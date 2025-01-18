import { ComAtprotoServerCreateSession } from '@atproto/api';

export class ATProtoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ATProtoError';
  }

  static fromResponse(error: any): ATProtoError {
    if (error?.response?.data) {
      return new ATProtoError(
        error.response.data.message || 'Unknown error',
        error.response.data.error || 'UNKNOWN_ERROR',
        error.response.status || 500
      );
    }
    return new ATProtoError(
      error.message || 'Network error',
      'NETWORK_ERROR',
      0
    );
  }
}

export const isAuthError = (error: any): boolean => {
  return error?.response?.status === 401;
};

export const isRateLimitError = (error: any): boolean => {
  return error?.response?.status === 429;
};

export const isNetworkError = (error: any): boolean => {
  return !error.response && error.request;
};
