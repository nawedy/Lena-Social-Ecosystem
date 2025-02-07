import * as toxicity from '@tensorflow-models/toxicity';
import { load } from '@tensorflow/tfjs';
import { Perspective } from 'perspective-api-client';
import { createClient } from '@supabase/supabase-js';
import type {
  ContentType,
  ModerationResult,
  ModerationConfig,
  ModerationAppeal,
  CommunityFlag,
  ModerationStats,
  ModerationStatus,
  ModerationReason
} from '../types';

export class ModerationService {
  private toxicityModel: toxicity.ToxicityClassifier | null = null;
  private perspective: Perspective;
  private supabase;
  private config: ModerationConfig;

  constructor(
    perspectiveApiKey: string,
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<ModerationConfig> = {}
  ) {
    this.perspective = new Perspective({ apiKey: perspectiveApiKey });
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      aiThreshold: 0.8,
      requireHumanReview: true,
      autoRejectThreshold: 0.95,
      communityFlagsThreshold: 3,
      appealEnabled: true,
      appealWaitingPeriod: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
  }

  async initialize() {
    await load();
    this.toxicityModel = await toxicity.load(0.9);
  }

  async moderateContent(
    content: string | File,
    contentType: ContentType,
    metadata?: Record<string, any>
  ): Promise<ModerationResult> {
    let status: ModerationStatus = 'pending';
    let confidence = 0;
    let reason: ModerationReason | undefined;

    if (typeof content === 'string' && contentType === 'text') {
      // Text moderation using both TensorFlow and Perspective API
      const [toxicityResult, perspectiveResult] = await Promise.all([
        this.toxicityModel?.classify(content),
        this.perspective.analyze(content)
      ]);

      // Combine results from both models
      confidence = Math.max(
        toxicityResult?.[0]?.results[0]?.probabilities[1] || 0,
        perspectiveResult.attributeScores?.TOXICITY?.summaryScore?.value || 0
      );

      if (confidence > this.config.autoRejectThreshold) {
        status = 'rejected';
        reason = 'hate_speech';
      } else if (confidence > this.config.aiThreshold) {
        status = this.config.requireHumanReview ? 'flagged' : 'approved';
      } else {
        status = 'approved';
      }
    } else {
      // For non-text content, use AI image/video analysis (placeholder)
      status = 'pending';
      confidence = 0;
    }

    // Store moderation result
    const { data: result, error } = await this.supabase
      .from('moderation_results')
      .insert({
        content_type: contentType,
        status,
        confidence,
        reason,
        moderated_by: 'ai',
        metadata
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: result.id,
      contentId: result.content_id,
      contentType: result.content_type,
      status: result.status,
      reason: result.reason,
      confidence: result.confidence,
      moderatedBy: result.moderated_by,
      metadata: result.metadata,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at)
    };
  }

  async submitAppeal(
    moderationId: string,
    userId: string,
    reason: string,
    evidence?: string
  ): Promise<ModerationAppeal> {
    if (!this.config.appealEnabled) {
      throw new Error('Appeals are not enabled');
    }

    const { data: moderation } = await this.supabase
      .from('moderation_results')
      .select()
      .eq('id', moderationId)
      .single();

    if (!moderation) {
      throw new Error('Moderation result not found');
    }

    const timeSinceModeration = Date.now() - new Date(moderation.created_at).getTime();
    if (timeSinceModeration < this.config.appealWaitingPeriod) {
      throw new Error('Please wait before submitting an appeal');
    }

    const { data: appeal, error } = await this.supabase
      .from('moderation_appeals')
      .insert({
        moderation_id: moderationId,
        user_id: userId,
        reason,
        evidence,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: appeal.id,
      moderationId: appeal.moderation_id,
      userId: appeal.user_id,
      reason: appeal.reason,
      evidence: appeal.evidence,
      status: appeal.status,
      reviewedBy: appeal.reviewed_by,
      createdAt: new Date(appeal.created_at),
      updatedAt: new Date(appeal.updated_at)
    };
  }

  async submitCommunityFlag(
    contentId: string,
    userId: string,
    reason: ModerationReason,
    description?: string
  ): Promise<CommunityFlag> {
    const { data: flag, error } = await this.supabase
      .from('community_flags')
      .insert({
        content_id: contentId,
        user_id: userId,
        reason,
        description,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Check if content should be automatically flagged based on threshold
    const { count } = await this.supabase
      .from('community_flags')
      .select('*', { count: 'exact' })
      .eq('content_id', contentId)
      .eq('status', 'pending');

    if (count >= this.config.communityFlagsThreshold) {
      await this.supabase
        .from('moderation_results')
        .update({ status: 'flagged', moderated_by: 'community' })
        .eq('content_id', contentId);
    }

    return {
      id: flag.id,
      contentId: flag.content_id,
      userId: flag.user_id,
      reason: flag.reason,
      description: flag.description,
      status: flag.status,
      createdAt: new Date(flag.created_at)
    };
  }

  async getStats(): Promise<ModerationStats> {
    const { data: stats, error } = await this.supabase.rpc('get_moderation_stats');
    if (error) throw error;

    return {
      totalContent: stats.total_content,
      pendingReviews: stats.pending_reviews,
      approvedContent: stats.approved_content,
      rejectedContent: stats.rejected_content,
      flaggedContent: stats.flagged_content,
      averageReviewTime: stats.average_review_time,
      appealRate: stats.appeal_rate,
      appealSuccessRate: stats.appeal_success_rate
    };
  }
} 