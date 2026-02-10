import { router, authProcedure, demoAuthMiddleware } from '@server/middleware';
import { z } from 'zod';
import { prisma } from '@server/prisma';
import { attachmentSchema } from '@shared/lib/prismaZodType';
import { listAttachmentsInFolder, searchAttachments } from "@server/generated/client/sql"

const mapAttachmentResult = (item: any) => ({
  id: item.id,
  path: item.path,
  name: item.name,
  size: item.size?.toString() || null,
  type: item.type,
  isShare: item.isShare,
  sharePassword: item.sharePassword,
  noteId: item.noteId,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  isFolder: item.is_folder || false,
  folderName: item.folder_name || null
});

export const attachmentsRouter = router({
  createFolder: authProcedure
    .input(z.object({
      folderName: z.string(),
      parentFolder: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { folderName, parentFolder } = input;
      const perfixPath = parentFolder ? `${parentFolder},${folderName}` : folderName;

      return await prisma.attachments.create({
        data: {
          name: folderName,
          path: '',
          perfixPath,
          depth: parentFolder ? parentFolder.split(',').length + 1 : 1,
          accountId: Number(ctx.id)
        }
      });
    }),

  list: authProcedure
    .input(z.object({
      page: z.number().default(1),
      size: z.number().default(10),
      searchText: z.string().default('').optional(),
      folder: z.string().optional()
    }))
    .query(async function ({ input, ctx }) {
      const { page, size, searchText, folder } = input;
      const skip = (page - 1) * size;
      const accountId = Number(ctx.id);

      if (searchText && !folder) {
        const querySearch = `%${searchText}%`.toLowerCase();
        const items = await prisma.$queryRawTyped(searchAttachments(accountId, querySearch, BigInt(size), BigInt(skip)));
        const total = await prisma.attachments.count({
          where: {
            OR: [
              { name: { contains: searchText, mode: 'insensitive' } },
              { path: { contains: searchText, mode: 'insensitive' } },
            ],
            note: { accountId },
          },
        });
        return {
          items: items.map(mapAttachmentResult),
          total,
        };
      }

      const folderPath = folder ? folder.split('/').join(',') : '';
      const folderWithSuffix = folderPath ? `${folderPath},%` : '%';

      const results = await prisma.$queryRawTyped(listAttachmentsInFolder(folderPath, accountId, folderWithSuffix, BigInt(size), BigInt(skip)));
      const total = await prisma.attachments.count({
        where: {
          accountId,
          perfixPath: folderPath
        }
      });

      return {
        items: results.map(mapAttachmentResult),
        total
      };
    }),

  rename: authProcedure
    .input(z.object({
      id: z.number().optional(),
      newName: z.string(),
      isFolder: z.boolean().optional(),
      oldFolderPath: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, newName, isFolder, oldFolderPath } = input;

      if (!isFolder && (newName.includes('/') || newName.includes('\\'))) {
        throw new Error('File names cannot contain path separators');
      }

      if (isFolder && oldFolderPath) {
        const folders = oldFolderPath.split(',');
        folders[folders.length - 1] = newName;
        const newFolderPath = folders.join(',');

        // Update all attachments that are in this folder or subfolders
        await prisma.$executeRaw`
          UPDATE attachments 
          SET "perfixPath" = REPLACE("perfixPath", ${oldFolderPath}, ${newFolderPath})
          WHERE "perfixPath" LIKE ${oldFolderPath + '%'}
          AND "accountId" = ${Number(ctx.id)}
        `;

        return { success: true };
      }

      return await prisma.attachments.update({
        where: { id, accountId: Number(ctx.id) },
        data: { name: newName }
      });
    }),

  delete: authProcedure
    .input(z.object({
      id: z.number().optional(),
      isFolder: z.boolean().optional(),
      folderPath: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, isFolder, folderPath } = input;

      if (isFolder && folderPath) {
        await prisma.attachments.deleteMany({
          where: {
            perfixPath: {
              startsWith: folderPath
            },
            accountId: Number(ctx.id)
          }
        });
        return { success: true };
      }

      return await prisma.attachments.delete({
        where: { id, accountId: Number(ctx.id) }
      });
    }),
});
