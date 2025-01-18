import { BskyAgent } from '@atproto/api';

export interface PaymentAccount {
  $type: string;
  uri: string;
  cid: string;
  did: string;
  type: 'individual' | 'business';
  status: 'active' | 'pending' | 'suspended';
  paymentMethods: Array<{
    id: string;
    type: 'bank_account' | 'card' | 'crypto_wallet';
    details: {
      last4?: string;
      bankName?: string;
      walletAddress?: string;
    };
    isDefault: boolean;
  }>;
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  payoutSchedule: {
    interval: 'daily' | 'weekly' | 'monthly';
    minimumAmount: number;
    nextPayout: string;
  };
  settings: {
    autoPayoutEnabled: boolean;
    payoutThreshold: number;
    payoutSchedule: 'daily' | 'weekly' | 'monthly';
  };
  verification: {
    status: 'pending' | 'verified' | 'failed';
    documents: string[];
  };
  metadata: Record<string, any>;
  createdAt: string;
}

export interface PaymentTransaction {
  $type: string;
  uri: string;
  cid: string;
  type: 'order_payment' | 'affiliate_commission' | 'platform_fee' | 'payout';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  fee: number;
  net: number;
  source: {
    did: string;
    type: string;
    reference: string;
  };
  destination: {
    did: string;
    type: string;
    reference: string;
  };
  metadata: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}

export class ATProtocolPayments {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Payment Account Management
  public async createPaymentAccount(params: {
    type: PaymentAccount['type'];
    paymentMethod: {
      type: string;
      details: Record<string, string>;
    };
    payoutSchedule: PaymentAccount['payoutSchedule'];
  }): Promise<PaymentAccount> {
    const record = {
      $type: 'app.bsky.commerce.paymentAccount',
      type: params.type,
      paymentMethods: [
        {
          id: crypto.randomUUID(),
          ...params.paymentMethod,
          isDefault: true,
        },
      ],
      balance: {
        available: 0,
        pending: 0,
        currency: 'USD',
      },
      payoutSchedule: params.payoutSchedule,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.paymentAccount',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      did: this.agent.session?.did ?? '',
      ...record,
    };
  }

  // Payment Processing
  public async processPayment(params: {
    amount: number;
    currency: string;
    source: PaymentTransaction['source'];
    destination: PaymentTransaction['destination'];
    metadata: Record<string, any>;
  }): Promise<PaymentTransaction> {
    const record = {
      $type: 'app.bsky.commerce.paymentTransaction',
      type: 'order_payment',
      status: 'pending',
      amount: params.amount,
      currency: params.currency,
      fee: this.calculateFee(params.amount),
      net: params.amount - this.calculateFee(params.amount),
      source: params.source,
      destination: params.destination,
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.paymentTransaction',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  // Split Payments
  public async processSplitPayment(params: {
    orderUri: string;
    amount: number;
    currency: string;
    splits: Array<{
      did: string;
      type: 'seller' | 'affiliate' | 'platform';
      percentage: number;
    }>;
  }): Promise<PaymentTransaction[]> {
    const transactions = await Promise.all(
      params.splits.map(split => {
        const splitAmount = (params.amount * split.percentage) / 100;
        return this.processPayment({
          amount: splitAmount,
          currency: params.currency,
          source: {
            did: this.agent.session?.did ?? '',
            type: 'order',
            reference: params.orderUri,
          },
          destination: {
            did: split.did,
            type: split.type,
            reference: `split_${split.type}`,
          },
          metadata: {
            orderUri: params.orderUri,
            splitType: split.type,
            percentage: split.percentage,
          },
        });
      })
    );

    return transactions;
  }

  // Automated Payouts
  public async processAutomatedPayouts(params: {
    accountUri: string;
    amount: number;
    currency: string;
  }): Promise<PaymentTransaction> {
    const record = {
      $type: 'app.bsky.commerce.paymentTransaction',
      type: 'payout',
      status: 'pending',
      amount: params.amount,
      currency: params.currency,
      fee: this.calculatePayoutFee(params.amount),
      net: params.amount - this.calculatePayoutFee(params.amount),
      source: {
        did: this.agent.session?.did ?? '',
        type: 'platform',
        reference: 'automated_payout',
      },
      destination: {
        did: await this.getAccountOwner(params.accountUri),
        type: 'payout',
        reference: params.accountUri,
      },
      metadata: {
        accountUri: params.accountUri,
        type: 'automated_payout',
      },
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.paymentTransaction',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  // Payment Analytics
  public async getPaymentAnalytics(params: {
    timeframe: {
      start: string;
      end: string;
    };
    type?: PaymentTransaction['type'];
  }): Promise<{
    totalVolume: number;
    totalFees: number;
    transactionCount: number;
    averageTransactionSize: number;
    volumeByDay: Array<{
      date: string;
      volume: number;
      transactions: number;
    }>;
    topAccounts: Array<{
      did: string;
      volume: number;
      transactions: number;
    }>;
  }> {
    const response = await this.agent.api.app.bsky.commerce.getPaymentAnalytics(
      {
        timeframe: params.timeframe,
        type: params.type,
      }
    );

    return response.data;
  }

  // Private Methods
  private calculateFee(amount: number): number {
    // Example fee calculation: 2.9% + $0.30
    return amount * 0.029 + 0.3;
  }

  private calculatePayoutFee(amount: number): number {
    // Example payout fee calculation: 0.25% + $0.25
    return amount * 0.0025 + 0.25;
  }

  private async getAccountOwner(accountUri: string): Promise<string> {
    const response = await this.agent.api.app.bsky.commerce.getPaymentAccount({
      uri: accountUri,
    });
    return response.data.did;
  }
}
