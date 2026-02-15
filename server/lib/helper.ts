// import axios from "axios";
import { ServerFetch } from "@server/lib/fetch";
import { authenticator } from 'otplib';
import crypto from 'crypto';
import { Feed } from "feed";
import jwt from 'jsonwebtoken';
import { prisma } from "@server/prisma";
import { User } from "@server/context";
// import { getGlobalConfig } from "@server/routerTrpc/config";
import { uint8ArrayToBase64, uint8ArrayToHex } from 'uint8array-extras';

export const SendWebhook = async (data: any, webhookType: string, ctx: any) => {
  try {
    const configItem = await prisma.config.findFirst({ where: { key: 'webhookEndpoint' } });
    if (!configItem) return;

    // @ts-ignore
    const webhookEndpoint = configItem.config?.value as string;

    if (webhookEndpoint) {
      await ServerFetch.post(webhookEndpoint, { data, webhookType, activityType: `blinko.note.${webhookType}` })
    }
  } catch (error) {
    console.log('request webhook error:', error)
  }
}

export function generateTOTP(): string {
  return authenticator.generateSecret();
}

export function generateTOTPQRCode(username: string, secret: string): string {
  return authenticator.keyuri(username, 'Blinko', secret);
}

export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch (err) {
    return false;
  }
}


export async function generateFeed(userId: number, origin: string, rows: number = 20) {
  const hasAccountId: any = {}
  if (userId != 0) {
    hasAccountId.accountId = userId
  }
  const notes = await prisma.notes.findMany({
    where: {
      ...hasAccountId,
      isShare: true,
      sharePassword: "",
      OR: [
        {
          shareExpiryDate: {
            gt: new Date()
          }
        },
        {
          shareExpiryDate: null
        }
      ]
    },
    orderBy: { updatedAt: 'desc' },
    take: rows,
    select: {
      content: true,
      updatedAt: true,
      shareEncryptedUrl: true,
      tags: {
        include: { tag: true }
      },
      account: {
        select: {
          name: true
        }
      },
    }
  });

  const feed = new Feed({
    title: "Blinko Public Notes",
    description: "Latest public notes",
    id: origin,
    link: origin,
    copyright: "All rights reserved",
    updated: new Date(),
    image: `${origin}/logo-dark-title.png`,
    feedLinks: {
      atom: `${origin}/api/rss/${userId}/atom`,
      rss: `${origin}/api/rss/${userId}/rss`
    },
  });

  notes.forEach(note => {
    const title = note.content.split('\n')[0] || 'Untitled';
    feed.addItem({
      title,
      link: `${origin}/share/${note.shareEncryptedUrl}`,
      description: note.content.substring(0, 200) + '...',
      date: note.updatedAt,
      author: [{
        name: note.account!.name
      }],
      category: note.tags.map(i => {
        return {
          name: i.tag.name
        }
      })
    });
  });

  return feed;
}

let cachedSecret: string | null = null;
let secretPromise: Promise<string> | null = null;

export const getNextAuthSecret = async () => {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret !== 'my_ultra_secure_nextauth_secret') {
    return envSecret;
  }

  if (cachedSecret) {
    return cachedSecret;
  }

  // Use a promise to handle concurrent requests and avoid multiple DB calls
  if (secretPromise) {
    return secretPromise;
  }

  secretPromise = (async () => {
    const configKey = 'JWT_SECRET';
    const savedSecret = await prisma.config.findFirst({
      where: { key: configKey }
    });

    let secret: string;
    if (savedSecret) {
      // @ts-ignore
      secret = savedSecret.config.value as string;
    } else {
      secret = uint8ArrayToBase64(crypto.randomBytes(32));
      await prisma.config.create({
        data: {
          key: configKey,
          config: { value: secret }
        }
      });
    }

    cachedSecret = secret;
    secretPromise = null;
    return secret;
  })();

  return secretPromise;
}

export const generateToken = async (user: any, twoFactorVerified = false) => {
  const secret = await getNextAuthSecret();
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role || 'user',
      twoFactorVerified,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30),
      iat: Math.floor(Date.now() / 1000)
    },
    secret,
    { algorithm: 'HS256' }
  );
};

