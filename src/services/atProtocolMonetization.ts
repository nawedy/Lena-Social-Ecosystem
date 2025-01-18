import { BskyAgent } from '@atproto/api';
import { atproto } from './atproto';

export interface TipTransaction {
  id: string;
  amount: number;
  currency: string;
  fromDid: string;
  toDid: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
}

export interface AdView {
  id: string;
  adId: string;
  userDid: string;
  timestamp: string;
  duration: number;
  completed: boolean;
}

export class ATProtocolMonetizationService {
  private agent: BskyAgent;

  constructor() {
    this.agent = atproto.getAgent();
  }

  // Tipping System
  async sendTip(params: {
    recipientDid: string;
    amount: number;
    currency: string;
    message?: string;
  }): Promise<TipTransaction> {
    try {
      const record = {
        $type: 'app.bsky.transaction.tip',
        recipient: params.recipientDid,
        amount: params.amount,
        currency: params.currency,
        message: params.message,
        createdAt: new Date().toISOString(),
      };

      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.transaction.tip',
        record,
      });

      return {
        id: response.uri,
        amount: params.amount,
        currency: params.currency,
        fromDid: this.agent.session?.did ?? '',
        toDid: params.recipientDid,
        timestamp: record.createdAt,
        status: 'completed',
        message: params.message,
      };
    } catch (error) {
      console.error('AT Protocol tip sending error:', error);
      throw error;
    }
  }

  // Ad System
  async createAd(params: {
    title: string;
    description: string;
    media: Blob;
    targetAudience: {
      interests?: string[];
      locations?: string[];
      ageRange?: { min: number; max: number };
    };
    budget: {
      amount: number;
      currency: string;
      duration: number; // in days
    };
  }) {
    try {
      const mediaBlob = await this.agent.uploadBlob(params.media, {
        encoding: 'image/jpeg',
      });

      const record = {
        $type: 'app.bsky.ad.create',
        title: params.title,
        description: params.description,
        media: mediaBlob.data.blob,
        targetAudience: params.targetAudience,
        budget: params.budget,
        createdAt: new Date().toISOString(),
      };

      return await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.ad.create',
        record,
      });
    } catch (error) {
      console.error('AT Protocol ad creation error:', error);
      throw error;
    }
  }

  async recordAdView(params: {
    adId: string;
    duration: number;
    completed: boolean;
  }): Promise<AdView> {
    try {
      const record = {
        $type: 'app.bsky.ad.view',
        ad: params.adId,
        duration: params.duration,
        completed: params.completed,
        timestamp: new Date().toISOString(),
      };

      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.ad.view',
        record,
      });

      return {
        id: response.uri,
        adId: params.adId,
        userDid: this.agent.session?.did ?? '',
        timestamp: record.timestamp,
        duration: params.duration,
        completed: params.completed,
      };
    } catch (error) {
      console.error('AT Protocol ad view recording error:', error);
      throw error;
    }
  }

  // Creator Program
  async enrollInCreatorProgram(params: {
    contentTypes: ('video' | 'image' | 'text')[];
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      minimumPosts: number;
    };
    categories: string[];
    paymentInfo: {
      type: 'crypto' | 'fiat';
      address?: string;
      bankInfo?: {
        accountNumber: string;
        routingNumber: string;
        bankName: string;
      };
    };
  }) {
    try {
      const record = {
        $type: 'app.bsky.creator.enroll',
        ...params,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      return await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.creator.enroll',
        record,
      });
    } catch (error) {
      console.error('AT Protocol creator program enrollment error:', error);
      throw error;
    }
  }

  // Analytics
  async getCreatorAnalytics(timeframe: 'day' | 'week' | 'month' | 'year') {
    try {
      return await this.agent.api.app.bsky.creator.getAnalytics({
        did: this.agent.session?.did ?? '',
        timeframe,
      });
    } catch (error) {
      console.error('AT Protocol creator analytics error:', error);
      throw error;
    }
  }

  async getAdAnalytics(adId: string) {
    try {
      return await this.agent.api.app.bsky.ad.getAnalytics({
        ad: adId,
      });
    } catch (error) {
      console.error('AT Protocol ad analytics error:', error);
      throw error;
    }
  }
}

export const atProtocolMonetization = new ATProtocolMonetizationService();
