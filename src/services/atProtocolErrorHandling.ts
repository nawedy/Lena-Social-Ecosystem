import { BskyAgent, XRPCError } from '@atproto/api';

export interface ErrorRecord {
  uri: string;
  cid: string;
  type: 'api' | 'network' | 'validation' | 'auth' | 'unknown';
  code: string;
  message: string;
  context?: Record<string, any>;
  stackTrace?: string;
  timestamp: string;
  resolved: boolean;
  resolution?: {
    action: string;
    timestamp: string;
    notes?: string;
  };
}

export class ATProtocolErrorHandling {
  private agent: BskyAgent;
  private static readonly ERROR_COLLECTION = 'app.bsky.system.error';

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  public async handleError(
    error: unknown,
    context?: Record<string, any>
  ): Promise<ErrorRecord> {
    const errorInfo = this.parseError(error);

    // Create error record
    const record = {
      $type: this.ERROR_COLLECTION,
      type: errorInfo.type,
      code: errorInfo.code,
      message: errorInfo.message,
      context,
      stackTrace: errorInfo.stack,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    try {
      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: this.ERROR_COLLECTION,
        record,
      });

      return {
        uri: response.uri,
        cid: response.cid,
        ...record,
      };
    } catch (e) {
      // If we can't save the error record, log to console as fallback
      console.error('Failed to save error record:', e);
      console.error('Original error:', error);
      throw error; // Re-throw the original error
    }
  }

  private parseError(error: unknown): {
    type: ErrorRecord['type'];
    code: string;
    message: string;
    stack?: string;
  } {
    if (error instanceof XRPCError) {
      return {
        type: 'api',
        code: error.error || 'UNKNOWN_API_ERROR',
        message: error.message,
        stack: error.stack,
      };
    }

    if (error instanceof Error) {
      if (error.name === 'NetworkError') {
        return {
          type: 'network',
          code: 'NETWORK_ERROR',
          message: error.message,
          stack: error.stack,
        };
      }

      if (error.name === 'ValidationError') {
        return {
          type: 'validation',
          code: 'VALIDATION_ERROR',
          message: error.message,
          stack: error.stack,
        };
      }

      return {
        type: 'unknown',
        code: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      type: 'unknown',
      code: 'UNKNOWN_ERROR',
      message: String(error),
    };
  }

  public async resolveError(params: {
    uri: string;
    action: string;
    notes?: string;
  }): Promise<ErrorRecord> {
    const current = await this.getError(params.uri);
    if (!current) throw new Error('Error record not found');

    const record = {
      ...current,
      resolved: true,
      resolution: {
        action: params.action,
        timestamp: new Date().toISOString(),
        notes: params.notes,
      },
    };

    const response = await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: this.ERROR_COLLECTION,
      rkey: params.uri.split('/').pop() ?? '',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  private async getError(uri: string): Promise<ErrorRecord | null> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: this.ERROR_COLLECTION,
        rkey: uri.split('/').pop() ?? '',
      });

      return response.data.value as ErrorRecord;
    } catch {
      return null;
    }
  }

  public async getErrorStats(): Promise<{
    total: number;
    byType: Record<ErrorRecord['type'], number>;
    resolutionRate: number;
    commonErrors: Array<{
      code: string;
      count: number;
    }>;
  }> {
    const response = await this.agent.api.app.bsky.system.getErrorStats({});
    return response.data;
  }
}
