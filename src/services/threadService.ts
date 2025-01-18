import { BskyAgent, AppBskyFeedDefs, RichText } from '@atproto/api';

export interface ThreadViewPost extends AppBskyFeedDefs.FeedViewPost {
  depth: number;
  children: ThreadViewPost[];
}

export class ThreadService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Get full thread context
  public async getThread(postUri: string): Promise<ThreadViewPost> {
    const response = await this.agent.getPostThread({ uri: postUri });

    if (!response.success) {
      throw new Error('Failed to fetch thread');
    }

    return this.buildThreadTree(response.data.thread);
  }

  // Build thread tree from flat structure
  private buildThreadTree(thread: any, depth = 0): ThreadViewPost {
    const post = thread.post as AppBskyFeedDefs.FeedViewPost;
    const replies = thread.replies || [];

    return {
      ...post,
      depth,
      children: replies.map((reply: any) => this.buildThreadTree(reply, depth + 1)),
    };
  }

  // Create a new thread
  public async createThread(posts: { text: string; media?: Blob[] }[]): Promise<string[]> {
    const threadUris: string[] = [];
    let parentUri: string | undefined;
    let parentCid: string | undefined;

    for (const post of posts) {
      const rt = new RichText({ text: post.text });
      await rt.detectFacets(this.agent);

      const postBlobs = await Promise.all(
        (post.media || []).map((blob) => this.agent.uploadBlob(blob))
      );

      const response = await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        embed:
          postBlobs.length > 0
            ? {
                $type: 'app.bsky.embed.images',
                images: postBlobs.map((blob, i) => ({
                  image: blob.data.blob,
                  alt: `Image ${i + 1}`,
                })),
              }
            : undefined,
        reply: parentUri
          ? {
              root: {
                uri: threadUris[0],
                cid: (await this.agent.getPost({ uri: threadUris[0] })).data.cid,
              },
              parent: {
                uri: parentUri,
                cid: parentCid!,
              },
            }
          : undefined,
      });

      threadUris.push(response.uri);
      parentUri = response.uri;
      parentCid = response.cid;
    }

    return threadUris;
  }

  // Subscribe to thread updates
  public async subscribeToThread(
    threadUri: string,
    callback: (update: ThreadViewPost) => void
  ): Promise<() => void> {
    const initialThread = await this.getThread(threadUri);
    callback(initialThread);

    // Set up polling for thread updates
    const interval = setInterval(async () => {
      try {
        const updatedThread = await this.getThread(threadUri);
        callback(updatedThread);
      } catch (error) {
        console.error('Error polling thread:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }

  // Get thread analytics
  public async getThreadAnalytics(threadUri: string): Promise<{
    totalReplies: number;
    totalLikes: number;
    totalReposts: number;
    participantCount: number;
    participants: Set<string>;
  }> {
    const thread = await this.getThread(threadUri);
    const analytics = {
      totalReplies: 0,
      totalLikes: 0,
      totalReposts: 0,
      participantCount: 0,
      participants: new Set<string>(),
    };

    const processPost = (post: ThreadViewPost) => {
      analytics.totalReplies += post.replyCount || 0;
      analytics.totalLikes += post.likeCount || 0;
      analytics.totalReposts += post.repostCount || 0;
      analytics.participants.add(post.post.author.did);

      post.children.forEach(processPost);
    };

    processPost(thread);
    analytics.participantCount = analytics.participants.size;

    return analytics;
  }
}
