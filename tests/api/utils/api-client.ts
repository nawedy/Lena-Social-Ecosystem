import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Load environment variables
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '30000', 10);

// Create axios instance with default config
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    // Add any default headers or transformations here
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common responses
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: any) => {
    if (error.response) {
      // Log API errors in test environment
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        url: error.config.url,
        method: error.config.method
      });
    }
    return Promise.reject(error);
  }
);

/**
 * Helper function to handle file uploads
 */
export async function uploadFile(
  endpoint: string,
  file: Buffer | Blob,
  metadata: Record<string, any> = {},
  config: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Append metadata as JSON string
  if (Object.keys(metadata).length > 0) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  return api.post(endpoint, formData, {
    ...config,
    headers: {
      ...config.headers,
      'Content-Type': 'multipart/form-data'
    }
  });
}

/**
 * Helper function to handle paginated requests
 */
export async function getPaginatedResults<T>(
  endpoint: string,
  params: Record<string, any> = {},
  config: AxiosRequestConfig = {}
): Promise<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const response = await api.get(endpoint, {
    ...config,
    params: {
      page: 1,
      limit: 10,
      ...params
    }
  });

  return response.data;
}

/**
 * Helper function to handle bulk operations
 */
export async function bulkOperation(
  endpoint: string,
  items: any[],
  config: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  return api.post(endpoint, { items }, config);
}

/**
 * Helper function to retry failed requests
 */
export async function retryRequest(
  request: () => Promise<AxiosResponse>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<AxiosResponse> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

/**
 * Helper function to handle streaming responses
 */
export async function getStream(
  endpoint: string,
  config: AxiosRequestConfig = {}
): Promise<NodeJS.ReadableStream> {
  const response = await api.get(endpoint, {
    ...config,
    responseType: 'stream'
  });
  
  return response.data;
}

/**
 * Helper function to handle API health check
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await api.get('/health');
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to get API version
 */
export async function getApiVersion(): Promise<string> {
  const response = await api.get('/version');
  return response.data.version;
}

// Export types for better type checking
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse }; 