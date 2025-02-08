import { supabase } from '$lib/supabaseClient';
import { BskyAgent } from '@atproto/api';
import { ActivityPub } from '@activity/client';
import type { Post, Profile, Activity } from '$lib/types';

interface FederationConfig {
  atProto: {
    service: string;
    identifier: string;
    password: string;
  };
  activityPub: {
    domain: string;
    privateKey: string;
    publicKey: string;
  };
}

class FederationService {
  private bskyAgent: BskyAgent;
  private activityPubClient: ActivityPub;
  private config: FederationConfig;

  constructor() {
    this.config = {
      atProto: {
        service: import.meta.env.VITE_ATP_SERVICE,
        identifier: import.meta.env.VITE_ATP_IDENTIFIER,
        password: import.meta.env.VITE_ATP_PASSWORD
      },
      activityPub: {
        domain: import.meta.env.VITE_ACTIVITYPUB_DOMAIN,
        privateKey: import.meta.env.VITE_ACTIVITYPUB_PRIVATE_KEY,
        publicKey: import.meta.env.VITE_ACTIVITYPUB_PUBLIC_KEY
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize AT Protocol client
      this.bskyAgent = new BskyAgent({
        service: this.config.atProto.service
      });
      await this.bskyAgent.login({
        identifier: this.config.atProto.identifier,
        password: this.config.atProto.password
      });

      // Initialize ActivityPub client
      this.activityPubClient = new ActivityPub({
        domain: this.config.activityPub.domain,
        privateKey: this.config.activityPub.privateKey,
        publicKey: this.config.activityPub.publicKey
      });

      // Start federation sync
      this.startFederationSync();
    } catch (error) {
      console.error('Error initializing federation service:', error);
      throw error;
    }
  }

  private async startFederationSync(): Promise<void> {
    // Set up real-time listeners for local content changes
    const subscription = supabase
      .from('posts')
      .on('INSERT', async (payload) => {
        await this.federatePost(payload.new);
      })
      .on('UPDATE', async (payload) => {
        await this.updateFederatedPost(payload.new);
      })
      .on('DELETE', async (payload) => {
        await this.deleteFederatedPost(payload.old);
      })
      .subscribe();

    // Handle cleanup
    window.addEventListener('beforeunload', () => {
      subscription.unsubscribe();
    });
  }

  async federatePost(post: Post): Promise<void> {
    try {
      // Federate to AT Protocol
      const atpRecord = await this.bskyAgent.post({
        text: post.content,
        embed: this.convertEmbedsToATP(post.embeds),
        reply: post.replyTo ? { parent: { uri: post.replyTo } } : undefined
      });

      // Federate to ActivityPub
      const activity = this.createActivityPubActivity(post);
      await this.activityPubClient.createActivity(activity);

      // Store federation IDs
      await supabase
        .from('post_federation')
        .insert({
          post_id: post.id,
          atp_uri: atpRecord.uri,
          activitypub_id: activity.id
        });
    } catch (error) {
      console.error('Error federating post:', error);
      throw error;
    }
  }

  async updateFederatedPost(post: Post): Promise<void> {
    try {
      // Get federation IDs
      const { data: federation } = await supabase
        .from('post_federation')
        .select('*')
        .eq('post_id', post.id)
        .single();

      if (federation) {
        // Update on AT Protocol
        await this.bskyAgent.post({
          text: post.content,
          embed: this.convertEmbedsToATP(post.embeds),
          reply: post.replyTo ? { parent: { uri: post.replyTo } } : undefined
        });

        // Update on ActivityPub
        const activity = this.createActivityPubActivity(post, 'Update');
        await this.activityPubClient.updateActivity(activity);
      }
    } catch (error) {
      console.error('Error updating federated post:', error);
      throw error;
    }
  }

  async deleteFederatedPost(post: Post): Promise<void> {
    try {
      // Get federation IDs
      const { data: federation } = await supabase
        .from('post_federation')
        .select('*')
        .eq('post_id', post.id)
        .single();

      if (federation) {
        // Delete from AT Protocol
        await this.bskyAgent.deletePost(federation.atp_uri);

        // Delete from ActivityPub
        await this.activityPubClient.deleteActivity(federation.activitypub_id);

        // Remove federation record
        await supabase
          .from('post_federation')
          .delete()
          .eq('post_id', post.id);
      }
    } catch (error) {
      console.error('Error deleting federated post:', error);
      throw error;
    }
  }

  private convertEmbedsToATP(embeds: any[]): any {
    // Convert local embed format to AT Protocol format
    return embeds.map(embed => {
      if (embed.type === 'image') {
        return {
          $type: 'app.bsky.embed.images',
          images: [{
            alt: embed.alt,
            image: embed.url
          }]
        };
      }
      // Add other embed type conversions as needed
      return null;
    }).filter(Boolean);
  }

  private createActivityPubActivity(post: Post, type: string = 'Create'): Activity {
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type,
      actor: `https://${this.config.activityPub.domain}/users/${post.authorId}`,
      object: {
        type: 'Note',
        content: post.content,
        attributedTo: `https://${this.config.activityPub.domain}/users/${post.authorId}`,
        published: post.createdAt,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        attachment: post.embeds.map(embed => ({
          type: 'Image',
          url: embed.url,
          name: embed.alt
        }))
      }
    };
  }

  async importFederatedPost(uri: string): Promise<Post> {
    try {
      if (uri.startsWith('at://')) {
        // Import from AT Protocol
        const post = await this.bskyAgent.getPost({ uri });
        return this.convertATPToLocalPost(post);
      } else {
        // Import from ActivityPub
        const activity = await this.activityPubClient.getActivity(uri);
        return this.convertActivityPubToLocalPost(activity);
      }
    } catch (error) {
      console.error('Error importing federated post:', error);
      throw error;
    }
  }

  private convertATPToLocalPost(atpPost: any): Post {
    return {
      content: atpPost.record.text,
      authorId: atpPost.author.did,
      createdAt: new Date(atpPost.record.createdAt),
      embeds: atpPost.record.embed?.images?.map((img: any) => ({
        type: 'image',
        url: img.image.ref,
        alt: img.alt
      })) || [],
      replyTo: atpPost.record.reply?.parent?.uri
    };
  }

  private convertActivityPubToLocalPost(activity: Activity): Post {
    const object = activity.object as any;
    return {
      content: object.content,
      authorId: object.attributedTo.split('/').pop(),
      createdAt: new Date(object.published),
      embeds: object.attachment?.map((attach: any) => ({
        type: 'image',
        url: attach.url,
        alt: attach.name
      })) || [],
      replyTo: object.inReplyTo
    };
  }

  async federateProfile(profile: Profile): Promise<void> {
    try {
      // Update AT Protocol profile
      await this.bskyAgent.updateProfile({
        displayName: profile.displayName,
        description: profile.bio,
        avatar: profile.avatar
      });

      // Update ActivityPub profile
      const actor = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Person',
        id: `https://${this.config.activityPub.domain}/users/${profile.id}`,
        name: profile.displayName,
        summary: profile.bio,
        icon: {
          type: 'Image',
          url: profile.avatar
        }
      };
      await this.activityPubClient.updateActor(actor);
    } catch (error) {
      console.error('Error federating profile:', error);
      throw error;
    }
  }
}

export const federationService = new FederationService(); 