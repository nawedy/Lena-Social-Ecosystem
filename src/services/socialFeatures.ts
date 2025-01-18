import { BskyAgent, RichText } from '@atproto/api';

export interface Group {
  uri: string;
  cid: string;
  name: string;
  description: string;
  avatar?: string;
  banner?: string;
  isPrivate: boolean;
  memberCount: number;
  rules?: string[];
  createdAt: string;
  createdBy: string;
}

export interface Event {
  uri: string;
  cid: string;
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  location?: {
    type: 'online' | 'physical' | 'hybrid';
    url?: string;
    address?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  cover?: string;
  maxAttendees?: number;
  currentAttendees: number;
  isPrivate: boolean;
  createdAt: string;
  createdBy: string;
}

export class SocialFeaturesService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Groups
  public async createGroup(params: {
    name: string;
    description: string;
    isPrivate: boolean;
    rules?: string[];
    avatar?: Blob;
    banner?: Blob;
  }): Promise<Group> {
    const [avatarBlob, bannerBlob] = await Promise.all([
      params.avatar ? this.agent.uploadBlob(params.avatar) : null,
      params.banner ? this.agent.uploadBlob(params.banner) : null,
    ]);

    const record = {
      $type: 'app.bsky.graph.group',
      name: params.name,
      description: params.description,
      isPrivate: params.isPrivate,
      rules: params.rules,
      avatar: avatarBlob?.data.blob,
      banner: bannerBlob?.data.blob,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.group',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      name: params.name,
      description: params.description,
      avatar: avatarBlob?.data.blob.ref.toString(),
      banner: bannerBlob?.data.blob.ref.toString(),
      isPrivate: params.isPrivate,
      memberCount: 1,
      rules: params.rules,
      createdAt: record.createdAt,
      createdBy: this.agent.session?.did ?? '',
    };
  }

  public async joinGroup(groupUri: string): Promise<void> {
    const record = {
      group: groupUri,
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.groupMember',
      record,
    });
  }

  public async leaveGroup(groupUri: string): Promise<void> {
    const records = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.groupMember',
    });

    const membership = records.data.records.find(
      record => record.value.group === groupUri
    );

    if (membership) {
      await this.agent.api.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.groupMember',
        rkey: membership.uri.split('/').pop()!,
      });
    }
  }

  public async postToGroup(
    groupUri: string,
    text: string,
    media?: Blob[]
  ): Promise<void> {
    const rt = new RichText({ text });
    await rt.detectFacets(this.agent);

    const mediaBlobs = await Promise.all(
      (media || []).map(blob => this.agent.uploadBlob(blob))
    );

    const record = {
      text: rt.text,
      facets: rt.facets,
      group: groupUri,
      embed:
        mediaBlobs.length > 0
          ? {
              $type: 'app.bsky.embed.images',
              images: mediaBlobs.map(blob => ({
                image: blob.data.blob,
                alt: 'Group post image',
              })),
            }
          : undefined,
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.feed.post',
      record,
    });
  }

  // Events
  public async createEvent(params: {
    title: string;
    description: string;
    startTime: string;
    endTime?: string;
    location?: Event['location'];
    cover?: Blob;
    maxAttendees?: number;
    isPrivate: boolean;
  }): Promise<Event> {
    const coverBlob = params.cover
      ? await this.agent.uploadBlob(params.cover)
      : null;

    const record = {
      $type: 'app.bsky.graph.event',
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      cover: coverBlob?.data.blob,
      maxAttendees: params.maxAttendees,
      isPrivate: params.isPrivate,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.event',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      cover: coverBlob?.data.blob.ref.toString(),
      maxAttendees: params.maxAttendees,
      currentAttendees: 1,
      isPrivate: params.isPrivate,
      createdAt: record.createdAt,
      createdBy: this.agent.session?.did ?? '',
    };
  }

  public async attendEvent(eventUri: string): Promise<void> {
    const record = {
      event: eventUri,
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.eventAttendee',
      record,
    });
  }

  public async cancelAttendance(eventUri: string): Promise<void> {
    const records = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.eventAttendee',
    });

    const attendance = records.data.records.find(
      record => record.value.event === eventUri
    );

    if (attendance) {
      await this.agent.api.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.eventAttendee',
        rkey: attendance.uri.split('/').pop()!,
      });
    }
  }

  // Get group feed
  public async getGroupFeed(
    groupUri: string,
    params?: { limit?: number; cursor?: string }
  ) {
    return this.agent.api.app.bsky.feed.getGroupFeed({
      group: groupUri,
      ...params,
    });
  }

  // Get upcoming events
  public async getUpcomingEvents(params?: { limit?: number; cursor?: string }) {
    const now = new Date().toISOString();
    return this.agent.api.app.bsky.graph.listEvents({
      after: now,
      ...params,
    });
  }

  // Search groups
  public async searchGroups(
    query: string,
    params?: { limit?: number; cursor?: string }
  ) {
    return this.agent.api.app.bsky.graph.searchGroups({
      q: query,
      ...params,
    });
  }
}
