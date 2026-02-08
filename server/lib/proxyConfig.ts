import { getGlobalConfig } from '@server/routerTrpc/config';
import { Context } from '@server/context';
import { URL } from 'url';

export async function getProxyUrl(options?: { ctx?: Context; useAdmin?: boolean }): Promise<string | null> {
    const { ctx, useAdmin = true } = options || {};

    const globalConfig = await getGlobalConfig({ ctx, useAdmin });

    if (!globalConfig.isUseHttpProxy || !globalConfig.httpProxyHost) {
        return null;
    }

    let proxyHost = globalConfig.httpProxyHost;
    const proxyPort = globalConfig.httpProxyPort || 8080;

    // Detect protocol based on the URL prefix
    let protocol = 'http'; // Default protocol
    if (proxyHost.includes('://')) {
        try {
            const url = new URL(proxyHost);
            protocol = url.protocol.replace(':', ''); // Remove the colon from protocol (e.g., "https:" → "https")
            proxyHost = url.hostname;
        } catch (e) {
            // If URL parsing fails, try extracting protocol with regex
            const protocolMatch = proxyHost.match(/^(https?):\/\//);
            if (protocolMatch && protocolMatch[1]) {
                protocol = protocolMatch[1];
            }
            proxyHost = proxyHost.replace(/^(https?:\/\/)/, '');
        }
    }

    if (globalConfig.httpProxyUsername && globalConfig.httpProxyPassword) {
        return `${protocol}://${globalConfig.httpProxyUsername}:${globalConfig.httpProxyPassword}@${proxyHost}:${proxyPort}`;
    }

    return `${protocol}://${proxyHost}:${proxyPort}`;
}

export async function getHttpCacheKey(options?: { ctx?: Context; useAdmin?: boolean }): Promise<string> {
    const { ctx, useAdmin = true } = options || {};
    const globalConfig = await getGlobalConfig({ ctx, useAdmin });
    return `${globalConfig.isUseHttpProxy}-${globalConfig.httpProxyHost}-${globalConfig.httpProxyPort}-${globalConfig.httpProxyUsername}-${globalConfig.httpProxyPassword}`;
}
