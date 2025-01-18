import { BskyAgent, AppBskyFeedDefs, RichText } from '@atproto/api';

export interface CustomFeed {
  uri: string;
  cid: string;
  name: string;
  description?: string;
  avatar?: string;
}

export class FeedGeneratorService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Create a custom feed
  public async createCustomFeed(
    name: string,
    description: string,
    filters: {
      keywords?: string[];
      users?: string[];
      languages?: string[];
    }
  ): Promise<CustomFeed> {
    // AT Protocol feed generation
    const record = {
      feed: {
        name,
        description,
        filters,
      },
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.generator',
      record,
    });

    return {
      uri: response.data.uri,
      cid: response.data.cid,
      name,
      description,
    };
  }

  // Get posts for a custom feed
  public async getFeedPosts(feedUri: string, params?: { limit?: number; cursor?: string }) {
    return this.agent.api.app.bsky.feed.getFeed({
      feed: feedUri,
      ...params,
    });
  }

  // Save a post for later
  public async savePost(postUri: string, postCid: string) {
    const record = {
      subject: {
        uri: postUri,
        cid: postCid,
      },
      createdAt: new Date().toISOString(),
    };

    return this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.actor.save',
      record,
    });
  }

  // Get saved posts
  public async getSavedPosts(params?: { limit?: number; cursor?: string }) {
    return this.agent.api.app.bsky.actor.getSavedFeeds(params);
  }

  // Remix a post
  public async remixPost(originalPost: AppBskyFeedDefs.FeedViewPost, remixText: string) {
    const rt = new RichText({ text: remixText });
    await rt.detectFacets(this.agent); // Detect mentions, links, etc.

    const record = {
      text: rt.text,
      facets: rt.facets,
      remix: {
        ref: {
          uri: originalPost.post.uri,
          cid: originalPost.post.cid,
        },
        type: 'quote',
      },
      createdAt: new Date().toISOString(),
    };

    return this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.post',
      record,
    });
  }

  // Create a list (e.g., curated accounts, topics)
  public async createList(name: string, description: string, purpose: 'curate' | 'moderation') {
    const record = {
      name,
      description,
      purpose,
      createdAt: new Date().toISOString(),
    };

    return this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.list',
      record,
    });
  }

  // Add item to a list
  public async addToList(listUri: string, subjectDid: string) {
    const record = {
      list: listUri,
      subject: subjectDid,
      createdAt: new Date().toISOString(),
    };

    return this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.listitem',
      record,
    });
  }
}
