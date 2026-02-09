import express, { Request, Response } from 'express';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileService } from "../../lib/files";
import sharp from "sharp";
import mime from "mime-types";
import { getUserFromRequest } from "../../lib/helper";
import { prisma } from "../../prisma";

const router = express.Router();

const MAX_PRESIGNED_URL_EXPIRY = 604800 - (60 * 60 * 24);
const CACHE_DURATION = MAX_PRESIGNED_URL_EXPIRY;

function isImage(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

async function generateThumbnail(s3ClientInstance: any, config: any, fullPath: string) {
  try {
    console.log(`[Thumbnail] Fetching: Bucket=${config.s3Bucket}, Key=${fullPath}`);
    const command = new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: fullPath
    });

    const response = await s3ClientInstance.send(command);

    if (!response.Body) {
      throw new Error('S3 response body is null');
    }

    // Diagnostic: Check if S3 actually has data
    if (response.ContentLength === 0) {
      throw new Error(`S3 reported 0 bytes for this file (Key: ${fullPath}). skipping thumbnail.`);
    }

    // In Bun, this is the most reliable way to read the stream from AWS SDK
    const bodyContents = await (response.Body as any).transformToByteArray();
    const buffer = Buffer.from(bodyContents);

    console.log(`[Thumbnail] Read ${buffer.length} bytes for ${fullPath}.`);

    if (buffer.length === 0) {
      throw new Error(`Downloaded 0 bytes despite ContentLength ${response.ContentLength}`);
    }

    const thumbnail = await sharp(buffer, { failOnError: false })
      .rotate()
      .resize(500, 500, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true
      })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.warn('[Thumbnail Warning]', error.message);
    throw error;
  }
}

/**
 * @swagger
 * /api/s3file/{path}:
 *   get:
 *     tags: 
 *       - File
 *     summary: Get S3 File
 *     operationId: getS3File
 *     parameters:
 *       - in: path
 *         name: path
 *         schema:
 *           type: string
 *         required: true
 *         description: Path to the S3 file
 *       - in: query
 *         name: thumbnail
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Whether to return a thumbnail (only for images)
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 *     security:
 *       - bearer: []
 */
//@ts-ignore
router.get(/.*/, async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req);
    const { s3ClientInstance, config } = await FileService.getS3Client();
    const fullPath = decodeURIComponent(req.path.substring(1));
    const needThumbnail = req.query.thumbnail === 'true';

    // Security fix: Validate S3 file path and check user permissions
    // Check if the file exists in attachments and user has access
    if (!fullPath.includes('temp/')) {
      try {
        const myFile = await prisma.attachments.findFirst({
          where: {
            path: '/api/s3file/' + fullPath
          },
          include: {
            note: {
              select: {
                isShare: true,
                accountId: true
              }
            }
          }
        });

        // Security fix: If file is not in database, deny access (prevent access to unregistered files)
        if (!myFile) {
          return res.status(404).json({ error: "File not found" });
        }

        // Cache file type for later use in signed URL generation
        (req as any).myFileType = myFile.type;

        if (!user) {
          if (myFile.note?.isShare) {
            // Public shared file, allow access
          } else {
            return res.status(401).json({ error: "Unauthorized" });
          }
        } else {
          // Check if user owns the file or the note containing the file
          const isOwner = myFile.accountId === Number(user.id) ||
            myFile.note?.accountId === Number(user.id) ||
            user.role === 'superadmin';

          if (!myFile.note?.isShare && !isOwner) {
            return res.status(401).json({ error: "Unauthorized" });
          }
        }
      } catch (error) {
        console.error('Error checking S3 file permissions:', error);
        return res.status(500).json({ error: "Error checking file permissions" });
      }
    } else {
      // For temp files, require authentication
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    if (isImage(fullPath) && needThumbnail) {
      try {
        const thumbnail = await generateThumbnail(s3ClientInstance, config, fullPath);
        const filename = decodeURIComponent(fullPath.split('/').pop() || '');

        res.set({
          "Content-Type": mime.lookup(filename) || "image/jpeg",
          "Cache-Control": "public, max-age=31536000",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "X-Content-Type-Options": "nosniff",
        });

        return res.send(thumbnail);
      } catch (error) {
        console.error('Failed to generate thumbnail, falling back to original:', error);
      }
    }

    // Redirect to custom domain if configured
    if (config.s3CustomDomain) {
      const customDomain = config.s3CustomDomain.replace(/\/$/, '');
      const originalToken = req.query.token as string;
      const redirectUrl = originalToken
        ? `${customDomain}/${fullPath}?token=${originalToken}`
        : `${customDomain}/${fullPath}`;

      console.log(`[S3] Redirecting to CDN: ${fullPath}`);

      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
        'Cache-Control': `public, max-age=${CACHE_DURATION}, immutable`,
        'Expires': new Date(Date.now() + CACHE_DURATION * 1000).toUTCString()
      });
      return res.redirect(302, redirectUrl);
    }

    console.log('Falling back to signed URL for:', fullPath);
    //@important if @aws-sdk/client-s3 is not 3.693.0, has 403 error
    const command = new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: fullPath,
      ResponseCacheControl: `public, max-age=${CACHE_DURATION}, immutable`,
      ResponseContentType: (req as any).myFileType || undefined
    });

    const signedUrl = await getSignedUrl(s3ClientInstance as any, command as any, {
      expiresIn: MAX_PRESIGNED_URL_EXPIRY
    });

    res.set({
      'Cache-Control': `public, max-age=${CACHE_DURATION}, immutable`,
      'Expires': new Date(Date.now() + CACHE_DURATION * 1000).toUTCString()
    });

    return res.redirect(signedUrl);
  } catch (error) {
    console.error('[S3] Access error:', error.message);
    return res.status(404).json({
      error: 'File not found',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

