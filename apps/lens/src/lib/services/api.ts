import { supabase } from '$lib/supabase';
import type { ApiResponse, PaginatedResponse } from '$lib/types';

export class ApiService {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make a GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      const queryString = params ? `?${new URLSearchParams(params)}` : '';
      const response = await fetch(`${this.baseUrl}${endpoint}${queryString}`, {
        method: 'GET',
        headers: this.defaultHeaders,
        credentials: 'include'
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.defaultHeaders,
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this.defaultHeaders,
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: this.defaultHeaders,
        credentials: 'include'
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(file: File, options?: {
    onProgress?: (progress: number) => void;
    path?: string;
  }): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from('media')
        .upload(`${options?.path || ''}/${crypto.randomUUID()}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Get paginated results
   */
  async getPaginated<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const response = await this.get<T[]>(endpoint, {
      ...params,
      page: params?.page || 1,
      per_page: params?.per_page || 20
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return {
      items: response.data || [],
      page: response.meta?.page || 1,
      perPage: response.meta?.perPage || 20,
      total: response.meta?.total || 0,
      hasMore: response.meta?.hasMore || false
    };
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      return {
        error: {
          code: response.status.toString(),
          message: isJson ? data.message : 'An error occurred',
          details: isJson ? data.details : undefined
        }
      };
    }

    return {
      data: data as T,
      meta: this.extractMetadata(response)
    };
  }

  /**
   * Handle API error
   */
  private handleError(error: any): ApiResponse<any> {
    console.error('API Error:', error);
    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        details: error
      }
    };
  }

  /**
   * Extract pagination metadata from response headers
   */
  private extractMetadata(response: Response) {
    const page = parseInt(response.headers.get('x-page') || '1');
    const perPage = parseInt(response.headers.get('x-per-page') || '20');
    const total = parseInt(response.headers.get('x-total') || '0');
    const hasMore = page * perPage < total;

    return { page, perPage, total, hasMore };
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authorization token
   */
  clearAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }
}

// Create API service instance
export const api = new ApiService(); 