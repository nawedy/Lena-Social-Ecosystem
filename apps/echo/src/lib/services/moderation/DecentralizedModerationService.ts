import { supabase } from '$lib/supabaseClient';
import { contentAnalysisService } from '../ai/ContentAnalysisService';

interface ModerationAction {
  postId: string;
  moderatorId: string;
  action: 'approve' | 'reject' | 'flag';
  reason: string;
  evidence?: string;
  confidence: number;
  timestamp: Date;
}

interface ModerationVote {
  actionId: string;
  voterId: string;
  vote: 'support' | 'oppose';
  reason?: string;
  timestamp: Date;
}

interface ModerationThresholds {
  minVotes: number;
  minSupportRatio: number;
  minModeratorReputation: number;
  maxReviewTime: number;
  aiConfidenceThreshold: number;
}

interface ModeratorStats {
  totalActions: number;
  accurateActions: number;
  reputation: number;
  specializations: string[];
  lastActive: Date;
}

class DecentralizedModerationService {
  private readonly thresholds: ModerationThresholds = {
    minVotes: 3,
    minSupportRatio: 0.66,
    minModeratorReputation: 0.5,
    maxReviewTime: 24 * 60 * 60 * 1000, // 24 hours
    aiConfidenceThreshold: 0.9
  };

  async moderateContent(postId: string, content: string): Promise<boolean> {
    try {
      // First, check AI moderation
      const aiAnalysis = await contentAnalysisService.analyzeContent(content);
      
      // If AI is highly confident about content being inappropriate
      if (
        aiAnalysis.toxicity > this.thresholds.aiConfidenceThreshold ||
        aiAnalysis.moderationFlags.spam ||
        aiAnalysis.moderationFlags.hate ||
        aiAnalysis.moderationFlags.violence
      ) {
        await this.createModerationAction({
          postId,
          moderatorId: 'ai-system',
          action: 'reject',
          reason: this.getAIModeratorReason(aiAnalysis),
          confidence: Math.max(
            aiAnalysis.toxicity,
            aiAnalysis.moderationFlags.spam ? 1 : 0,
            aiAnalysis.moderationFlags.hate ? 1 : 0,
            aiAnalysis.moderationFlags.violence ? 1 : 0
          ),
          timestamp: new Date()
        });
        return false;
      }

      // If content passes AI check but needs human review
      if (aiAnalysis.toxicity > 0.5) {
        await this.queueForHumanReview(postId, content, aiAnalysis);
      }

      return true;
    } catch (error) {
      console.error('Error in content moderation:', error);
      return true; // Default to allowing content if moderation fails
    }
  }

  private getAIModeratorReason(analysis: any): string {
    const reasons = [];
    if (analysis.toxicity > this.thresholds.aiConfidenceThreshold) {
      reasons.push('High toxicity content');
    }
    if (analysis.moderationFlags.spam) {
      reasons.push('Spam content detected');
    }
    if (analysis.moderationFlags.hate) {
      reasons.push('Hate speech detected');
    }
    if (analysis.moderationFlags.violence) {
      reasons.push('Violent content detected');
    }
    return reasons.join(', ');
  }

  private async queueForHumanReview(
    postId: string,
    content: string,
    aiAnalysis: any
  ): Promise<void> {
    await supabase
      .from('moderation_queue')
      .insert({
        post_id: postId,
        content,
        ai_analysis: aiAnalysis,
        status: 'pending',
        created_at: new Date().toISOString()
      });
  }

