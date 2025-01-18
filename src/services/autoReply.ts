import { BskyAgent, AppBskyFeedDefs, RichText } from '@atproto/api';

export interface AutoReplyRule {
  id: string;
  trigger: {
    type: 'keyword' | 'mention' | 'hashtag' | 'userGroup';
    value: string;
  };
  response: {
    text: string;
    includeMention: boolean;
  };
  isEnabled: boolean;
}

export class AutoReplyService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Store auto-reply rules using AT Protocol's repo
  public async saveRule(
    rule: Omit<AutoReplyRule, 'id'>
  ): Promise<AutoReplyRule> {
    const ruleWithId = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.actor.autoReply',
      record: ruleWithId,
    });

    return ruleWithId as AutoReplyRule;
  }

  // Get all auto-reply rules
  public async getRules(): Promise<AutoReplyRule[]> {
    const response = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.actor.autoReply',
    });

    return response.data.records.map(record => record.value as AutoReplyRule);
  }

  // Process incoming post for auto-replies
  public async processPost(post: AppBskyFeedDefs.FeedViewPost): Promise<void> {
    const rules = await this.getRules();
    const enabledRules = rules.filter(rule => rule.isEnabled);

    for (const rule of enabledRules) {
      if (await this.shouldTriggerRule(rule, post)) {
        await this.sendAutoReply(rule, post);
      }
    }
  }

  private async shouldTriggerRule(
    rule: AutoReplyRule,
    post: AppBskyFeedDefs.FeedViewPost
  ): Promise<boolean> {
    const postText = post.post.record.text.toLowerCase();
    const trigger = rule.trigger.value.toLowerCase();

    switch (rule.trigger.type) {
      case 'keyword':
        return postText.includes(trigger);

      case 'mention':
        return (
          post.post.record.facets?.some(facet =>
            facet.features?.some(
              feature =>
                feature.$type === 'app.bsky.richtext.facet#mention' &&
                feature.did === trigger
            )
          ) ?? false
        );

      case 'hashtag':
        return (
          post.post.record.facets?.some(facet =>
            facet.features?.some(
              feature =>
                feature.$type === 'app.bsky.richtext.facet#tag' &&
                feature.tag.toLowerCase() === trigger
            )
          ) ?? false
        );

      case 'userGroup':
        // Check if the post author is in the specified user group
        const userGroups = await this.getUserGroups();
        const group = userGroups.find(g => g.id === trigger);
        return group?.members.includes(post.post.author.did) ?? false;

      default:
        return false;
    }
  }

  private async sendAutoReply(
    rule: AutoReplyRule,
    post: AppBskyFeedDefs.FeedViewPost
  ): Promise<void> {
    let replyText = rule.response.text;

    if (rule.response.includeMention) {
      replyText = `@${post.post.author.handle} ${replyText}`;
    }

    const rt = new RichText({ text: replyText });
    await rt.detectFacets(this.agent);

    await this.agent.post({
      text: rt.text,
      facets: rt.facets,
      reply: {
        root: {
          uri: post.post.uri,
          cid: post.post.cid,
        },
        parent: {
          uri: post.post.uri,
          cid: post.post.cid,
        },
      },
    });
  }

  private async getUserGroups(): Promise<{ id: string; members: string[] }[]> {
    const response = await this.agent.api.com.atproto.repo.listRecords({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.graph.list',
    });

    return response.data.records.map(record => ({
      id: record.value.id,
      members: record.value.members,
    }));
  }
}
