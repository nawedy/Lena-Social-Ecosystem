<!-- AudioTrackCard.svelte -->
<script lang="ts">
  import { Card } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import { Badge } from '$lib/components/ui';
  import { PriceDisplay } from '$lib/components/marketplace';
  import { AudioPlayer } from '$lib/components/audio';
  import { AudioWaveform } from '$lib/components/audio';
  import { formatDuration, formatRelativeDate } from '$lib/utils';

  export let track: {
    id: string;
    title: string;
    artist: {
      id: string;
      name: string;
      avatar: string;
      verified: boolean;
    };
    artwork: string;
    previewUrl: string;
    duration: number;
    price: number;
    currency: string;
    genre: string;
    bpm: number;
    key: string;
    downloads: number;
    plays: number;
    createdAt: string;
    tokenGated?: boolean;
    nft?: boolean;
  };
</script>

<Card
  class="group relative overflow-hidden transition-all hover:shadow-lg"
  interactive
  hoverable
>
  <div class="flex gap-4 p-4">
    <!-- Artwork -->
    <div class="relative aspect-square w-32 flex-shrink-0 overflow-hidden rounded-lg">
      <img
        src={track.artwork}
        alt={track.title}
        class="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
      
      <!-- Badges -->
      <div class="absolute left-2 top-2 flex gap-1">
        {#if track.tokenGated}
          <Badge variant="secondary">
            <Icon name="lock" class="mr-1 h-3 w-3" />
            Token Gated
          </Badge>
        {/if}
        {#if track.nft}
          <Badge variant="secondary">
            <Icon name="gem" class="mr-1 h-3 w-3" />
            NFT
          </Badge>
        {/if}
      </div>
    </div>

    <!-- Info -->
    <div class="flex-1">
      <div class="mb-2 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold">{track.title}</h3>
          <div class="flex items-center gap-2">
            <img
              src={track.artist.avatar}
              alt={track.artist.name}
              class="h-5 w-5 rounded-full object-cover"
            />
            <span class="text-sm text-muted-foreground">
              {track.artist.name}
            </span>
            {#if track.artist.verified}
              <Icon
                name="badge-check"
                class="h-4 w-4 text-blue-500"
              />
            {/if}
          </div>
        </div>
        <PriceDisplay
          price={track.price}
          currency={track.currency}
          showIcon
          size="lg"
          class="flex-shrink-0"
        />
      </div>

      <!-- Waveform -->
      <div class="mb-4 h-16">
        <AudioWaveform
          src={track.previewUrl}
          height={64}
          class="opacity-50 group-hover:opacity-100"
        />
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-4 text-sm text-muted-foreground">
        <div class="flex items-center gap-1">
          <Icon name="clock" class="h-4 w-4" />
          <span>{formatDuration(track.duration)}</span>
        </div>
        <div class="flex items-center gap-1">
          <Icon name="music" class="h-4 w-4" />
          <span>{track.genre}</span>
        </div>
        <div class="flex items-center gap-1">
          <Icon name="activity" class="h-4 w-4" />
          <span>{track.bpm} BPM</span>
        </div>
        <div class="flex items-center gap-1">
          <Icon name="music-4" class="h-4 w-4" />
          <span>{track.key}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1">
            <Icon name="download" class="h-4 w-4" />
            <span>{track.downloads} downloads</span>
          </div>
          <div class="flex items-center gap-1">
            <Icon name="play" class="h-4 w-4" />
            <span>{track.plays} plays</span>
          </div>
        </div>
        <time datetime={track.createdAt}>
          {formatRelativeDate(track.createdAt)}
        </time>
      </div>
    </div>
  </div>

  <!-- Preview Player -->
  <div class="border-t">
    <AudioPlayer
      src={track.previewUrl}
      title={track.title}
      artist={track.artist.name}
      artwork={track.artwork}
      preview
    />
  </div>
</Card>

<style>
  /* Add any component-specific styles here */
</style> 