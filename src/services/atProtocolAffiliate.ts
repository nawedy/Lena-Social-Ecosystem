import { BskyAgent, RichText } from '@atproto/api';

export interface AffiliateProfile {
  uri: string;
  cid: string;
  did: string;
  handle: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  commissionRate: number;
  paymentInfo: {
    type: string;
    details: Record<string, string>;
  };
  analytics: {
    totalEarnings: number;
    totalSales: number;
    conversionRate: number;
    activeReferrals: number;
  };
  createdAt: string;
}

export interface AffiliateEarning {
  uri: string;
  cid: string;
  affiliateId: string;
  orderId: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: string;
  createdAt: string;
}

export interface ProductShare {
  uri: string;
  cid: string;
  productUri: string;
  affiliateId: string;
  postUri: string;
  type: 'post' | 'video' | 'story';
  performance: {
    views: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
  createdAt: string;
}

export class ATProtocolAffiliate {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Affiliate Program Management
  public async applyForAffiliate(params: {
    paymentInfo: AffiliateProfile['paymentInfo'];
  }): Promise<AffiliateProfile> {
    const record = {
      $type: 'app.bsky.commerce.affiliateApplication',
      paymentInfo: params.paymentInfo,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.affiliateApplication',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      did: this.agent.session?.did ?? '',
      handle: this.agent.session?.handle ?? '',
      status: 'pending',
      commissionRate: 0.1, // Default 10%
      paymentInfo: params.paymentInfo,
      analytics: {
        totalEarnings: 0,
        totalSales: 0,
        conversionRate: 0,
        activeReferrals: 0,
      },
      createdAt: record.createdAt,
    };
  }

  // Product Sharing
  public async shareProduct(params: {
    productUri: string;
    text: string;
    media?: Blob[];
    type: ProductShare['type'];
  }): Promise<ProductShare> {
    const rt = new RichText({ text: params.text });
    await rt.detectFacets(this.agent);

    const mediaBlobs = params.media
      ? await Promise.all(params.media.map(blob => this.agent.uploadBlob(blob)))
      : [];

    const record = {
      $type: 'app.bsky.commerce.productShare',
      product: params.productUri,
      text: rt.text,
      facets: rt.facets,
      media: mediaBlobs.map(blob => ({
        image: blob.data.blob,
        alt: 'Product share media',
      })),
      type: params.type,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.productShare',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      productUri: params.productUri,
      affiliateId: this.agent.session?.did ?? '',
      postUri: response.uri,
      type: params.type,
      performance: {
        views: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      },
      createdAt: record.createdAt,
    };
  }

  // Video Creation
  public async createProductVideo(params: {
    productUri: string;
    video: Blob;
    thumbnail: Blob;
    description: string;
  }): Promise<ProductShare> {
    const [videoBlob, thumbnailBlob] = await Promise.all([
      this.agent.uploadBlob(params.video),
      this.agent.uploadBlob(params.thumbnail),
    ]);

    const rt = new RichText({ text: params.description });
    await rt.detectFacets(this.agent);

    const record = {
      $type: 'app.bsky.commerce.productVideo',
      product: params.productUri,
      video: videoBlob.data.blob,
      thumbnail: thumbnailBlob.data.blob,
      description: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.productVideo',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      productUri: params.productUri,
      affiliateId: this.agent.session?.did ?? '',
      postUri: response.uri,
      type: 'video',
      performance: {
        views: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      },
      createdAt: record.createdAt,
    };
  }

  // Analytics
  public async getAffiliateAnalytics(timeframe?: {
    start: string;
    end: string;
  }): Promise<{
    overview: {
      totalEarnings: number;
      pendingEarnings: number;
      totalSales: number;
      conversionRate: number;
      activeShares: number;
    };
    performance: {
      shares: Array<ProductShare & { product: any }>;
      earnings: AffiliateEarning[];
      topProducts: Array<{
        uri: string;
        name: string;
        sales: number;
        revenue: number;
      }>;
      dailyStats: Array<{
        date: string;
        sales: number;
        revenue: number;
        earnings: number;
        clicks: number;
        conversions: number;
      }>;
    };
  }> {
    const response =
      await this.agent.api.app.bsky.commerce.getAffiliateAnalytics({
        affiliate: this.agent.session?.did ?? '',
        timeframe,
      });

    return response.data;
  }

  // Earnings Management
  public async getEarnings(params?: {
    status?: AffiliateEarning['status'];
    timeframe?: {
      start: string;
      end: string;
    };
  }): Promise<{
    earnings: AffiliateEarning[];
    summary: {
      total: number;
      pending: number;
      paid: number;
    };
  }> {
    const response =
      await this.agent.api.app.bsky.commerce.getAffiliateEarnings({
        affiliate: this.agent.session?.did ?? '',
        ...params,
      });

    return response.data;
  }

  // Tracking
  public async trackSharePerformance(
    shareUri: string
  ): Promise<ProductShare['performance']> {
    const response = await this.agent.api.app.bsky.commerce.getSharePerformance(
      {
        share: shareUri,
      }
    );

    return response.data;
  }
}
