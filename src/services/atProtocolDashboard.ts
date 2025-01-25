import { BskyAgent, RichText, AppBskyFeedDefs } from '@atproto/api';

export interface AccountMetrics {
  followers: number;
  following: number;
  posts: number;
  likes: number;
  reposts: number;
  engagement: number;
  reachByDay: Array<{
    date: string;
    reach: number;
    engagement: number;
  }>;
}

export interface ContentMetrics {
  totalPosts: number;
  totalViews: number;
  averageEngagement: number;
  topPosts: AppBskyFeedDefs.FeedViewPost[];
  contentByType: Record<string, number>;
  performanceByHour: Array<{
    hour: number;
    engagement: number;
    reach: number;
  }>;
}

export interface MultiAccountDashboard {
  accounts: Array<{
    did: string;
    handle: string;
    metrics: AccountMetrics;
    content: ContentMetrics;
    monetization: {
      revenue: number;
      products: number;
      orders: number;
    };
  }>;
  consolidated: {
    totalReach: number;
    totalEngagement: number;
    totalRevenue: number;
    growth: {
      followers: number;
      engagement: number;
      revenue: number;
    };
  };
}

export interface ContentSchedule {
  uri: string;
  cid: string;
  content: {
    text: string;
    media?: {
      images?: Array<{
        image: string;
        alt: string;
      }>;
      video?: {
        url: string;
        thumbnail: string;
      };
    };
  };
  scheduledFor: string;
  accounts: string[];
  status: 'scheduled' | 'published' | 'failed';
  createdAt: string;
}

export class ATProtocolDashboard {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Multi-Account Management
  public async getMultiAccountDashboard(
    accounts: string[]
  ): Promise<MultiAccountDashboard> {
    const accountsData = await Promise.all(
      accounts.map(async did => {
        const metrics = await this.getAccountMetrics(did);
        const content = await this.getContentMetrics(did);
        const monetization = await this.getMonetizationMetrics(did);

        return {
          did,
          handle: (await this.agent.getProfile({ actor: did })).data.handle,
          metrics,
          content,
          monetization,
        };
      })
    );

    return {
      accounts: accountsData,
      consolidated: this.consolidateMetrics(accountsData),
    };
  }

