import { router, authProcedure, publicProcedure, superAdminAuthMiddleware } from '../middleware';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '../prisma';
import fs from 'fs/promises';
import path from 'path';
// import axios from 'axios'; // Removed
import { ServerFetch } from '@server/lib/fetch';
import yauzl from 'yauzl-promise';
import { createWriteStream } from 'fs';
import { pluginInfoSchema, installPluginSchema } from '../../shared/lib/types';
import { pluginSchema } from '@shared/lib/prismaZodType';
import { cache } from '@shared/lib/cache';
import { existsSync } from 'fs';
import { getHttpCacheKey, getWithProxy } from '@server/lib/proxy';
import pathIsInside from 'path-is-inside';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const getPluginRootDir = () => {
  if (process.env.NODE_ENV !== 'production' && process.cwd().endsWith('server')) {
    return path.join(process.cwd(), '../plugins');
  }
  return path.join(process.cwd(), 'plugins');
}

/**
 * Ensures the plugin directory exists
 */
const ensurePluginDir = async () => {
  const dir = getPluginRootDir();
  await ensureDirectoryExists(dir);
};

/**
 * Ensures that a directory exists
 */
const ensureDirectoryExists = async (dirPath: string) => {
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

/**
 * Write a file ensuring its directory exists
 */
const writeFileWithDir = async (filePath: string, content: string) => {
  const dirPath = path.dirname(filePath);
  await ensureDirectoryExists(dirPath);
  await fs.writeFile(filePath, content);
};

const scanCssFiles = async (dirPath: string): Promise<string[]> => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const cssFiles: string[] = [];

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        const subDirCssFiles = await scanCssFiles(fullPath);
        cssFiles.push(...subDirCssFiles.map(subFile => path.join(file.name, subFile)));
      } else if (file.name.endsWith('.css')) {
        cssFiles.push(file.name);
      }
    }

    return cssFiles;
  } catch (error) {
    console.error('Error scanning CSS files:', error);
    return [];
  }
};

async function downloadWithRetry(url: string, filePath: string, retries = MAX_RETRIES): Promise<void> {
  try {
    const data = await ServerFetch.get<ArrayBuffer>(url, {
      responseType: 'arrayBuffer',
      timeout: 30000, // 30 seconds timeout
    });
    // Convert ArrayBuffer to Buffer for file writing
    await fs.writeFile(filePath, Buffer.from(data));
  } catch (error: any) {
    if (retries > 0) {
      // Retry on any error since we don't have fine-grained error codes from fetch yet
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return downloadWithRetry(url, filePath, retries - 1);
    }
    throw error;
  }
}


const getPluginDir = (pluginName: string) => {
  return path.join(getPluginRootDir(), pluginName);
};

