import { BskyAgent, RichText } from '@atproto/api';

export interface StreamConfig {
  title: string;
  description?: string;
  isPrivate: boolean;
  allowedViewers?: string[]; // DIDs of allowed viewers
  streamKey?: string;
  rtmpUrl?: string;
}

export interface StreamMetadata {
  uri: string;
  cid: string;
  status: 'scheduled' | 'live' | 'ended';
  viewerCount: number;
  startedAt?: string;
  endedAt?: string;
}

export class LiveStreamService {
  private agent: BskyAgent;
  private mediaServer: string;

  constructor(agent: BskyAgent, mediaServer: string) {
    this.agent = agent;
    this.mediaServer = mediaServer;
  }

  // Create a new live stream
  public async createStream(config: StreamConfig): Promise<StreamMetadata> {
    // Create stream record in AT Protocol
    const record = {
      $type: 'app.bsky.feed.livestream',
      title: config.title,
      description: config.description,
      createdAt: new Date().toISOString(),
      isPrivate: config.isPrivate,
      allowedViewers: config.allowedViewers,
      status: 'scheduled' as const,
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.livestream',
      record,
    });

    // Get stream configuration from media server
    const streamConfig = await this.getStreamConfig(response.uri);

    return {
      uri: response.uri,
      cid: response.cid,
      status: 'scheduled',
      viewerCount: 0,
      ...streamConfig,
    };
  }

  // Start the live stream
  public async startStream(streamUri: string): Promise<void> {
    await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.livestream',
      rkey: streamUri.split('/').pop()!,
      record: {
        status: 'live',
        startedAt: new Date().toISOString(),
      },
    });

    // Create a post announcing the stream
    const rt = new RichText({
      text: `🔴 I'm live now! Join my stream: ${streamUri}`,
    });
    await rt.detectFacets(this.agent);

    await this.agent.post({
      text: rt.text,
      facets: rt.facets,
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: streamUri,
          title: 'Live Stream',
          description: 'Join the live stream now!',
        },
      },
    });
  }

  // End the live stream
  public async endStream(streamUri: string): Promise<void> {
    await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.livestream',
      rkey: streamUri.split('/').pop()!,
      record: {
        status: 'ended',
        endedAt: new Date().toISOString(),
      },
    });
  }

  // Get stream configuration from media server
  private async getStreamConfig(streamUri: string): Promise<{
    streamKey: string;
    rtmpUrl: string;
  }> {
    const response = await fetch(`${this.mediaServer}/stream/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        streamUri,
        userId: this.agent.session?.did,
      }),
    });

    return response.json();
  }

  // Subscribe to stream events
  public subscribeToStream(
    streamUri: string,
    callbacks: {
      onViewerJoin?: (did: string) => void;
      onViewerLeave?: (did: string) => void;
      onChat?: (message: { author: string; text: string }) => void;
      onStreamEnd?: () => void;
    }
  ): () => void {
    const ws = new WebSocket(
      `${this.mediaServer.replace('http', 'ws')}/stream/events`
    );

    ws.onmessage = event => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'viewer_join':
          callbacks.onViewerJoin?.(data.did);
          break;
        case 'viewer_leave':
          callbacks.onViewerLeave?.(data.did);
          break;
        case 'chat':
          callbacks.onChat?.(data.message);
          break;
        case 'stream_end':
          callbacks.onStreamEnd?.();
          ws.close();
          break;
      }
    };

    return () => ws.close();
  }

  // Send chat message in stream
  public async sendChatMessage(streamUri: string, text: string): Promise<void> {
    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.chat',
      record: {
        streamUri,
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      },
    });
  }

  // Get stream chat history
  public async getChatHistory(
    streamUri: string,
    limit: number = 50
  ): Promise<
    {
      author: string;
      text: string;
      createdAt: string;
    }[]
  > {
    const response = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.chat',
      limit,
    });

    return response.data.records
      .filter(record => record.value.streamUri === streamUri)
      .map(record => ({
        author: record.value.author,
        text: record.value.text,
        createdAt: record.value.createdAt,
      }));
  }

  // Enhanced stream interaction features
  public async addStreamInteraction(
    streamUri: string,
    interaction: {
      type: 'like' | 'repost' | 'comment' | 'share' | 'shop';
      content?: string;
      product?: {
        name: string;
        price: number;
        url: string;
        image?: Blob;
      };
    }
  ): Promise<void> {
    const rt = interaction.content
      ? new RichText({ text: interaction.content })
      : null;
    if (rt) await rt.detectFacets(this.agent);

    const record = {
      streamUri,
      type: interaction.type,
      content: rt?.text,
      facets: rt?.facets,
      product: interaction.product,
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamInteraction',
      record,
    });
  }

  // Get stream interactions
  public async getStreamInteractions(
    streamUri: string,
    type?: 'like' | 'repost' | 'comment' | 'share' | 'shop'
  ): Promise<{
    likes: number;
    reposts: number;
    comments: number;
    shares: number;
    products: Array<{
      name: string;
      price: number;
      url: string;
      purchases: number;
    }>;
  }> {
    const response = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamInteraction',
    });

    const interactions = response.data.records
      .filter(record => record.value.streamUri === streamUri)
      .filter(record => !type || record.value.type === type);

    const products = interactions
      .filter(record => record.value.type === 'shop' && record.value.product)
      .reduce(
        (acc, record) => {
          const product = record.value.product;
          const existing = acc.find(p => p.url === product.url);
          if (existing) {
            existing.purchases++;
          } else {
            acc.push({
              ...product,
              purchases: 1,
            });
          }
          return acc;
        },
        [] as Array<{
          name: string;
          price: number;
          url: string;
          purchases: number;
        }>
      );

    return {
      likes: interactions.filter(record => record.value.type === 'like').length,
      reposts: interactions.filter(record => record.value.type === 'repost')
        .length,
      comments: interactions.filter(record => record.value.type === 'comment')
        .length,
      shares: interactions.filter(record => record.value.type === 'share')
        .length,
      products,
    };
  }

  // Add shopping features to stream
  public async addShoppingFeature(
    streamUri: string,
    products: Array<{
      name: string;
      price: number;
      url: string;
      image?: Blob;
      description?: string;
      inventory?: number;
    }>
  ): Promise<void> {
    const productBlobs = await Promise.all(
      products.filter(p => p.image).map(p => this.agent.uploadBlob(p.image!))
    );

    const record = {
      streamUri,
      products: products.map((product, i) => ({
        ...product,
        image: product.image ? productBlobs[i].data.blob : undefined,
      })),
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamProducts',
      record,
    });
  }

  // Add interactive polls to stream
  public async addStreamPoll(
    streamUri: string,
    poll: {
      question: string;
      options: string[];
      duration: number;
    }
  ): Promise<string> {
    const record = {
      streamUri,
      question: poll.question,
      options: poll.options,
      votes: {} as Record<string, string[]>,
      endsAt: new Date(Date.now() + poll.duration).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamPoll',
      record,
    });

    return response.uri;
  }

  // Vote in stream poll
  public async voteInPoll(pollUri: string, optionIndex: number): Promise<void> {
    const poll = await this.agent.api.com.atproto.repo.getRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamPoll',
      rkey: pollUri.split('/').pop()!,
    });

    if (!poll.data || new Date(poll.data.value.endsAt) < new Date()) {
      throw new Error('Poll has ended');
    }

    const votes = poll.data.value.votes || {};
    const userId = this.agent.session?.did;

    // Remove previous vote if exists
    Object.keys(votes).forEach(key => {
      votes[key] = votes[key].filter(id => id !== userId);
    });

    // Add new vote
    votes[optionIndex] = [...(votes[optionIndex] || []), userId!];

    await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamPoll',
      rkey: pollUri.split('/').pop()!,
      record: {
        ...poll.data.value,
        votes,
      },
    });
  }

  // Get poll results
  public async getPollResults(pollUri: string): Promise<{
    question: string;
    options: Array<{
      text: string;
      votes: number;
      percentage: number;
    }>;
    totalVotes: number;
    hasEnded: boolean;
  }> {
    const poll = await this.agent.api.com.atproto.repo.getRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.streamPoll',
      rkey: pollUri.split('/').pop()!,
    });

    if (!poll.data) {
      throw new Error('Poll not found');
    }

    const votes = poll.data.value.votes || {};
    const totalVotes = Object.values(votes).reduce(
      (sum, voters) => sum + voters.length,
      0
    );

    return {
      question: poll.data.value.question,
      options: poll.data.value.options.map((option: string, index: number) => ({
        text: option,
        votes: votes[index]?.length || 0,
        percentage:
          totalVotes === 0
            ? 0
            : ((votes[index]?.length || 0) / totalVotes) * 100,
      })),
      totalVotes,
      hasEnded: new Date(poll.data.value.endsAt) < new Date(),
    };
  }
}