  // Content Scheduling
  public async scheduleContent(params: {
    content: {
      text: string;
      media?: Blob[];
    };
    scheduledFor: string;
    accounts: string[];
  }): Promise<ContentSchedule> {
    const rt = new RichText({ text: params.content.text });
    await rt.detectFacets(this.agent);

    const mediaBlobs = await Promise.all(
      (params.content.media || []).map(blob => this.agent.uploadBlob(blob))
    );

    const record = {
      $type: 'app.bsky.feed.scheduledPost',
      text: rt.text,
      facets: rt.facets,
      media: mediaBlobs.map(blob => ({
        image: blob.data.blob,
        alt: 'Scheduled post image',
      })),
      scheduledFor: params.scheduledFor,
      accounts: params.accounts,
      status: 'scheduled' as const,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.scheduledPost',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      content: {
        text: rt.text,
        media: {
          images: mediaBlobs.map((blob, i) => ({
            image: blob.data.blob.ref.toString(),
            alt: `Image ${i + 1}`,
          })),
        },
      },
      scheduledFor: params.scheduledFor,
      accounts: params.accounts,
      status: 'scheduled',
      createdAt: record.createdAt,
    };
  }

  // Content Performance
  public async getContentPerformance(params: {
    accounts: string[];
    timeframe: {
      start: string;
      end: string;
    };
    contentTypes?: string[];
  }): Promise<{
    posts: Array<
      AppBskyFeedDefs.FeedViewPost & {
        metrics: {
          views: number;
          likes: number;
          reposts: number;
          replies: number;
          engagement: number;
        };
      }
    >;
    summary: {
      totalPosts: number;
      totalViews: number;
      averageEngagement: number;
      topPerformers: string[];
      underperformers: string[];
    };
  }> {
    const posts = await Promise.all(
      params.accounts.map(did =>
        this.agent.api.app.bsky.feed.getAuthorFeed({
          actor: did,
          limit: 100,
        })
      )
    );

    const allPosts = posts
      .flatMap(response => response.data.feed)
      .filter(post => {
        const postDate = new Date(post.post.indexedAt);
        return (
          postDate >= new Date(params.timeframe.start) &&
          postDate <= new Date(params.timeframe.end) &&
          (!params.contentTypes ||
            params.contentTypes.includes(post.post.record.$type))
        );
      });

    const postsWithMetrics = await Promise.all(
      allPosts.map(async post => {
        const metrics = await this.getPostMetrics(post.post.uri);
        return {
          ...post,
          metrics,
        };
      })
    );

    const totalViews = postsWithMetrics.reduce(
      (sum, post) => sum + post.metrics.views,
      0
    );
    const totalEngagement = postsWithMetrics.reduce(
      (sum, post) => sum + post.metrics.engagement,
      0
    );

    return {
      posts: postsWithMetrics,
      summary: {
        totalPosts: postsWithMetrics.length,
        totalViews,
        averageEngagement: totalEngagement / postsWithMetrics.length,
        topPerformers: postsWithMetrics
          .sort((a, b) => b.metrics.engagement - a.metrics.engagement)
          .slice(0, 5)
          .map(post => post.post.uri),
        underperformers: postsWithMetrics
          .sort((a, b) => a.metrics.engagement - b.metrics.engagement)
          .slice(0, 5)
          .map(post => post.post.uri),
      },
    };
  }

  // Audience Insights
  public async getAudienceInsights(accounts: string[]): Promise<{
    demographics: Record<string, number>;
    interests: Record<string, number>;
    activeHours: Record<number, number>;
    growthTrend: Array<{
      date: string;
      followers: number;
      engagement: number;
    }>;
  }> {
    const insights = await Promise.all(
      accounts.map(did =>
        this.agent.api.app.bsky.actor.getInsights({
          actor: did,
        })
      )
    );

    return this.aggregateAudienceInsights(
      insights.map(response => response.data)
    );
  }

  // Helper Methods
  private async getAccountMetrics(did: string): Promise<AccountMetrics> {
    const response = await this.agent.api.app.bsky.actor.getProfile({
      actor: did,
    });

    const reachData = await this.agent.api.app.bsky.actor.getReach({
      actor: did,
      period: '30d',
    });

    return {
      followers: response.data.followersCount,
      following: response.data.followsCount,
      posts: response.data.postsCount,
      likes: response.data.likesCount || 0,
      reposts: response.data.repostsCount || 0,
      engagement: response.data.engagement || 0,
      reachByDay: reachData.data.byDay,
    };
  }

  private async getContentMetrics(did: string): Promise<ContentMetrics> {
    const response = await this.agent.api.app.bsky.feed.getAuthorFeed({
      actor: did,
      limit: 100,
    });

    const posts = response.data.feed;
    const totalViews = posts.reduce(
      (sum, post) => sum + (post.post.viewCount || 0),
      0
    );

    return {
      totalPosts: posts.length,
      totalViews,
      averageEngagement:
        posts.reduce((sum, post) => sum + (post.post.engagement || 0), 0) /
        posts.length,
      topPosts: posts
        .sort((a, b) => (b.post.engagement || 0) - (a.post.engagement || 0))
        .slice(0, 5),
      contentByType: this.aggregateContentTypes(posts),
      performanceByHour: this.aggregatePerformanceByHour(posts),
    };
  }

  private async getMonetizationMetrics(did: string): Promise<{
    revenue: number;
    products: number;
    orders: number;
  }> {
    const response = await this.agent.api.app.bsky.commerce.getSellerMetrics({
      seller: did,
    });

    return response.data;
  }

  private async getPostMetrics(uri: string): Promise<{
    views: number;
    likes: number;
    reposts: number;
    replies: number;
    engagement: number;
  }> {
    const response = await this.agent.api.app.bsky.feed.getPostMetrics({
      uri,
    });

    return response.data;
  }

  private consolidateMetrics(
    accounts: MultiAccountDashboard['accounts']
  ): MultiAccountDashboard['consolidated'] {
    return {
      totalReach: accounts.reduce(
        (sum, account) =>
          sum + account.metrics.reachByDay.reduce((s, day) => s + day.reach, 0),
        0
      ),
      totalEngagement: accounts.reduce(
        (sum, account) => sum + account.metrics.engagement,
        0
      ),
      totalRevenue: accounts.reduce(
        (sum, account) => sum + account.monetization.revenue,
        0
      ),
      growth: {
        followers: accounts.reduce(
          (sum, account) => sum + account.metrics.followers,
          0
        ),
        engagement: accounts.reduce(
          (sum, account) => sum + account.metrics.engagement,
          0
        ),
        revenue: accounts.reduce(
          (sum, account) => sum + account.monetization.revenue,
          0
        ),
      },
    };
  }

  private aggregateContentTypes(
    posts: AppBskyFeedDefs.FeedViewPost[]
  ): Record<string, number> {
    return posts.reduce(
      (acc, post) => {
        const type = post.post.record.$type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private aggregatePerformanceByHour(
    posts: AppBskyFeedDefs.FeedViewPost[]
  ): Array<{
    hour: number;
    engagement: number;
    reach: number;
  }> {
    const hourlyData = new Array(24).fill(null).map((_, hour) => ({
      hour,
      engagement: 0,
      reach: 0,
      count: 0,
    }));

    posts.forEach(post => {
      const hour = new Date(post.post.indexedAt).getHours();
      hourlyData[hour].engagement += post.post.engagement || 0;
      hourlyData[hour].reach += post.post.viewCount || 0;
      hourlyData[hour].count += 1;
    });

    return hourlyData.map(({ hour, engagement, reach, count }) => ({
      hour,
      engagement: count ? engagement / count : 0,
      reach: count ? reach / count : 0,
    }));
  }

  private aggregateAudienceInsights(_insights: any[]): {
    demographics: Record<string, number>;
    interests: Record<string, number>;
    activeHours: Record<number, number>;
    growthTrend: Array<{
      date: string;
      followers: number;
      engagement: number;
    }>;
  } {
    // Implementation would depend on the actual structure of insights data
    return {
      demographics: {},
      interests: {},
      activeHours: {},
      growthTrend: [],
    };
  }
}