  async submitModerationAction(action: ModerationAction): Promise<void> {
    try {
      // Check moderator reputation
      const moderatorStats = await this.getModeratorStats(action.moderatorId);
      if (moderatorStats.reputation < this.thresholds.minModeratorReputation) {
        throw new Error('Insufficient moderator reputation');
      }

      // Create moderation action
      const { data: moderationAction, error } = await supabase
        .from('moderation_actions')
        .insert({
          post_id: action.postId,
          moderator_id: action.moderatorId,
          action: action.action,
          reason: action.reason,
          evidence: action.evidence,
          confidence: action.confidence,
          created_at: action.timestamp.toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update moderator stats
      await this.updateModeratorStats(action.moderatorId, moderationAction);

      // Check if action should be automatically applied
      if (moderatorStats.reputation > 0.9 && action.confidence > 0.9) {
        await this.applyModerationAction(moderationAction);
      }
    } catch (error) {
      console.error('Error submitting moderation action:', error);
      throw error;
    }
  }

  async submitModerationVote(vote: ModerationVote): Promise<void> {
    try {
      // Record vote
      await supabase
        .from('moderation_votes')
        .insert({
          action_id: vote.actionId,
          voter_id: vote.voterId,
          vote: vote.vote,
          reason: vote.reason,
          created_at: vote.timestamp.toISOString()
        });

      // Check if action has reached consensus
      await this.checkConsensus(vote.actionId);
    } catch (error) {
      console.error('Error submitting moderation vote:', error);
      throw error;
    }
  }

  private async checkConsensus(actionId: string): Promise<void> {
    // Get all votes for the action
    const { data: votes } = await supabase
      .from('moderation_votes')
      .select('*')
      .eq('action_id', actionId);

    if (!votes || votes.length < this.thresholds.minVotes) {
      return; // Not enough votes yet
    }

    // Calculate support ratio
    const supportVotes = votes.filter(v => v.vote === 'support').length;
    const supportRatio = supportVotes / votes.length;

    // Get the moderation action
    const { data: action } = await supabase
      .from('moderation_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (!action) return;

    // If consensus reached, apply the action
    if (supportRatio >= this.thresholds.minSupportRatio) {
      await this.applyModerationAction(action);
    } else if (supportRatio <= (1 - this.thresholds.minSupportRatio)) {
      // If action is clearly rejected, mark it as rejected
      await this.rejectModerationAction(action);
    }
  }

  private async applyModerationAction(action: any): Promise<void> {
    // Update post status based on action
    if (action.action === 'reject') {
      await supabase
        .from('posts')
        .update({
          status: 'removed',
          moderation_reason: action.reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', action.post_id);
    }

    // Update action status
    await supabase
      .from('moderation_actions')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString()
      })
      .eq('id', action.id);

    // Update moderator reputation
    await this.updateModeratorReputation(action.moderator_id, true);
  }

  private async rejectModerationAction(action: any): Promise<void> {
    await supabase
      .from('moderation_actions')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', action.id);

    // Update moderator reputation
    await this.updateModeratorReputation(action.moderator_id, false);
  }

  private async getModeratorStats(moderatorId: string): Promise<ModeratorStats> {
    const { data } = await supabase
      .from('moderator_stats')
      .select('*')
      .eq('moderator_id', moderatorId)
      .single();

    if (!data) {
      // Create new moderator stats
      return {
        totalActions: 0,
        accurateActions: 0,
        reputation: 0.5, // Start with neutral reputation
        specializations: [],
        lastActive: new Date()
      };
    }

    return data;
  }

  private async updateModeratorStats(
    moderatorId: string,
    action: any
  ): Promise<void> {
    const stats = await this.getModeratorStats(moderatorId);

    await supabase
      .from('moderator_stats')
      .upsert({
        moderator_id: moderatorId,
        total_actions: stats.totalActions + 1,
        accurate_actions: stats.accurateActions,
        reputation: stats.reputation,
        specializations: stats.specializations,
        last_active: new Date().toISOString()
      });
  }

  private async updateModeratorReputation(
    moderatorId: string,
    wasAccurate: boolean
  ): Promise<void> {
    const stats = await this.getModeratorStats(moderatorId);

    const newAccurateActions = stats.accurateActions + (wasAccurate ? 1 : 0);
    const newReputation = newAccurateActions / (stats.totalActions + 1);

    await supabase
      .from('moderator_stats')
      .update({
        accurate_actions: newAccurateActions,
        reputation: newReputation,
        updated_at: new Date().toISOString()
      })
      .eq('moderator_id', moderatorId);
  }

  async getModeratorQueue(moderatorId: string): Promise<any[]> {
    // Get moderator's specializations
    const stats = await this.getModeratorStats(moderatorId);

    // Get posts needing review, prioritizing moderator's specializations
    const { data: queue } = await supabase
      .from('moderation_queue')
      .select(`
        *,
        post:post_id (*)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!queue) return [];

    // Sort queue based on moderator specializations and content categories
    return queue.sort((a, b) => {
      const aMatchesSpecialization = stats.specializations.some(
        spec => a.ai_analysis.contentCategory === spec
      );
      const bMatchesSpecialization = stats.specializations.some(
        spec => b.ai_analysis.contentCategory === spec
      );

      if (aMatchesSpecialization && !bMatchesSpecialization) return -1;
      if (!aMatchesSpecialization && bMatchesSpecialization) return 1;
      return 0;
    });
  }

  startPeriodicReview(): void {
    setInterval(async () => {
      try {
        // Get actions that have been pending for too long
        const cutoffTime = new Date(Date.now() - this.thresholds.maxReviewTime);
        
        const { data: pendingActions } = await supabase
          .from('moderation_actions')
          .select('*')
          .eq('status', 'pending')
          .lt('created_at', cutoffTime.toISOString());

        if (!pendingActions) return;

        // Process each expired action
        for (const action of pendingActions) {
          // Get votes for this action
          const { data: votes } = await supabase
            .from('moderation_votes')
            .select('*')
            .eq('action_id', action.id);

          if (!votes || votes.length === 0) {
            // No votes received, reject the action
            await this.rejectModerationAction(action);
          } else {
            // Apply majority decision
            const supportVotes = votes.filter(v => v.vote === 'support').length;
            const supportRatio = supportVotes / votes.length;

            if (supportRatio >= 0.5) {
              await this.applyModerationAction(action);
            } else {
              await this.rejectModerationAction(action);
            }
          }
        }
      } catch (error) {
        console.error('Error in periodic moderation review:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
}

export const decentralizedModerationService = new DecentralizedModerationService(); 