import { ServerFetch } from './fetch';
import { getProxyUrl, getHttpCacheKey } from './proxyConfig';
import { Context } from '@server/context';

// Re-export for compatibility
export { getProxyUrl, getHttpCacheKey };

/**
 * Creates a fetch function that uses the configured HTTP proxy
 * @returns A fetch function that works with the proxy settings
 */
export async function fetchWithProxy(): Promise<typeof fetch> {
  const proxyUrl = await getProxyUrl();
  if (!proxyUrl) {
    return fetch;
  }

  // Bun native proxy support in fetch
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    return fetch(url, {
      ...init,
      proxy: proxyUrl,
    });
  }) as typeof fetch;
}

/**
 * @deprecated Use ServerFetch.get instead
 */
export async function getWithProxy(
  url: string,
  options?: {
    ctx?: Context;
    useAdmin?: boolean;
    config?: any; // Was AxiosRequestConfig
  },
) {
  try {
    const { config = {} } = options || {};
    // Map axios config to ServerFetch options
    const fetchOptions = {
      ...config,
      timeout: config.timeout,
      params: config.params,
      headers: config.headers,
    }

    const data = await ServerFetch.get(url, fetchOptions);

    // Return mock Axios response structure for compatibility
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config
    };
  } catch (error: any) {
    console.error(`[Server] getWithProxy error for URL ${url}:`, error);
    return {
      error: true,
      data: null,
      status: (error as any).status || 500,
      statusText: 'Error',
      message: error.message || 'Unknown error',
      proxyInfo: {},
      url
    };
  }
}

/**
 * @deprecated Use ServerFetch.post instead
 */
export async function postWithProxy(
  url: string,
  data?: any,
  options?: {
    ctx?: Context;
    useAdmin?: boolean;
    config?: any; // Was AxiosRequestConfig
  },
) {
  try {
    const { config = {} } = options || {};
    // Map axios config to ServerFetch options
    const fetchOptions = {
      ...config,
      timeout: config.timeout,
      params: config.params,
      headers: config.headers,
    }

    const responseData = await ServerFetch.post(url, data, fetchOptions);

    // Return mock Axios response structure for compatibility
    return {
      data: responseData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config
    };
  } catch (error: any) {
    console.error(`[Server] postWithProxy error for URL ${url}:`, error);
    return {
      error: true,
      data: null,
      status: (error as any).status || 500,
      statusText: 'Error',
      message: error.message || 'Unknown error',
      proxyInfo: {},
      url
    };
  }
}