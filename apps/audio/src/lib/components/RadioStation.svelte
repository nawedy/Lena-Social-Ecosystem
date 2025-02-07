<!-- RadioStation.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Button, Icon, Slider } from '@lena/ui';

  export let currentTrack: {
    id: string;
    title: string;
    artist: string;
    artwork?: string;
    duration: number;
    genre?: string;
    mood?: string;
    energy?: number;
  } | null = null;

  export let upcomingTracks: Array<{
    id: string;
    title: string;
    artist: string;
    artwork?: string;
    duration: number;
    genre?: string;
    mood?: string;
    energy?: number;
    confidence: number;
  }> = [];

  export let seedTracks: Array<typeof currentTrack> = [];
  export let seedArtists: Array<string> = [];
  export let seedGenres: Array<string> = [];

  const dispatch = createEventDispatcher();
  let isPlaying = false;
  let showSettings = false;

  // Station Settings
  let variety = 0.5; // 0-1: How much the station deviates from seeds
  let popularity = 0.5; // 0-1: Balance between popular and underground
  let energy = 0.5; // 0-1: Energy level of tracks
  let mood = 0.5; // 0-1: Happy vs Melancholic

  function togglePlay() {
    isPlaying = !isPlaying;
    dispatch('playStateChange', { isPlaying });
  }

  function skipTrack() {
    dispatch('skip');
  }

  function addToLibrary() {
    if (currentTrack) {
      dispatch('addToLibrary', { track: currentTrack });
    }
  }

  function updateSettings() {
    dispatch('updateSettings', {
      variety,
      popularity,
      energy,
      mood
    });
  }

  function removeSeedTrack(trackId: string) {
    seedTracks = seedTracks.filter(track => track.id !== trackId);
    dispatch('updateSeeds', { seedTracks, seedArtists, seedGenres });
  }

  function removeSeedArtist(artist: string) {
    seedArtists = seedArtists.filter(a => a !== artist);
    dispatch('updateSeeds', { seedTracks, seedArtists, seedGenres });
  }

  function removeSeedGenre(genre: string) {
    seedGenres = seedGenres.filter(g => g !== genre);
    dispatch('updateSeeds', { seedTracks, seedArtists, seedGenres });
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  $: {
    if (variety || popularity || energy || mood) {
      updateSettings();
    }
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-gray-700">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon name="radio" size={24} class="text-primary-400" />
        <h2 class="text-lg font-medium">Radio Station</h2>
      </div>
      <Button
        variant="ghost"
        on:click={() => showSettings = !showSettings}
      >
        <Icon name="settings" size={20} />
      </Button>
    </div>
  </div>

  <!-- Current Track -->
  {#if currentTrack}
    <div class="p-4 bg-primary-500/10">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={currentTrack.artwork || 'default-artwork.png'}
            alt={currentTrack.title}
            class="w-full h-full object-cover"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">{currentTrack.title}</p>
          <p class="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
          {#if currentTrack.genre}
            <p class="text-sm text-primary-400">{currentTrack.genre}</p>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <button
            class="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
            on:click={addToLibrary}
          >
            <Icon name="heart" size={20} />
          </button>
          <button
            class="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
            on:click={togglePlay}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
          </button>
          <button
            class="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
            on:click={skipTrack}
          >
            <Icon name="skip-forward" size={20} />
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Settings -->
  {#if showSettings}
    <div class="p-4 border-t border-gray-700 space-y-6">
      <!-- Station Seeds -->
      <div class="space-y-4">
        <h3 class="text-sm font-medium text-gray-400">Based On</h3>
        
        {#if seedTracks.length > 0}
          <div class="space-y-2">
            <h4 class="text-xs text-gray-500">Tracks</h4>
            {#each seedTracks as track}
              <div class="flex items-center gap-2 text-sm">
                <button
                  class="text-gray-400 hover:text-white"
                  on:click={() => removeSeedTrack(track.id)}
                >
                  <Icon name="x" size={16} />
                </button>
                <span class="truncate">{track.title} - {track.artist}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if seedArtists.length > 0}
          <div class="space-y-2">
            <h4 class="text-xs text-gray-500">Artists</h4>
            {#each seedArtists as artist}
              <div class="flex items-center gap-2 text-sm">
                <button
                  class="text-gray-400 hover:text-white"
                  on:click={() => removeSeedArtist(artist)}
                >
                  <Icon name="x" size={16} />
                </button>
                <span class="truncate">{artist}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if seedGenres.length > 0}
          <div class="space-y-2">
            <h4 class="text-xs text-gray-500">Genres</h4>
            {#each seedGenres as genre}
              <div class="flex items-center gap-2 text-sm">
                <button
                  class="text-gray-400 hover:text-white"
                  on:click={() => removeSeedGenre(genre)}
                >
                  <Icon name="x" size={16} />
                </button>
                <span class="truncate">{genre}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Station Parameters -->
      <div class="space-y-4">
        <h3 class="text-sm font-medium text-gray-400">Station Settings</h3>
        
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-400">Variety</label>
              <span class="text-sm text-gray-500">
                {variety < 0.33 ? 'Similar' : variety < 0.66 ? 'Mixed' : 'Adventurous'}
              </span>
            </div>
            <Slider
              value={variety}
              min={0}
              max={1}
              step={0.01}
              on:change={(e) => variety = e.detail}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-400">Popularity</label>
              <span class="text-sm text-gray-500">
                {popularity < 0.33 ? 'Underground' : popularity < 0.66 ? 'Mixed' : 'Popular'}
              </span>
            </div>
            <Slider
              value={popularity}
              min={0}
              max={1}
              step={0.01}
              on:change={(e) => popularity = e.detail}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-400">Energy</label>
              <span class="text-sm text-gray-500">
                {energy < 0.33 ? 'Chill' : energy < 0.66 ? 'Balanced' : 'Energetic'}
              </span>
            </div>
            <Slider
              value={energy}
              min={0}
              max={1}
              step={0.01}
              on:change={(e) => energy = e.detail}
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-400">Mood</label>
              <span class="text-sm text-gray-500">
                {mood < 0.33 ? 'Melancholic' : mood < 0.66 ? 'Balanced' : 'Upbeat'}
              </span>
            </div>
            <Slider
              value={mood}
              min={0}
              max={1}
              step={0.01}
              on:change={(e) => mood = e.detail}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Upcoming Tracks -->
  {#if upcomingTracks.length > 0}
    <div class="p-4 border-t border-gray-700">
      <h3 class="text-sm font-medium text-gray-400 mb-3">Coming Up Next</h3>
      <div class="space-y-2">
        {#each upcomingTracks.slice(0, 3) as track}
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded overflow-hidden flex-shrink-0">
              <img
                src={track.artwork || 'default-artwork.png'}
                alt={track.title}
                class="w-full h-full object-cover"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="truncate">{track.title}</p>
              <p class="text-sm text-gray-400 truncate">{track.artist}</p>
            </div>
            <span class="text-sm text-primary-400">
              {Math.round(track.confidence * 100)}% match
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div> 