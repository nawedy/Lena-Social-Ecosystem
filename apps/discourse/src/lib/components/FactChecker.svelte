<!-- FactChecker.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button, Icon, Card } from '@lena/ui';

  export let claim: {
    id: string;
    text: string;
    author: {
      id: string;
      username: string;
      reputation?: number;
      credibility?: number;
    };
    context?: string;
    timestamp: Date;
    sources?: Array<{
      id: string;
      url: string;
      title: string;
      publisher: string;
      publishDate: Date;
      type: 'academic' | 'news' | 'government' | 'organization' | 'social' | 'other';
      metrics: {
        trustScore: number;
        biasScore: number;
        factualityScore: number;
        expertConsensus?: number;
        peerReviewed?: boolean;
        citationCount?: number;
      };
    }>;
    verificationStatus: 'pending' | 'verified' | 'disputed' | 'misleading' | 'false';
    aiAnalysis?: {
      confidence: number;
      reasoning: string[];
      counterpoints: string[];
      suggestedSources: string[];
      biasIndicators: Array<{
        type: 'language' | 'context' | 'source' | 'logic';
        description: string;
        severity: number;
      }>;
      factualAccuracy: number;
      logicalCoherence: number;
      evidenceStrength: number;
    };
    communityFeedback?: {
      upvotes: number;
      downvotes: number;
      reports: number;
      verifiedExperts: Array<{
        id: string;
        username: string;
        credentials: string[];
        assessment: 'support' | 'dispute' | 'neutral';
        comment?: string;
      }>;
    };
  };

  export let showAIInsights = true;
  export let realTimeCheck = true;
  export let autoSuggestSources = true;
  export let requireVerification = false;

  const dispatch = createEventDispatcher();
  let isExpanded = false;
  let isVerifying = false;
  let selectedSources: string[] = [];
  let userAssessment: 'support' | 'dispute' | 'neutral' | null = null;

  $: overallTrustScore = calculateTrustScore(claim);
  $: biasLevel = calculateBiasLevel(claim);
  $: sourceQuality = calculateSourceQuality(claim);
  $: expertConsensus = calculateExpertConsensus(claim);

  function calculateTrustScore(claim: typeof claim) {
    if (!claim.sources || claim.sources.length === 0) return 0;

    const scores = {
      sourceCredibility: 0,
      factualAccuracy: claim.aiAnalysis?.factualAccuracy || 0,
      expertSupport: 0,
      communityTrust: 0
    };

    // Source credibility
    scores.sourceCredibility = claim.sources.reduce((acc, source) => 
      acc + (source.metrics.trustScore + source.metrics.factualityScore) / 2, 0
    ) / claim.sources.length;

    // Expert support
    if (claim.communityFeedback?.verifiedExperts) {
      const experts = claim.communityFeedback.verifiedExperts;
      const supportCount = experts.filter(e => e.assessment === 'support').length;
      scores.expertSupport = supportCount / experts.length;
    }

    // Community trust
    if (claim.communityFeedback) {
      const total = claim.communityFeedback.upvotes + claim.communityFeedback.downvotes;
      if (total > 0) {
        scores.communityTrust = claim.communityFeedback.upvotes / total;
      }
    }

    // Weighted average
    return (
      scores.sourceCredibility * 0.4 +
      scores.factualAccuracy * 0.3 +
      scores.expertSupport * 0.2 +
      scores.communityTrust * 0.1
    );
  }

  function calculateBiasLevel(claim: typeof claim) {
    if (!claim.aiAnalysis) return null;

    const biasFactors = {
      language: 0,
      context: 0,
      source: 0,
      logic: 0
    };

    // Analyze AI-detected bias indicators
    claim.aiAnalysis.biasIndicators.forEach(indicator => {
      biasFactors[indicator.type] += indicator.severity;
    });

    // Source bias analysis
    if (claim.sources) {
      const avgSourceBias = claim.sources.reduce((acc, source) => 
        acc + source.metrics.biasScore, 0
      ) / claim.sources.length;
      biasFactors.source = avgSourceBias;
    }

    // Weighted calculation
    return {
      overall: (
        biasFactors.language * 0.3 +
        biasFactors.context * 0.2 +
        biasFactors.source * 0.3 +
        biasFactors.logic * 0.2
      ),
      factors: biasFactors
    };
  }

  function calculateSourceQuality(claim: typeof claim) {
    if (!claim.sources || claim.sources.length === 0) return null;

    const metrics = {
      academic: 0,
      peerReviewed: 0,
      recentness: 0,
      diversity: new Set(),
      citations: 0
    };

    claim.sources.forEach(source => {
      // Academic weight
      if (source.type === 'academic') metrics.academic++;
      if (source.metrics.peerReviewed) metrics.peerReviewed++;
      
      // Recentness (within 2 years)
      const age = (new Date().getTime() - source.publishDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (age <= 2) metrics.recentness++;

      // Source diversity
      metrics.diversity.add(source.publisher);

      // Citation impact
      if (source.metrics.citationCount) {
        metrics.citations += Math.min(source.metrics.citationCount / 100, 1);
      }
    });

    return {
      score: (
        (metrics.academic / claim.sources.length) * 0.3 +
        (metrics.peerReviewed / claim.sources.length) * 0.2 +
        (metrics.recentness / claim.sources.length) * 0.2 +
        (metrics.diversity.size / claim.sources.length) * 0.2 +
        (metrics.citations / claim.sources.length) * 0.1
      ),
      metrics
    };
  }

  function calculateExpertConsensus(claim: typeof claim) {
    if (!claim.communityFeedback?.verifiedExperts || 
        claim.communityFeedback.verifiedExperts.length === 0) {
      return null;
    }

    const experts = claim.communityFeedback.verifiedExperts;
    const total = experts.length;
    const support = experts.filter(e => e.assessment === 'support').length;
    const dispute = experts.filter(e => e.assessment === 'dispute').length;
    const neutral = experts.filter(e => e.assessment === 'neutral').length;

    return {
      support: support / total,
      dispute: dispute / total,
      neutral: neutral / total,
      totalExperts: total,
      hasConsensus: (support / total > 0.7) || (dispute / total > 0.7)
    };
  }

  function getVerificationStatusColor(status: typeof claim.verificationStatus) {
    switch (status) {
      case 'verified': return 'text-green-500';
      case 'disputed': return 'text-yellow-500';
      case 'misleading': return 'text-orange-500';
      case 'false': return 'text-red-500';
      default: return 'text-gray-400';
    }
  }

  function handleSourceSelect(sourceId: string) {
    selectedSources = selectedSources.includes(sourceId)
      ? selectedSources.filter(id => id !== sourceId)
      : [...selectedSources, sourceId];
  }

  function handleAssessment(assessment: typeof userAssessment) {
    userAssessment = assessment;
    dispatch('assess', { assessment });
  }

  function handleVerify() {
    isVerifying = true;
    dispatch('verify', { 
      claimId: claim.id,
      selectedSources
    });
  }

  function handleReport() {
    dispatch('report', { 
      claimId: claim.id,
      reason: 'factual_accuracy'
    });
  }

  function handleSourceAdd() {
    dispatch('add-source', { 
      claimId: claim.id
    });
  }
</script>

<Card
  variant="default"
  class="overflow-hidden"
>
  <div class="p-4">
    <!-- Claim Header -->
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p class="text-lg">{claim.text}</p>
        <div class="flex items-center gap-2 mt-2 text-sm text-gray-400">
          <span>by {claim.author.username}</span>
          <span>•</span>
          <span>{new Date(claim.timestamp).toLocaleDateString()}</span>
          {#if claim.context}
            <span>•</span>
            <span class="italic">"{claim.context}"</span>
          {/if}
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <span class={`font-medium ${getVerificationStatusColor(claim.verificationStatus)}`}>
          {claim.verificationStatus.charAt(0).toUpperCase() + claim.verificationStatus.slice(1)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          on:click={() => isExpanded = !isExpanded}
        >
          <Icon
            name="chevron-down"
            size={20}
            class="transform transition-transform duration-200"
            class:rotate-180={isExpanded}
          />
        </Button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-4 gap-4 mt-4">
      <div class="text-center">
        <div class="text-2xl font-medium">
          {Math.round(overallTrustScore * 100)}%
        </div>
        <div class="text-sm text-gray-400">Trust Score</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-medium">
          {claim.sources?.length || 0}
        </div>
        <div class="text-sm text-gray-400">Sources</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-medium">
          {claim.communityFeedback?.verifiedExperts?.length || 0}
        </div>
        <div class="text-sm text-gray-400">Expert Reviews</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-medium">
          {biasLevel ? Math.round((1 - biasLevel.overall) * 100) : '--'}%
        </div>
        <div class="text-sm text-gray-400">Objectivity</div>
      </div>
    </div>

    {#if isExpanded}
      <div class="mt-6 space-y-6">
        <!-- Source Analysis -->
        {#if claim.sources && claim.sources.length > 0}
          <div class="space-y-4">
            <h3 class="font-medium">Sources & Citations</h3>
            <div class="space-y-2">
              {#each claim.sources as source}
                <div
                  class="p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(source.id)}
                      on:change={() => handleSourceSelect(source.id)}
                      class="mt-1"
                    />
                    <div class="flex-1">
                      <div class="flex items-start justify-between">
                        <div>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="font-medium hover:text-primary-400 transition-colors"
                          >
                            {source.title}
                          </a>
                          <div class="text-sm text-gray-400">
                            {source.publisher} • {new Date(source.publishDate).toLocaleDateString()}
                          </div>
                        </div>
                        <span class="px-2 py-0.5 text-xs rounded bg-primary-500/20 text-primary-400">
                          {source.type}
                        </span>
                      </div>

                      <div class="grid grid-cols-3 gap-2 mt-2">
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-gray-400">Trust:</span>
                          <div class="flex-1 h-1.5 rounded-full bg-gray-700">
                            <div
                              class="h-full rounded-full bg-primary-500"
                              style="width: {source.metrics.trustScore * 100}%"
                            />
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-gray-400">Bias:</span>
                          <div class="flex-1 h-1.5 rounded-full bg-gray-700">
                            <div
                              class="h-full rounded-full bg-primary-500"
                              style="width: {(1 - source.metrics.biasScore) * 100}%"
                            />
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-gray-400">Factual:</span>
                          <div class="flex-1 h-1.5 rounded-full bg-gray-700">
                            <div
                              class="h-full rounded-full bg-primary-500"
                              style="width: {source.metrics.factualityScore * 100}%"
                            />
                          </div>
                        </div>
                      </div>

                      {#if source.metrics.peerReviewed || source.metrics.citationCount}
                        <div class="flex items-center gap-4 mt-2 text-sm text-gray-400">
                          {#if source.metrics.peerReviewed}
                            <span class="flex items-center gap-1">
                              <Icon name="check-circle" size={16} class="text-green-500" />
                              Peer Reviewed
                            </span>
                          {/if}
                          {#if source.metrics.citationCount}
                            <span class="flex items-center gap-1">
                              <Icon name="quote" size={16} />
                              {source.metrics.citationCount} citations
                            </span>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>

            <div class="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                on:click={handleSourceAdd}
              >
                <Icon name="plus" size={16} class="mr-2" />
                Add Source
              </Button>

              {#if selectedSources.length > 0}
                <Button
                  variant="primary"
                  size="sm"
                  on:click={handleVerify}
                  disabled={isVerifying}
                >
                  {#if isVerifying}
                    <Icon name="loader" size={16} class="mr-2 animate-spin" />
                    Verifying...
                  {:else}
                    <Icon name="check" size={16} class="mr-2" />
                    Verify with Selected Sources
                  {/if}
                </Button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- AI Analysis -->
        {#if showAIInsights && claim.aiAnalysis}
          <div class="space-y-4">
            <h3 class="font-medium">AI Analysis</h3>
            
            <div class="grid grid-cols-3 gap-4">
              <div class="space-y-2">
                <div class="text-sm text-gray-400">Factual Accuracy</div>
                <div class="h-1.5 rounded-full bg-gray-700">
                  <div
                    class="h-full rounded-full bg-primary-500"
                    style="width: {claim.aiAnalysis.factualAccuracy * 100}%"
                  />
                </div>
              </div>
              <div class="space-y-2">
                <div class="text-sm text-gray-400">Logical Coherence</div>
                <div class="h-1.5 rounded-full bg-gray-700">
                  <div
                    class="h-full rounded-full bg-primary-500"
                    style="width: {claim.aiAnalysis.logicalCoherence * 100}%"
                  />
                </div>
              </div>
              <div class="space-y-2">
                <div class="text-sm text-gray-400">Evidence Strength</div>
                <div class="h-1.5 rounded-full bg-gray-700">
                  <div
                    class="h-full rounded-full bg-primary-500"
                    style="width: {claim.aiAnalysis.evidenceStrength * 100}%"
                  />
                </div>
              </div>
            </div>

            {#if claim.aiAnalysis.biasIndicators.length > 0}
              <div class="space-y-2">
                <div class="text-sm font-medium">Potential Bias Indicators:</div>
                <div class="space-y-1">
                  {#each claim.aiAnalysis.biasIndicators as indicator}
                    <div class="flex items-start gap-2 text-sm">
                      <Icon
                        name="alert-triangle"
                        size={16}
                        class="text-yellow-500 mt-0.5"
                      />
                      <div class="flex-1">
                        <span class="capitalize">{indicator.type}:</span>
                        <span class="text-gray-400">{indicator.description}</span>
                      </div>
                      <div class="flex">
                        {#each Array(3) as _, i}
                          <Icon
                            name="alert-triangle"
                            size={12}
                            class={i < indicator.severity ? 'text-yellow-500' : 'text-gray-700'}
                          />
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if claim.aiAnalysis.reasoning.length > 0}
              <div class="space-y-2">
                <div class="text-sm font-medium">Analysis Reasoning:</div>
                <ul class="list-disc pl-4 space-y-1 text-sm text-gray-400">
                  {#each claim.aiAnalysis.reasoning as point}
                    <li>{point}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if claim.aiAnalysis.counterpoints.length > 0}
              <div class="space-y-2">
                <div class="text-sm font-medium">Potential Counterpoints:</div>
                <ul class="list-disc pl-4 space-y-1 text-sm text-gray-400">
                  {#each claim.aiAnalysis.counterpoints as point}
                    <li>{point}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Expert Reviews -->
        {#if claim.communityFeedback?.verifiedExperts && claim.communityFeedback.verifiedExperts.length > 0}
          <div class="space-y-4">
            <h3 class="font-medium">Expert Reviews</h3>
            
            {#if expertConsensus}
              <div class="p-4 rounded-lg bg-gray-800/50">
                <div class="flex items-center justify-between">
                  <div class="space-y-2">
                    <div class="text-sm">Expert Consensus</div>
                    <div class="flex items-center gap-4">
                      <div class="flex items-center gap-2">
                        <Icon name="thumbs-up" size={16} class="text-green-500" />
                        <span>{Math.round(expertConsensus.support * 100)}%</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <Icon name="thumbs-down" size={16} class="text-red-500" />
                        <span>{Math.round(expertConsensus.dispute * 100)}%</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <Icon name="minus" size={16} class="text-gray-500" />
                        <span>{Math.round(expertConsensus.neutral * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  {#if expertConsensus.hasConsensus}
                    <div class="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400 text-sm">
                      Strong Consensus
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="space-y-2">
              {#each claim.communityFeedback.verifiedExperts as expert}
                <div class="p-3 rounded-lg bg-gray-800/50">
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="font-medium">{expert.username}</div>
                      <div class="flex flex-wrap gap-1 mt-1">
                        {#each expert.credentials as credential}
                          <span class="px-1.5 py-0.5 text-xs rounded bg-primary-500/20 text-primary-400">
                            {credential}
                          </span>
                        {/each}
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if expert.assessment === 'support'}
                        <Icon name="thumbs-up" size={16} class="text-green-500" />
                        <span class="text-green-500">Supports</span>
                      {:else if expert.assessment === 'dispute'}
                        <Icon name="thumbs-down" size={16} class="text-red-500" />
                        <span class="text-red-500">Disputes</span>
                      {:else}
                        <Icon name="minus" size={16} class="text-gray-500" />
                        <span class="text-gray-500">Neutral</span>
                      {/if}
                    </div>
                  </div>
                  {#if expert.comment}
                    <p class="mt-2 text-sm text-gray-400">{expert.comment}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- User Assessment -->
        <div class="space-y-4">
          <h3 class="font-medium">Your Assessment</h3>
          
          <div class="flex items-center gap-4">
            <Button
              variant={userAssessment === 'support' ? 'primary' : 'ghost'}
              size="sm"
              on:click={() => handleAssessment('support')}
            >
              <Icon name="thumbs-up" size={16} class="mr-2" />
              Support
            </Button>
            <Button
              variant={userAssessment === 'dispute' ? 'primary' : 'ghost'}
              size="sm"
              on:click={() => handleAssessment('dispute')}
            >
              <Icon name="thumbs-down" size={16} class="mr-2" />
              Dispute
            </Button>
            <Button
              variant={userAssessment === 'neutral' ? 'primary' : 'ghost'}
              size="sm"
              on:click={() => handleAssessment('neutral')}
            >
              <Icon name="minus" size={16} class="mr-2" />
              Neutral
            </Button>

            <div class="flex-1" />

            <Button
              variant="ghost"
              size="sm"
              class="text-red-400 hover:text-red-300"
              on:click={handleReport}
            >
              <Icon name="flag" size={16} class="mr-2" />
              Report Issue
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Card> 