export const verifyToken = async (token: string) => {
  const secret = await getNextAuthSecret();
  try {
    const decoded = jwt.verify(token, secret) as User;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

export const getTokenFromRequest = async (req: ExpressRequest) => {
  try {
    if (req.headers && typeof req.headers === 'object') {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const tokenData = await verifyToken(token);
        if (tokenData) return { ...tokenData, id: tokenData.sub, token };
      }
    }

    if (req.query && req.query.token) {
      const token = req.query.token as string;
      const tokenData = await verifyToken(token);
      if (tokenData) return { ...tokenData, id: tokenData.sub, token };
    }

    return null;
  } catch (error) {
    console.error('Token retrieval error:', error);
    return null;
  }
}

export const getAllPathTags = async (accountId: number, onlyLeaves: boolean = false) => {
  const flattenTags = await prisma.tag.findMany({ where: { accountId } });
  const hasHierarchy = flattenTags.some(tag => tag.parent != null && tag.parent !== 0);
  if (hasHierarchy) {
    const buildHashTagTreeFromDb = (tags: any[]) => {
      const tagMap = new Map();
      const rootNodes: any[] = [];
      tags.forEach(tag => {
        tagMap.set(tag.id, { ...tag, children: [] });
      });
      tags.forEach(tag => {
        if (tag.parent) {
          const parentNode = tagMap.get(tag.parent);
          if (parentNode) {
            parentNode.children.push(tagMap.get(tag.id));
          } else {
            rootNodes.push(tagMap.get(tag.id));
          }
        } else {
          rootNodes.push(tagMap.get(tag.id));
        }
      });

      return rootNodes;
    };

    const generateTagPaths = (node: any, parentPath = '') => {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : `#${node.name}`;
      const paths: string[] = [];

      const hasChildren = node.children && node.children.length > 0;

      // If NOT only-leaves, OR it's a leaf node, add it.
      if (!onlyLeaves || !hasChildren) {
        paths.push(currentPath);
      }

      if (hasChildren) {
        node.children.forEach((child: any) => {
          const childPaths = generateTagPaths(child, currentPath);
          paths.push(...childPaths);
        });
      }

      return paths;
    };

    const listTags = buildHashTagTreeFromDb(flattenTags);
    let pathTags: string[] = [];

    listTags.forEach(node => {
      pathTags = pathTags.concat(generateTagPaths(node));
    });

    return pathTags;
  } else {
    const tagPathMap = new Map();
    const tagSet = new Set<string>();
    flattenTags.forEach(tag => {
      const tagName = tag.name.startsWith('#') ? tag.name.substring(1) : tag.name;
      tagSet.add(tagName);
      tagPathMap.set(tagName, `#${tagName}`);
    });

    // If onlyLeaves is true, we should filter out tags that imply a parent relationship
    // For flat text tags like "A" and "A/B", "A" is a parent of "A/B".
    if (onlyLeaves) {
      const sortedTags = [...tagSet].sort();
      const leafTags: string[] = [];

      // Simple heuristic: if "A" and "A/B" exist, "A/B" starts with "A/".
      for (let i = 0; i < sortedTags.length; i++) {
        const current = sortedTags[i];
        const next = sortedTags[i + 1];

        // If next exists and starts with current + '/', then current is a parent.
        if (next && next.startsWith(current + '/')) {
          continue; // Skip current (parent)
        }
        leafTags.push(`#${current}`);
      }
      return leafTags;
    }

    const pathTags: string[] = [];
    tagSet.forEach((tag: string) => {
      pathTags.push(`#${tag}`);
      if (tag.includes('/')) {
        const parts = tag.split('/');
        let currentPath = '#' + parts[0];
        pathTags.push(currentPath);

        for (let i = 1; i < parts.length; i++) {
          currentPath += '/' + parts[i];
          pathTags.push(currentPath);
        }
      }
    });
    return [...new Set(pathTags)];
  }
};


export const resetSequences = async () => {
  await prisma.$executeRaw`SELECT setval('notes_id_seq', (SELECT MAX(id) FROM "notes") + 1);`;
  await prisma.$executeRaw`SELECT setval('tag_id_seq', (SELECT MAX(id) FROM "tag") + 1);`;
  await prisma.$executeRaw`SELECT setval('"tagsToNote_id_seq"', (SELECT MAX(id) FROM "tagsToNote") + 1);`;
  await prisma.$executeRaw`SELECT setval('attachments_id_seq', (SELECT MAX(id) FROM "attachments") + 1);`;
}

export const getUserFromSession = (req: any) => {
  if (req && req.isAuthenticated && req.isAuthenticated() && req.user) {
    const user = req.user;
    return {
      id: user.id.toString(),
      sub: user.id.toString(),
      name: user.name,
      role: user.role || 'user',
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 * 1000,
      iat: Math.floor(Date.now() / 1000),
    };
  }
  return null;
};

export const getUserFromRequest = async (req: any) => {
  const sessionUser = getUserFromSession(req);
  if (sessionUser) {
    return sessionUser;
  }

  return await getTokenFromRequest(req);
};

// 生成带token的URL
export const generateUrlWithToken = async (url: string, user: any) => {
  const token = await generateToken(user);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${token}`;
}

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = uint8ArrayToHex(crypto.randomBytes(16));
    crypto.pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve('pbkdf2:' + salt + ':' + uint8ArrayToHex(derivedKey));
    });
  });
}

export async function verifyPassword(inputPassword: string, hashedPassword: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [prefix, salt, hash] = hashedPassword.split(':');
    if (prefix !== 'pbkdf2') {
      return resolve(false);
    }
    crypto.pbkdf2(inputPassword, salt!, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(uint8ArrayToHex(derivedKey) === hash);
    });
  });
}

