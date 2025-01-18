import { BskyAgent } from '@atproto/api';

export interface PaymentMethod {
  $type: string;
  uri: string;
  cid: string;
  type: 'card' | 'bank_account' | 'crypto' | 'wallet';
  provider: string;
  status: 'active' | 'inactive' | 'expired';
  lastFour?: string;
  expiryDate?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Transaction {
  $type: string;
  uri: string;
  cid: string;
  type: 'payment' | 'refund' | 'payout' | 'transfer';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  fromDid: string;
  toDid: string;
  reference?: {
    type: 'order' | 'refund' | 'payout';
    uri: string;
  };
  paymentMethodUri?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutAccount {
  $type: string;
  uri: string;
  cid: string;
  type: 'bank_account' | 'crypto_wallet';
  status: 'pending' | 'verified' | 'rejected';
  verification?: {
    status: 'pending' | 'verified' | 'failed';
    requiredDocs: string[];
    submittedDocs: string[];
    failureReason?: string;
  };
  accountDetails: {
    accountNumber?: string;
    routingNumber?: string;
    accountType?: string;
    bankName?: string;
    walletAddress?: string;
    network?: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAnalytics {
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalVolume: number;
    successRate: number;
    averageAmount: number;
    refundRate: number;
  };
  trends: Array<{
    metric: string;
    change: number;
    insight: string;
  }>;
  byMethod: Record<
    string,
    {
      volume: number;
      count: number;
      failureRate: number;
    }
  >;
}

export class ATProtocolPayment {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Payment Method Management
  public async addPaymentMethod(params: {
    type: PaymentMethod['type'];
    provider: string;
    token: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentMethod> {
    const record = {
      $type: 'app.bsky.commerce.paymentMethod',
      type: params.type,
      provider: params.provider,
      status: 'active',
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.paymentMethod',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  public async updatePaymentMethodStatus(params: {
    uri: string;
    status: PaymentMethod['status'];
  }): Promise<PaymentMethod> {
    const current = await this.getPaymentMethod(params.uri);
    if (!current) throw new Error('Payment method not found');

    const record = {
      ...current,
      status: params.status,
    };

    const response = await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.paymentMethod',
      rkey: params.uri.split('/').pop() ?? '',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  // Transaction Processing
  public async createTransaction(params: {
    type: Transaction['type'];
    amount: number;
    currency: string;
    fromDid: string;
    toDid: string;
    reference?: Transaction['reference'];
    paymentMethodUri?: string;
    metadata?: Record<string, any>;
  }): Promise<Transaction> {
    // Validate payment method if provided
    if (params.paymentMethodUri) {
      const paymentMethod = await this.getPaymentMethod(params.paymentMethodUri);
      if (!paymentMethod || paymentMethod.status !== 'active') {
        throw new Error('Invalid or inactive payment method');
      }
    }

    const record = {
      $type: 'app.bsky.commerce.transaction',
      ...params,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.transaction',
      record,
    });

    // Process the transaction
    const processedTransaction = await this.processTransaction({
      uri: response.uri,
      cid: response.cid,
      ...record,
    });

    return processedTransaction;
  }

  // Payout Management
  public async createPayoutAccount(params: {
    type: PayoutAccount['type'];
    accountDetails: PayoutAccount['accountDetails'];
    metadata?: Record<string, any>;
  }): Promise<PayoutAccount> {
    const record = {
      $type: 'app.bsky.commerce.payoutAccount',
      ...params,
      status: 'pending',
      verification: {
        status: 'pending',
        requiredDocs: this.getRequiredDocs(params.type),
        submittedDocs: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.payoutAccount',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  public async submitPayoutVerification(params: {
    accountUri: string;
    documents: Array<{
      type: string;
      blob: string;
    }>;
  }): Promise<PayoutAccount> {
    const account = await this.getPayoutAccount(params.accountUri);
    if (!account) throw new Error('Payout account not found');

    // Update verification status and documents
    const updatedAccount = {
      ...account,
      verification: {
        ...account.verification,
        status: 'pending',
        submittedDocs: params.documents.map((doc) => doc.type),
      },
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.payoutAccount',
      rkey: params.accountUri.split('/').pop() ?? '',
      record: updatedAccount,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...updatedAccount,
    };
  }

  // Analytics
  public async getPaymentAnalytics(params: {
    period: {
      start: string;
      end: string;
    };
  }): Promise<PaymentAnalytics> {
    const response = await this.agent.api.app.bsky.commerce.getPaymentAnalytics({
      period: params.period,
    });

    return response.data;
  }

  // Private Helper Methods
  private async getPaymentMethod(uri: string): Promise<PaymentMethod | null> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.paymentMethod',
        rkey: uri.split('/').pop() ?? '',
      });

      return response.data.value as PaymentMethod;
    } catch {
      return null;
    }
  }

  private async getPayoutAccount(uri: string): Promise<PayoutAccount | null> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.payoutAccount',
        rkey: uri.split('/').pop() ?? '',
      });

      return response.data.value as PayoutAccount;
    } catch {
      return null;
    }
  }

  private async processTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      // Process payment through appropriate provider
      // This is where you'd integrate with payment processors
      const success = await this.processPaymentWithProvider(transaction);

      const updatedTransaction = {
        ...transaction,
        status: success ? 'completed' : 'failed',
        updatedAt: new Date().toISOString(),
      };

      await this.agent.api.com.atproto.repo.putRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.transaction',
        rkey: transaction.uri.split('/').pop() ?? '',
        record: updatedTransaction,
      });

      return updatedTransaction;
    } catch (error) {
      // Handle processing error
      const failedTransaction = {
        ...transaction,
        status: 'failed',
        metadata: {
          ...transaction.metadata,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        updatedAt: new Date().toISOString(),
      };

      await this.agent.api.com.atproto.repo.putRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.transaction',
        rkey: transaction.uri.split('/').pop() ?? '',
        record: failedTransaction,
      });

      return failedTransaction;
    }
  }

  private async processPaymentWithProvider(_transaction: Transaction): Promise<boolean> {
    // This is where you'd implement actual payment processing logic
    // For now, we'll simulate success
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.1); // 90% success rate
      }, 1000);
    });
  }

  private getRequiredDocs(accountType: PayoutAccount['type']): string[] {
    switch (accountType) {
      case 'bank_account':
        return ['id_verification', 'bank_statement', 'proof_of_address'];
      case 'crypto_wallet':
        return ['id_verification', 'wallet_ownership_proof'];
      default:
        return [];
    }
  }
}
