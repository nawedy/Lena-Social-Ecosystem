<script context="module" lang="ts">
  export interface FactCheckerResult {
    sourceId: string;
    trustScore: number;
    biasScore: number;
    factualityScore: number;
    academicReferences: number;
    peerReviewed: boolean;
    citations: number;
    sourceDiversity: number;
    temporalRelevance: number;
    expertConsensus: number;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { argumentAnalysisService } from '$lib/services/argumentAnalysis';
  import type { ArgumentAnalysis, ExpertReview, CommunityModeration } from '$lib/services/argumentAnalysis';
  
  // Props
  export let argumentId: string;
  export let content: string;
  
  // State
  let analysis: ArgumentAnalysis | null = null;
  let expertReviews: ExpertReview[] = [];
  let communityModeration: CommunityModeration[] = [];
  let isLoading = true;
  let error: string | null = null;
  
  // Reactive statements
  $: compositeScore = analysis ? calculateCompositeScore(analysis) : 0;
  $: trustLevel = getTrustLevel(compositeScore);
  $: moderationStatus = getModerationStatus(communityModeration);
  
  onMount(async () => {
    try {
      // Load all analysis data in parallel
      const [analysisData, reviews, moderation] = await Promise.all([
        argumentAnalysisService.analyzeArgument(content),
        argumentAnalysisService.getExpertReviews(argumentId),
        argumentAnalysisService.getCommunityModeration(argumentId)
      ]);
      
      analysis = analysisData;
      expertReviews = reviews;
      communityModeration = moderation;
    } catch (error: unknown) {
      if (error instanceof Error) {
        error = error.message;
      } else {
        error = 'An unknown error occurred';
      }
    } finally {
      isLoading = false;
    }
  });
  
  function calculateCompositeScore(analysis: ArgumentAnalysis): number {
    const {
      trustworthiness,
      relevance,
      impact,
      consensus
    } = analysis.compositeScores;
    
    // Weighted average of different scores
    return (
      trustworthiness * 0.4 +
      relevance * 0.2 +
      impact * 0.2 +
      consensus * 0.2
    );
  }
  
  function getTrustLevel(score: number): string {
    if (score >= 0.8) return 'Very High';
    if (score >= 0.6) return 'High';
    if (score >= 0.4) return 'Moderate';
    if (score >= 0.2) return 'Low';
    return 'Very Low';
  }
  
  function getModerationStatus(moderation: CommunityModeration[]): string {
    const approved = moderation.filter(m => m.status === 'accepted').length;
    const rejected = moderation.filter(m => m.status === 'rejected').length;
    const total = moderation.length;
    
    if (total === 0) return 'Pending Review';
    if (approved > rejected * 2) return 'Community Approved';
    if (rejected > approved * 2) return 'Community Flagged';
    return 'Under Discussion';
  }
  
  async function handleModerationAction(action: 'flag' | 'approve' | 'reject', reason: string) {
    try {
      await argumentAnalysisService.submitModerationAction({
        userId: 'current-user-id', // Replace with actual user ID
        moderationAction: action,
        reason,
        evidence: content
      });
      
      // Refresh moderation data
      communityModeration = await argumentAnalysisService.getCommunityModeration(argumentId);
    } catch (error: unknown) {
      if (error instanceof Error) {
        error = error.message;
      } else {
        error = 'An unknown error occurred';
      }
    }
  }
  
  async function handleExpertReview(review: string, rating: number) {
    try {
      await argumentAnalysisService.submitExpertReview({
        expertId: 'current-expert-id', // Replace with actual expert ID
        expertName: 'Expert Name', // Replace with actual expert name
        credentials: ['Credential 1', 'Credential 2'],
        institution: 'Institution Name',
        review,
        rating,
        confidence: 0.9
      });
      
      // Refresh expert reviews
      expertReviews = await argumentAnalysisService.getExpertReviews(argumentId);
    } catch (error: unknown) {
      if (error instanceof Error) {
        error = error.message;
      } else {
        error = 'An unknown error occurred';
      }
    }
  }
</script>

<div class="fact-checker {trustLevel.toLowerCase()}-trust">
  {#if isLoading}
    <div class="loading">Analyzing argument...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if analysis}
    <div class="analysis-header">
      <h3>Argument Analysis</h3>
      <div class="trust-badge" class:verified={trustLevel === 'Very High'}>
        {trustLevel} Trust Level
      </div>
    </div>
    
    <div class="analysis-content">
      <div class="metrics">
        <div class="metric">
          <span>Source Trust:</span>
          <div class="progress-bar">
            <div class="progress" style="width: {analysis.compositeScores.trustworthiness * 100}%"></div>
          </div>
        </div>
        
        <div class="metric">
          <span>Relevance:</span>
          <div class="progress-bar">
            <div class="progress" style="width: {analysis.compositeScores.relevance * 100}%"></div>
          </div>
        </div>
        
        <div class="metric">
          <span>Impact:</span>
          <div class="progress-bar">
            <div class="progress" style="width: {analysis.compositeScores.impact * 100}%"></div>
          </div>
        </div>
        
        <div class="metric">
          <span>Consensus:</span>
          <div class="progress-bar">
            <div class="progress" style="width: {analysis.compositeScores.consensus * 100}%"></div>
          </div>
        </div>
      </div>
      
      <div class="ai-analysis">
        <h4>AI Analysis</h4>
        {#if analysis.aiAnalysis.fallacyDetection.length > 0}
          <div class="fallacies">
            <h5>Potential Fallacies:</h5>
            <ul>
              {#each analysis.aiAnalysis.fallacyDetection as fallacy}
                <li>{fallacy}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if analysis.aiAnalysis.counterarguments.length > 0}
          <div class="counterarguments">
            <h5>Key Counterarguments:</h5>
            <ul>
              {#each analysis.aiAnalysis.counterarguments as counterargument}
                <li>{counterargument}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
      
      <div class="expert-reviews">
        <h4>Expert Reviews ({expertReviews.length})</h4>
        {#each expertReviews as review}
          <div class="expert-review">
            <div class="expert-header">
              <span class="expert-name">{review.expertName}</span>
              <span class="expert-institution">{review.institution}</span>
            </div>
            <p class="review-content">{review.review}</p>
            <div class="review-rating">
              Rating: {review.rating}/5 (Confidence: {review.confidence * 100}%)
            </div>
          </div>
        {/each}
      </div>
      
      <div class="community-moderation">
        <h4>Community Moderation</h4>
        <div class="moderation-status">
          Status: <span class="status-badge {moderationStatus.toLowerCase().replace(' ', '-')}">
            {moderationStatus}
          </span>
        </div>
        
        <div class="moderation-actions">
          <button
            class="action-button approve"
            on:click={() => handleModerationAction('approve', 'Verified information')}
          >
            Approve
          </button>
          <button
            class="action-button flag"
            on:click={() => handleModerationAction('flag', 'Needs verification')}
          >
            Flag for Review
          </button>
        </div>
        
        {#each communityModeration as action}
          <div class="moderation-action">
            <div class="action-header">
              <span class="action-type">{action.moderationAction}</span>
              <span class="action-time">{new Date(action.timestamp).toLocaleDateString()}</span>
            </div>
            <p class="action-reason">{action.reason}</p>
            <div class="action-votes">
              <span class="supporting">+{action.supportingVotes}</span>
              <span class="opposing">-{action.opposingVotes}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .fact-checker {
    background: var(--color-deep-space-black);
    border-radius: 12px;
    padding: 1.5rem;
    color: white;
  }
  
  .analysis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  h3 {
    color: var(--color-deep-gold);
    margin: 0;
    font-family: var(--font-playfair);
  }
  
  .trust-badge {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
  }
  
  .trust-badge.verified {
    background: rgba(29, 185, 84, 0.2);
    color: #1db954;
    border: 1px solid #1db954;
  }
  
  .metrics {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .metric {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .metric span {
    min-width: 120px;
  }
  
  .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress {
    height: 100%;
    background: var(--color-deep-gold);
    transition: width 0.3s ease;
  }
  
  .ai-analysis {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 2rem;
  }
  
  .ai-analysis h4 {
    color: var(--color-deep-gold);
    margin: 0 0 1rem 0;
  }
  
  .ai-analysis ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  .ai-analysis li {
    margin-bottom: 0.5rem;
  }
  
  .expert-reviews {
    margin-bottom: 2rem;
  }
  
  .expert-review {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .expert-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .expert-name {
    font-weight: 600;
    color: var(--color-deep-gold);
  }
  
  .expert-institution {
    font-size: 0.9rem;
    opacity: 0.7;
  }
  
  .review-content {
    margin: 0.5rem 0;
    line-height: 1.4;
  }
  
  .review-rating {
    font-size: 0.9rem;
    opacity: 0.7;
  }
  
  .community-moderation .moderation-status {
    margin-bottom: 1rem;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.9rem;
  }
  
  .status-badge.community-approved {
    background: rgba(29, 185, 84, 0.2);
    color: #1db954;
  }
  
  .status-badge.community-flagged {
    background: rgba(255, 0, 60, 0.2);
    color: #ff003c;
  }
  
  .status-badge.under-discussion {
    background: rgba(255, 215, 0, 0.2);
    color: #ffd700;
  }
  
  .moderation-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .action-button {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-button.approve {
    background: rgba(29, 185, 84, 0.2);
    color: #1db954;
    border: 1px solid #1db954;
  }
  
  .action-button.approve:hover {
    background: rgba(29, 185, 84, 0.3);
  }
  
  .action-button.flag {
    background: rgba(255, 0, 60, 0.2);
    color: #ff003c;
    border: 1px solid #ff003c;
  }
  
  .action-button.flag:hover {
    background: rgba(255, 0, 60, 0.3);
  }
  
  .moderation-action {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .action-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .action-type {
    text-transform: capitalize;
    font-weight: 600;
  }
  
  .action-time {
    font-size: 0.9rem;
    opacity: 0.7;
  }
  
  .action-reason {
    margin: 0.5rem 0;
    line-height: 1.4;
  }
  
  .action-votes {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
  }
  
  .action-votes .supporting {
    color: #1db954;
  }
  
  .action-votes .opposing {
    color: #ff003c;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--color-deep-gold);
  }
  
  .error {
    color: #ff003c;
    text-align: center;
    padding: 1rem;
    background: rgba(255, 0, 60, 0.1);
    border-radius: 8px;
  }
</style> 