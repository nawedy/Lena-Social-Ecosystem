import { BskyAgent, RichText } from '@atproto/api';

export interface ContentData {
  text: string;
  media?: {
    type: 'image' | 'video';
    url: string;
    alt?: string;
  }[];
  tags?: string[];
}

export interface ContentMetadata {
  visibility: 'public' | 'private' | 'unlisted';
  language?: string;
  contentWarning?: string;
}

export class ContentManager {
  private agent: BskyAgent;

  constructor(serviceUrl: string = 'https://bsky.social') {
    this.agent = new BskyAgent({ service: serviceUrl });
  }

  async uploadContent(
    content: ContentData,
    metadata: ContentMetadata
  ): Promise<string> {
    const richText = new RichText({ text: content.text });
    await richText.detectFacets(this.agent);

    const post = {
      text: richText.text,
      facets: richText.facets,
      labels: metadata.contentWarning
        ? {
            values: [{ val: metadata.contentWarning }],
          }
        : undefined,
      langs: metadata.language ? [metadata.language] : undefined,
    };

    const response = await this.agent.post(post);
    return response.uri;
  }

  async deleteContent(uri: string): Promise<void> {
    await this.agent.deletePost(uri);
  }

  async likeContent(uri: string, cid: string): Promise<void> {
    await this.agent.like(uri, cid);
  }

  async repostContent(uri: string, cid: string): Promise<void> {
    await this.agent.repost(uri, cid);
  }
}
