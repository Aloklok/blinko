import dotenv from "dotenv";
import path from "path";
// Load env from root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { prisma } from "../prisma";
import { FileService } from "../lib/files";
import sharp from "sharp";
import fs from "fs/promises";
import { getGlobalConfig } from "../routerTrpc/config";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not defined. Please check your .env file.");
    process.exit(1);
}

// Configuration
const BATCH_SIZE = 10;
const WEBP_QUALITY = 80;

async function repairImages() {
    console.log("Starting image repair and WebP migration...");

    const MIGRATION_MARKER = "_bmig_";

    const attachments = await prisma.attachments.findMany({
        where: {
            OR: [
                { type: { startsWith: "image/" } },
                { type: { startsWith: "audio/" } },
                { type: { startsWith: "video/" } },
                { type: "application/octet-stream" },
                { name: { endsWith: ".mp4", mode: 'insensitive' } },
                { name: { endsWith: ".webm", mode: 'insensitive' } },
                { name: { endsWith: ".wav", mode: 'insensitive' } },
            ]
        }
    });

    console.log(`Found ${attachments.length} potential records to evaluate.`);

    const config = await getGlobalConfig({ useAdmin: true });

    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < attachments.length; i += BATCH_SIZE) {
        const batch = attachments.slice(i, i + BATCH_SIZE);
        console.log(`\n=== Batch ${i / BATCH_SIZE + 1} (${batch.length} items) ===`);

        for (const attachment of batch) {
            try {
                const ext = path.extname(attachment.name).toLowerCase();
                const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
                const isMedia = ['.mp4', '.webm', '.wav', '.mp3'].includes(ext);
                const hasMarker = attachment.path.includes(MIGRATION_MARKER);

                // 1. Skip Logic with Verbose Logging
                if (isImage && attachment.type === "image/webp" && hasMarker) {
                    console.log(`[SKIP] Already Migrated Image (WebP): ${attachment.name}`);
                    skippedCount++;
                    continue;
                }

                if (isMedia && (attachment.type === "audio/mp4" || attachment.type === "audio/webm") && hasMarker) {
                    console.log(`[SKIP] Already Migrated Media (${attachment.type}): ${attachment.name}`);
                    skippedCount++;
                    continue;
                }

                console.log(`[AUDIT] Analyzing: ${attachment.name} | Type: ${attachment.type} | Path: ${attachment.path}`);

                // 2. Download original file
                let buffer: Buffer;
                try {
                    const decodedPath = decodeURIComponent(attachment.path);
                    buffer = await FileService.getFileBuffer(decodedPath);
                } catch (downloadErr: any) {
                    if (downloadErr.name === 'NoSuchKey' || downloadErr.Code === 'NoSuchKey') {
                        console.warn(`[WARN] FILE MISSING in storage: ${attachment.name}`);
                        skippedCount++;
                        continue;
                    }
                    throw downloadErr;
                }

                let finalBuffer = buffer;
                let newName = attachment.name;
                let newType = attachment.type;

                // 3. Transformation Logic
                if (isImage) {
                    console.log(`   -> Converting [${ext}] to WebP...`);
                    finalBuffer = await sharp(buffer)
                        .webp({ quality: WEBP_QUALITY })
                        .toBuffer();
                    newName = attachment.name.replace(new RegExp(`\\${ext}$`, 'i'), '.webp');
                    newType = "image/webp";
                } else if (ext === '.mp4') {
                    console.log(`   -> Setting Content-Type to audio/mp4...`);
                    newType = "audio/mp4";
                } else if (ext === '.webm') {
                    console.log(`   -> Setting Content-Type to audio/webm...`);
                    newType = "audio/webm";
                } else if (attachment.type === 'application/octet-stream') {
                    if (ext === '.png') newType = 'image/png';
                    else if (ext === '.jpg' || ext === '.jpeg') newType = 'image/jpeg';
                    else {
                        console.log(`   -> No rule for octet-stream ${ext}, skipping.`);
                        skippedCount++;
                        continue;
                    }
                } else {
                    console.log(`   -> Non-target file, skipping.`);
                    skippedCount++;
                    continue;
                }

                // 4. Update Storage & Database
                if (attachment.path.includes("/api/s3file/")) {
                    const { s3ClientInstance } = await FileService.getS3Client();
                    const oldKey = decodeURIComponent(attachment.path.replace("/api/s3file/", ""));
                    const dirPath = path.dirname(oldKey);

                    let newKey;
                    if (hasMarker) {
                        newKey = oldKey; // Keep key if marker exists but type was wrong (unlikely but safe)
                    } else {
                        const baseName = path.basename(newName, path.extname(newName));
                        newKey = (dirPath === "." ? "" : dirPath + "/") + `${baseName}${MIGRATION_MARKER}${Date.now()}${path.extname(newName)}`;
                    }

                    console.log(`   -> Uploading to R2: ${newKey}`);
                    await s3ClientInstance.send(new PutObjectCommand({
                        Bucket: config.s3Bucket,
                        Key: newKey,
                        Body: finalBuffer,
                        ContentType: newType,
                    }));

                    await prisma.attachments.update({
                        where: { id: attachment.id },
                        data: {
                            path: `/api/s3file/${newKey}`,
                            name: newName,
                            type: newType,
                            size: finalBuffer.length
                        }
                    });

                    if (oldKey !== newKey) {
                        await s3ClientInstance.send(new DeleteObjectCommand({
                            Bucket: config.s3Bucket,
                            Key: oldKey
                        }));
                    }

                } else if (attachment.path.includes("/api/file/")) {
                    const oldRelativePath = decodeURIComponent(attachment.path.replace("/api/file/", ""));
                    const oldFullPath = FileService.validateAndResolvePath(oldRelativePath);
                    const dirPath = path.dirname(oldRelativePath);

                    let newRelativePath = oldRelativePath;
                    if (!hasMarker) {
                        const baseName = path.basename(newName, path.extname(newName));
                        newRelativePath = (dirPath === "." ? "" : dirPath + "/") + `${baseName}${MIGRATION_MARKER}${Date.now()}${path.extname(newName)}`;
                    }
                    const newFullPath = FileService.validateAndResolvePath(newRelativePath);

                    console.log(`   -> Saving to Disk: ${newRelativePath}`);
                    await fs.writeFile(newFullPath, finalBuffer);

                    await prisma.attachments.update({
                        where: { id: attachment.id },
                        data: {
                            path: `/api/file/${newRelativePath}`,
                            name: newName,
                            type: newType,
                            size: finalBuffer.length
                        }
                    });

                    if (oldFullPath !== newFullPath) {
                        await fs.unlink(oldFullPath);
                    }
                }

                console.log(`   [SUCCESS] Migrated ${attachment.name}`);
                processedCount++;
            } catch (err) {
                console.error(`   [FAILED] ${attachment.name}:`, err);
            }
        }
        // Small delay between batches to let DB pool breathe
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\nMigration completed! Summary: Processed: ${processedCount}, Skipped: ${skippedCount}`);
}

repairImages().catch(console.error);