const cleanPluginDir = async (pluginName: string) => {
  const pluginDir = getPluginDir(pluginName);
  try {
    await fs.rm(pluginDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, ignore error
  }
};

const getPluginCssContentsInternal = async (pluginName: string) => {
  const pluginDir = getPluginDir(pluginName);
  if (!existsSync(pluginDir)) {
    return [];
  }

  const cssFiles = await scanCssFiles(pluginDir);
  const cssContents = await Promise.all(
    cssFiles.map(async (file) => {
      const filePath = path.join(pluginDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        fileName: file,
        content,
      };
    })
  );

  return cssContents;
};

export const pluginRouter = router({
  // Get CSS file contents for a plugin
  getPluginCssContents: authProcedure
    .input(
      z.object({
        pluginName: z.string(),
      }),
    )
    .output(z.array(z.object({
      fileName: z.string(),
      content: z.string()
    })))
    .query(async ({ input }) => {
      return await getPluginCssContentsInternal(input.pluginName);
    }),

  // Batch get CSS and configs for multiple plugins
  getPluginsInitializePayload: authProcedure
    .input(
      z.object({
        pluginNames: z.array(z.string()),
      }),
    )
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const userId = Number(ctx.id);
      const { pluginNames } = input;
      const result: Record<string, any> = {};

      for (const pluginName of pluginNames) {
        // 1. Get CSS
        const cssContents = await getPluginCssContentsInternal(pluginName);

        // 2. Get Config (Re-implementation to avoid router circular dependency)
        const configs = await prisma.config.findMany({
          where: {
            userId,
            key: {
              contains: `plugin_config_${pluginName}_`
            }
          }
        });

        const configMap = configs.reduce((acc, item) => {
          const key = item.key.replace(`plugin_config_${pluginName}_`, '');
          // Debug log for each config item
          // console.log(`[getPluginsInitializePayload] Config item for ${pluginName}: key=${key}, type=${typeof item.config}, value=${JSON.stringify(item.config)}`);

          if (typeof item.config === 'object' && item.config !== null && 'value' in item.config) {
            acc[key] = (item.config as { value: any }).value;
          } else {
            // Fallback for unexpected structure
            acc[key] = item.config;
          }
          return acc;
        }, {} as Record<string, any>);

        result[pluginName] = {
          cssContents,
          config: configMap
        };
      }

      console.log('[getPluginsInitializePayload] Final result keys:', Object.keys(result));
      return result;
    }),

  list: publicProcedure
    .query(async () => {
      return cache.wrap(
        `plugin-list-${await getHttpCacheKey()}`,
        async () => {
          try {
            const response = await getWithProxy('https://raw.githubusercontent.com/blinko-space/blinko-plugin-marketplace/main/index.json');
            return response.data;
          } catch (error) {
            console.error('Failed to fetch plugin list:', error);
            return [];
          }
        },
        {
          ttl: 5 * 60 * 1000,
        },
      );
    }),

  saveDevPlugin: authProcedure
    .use(superAdminAuthMiddleware)
    .input(
      z.object({
        code: z.string(),
        fileName: z.string(),
        metadata: z.any(),
      }),
    )
    .output(z.any())
    .mutation(async function ({ input }) {
      try {
        // Security fix: Validate fileName to prevent path traversal
        if (input.fileName.includes('..') || input.fileName.includes('\\..') || input.fileName.includes('/..')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file name: path traversal detected'
          });
        }

        if (path.isAbsolute(input.fileName)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file name: absolute paths are not allowed'
          });
        }

        // Clean dev plugin directory
        await cleanPluginDir('dev');

        // Rebuild directory and save file
        const devPluginDir = path.resolve(getPluginDir('dev'));
        await ensureDirectoryExists(devPluginDir);

        const fullFilePath = path.resolve(devPluginDir, input.fileName);

        // Security fix: Ensure the resolved path is within the dev plugin directory
        if (!pathIsInside(fullFilePath, devPluginDir)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied: file path outside plugin directory'
          });
        }

        await writeFileWithDir(fullFilePath, input.code);

        return { success: true };
      } catch (error) {
        console.error('Save dev plugin error:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw error;
      }
    }),

  // Save additional files for dev plugin
  saveAdditionalDevFile: authProcedure
    .use(superAdminAuthMiddleware)
    .input(
      z.object({
        filePath: z.string(),
        content: z.string(),
      }),
    )
    .output(z.any())
    .mutation(async function ({ input }) {
      try {
        // Security fix: Validate file path to prevent path traversal
        if (input.filePath.includes('..') || input.filePath.includes('\\..') || input.filePath.includes('/..')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file path: path traversal detected'
          });
        }

        // Security fix: Prevent absolute paths
        if (path.isAbsolute(input.filePath)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file path: absolute paths are not allowed'
          });
        }

        // Get plugin directory and resolve paths
        const devPluginDir = path.resolve(getPluginDir('dev'));
        const fullPath = path.resolve(devPluginDir, input.filePath);

        // Security fix: Ensure the resolved path is within the plugin directory
        if (!pathIsInside(fullPath, devPluginDir)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied: file path outside plugin directory'
          });
        }

        await writeFileWithDir(fullPath, input.content);

        return { success: true };
      } catch (error) {
        console.error(`Save additional dev file error: ${input.filePath}`, error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  installPlugin: authProcedure.input(installPluginSchema.extend({
    forceReinstall: z.boolean().optional().default(false)
  })).mutation(async ({ input }) => {
    const pluginDir = getPluginDir(input.name);
    const tempZipPath = path.join(pluginDir, 'release.zip');

    try {
      // Check if plugin already exists
      const existingPlugin = await prisma.plugin.findFirst({
        where: {
          metadata: {
            path: ['name'],
            equals: input.name,
          },
        },
      });

      if (existingPlugin) {
        const metadata = existingPlugin.metadata as { version: string };
        if (metadata.version !== input.version || input.forceReinstall) {
          await cleanPluginDir(input.name);
        } else {
          throw new Error(`Plugin v${metadata.version} is already installed`);
        }
      }

      // Create plugin directory and download files
      await ensureDirectoryExists(pluginDir);
      const releaseUrl = `${input.url}/releases/download/v${input.version}/release.zip`;

      // Use retry mechanism for download
      await downloadWithRetry(releaseUrl, tempZipPath);

      // Extract zip file
      const zipFile = await yauzl.open(tempZipPath);
      for await (const entry of zipFile) {
        if (entry.filename.endsWith('/')) {
          await fs.mkdir(path.join(pluginDir, entry.filename), { recursive: true });
          continue;
        }

        const targetPath = path.join(pluginDir, entry.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        const readStream = await entry.openReadStream();
        const writeStream = createWriteStream(targetPath);

        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream).on('finish', resolve).on('error', reject);
        });
      }

      await zipFile.close();
      await fs.unlink(tempZipPath);

      // Save to database
      return await prisma.$transaction(async (tx) => {
        if (existingPlugin) {
          return await tx.plugin.update({
            where: { id: existingPlugin.id },
            data: {
              metadata: input,
              path: `/plugins/${input.name}/index.js`,
            },
          });
        } else {
          return await tx.plugin.create({
            data: {
              metadata: input,
              path: `/plugins/${input.name}/index.js`,
              isUse: true,
              isDev: false,
            },
          });
        }
      });
    } catch (error: any) {
      // Clean up on error
      await cleanPluginDir(input.name);
      console.error('Install plugin error details:', {
        name: input.name,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Ensure we throw a proper Error or TRPCError
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }),

  getInstalledPlugins: publicProcedure.output(z.array(pluginSchema)).query(async () => {
    const plugins = await prisma.plugin.findMany();
    return plugins;
  }),

  uninstallPlugin: authProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const plugin = await prisma.plugin.findUnique({
          where: { id: input.id },
        });

        if (!plugin) {
          throw new Error('Plugin not found');
        }

        const metadata = plugin.metadata as { name: string };

        // Delete plugin files
        await cleanPluginDir(metadata.name);

        // Delete from database
        await prisma.plugin.delete({
          where: { id: input.id },
        });

        return { success: true };
      } catch (error) {
        console.error('Uninstall plugin error:', error);
        throw error;
      }
    }),
});

ensurePluginDir().catch(console.error);
