import { BskyAgent } from '@atproto/api';

import { atproto } from './atproto';
import { securityService } from './security';

export interface Message {
  id: string;
  text: string;
  sender: string;
  recipient: string;
  timestamp: string;
  isEncrypted: boolean;
  attachments?: {
    type: 'image' | 'video' | 'file';
    uri: string;
    mimeType: string;
    size: number;
  }[];
  status: 'sent' | 'delivered' | 'read';
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  creator: string;
  admins: string[];
  members: string[];
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
  settings: {
    onlyAdminsCanPost: boolean;
    onlyAdminsCanAddMembers: boolean;
    requireApprovalForJoin: boolean;
    maxMembers?: number;
  };
}

export class ATProtocolMessagingService {
  private agent: BskyAgent;

  constructor() {
    this.agent = atproto.getAgent();
  }

  // Direct Messaging
  async sendDirectMessage(params: {
    recipientDid: string;
    text: string;
    attachments?: { type: 'image' | 'video' | 'file'; data: Blob }[];
    encrypt?: boolean;
  }): Promise<Message> {
    try {
      let encryptedText = params.text;
      if (params.encrypt) {
        const { encryptedData, iv } = await securityService.encryptData(params.text);
        encryptedText = JSON.stringify({ data: encryptedData, iv });
      }

      const attachments = params.attachments
        ? await Promise.all(
            params.attachments.map(async (attachment) => {
              const upload = await this.agent.uploadBlob(attachment.data, {
                encoding:
                  attachment.type === 'image'
                    ? 'image/jpeg'
                    : attachment.type === 'video'
                    ? 'video/mp4'
                    : 'application/octet-stream',
              });
              return {
                type: attachment.type,
                uri: upload.data.blob.ref.toString(),
                mimeType: upload.data.blob.mimeType,
                size: attachment.data.size,
              };
            })
          )
        : undefined;

      const record = {
        $type: 'app.bsky.graph.message',
        text: encryptedText,
        recipient: params.recipientDid,
        isEncrypted: params.encrypt ?? false,
        attachments,
        timestamp: new Date().toISOString(),
      };

      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.message',
        record,
      });

      return {
        id: response.uri,
        text: params.text,
        sender: this.agent.session?.did ?? '',
        recipient: params.recipientDid,
        timestamp: record.timestamp,
        isEncrypted: params.encrypt ?? false,
        attachments,
        status: 'sent',
      };
    } catch (error) {
      console.error('Direct message sending error:', error);
      throw error;
    }
  }

  async getDirectMessages(params?: {
    limit?: number;
    cursor?: string;
    since?: string;
  }): Promise<{
    messages: Message[];
    cursor?: string;
  }> {
    try {
      const response = await this.agent.api.app.bsky.graph.getMessages({
        ...params,
        did: this.agent.session?.did,
      });

      const messages = await Promise.all(
        response.messages.map(async (msg) => {
          let text = msg.record.text;
          if (msg.record.isEncrypted) {
            const { data, iv } = JSON.parse(text);
            text = await securityService.decryptData(data, iv);
          }

          return {
            id: msg.uri,
            text,
            sender: msg.record.sender,
            recipient: msg.record.recipient,
            timestamp: msg.record.timestamp,
            isEncrypted: msg.record.isEncrypted,
            attachments: msg.record.attachments,
            status: msg.record.status,
          };
        })
      );

      return {
        messages,
        cursor: response.cursor,
      };
    } catch (error) {
      console.error('Direct messages fetch error:', error);
      throw error;
    }
  }

  // Groups
  async createGroup(params: {
    name: string;
    description?: string;
    avatar?: Blob;
    isPrivate: boolean;
    settings?: Partial<Group['settings']>;
  }): Promise<Group> {
    try {
      const avatarBlob = params.avatar
        ? await this.agent.uploadBlob(params.avatar, { encoding: 'image/jpeg' })
        : undefined;

      const timestamp = new Date().toISOString();
      const record = {
        $type: 'app.bsky.graph.group',
        name: params.name,
        description: params.description,
        avatar: avatarBlob?.data.blob,
        creator: this.agent.session?.did,
        admins: [this.agent.session?.did],
        members: [this.agent.session?.did],
        isPrivate: params.isPrivate,
        settings: {
          onlyAdminsCanPost: false,
          onlyAdminsCanAddMembers: false,
          requireApprovalForJoin: params.isPrivate,
          maxMembers: 1000,
          ...params.settings,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.group',
        record,
      });

      return {
        id: response.uri,
        ...record,
        avatar: avatarBlob?.data.blob.ref.toString(),
      };
    } catch (error) {
      console.error('Group creation error:', error);
      throw error;
    }
  }

  async joinGroup(groupId: string): Promise<void> {
    try {
      const group = await this.getGroup(groupId);

      if (group.settings.requireApprovalForJoin) {
        await this.requestGroupJoin(groupId);
      } else {
        await this.agent.api.com.atproto.repo.createRecord({
          repo: this.agent.session?.did ?? '',
          collection: 'app.bsky.graph.groupMember',
          record: {
            group: groupId,
            member: this.agent.session?.did,
            joinedAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Group join error:', error);
      throw error;
    }
  }

  async leaveGroup(groupId: string): Promise<void> {
    try {
      await this.agent.api.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.groupMember',
        rkey: `${groupId}#${this.agent.session?.did}`,
      });
    } catch (error) {
      console.error('Group leave error:', error);
      throw error;
    }
  }

  async getGroup(groupId: string): Promise<Group> {
    try {
      const response = await this.agent.api.app.bsky.graph.getGroup({
        group: groupId,
      });

      return {
        id: response.uri,
        name: response.record.name,
        description: response.record.description,
        avatar: response.record.avatar?.ref.toString(),
        creator: response.record.creator,
        admins: response.record.admins,
        members: response.record.members,
        createdAt: response.record.createdAt,
        updatedAt: response.record.updatedAt,
        isPrivate: response.record.isPrivate,
        settings: response.record.settings,
      };
    } catch (error) {
      console.error('Group fetch error:', error);
      throw error;
    }
  }

  private async requestGroupJoin(groupId: string): Promise<void> {
    try {
      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.graph.groupJoinRequest',
        record: {
          group: groupId,
          member: this.agent.session?.did,
          requestedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Group join request error:', error);
      throw error;
    }
  }
}

export const atProtocolMessaging = new ATProtocolMessagingService();
