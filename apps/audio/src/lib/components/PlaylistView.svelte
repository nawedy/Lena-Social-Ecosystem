<!-- PlaylistView.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Button, Icon, Avatar } from '@lena/ui';
  import { auth } from '$lib/stores/auth';
  import { formatDistance } from 'date-fns';

  export let playlist: {
    id: string;
    title: string;
    description: string;
    coverImage: string;
    owner: {
      id: string;
      name: string;
      avatar: string;
    };
    collaborators: Array<{
      id: string;
      name: string;
      avatar: string;
      role: 'editor' | 'viewer';
    }>;
    isPublic: boolean;
    tracks: Array<{
      id: string;
      title: string;
      artist: string;
      album: string;
      duration: number;
      artwork: string;
      addedBy: string;
      addedAt: Date;
      plays: number;
      isLiked: boolean;
      audioFeatures?: {
        tempo: number;
        key: string;
        energy: number;
        danceability: number;
        valence: number;
      };
    }>;
    stats: {
      totalDuration: number;
      followers: number;
      plays: number;
    };
    createdAt: Date;
    updatedAt: Date;
  };

  export let currentTrackId: string | null = null;
  export let isPlaying = false;

  const dispatch = createEventDispatcher();
  let isEditMode = false;
  let showAudioFeatures = false;
  let selectedTracks: Set<string> = new Set();
  let draggedTrackId: string | null = null;
  let dropTargetIndex: number | null = null;
  let recommendations: typeof playlist.tracks = [];
  let showRecommendations = false;
  let sortKey: 'title' | 'artist' | 'album' | 'addedAt' | 'plays' = 'addedAt';
  let sortDirection: 'asc' | 'desc' = 'desc';

  $: isOwner = playlist.owner.id === $auth.user?.id;
  $: isCollaborator = playlist.collaborators.some(c => c.id === $auth.user?.id);
  $: canEdit = isOwner || (isCollaborator && playlist.collaborators.find(c => c.id === $auth.user?.id)?.role === 'editor');
  $: sortedTracks = [...playlist.tracks].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    const direction = sortDirection === 'asc' ? 1 : -1;
    return typeof aValue === 'string' 
      ? aValue.localeCompare(bValue) * direction
      : (aValue - bValue) * direction;
  });

  onMount(async () => {
    if (playlist.tracks.length > 0) {
      // Get AI-powered recommendations based on playlist analysis
      recommendations = await getRecommendations();
    }
  });

  async function getRecommendations() {
    // TODO: Implement AI recommendation logic
    // This would analyze the playlist's audio features, user preferences,
    // and listening history to generate personalized recommendations
    return [];
  }

  function handlePlay(trackId: string) {
    if (currentTrackId === trackId) {
      dispatch('togglePlay');
    } else {
      dispatch('play', { trackId });
    }
  }

  function handleTrackDragStart(e: DragEvent, trackId: string) {
    draggedTrackId = trackId;
    e.dataTransfer?.setData('text/plain', trackId);
  }

  function handleTrackDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dropTargetIndex = index;
  }

  function handleTrackDrop(e: DragEvent, index: number) {
    e.preventDefault();
    if (!draggedTrackId || !canEdit) return;

    const fromIndex = playlist.tracks.findIndex(t => t.id === draggedTrackId);
    if (fromIndex === -1) return;

    // Reorder tracks
    const tracks = [...playlist.tracks];
    const [track] = tracks.splice(fromIndex, 1);
    tracks.splice(index, 0, track);
    
    // Update playlist
    playlist = {
      ...playlist,
      tracks,
      updatedAt: new Date()
    };

    // Reset drag state
    draggedTrackId = null;
    dropTargetIndex = null;

    dispatch('reorder', { tracks });
  }

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  function toggleTrackSelection(trackId: string) {
    if (selectedTracks.has(trackId)) {
      selectedTracks.delete(trackId);
    } else {
      selectedTracks.add(trackId);
    }
    selectedTracks = selectedTracks;
  }

  function handleBulkAction(action: 'remove' | 'addToQueue' | 'download') {
    if (selectedTracks.size === 0) return;

    switch (action) {
      case 'remove':
        if (!canEdit) return;
        playlist.tracks = playlist.tracks.filter(t => !selectedTracks.has(t.id));
        dispatch('update', { playlist });
        break;
      case 'addToQueue':
        dispatch('addToQueue', { trackIds: Array.from(selectedTracks) });
        break;
      case 'download':
        dispatch('download', { trackIds: Array.from(selectedTracks) });
        break;
    }

    selectedTracks.clear();
    selectedTracks = selectedTracks;
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div class="space-y-6">
  <!-- Playlist Header -->
  <div class="flex gap-6">
    <img
      src={playlist.coverImage}
      alt={playlist.title}
      class="w-60 h-60 rounded-lg object-cover"
    />

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 text-sm text-gray-400">
        <span>PLAYLIST</span>
        {#if !playlist.isPublic}
          <Icon name="lock" size={16} />
        {/if}
      </div>

      <h1 class="text-4xl font-bold mt-2">{playlist.title}</h1>
      <p class="text-gray-400 mt-2">{playlist.description}</p>

      <div class="flex items-center gap-4 mt-4">
        <Avatar
          src={playlist.owner.avatar}
          alt={playlist.owner.name}
          size="sm"
        />
        <span>{playlist.owner.name}</span>
        <span>•</span>
        <span>{playlist.stats.followers.toLocaleString()} followers</span>
        <span>•</span>
        <span>{playlist.tracks.length} songs</span>
        <span>•</span>
        <span>{formatDuration(playlist.stats.totalDuration)}</span>
      </div>

      <div class="flex items-center gap-4 mt-6">
        <Button
          variant="primary"
          on:click={() => dispatch('play', { trackId: playlist.tracks[0]?.id })}
          disabled={playlist.tracks.length === 0}
        >
          <Icon name="play" size={20} class="mr-2" />
          Play
        </Button>

        {#if canEdit}
          <Button
            variant="secondary"
            on:click={() => isEditMode = !isEditMode}
          >
            <Icon name="edit-2" size={20} class="mr-2" />
            Edit
          </Button>
        {/if}

        <Button
          variant="ghost"
          on:click={() => showAudioFeatures = !showAudioFeatures}
        >
          <Icon name="activity" size={20} class="mr-2" />
          Audio Features
        </Button>

        <Button
          variant="ghost"
          on:click={() => showRecommendations = !showRecommendations}
        >
          <Icon name="sparkles" size={20} class="mr-2" />
          Recommendations
        </Button>
      </div>
    </div>
  </div>

  <!-- Bulk Actions -->
  {#if selectedTracks.size > 0}
    <div class="flex items-center gap-4 p-4 bg-primary-900/20 rounded-lg">
      <span class="text-sm">{selectedTracks.size} tracks selected</span>
      <div class="flex-1" />
      <Button
        variant="ghost"
        on:click={() => handleBulkAction('addToQueue')}
      >
        Add to Queue
      </Button>
      <Button
        variant="ghost"
        on:click={() => handleBulkAction('download')}
      >
        Download
      </Button>
      {#if canEdit}
        <Button
          variant="ghost"
          class="text-red-400 hover:text-red-300"
          on:click={() => handleBulkAction('remove')}
        >
          Remove
        </Button>
      {/if}
    </div>
  {/if}

  <!-- Track List -->
  <div class="relative overflow-x-auto">
    <table class="w-full text-left">
      <thead class="text-sm text-gray-400 border-b border-gray-800">
        <tr>
          <th class="p-4 w-12">
            <input
              type="checkbox"
              checked={selectedTracks.size === playlist.tracks.length}
              on:change={(e) => {
                if (e.currentTarget.checked) {
                  selectedTracks = new Set(playlist.tracks.map(t => t.id));
                } else {
                  selectedTracks.clear();
                }
                selectedTracks = selectedTracks;
              }}
            />
          </th>
          <th class="p-4 w-12">#</th>
          <th class="p-4">
            <button
              class="hover:text-white transition-colors"
              on:click={() => handleSort('title')}
            >
              Title
              {#if sortKey === 'title'}
                <Icon
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  class="inline-block ml-1"
                />
              {/if}
            </button>
          </th>
          <th class="p-4">
            <button
              class="hover:text-white transition-colors"
              on:click={() => handleSort('artist')}
            >
              Artist
              {#if sortKey === 'artist'}
                <Icon
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  class="inline-block ml-1"
                />
              {/if}
            </button>
          </th>
          <th class="p-4">
            <button
              class="hover:text-white transition-colors"
              on:click={() => handleSort('album')}
            >
              Album
              {#if sortKey === 'album'}
                <Icon
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  class="inline-block ml-1"
                />
              {/if}
            </button>
          </th>
          <th class="p-4">
            <button
              class="hover:text-white transition-colors"
              on:click={() => handleSort('addedAt')}
            >
              Date Added
              {#if sortKey === 'addedAt'}
                <Icon
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  class="inline-block ml-1"
                />
              {/if}
            </button>
          </th>
          <th class="p-4">
            <button
              class="hover:text-white transition-colors"
              on:click={() => handleSort('plays')}
            >
              Plays
              {#if sortKey === 'plays'}
                <Icon
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  class="inline-block ml-1"
                />
              {/if}
            </button>
          </th>
          <th class="p-4 w-20 text-center">
            <Icon name="clock" size={16} />
          </th>
        </tr>
      </thead>

      <tbody class="divide-y divide-gray-800">
        {#each sortedTracks as track, i (track.id)}
          <tr
            class="group hover:bg-gray-800/50 transition-colors"
            class:bg-primary-900/20={currentTrackId === track.id}
            draggable={canEdit}
            on:dragstart={(e) => handleTrackDragStart(e, track.id)}
            on:dragover={(e) => handleTrackDragOver(e, i)}
            on:drop={(e) => handleTrackDrop(e, i)}
          >
            <td class="p-4">
              <input
                type="checkbox"
                checked={selectedTracks.has(track.id)}
                on:change={() => toggleTrackSelection(track.id)}
              />
            </td>
            <td class="p-4 text-gray-400">
              {#if currentTrackId === track.id}
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={16}
                  class="text-primary-400"
                />
              {:else}
                {i + 1}
              {/if}
            </td>
            <td class="p-4">
              <div class="flex items-center gap-3">
                <img
                  src={track.artwork}
                  alt={track.title}
                  class="w-10 h-10 rounded"
                />
                <div class="min-w-0">
                  <button
                    class="font-medium hover:underline truncate"
                    on:click={() => handlePlay(track.id)}
                  >
                    {track.title}
                  </button>
                  {#if showAudioFeatures && track.audioFeatures}
                    <div class="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span>{track.audioFeatures.key}</span>
                      <span>•</span>
                      <span>{Math.round(track.audioFeatures.tempo)} BPM</span>
                      <span>•</span>
                      <span>Energy: {Math.round(track.audioFeatures.energy * 100)}%</span>
                    </div>
                  {/if}
                </div>
              </div>
            </td>
            <td class="p-4 text-gray-400">{track.artist}</td>
            <td class="p-4 text-gray-400">{track.album}</td>
            <td class="p-4 text-gray-400">
              {formatDistance(track.addedAt, new Date(), { addSuffix: true })}
            </td>
            <td class="p-4 text-gray-400">{track.plays.toLocaleString()}</td>
            <td class="p-4 text-gray-400 text-center">
              {formatDuration(track.duration)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Recommendations -->
  {#if showRecommendations && recommendations.length > 0}
    <div class="mt-8">
      <h2 class="text-xl font-medium mb-4">Recommended Tracks</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {#each recommendations as track}
          <button
            class="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-left group"
            on:click={() => dispatch('addTrack', { track })}
          >
            <img
              src={track.artwork}
              alt={track.title}
              class="w-full aspect-square rounded-lg mb-3 group-hover:shadow-lg transition-shadow"
            />
            <h3 class="font-medium truncate">{track.title}</h3>
            <p class="text-sm text-gray-400 truncate">{track.artist}</p>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div> 