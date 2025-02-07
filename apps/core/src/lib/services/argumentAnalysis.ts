import { supabase } from '$lib/supabaseClient';
import type { FactCheckerResult } from '$lib/components/FactChecker.svelte';

export interface SourceAnalysis {
  sourceId: string;
  url: string;
  title: string;
  author: string;
  publicationDate: string;
  domain: string;
  trustScore: number;
  biasScore: number;
  factualityScore: number;
  academicReferences: number;
  peerReviewed: boolean;
  citations: number;
  sourceDiversity: number;
  temporalRelevance: number;
}

export interface ExpertReview {
  expertId: string;
  expertName: string;
  credentials: string[];
  institution: string;
  review: string;
  rating: number;
  confidence: number;
  timestamp: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface CommunityModeration {
  userId: string;
  moderationAction: 'flag' | 'approve' | 'reject';
  reason: string;
  evidence: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
  supportingVotes: number;
  opposingVotes: number;
}

export interface ArgumentAnalysis {
  argumentId: string;
  sourceAnalysis: SourceAnalysis[];
  expertReviews: ExpertReview[];
  communityModeration: CommunityModeration[];
  aiAnalysis: {
    logicalCoherence: number;
    evidenceStrength: number;
    biasDetection: number;
    fallacyDetection: string[];
    counterarguments: string[];
  };
  compositeScores: {
    trustworthiness: number;
    relevance: number;
    impact: number;
    consensus: number;
  };
}

class ArgumentAnalysisService {
  async analyzeArgument(content: string): Promise<ArgumentAnalysis> {
    const { data, error } = await supabase
      .from('argument_analysis')
      .select('*')
      .eq('content', content)
      .single();

    if (error) {
      throw new Error('Failed to analyze argument');
    }

    return data;
  }

  async submitExpertReview(review: Omit<ExpertReview, 'timestamp' | 'verificationStatus'>): Promise<void> {
    const { error } = await supabase
      .from('expert_reviews')
      .insert({
        ...review,
        timestamp: new Date().toISOString(),
        verificationStatus: 'pending'
      });

    if (error) {
      throw new Error('Failed to submit expert review');
    }
  }

  async submitModerationAction(moderation: Omit<CommunityModeration, 'timestamp' | 'status' | 'supportingVotes' | 'opposingVotes'>): Promise<void> {
    const { error } = await supabase
      .from('community_moderation')
      .insert({
        ...moderation,
        timestamp: new Date().toISOString(),
        status: 'pending',
        supportingVotes: 0,
        opposingVotes: 0
      });

    if (error) {
      throw new Error('Failed to submit moderation action');
    }
  }

  async voteModerationAction(moderationId: string, vote: 'support' | 'oppose'): Promise<void> {
    const { error } = await supabase.rpc('vote_moderation_action', {
      moderation_id: moderationId,
      vote_type: vote
    });

    if (error) {
      throw new Error('Failed to vote on moderation action');
    }
  }

  async getArgumentFactCheck(argumentId: string): Promise<FactCheckerResult> {
    const { data, error } = await supabase
      .from('fact_checker_results')
      .select('*')
      .eq('argument_id', argumentId)
      .single();

    if (error) {
      throw new Error('Failed to get fact check results');
    }

    return data;
  }

  async getSourceAnalysis(url: string): Promise<SourceAnalysis> {
    const { data, error } = await supabase
      .from('source_analysis')
      .select('*')
      .eq('url', url)
      .single();

    if (error) {
      throw new Error('Failed to get source analysis');
    }

    return data;
  }

  async getExpertReviews(argumentId: string): Promise<ExpertReview[]> {
    const { data, error } = await supabase
      .from('expert_reviews')
      .select('*')
      .eq('argument_id', argumentId)
      .eq('verificationStatus', 'verified');

    if (error) {
      throw new Error('Failed to get expert reviews');
    }

    return data;
  }

  async getCommunityModeration(argumentId: string): Promise<CommunityModeration[]> {
    const { data, error } = await supabase
      .from('community_moderation')
      .select('*')
      .eq('argument_id', argumentId);

    if (error) {
      throw new Error('Failed to get community moderation');
    }

    return data;
  }
}

export const argumentAnalysisService = new ArgumentAnalysisService(); 