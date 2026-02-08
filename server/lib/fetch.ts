import { getGlobalConfig } from "../routerTrpc/config";
import { getProxyUrl } from "./proxyConfig";

interface FetchOptions extends RequestInit {
    timeout?: number;
    params?: Record<string, string>;
    responseType?: 'json' | 'text' | 'blob' | 'stream' | 'arrayBuffer';
}

/**
 * A wrapper around native fetch to mimic axios-like behavior
 * Supports timeout, query params, and simplified response handling.
 * Leverages Bun's native fetch and proxy support.
 */
export class ServerFetch {
    private static async request<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
        const { timeout = 60000, params, responseType = 'json', ...init } = options;

        // Get Proxy URL from dynamic config
        const proxyUrl = await getProxyUrl();

        // Handle Query Params
        let requestUrl = url;
        if (params) {
            const urlObj = new URL(url);
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    urlObj.searchParams.append(key, String(value));
                }
            });
            requestUrl = urlObj.toString();
        }

        // Handle Timeout
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(requestUrl, {
                ...init,
                signal: controller.signal,
                // Bun native proxy support
                proxy: proxyUrl || undefined
            });

            clearTimeout(id);

            if (!response.ok) {
                let errorBody;
                try {
                    errorBody = await response.text();
                } catch (e) {
                    errorBody = response.statusText;
                }
                throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
            }

            if (responseType === 'stream') {
                return response.body as unknown as T;
            }

            if (responseType === 'arrayBuffer') {
                return await response.arrayBuffer() as unknown as T;
            }

            if (responseType === 'blob') {
                return await response.blob() as unknown as T;
            }

            if (responseType === 'text') {
                return await response.text() as unknown as T;
            }

            // Default to JSON
            const text = await response.text();
            try {
                return text ? JSON.parse(text) : {};
            } catch (e) {
                // Fallback for non-json responses that were expected to be json
                return text as unknown as T;
            }
        } catch (error: any) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }

    static get<T = any>(url: string, options?: FetchOptions) {
        return this.request<T>(url, { ...options, method: 'GET' });
    }

    static post<T = any>(url: string, data?: any, options?: FetchOptions) {
        const headers = new Headers(options?.headers);
        let body = data;

        if (data && typeof data === 'object' && !(data instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(data);
        }

        return this.request<T>(url, { ...options, method: 'POST', headers, body });
    }

    static put<T = any>(url: string, data?: any, options?: FetchOptions) {
        const headers = new Headers(options?.headers);
        let body = data;

        if (data && typeof data === 'object' && !(data instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(data);
        }
        return this.request<T>(url, { ...options, method: 'PUT', headers, body });
    }

    static delete<T = any>(url: string, options?: FetchOptions) {
        return this.request<T>(url, { ...options, method: 'DELETE' });
    }
}
