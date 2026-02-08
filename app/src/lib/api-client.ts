import { RootStore } from '@/store/root';
import { UserStore } from '@/store/user';
import { getBlinkoEndpoint } from './blinkoEndpoint';

interface RequestConfig extends RequestInit {
    onUploadProgress?: (progressEvent: ProgressEvent) => void;
    responseType?: 'json' | 'blob' | 'text';
}

class ApiClient {
    private getHeaders() {
        const userStore = RootStore.Get(UserStore);
        const token = userStore.tokenData.value?.token;
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    private async handleResponse(response: Response, config: RequestConfig = {}) {
        if (response.status === 401) {
            // Handle 401: Token expired or unauthorized
            console.warn('[ApiClient] 401 Unauthorized');
            // window.location.href = '/signin'; // Optional: Redirect
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (config.responseType === 'blob') {
            return response.blob();
        }
        if (config.responseType === 'text') {
            return response.text();
        }
        // Default to JSON
        // Check if content-type is json
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        }
        return response;
    }

    async get(url: string, config?: RequestConfig) {
        const response = await fetch(url, {
            ...config,
            method: 'GET',
            headers: {
                ...this.getHeaders(),
                ...config?.headers,
            },
        });
        return { data: await this.handleResponse(response, config) };
    }

    async post(url: string, data?: any, config?: RequestConfig) {
        const isFormData = data instanceof FormData;
        const headers: any = {
            ...this.getHeaders(),
            ...config?.headers,
        };

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            ...config,
            method: 'POST',
            headers,
            body: isFormData ? data : JSON.stringify(data),
        });
        return { data: await this.handleResponse(response, config) };
    }

    // Use XMLHttpRequest for upload progress support
    upload(url: string, formData: FormData, config?: RequestConfig) {
        return new Promise<{ data: any }>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);

            const headers = this.getHeaders() as Record<string, string>;
            Object.keys(headers).forEach(key => {
                xhr.setRequestHeader(key, headers[key]);
            });

            if (config?.onUploadProgress) {
                xhr.upload.onprogress = config.onUploadProgress;
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve({ data });
                    } catch (e) {
                        resolve({ data: xhr.responseText });
                    }
                } else {
                    if (xhr.status === 401) {
                        console.warn('[ApiClient] 401 Unauthorized (Upload)');
                    }
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network Error'));
            xhr.send(formData);
        });
    }
}

export const apiClient = new ApiClient();
