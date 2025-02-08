import { supabase } from '$lib/supabase';
import type { ThumbnailTest, ThumbnailVariant } from '$lib/types/analytics';

export class ThumbnailTestService {
  private videoId: string;

  constructor(videoId: string) {
    this.videoId = videoId;
  }

  /**
   * Start a new A/B test
   */
  async startTest(variants: string[], options: {
    targetImpressions: number;
    durationHours: number;
  }): Promise<ThumbnailTest> {
    try {
      // End any active tests
      await this.endActiveTests();

      // Create new test
      const { data, error } = await supabase
        .from('thumbnail_tests')
        .insert({
          video_id: this.videoId,
          variants: variants.map(imageUrl => ({
            id: crypto.randomUUID(),
            imageUrl,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            isWinner: false
          })),
          target_impressions: options.targetImpressions,
          duration_hours: options.durationHours,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to start A/B test:', error);
      throw error;
    }
  }

  /**
   * End active tests and select winner
   */
  async endTest(winnerId?: string): Promise<void> {
    try {
      const activeTest = await this.getActiveTest();
      if (!activeTest) return;

      // If no winner specified, select the variant with highest CTR
      const winner = winnerId 
        ? activeTest.variants.find(v => v.id === winnerId)
        : this.selectWinner(activeTest.variants);

      if (!winner) throw new Error('Invalid winner ID');

      // Update test status
      await supabase
        .from('thumbnail_tests')
        .update({
          completed_at: new Date().toISOString(),
          winner_id: winner.id,
          variants: activeTest.variants.map(v => ({
            ...v,
            isWinner: v.id === winner.id
          }))
        })
        .eq('id', activeTest.id);

      // Update video thumbnail
      await supabase
        .from('videos')
        .update({
          thumbnail_url: winner.imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.videoId);
    } catch (error) {
      console.error('Failed to end A/B test:', error);
      throw error;
    }
  }

  /**
   * Track thumbnail impression
   */
  async trackImpression(variantId: string): Promise<void> {
    try {
      await supabase.rpc('increment_thumbnail_impression', {
        variant_id: variantId
      });
    } catch (error) {
      console.error('Failed to track impression:', error);
    }
  }

  /**
   * Track thumbnail click
   */
  async trackClick(variantId: string): Promise<void> {
    try {
      await supabase.rpc('increment_thumbnail_click', {
        variant_id: variantId
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }

  /**
   * Get active test
   */
  async getActiveTest(): Promise<ThumbnailTest | null> {
    const { data, error } = await supabase
      .from('thumbnail_tests')
      .select('*')
      .eq('video_id', this.videoId)
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
  async getTestResults(testId: string): Promise<ThumbnailTest> {
    const { data, error } = await supabase
      .from('thumbnail_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Subscribe to test updates
   */
  subscribeToTest(testId: string, callback: (test: ThumbnailTest) => void) {
    return supabase
      .channel(`thumbnail-test-${testId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'thumbnail_tests',
          filter: `id=eq.${testId}`
        },
        (payload) => callback(payload.new as ThumbnailTest)
      )
      .subscribe();
  }

  /**
   * End any active tests
   */
  private async endActiveTests(): Promise<void> {
    await supabase
      .from('thumbnail_tests')
      .update({
        completed_at: new Date().toISOString(),
        status: 'cancelled'
      })
      .eq('video_id', this.videoId)
      .is('completed_at', null);
  }

  /**
   * Select winner based on performance
   */
  private selectWinner(variants: ThumbnailVariant[]): ThumbnailVariant {
    // Calculate confidence intervals for each variant
    const variantsWithConfidence = variants.map(variant => ({
      ...variant,
      confidence: this.calculateConfidence(variant, variants)
    }));

    // Select variant with highest confidence
    return variantsWithConfidence.reduce((best, current) => {
      return (current.confidence || 0) > (best.confidence || 0) ? current : best;
    }, variantsWithConfidence[0]);
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(variant: ThumbnailVariant, allVariants: ThumbnailVariant[]): number {
    const totalImpressions = allVariants.reduce((sum, v) => sum + v.impressions, 0);
    if (totalImpressions < 100) return 0;

    const variantCTR = variant.clicks / variant.impressions;
    const otherVariants = allVariants.filter(v => v.id !== variant.id);
    const avgOtherCTR = otherVariants.reduce((sum, v) => sum + (v.clicks / v.impressions), 0) / otherVariants.length;

    // Calculate z-score
    const standardError = Math.sqrt(variantCTR * (1 - variantCTR) / variant.impressions);
    const zScore = (variantCTR - avgOtherCTR) / standardError;

    // Convert to confidence percentage
    return Math.min(0.9999, (1 + Math.erf(zScore / Math.sqrt(2))) / 2) * 100;
  }
}

// Create thumbnail test service instance
export function createThumbnailTestService(videoId: string) {
  return new ThumbnailTestService(videoId);
} 