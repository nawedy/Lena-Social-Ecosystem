import { supabase } from '$lib/supabase';

export interface ContentTest {
  id: string;
  videoId: string;
  type: 'title' | 'description' | 'tags';
  variants: ContentVariant[];
  targetImpressions: number;
  durationHours: number;
  startedAt: string;
  completedAt?: string;
  winnerId?: string;
}

export interface ContentVariant {
  id: string;
  content: string;
  impressions: number;
  clicks: number;
  ctr: number;
  isWinner: boolean;
  confidence?: number;
  metadata?: {
    aiScore?: number;
    sentiment?: number;
    readability?: number;
    keywords?: string[];
  };
}

export class ContentTestService {
  private videoId: string;

  constructor(videoId: string) {
    this.videoId = videoId;
  }

  /**
   * Start a new content A/B test
   */
  async startTest(type: ContentTest['type'], variants: string[], options: {
    targetImpressions: number;
    durationHours: number;
  }): Promise<ContentTest> {
    try {
      // End any active tests of the same type
      await this.endActiveTests(type);

      // Analyze variants with AI
      const analyzedVariants = await Promise.all(
        variants.map(async content => {
          const analysis = await this.analyzeContent(type, content);
          return {
            id: crypto.randomUUID(),
            content,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            isWinner: false,
            metadata: analysis
          };
        })
      );

      // Create new test
      const { data, error } = await supabase
        .from('content_tests')
        .insert({
          video_id: this.videoId,
          type,
          variants: analyzedVariants,
          target_impressions: options.targetImpressions,
          duration_hours: options.durationHours,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to start content test:', error);
      throw error;
    }
  }

  /**
   * End active test and select winner
   */
  async endTest(type: ContentTest['type'], winnerId?: string): Promise<void> {
    try {
      const activeTest = await this.getActiveTest(type);
      if (!activeTest) return;

      // If no winner specified, select the variant with highest confidence
      const winner = winnerId 
        ? activeTest.variants.find(v => v.id === winnerId)
        : this.selectWinner(activeTest.variants);

      if (!winner) throw new Error('Invalid winner ID');

      // Update test status
      await supabase
        .from('content_tests')
        .update({
          completed_at: new Date().toISOString(),
          winner_id: winner.id,
          variants: activeTest.variants.map(v => ({
            ...v,
            isWinner: v.id === winner.id
          }))
        })
        .eq('id', activeTest.id);

      // Update video content
      await this.updateVideoContent(type, winner.content);
    } catch (error) {
      console.error('Failed to end content test:', error);
      throw error;
    }
  }

  /**
   * Track content impression
   */
  async trackImpression(testId: string, variantId: string): Promise<void> {
    try {
      await supabase.rpc('increment_content_impression', {
        test_id: testId,
        variant_id: variantId
      });
    } catch (error) {
      console.error('Failed to track impression:', error);
    }
  }

  /**
   * Track content click/selection
   */
  async trackClick(testId: string, variantId: string): Promise<void> {
    try {
      await supabase.rpc('increment_content_click', {
        test_id: testId,
        variant_id: variantId
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }

  /**
   * Get active test of specific type
   */
  async getActiveTest(type: ContentTest['type']): Promise<ContentTest | null> {
    const { data, error } = await supabase
      .from('content_tests')
      .select('*')
      .eq('video_id', this.videoId)
      .eq('type', type)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get test results
   */
  async getTestResults(testId: string): Promise<ContentTest> {
    const { data, error } = await supabase
      .from('content_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Subscribe to test updates
   */
  subscribeToTest(testId: string, callback: (test: ContentTest) => void) {
    return supabase
      .channel(`content-test-${testId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_tests',
          filter: `id=eq.${testId}`
        },
        (payload) => callback(payload.new as ContentTest)
      )
      .subscribe();
  }

  /**
   * End any active tests of the same type
   */
  private async endActiveTests(type: ContentTest['type']): Promise<void> {
    await supabase
      .from('content_tests')
      .update({
        completed_at: new Date().toISOString(),
        status: 'cancelled'
      })
      .eq('video_id', this.videoId)
      .eq('type', type)
      .is('completed_at', null);
  }

  /**
   * Analyze content with AI
   */
  private async analyzeContent(type: ContentTest['type'], content: string) {
    try {
      const response = await fetch('/api/content/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, content })
      });

      if (!response.ok) throw new Error('Failed to analyze content');
      return await response.json();
    } catch (error) {
      console.error('Content analysis failed:', error);
      return {};
    }
  }

  /**
   * Select winner based on performance and AI analysis
   */
  private selectWinner(variants: ContentVariant[]): ContentVariant {
    // Calculate combined score using CTR and AI metrics
    const variantsWithScore = variants.map(variant => {
      const ctrScore = variant.impressions > 100 
        ? variant.ctr * 0.7 // 70% weight for CTR if enough impressions
        : variant.ctr * 0.3; // 30% weight for CTR if not enough data

      const aiScore = variant.metadata?.aiScore || 0;
      const sentimentScore = (variant.metadata?.sentiment || 0.5) * 0.1;
      const readabilityScore = (variant.metadata?.readability || 0.5) * 0.1;

      return {
        ...variant,
        score: ctrScore + (aiScore * 0.3) + sentimentScore + readabilityScore
      };
    });

    // Return variant with highest score
    return variantsWithScore.reduce((best, current) => {
      return current.score > best.score ? current : best;
    }, variantsWithScore[0]);
  }

  /**
   * Update video content with winning variant
   */
  private async updateVideoContent(type: ContentTest['type'], content: string) {
    const update = {
      [type]: content,
      updated_at: new Date().toISOString()
    };

    await supabase
      .from('videos')
      .update(update)
      .eq('id', this.videoId);
  }
}

// Create content test service instance
export function createContentTestService(videoId: string) {
  return new ContentTestService(videoId);
} 