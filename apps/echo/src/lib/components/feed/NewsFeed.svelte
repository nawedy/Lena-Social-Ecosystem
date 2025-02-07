<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { Button, Input, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import PostCard from './PostCard.svelte';
  import TrendingTopics from '../trending/TrendingTopics.svelte';
  import NewsAlerts from '../alerts/NewsAlerts.svelte';

  export let selectedTab: 'following' | 'trending' | 'news' = 'following';
  export let searchQuery: string = '';

  let posts: any[] = [];
  let loading = false;
  let error: string | null = null;
  let realtimeSubscription: any = null;
  let lastPostTime = new Date().toISOString();
  let hasNewPosts = false;
  let isLoadingMore = false;
  let hasMorePosts = true;

  async function loadPosts(options: { loadMore?: boolean } = {}) {
    if (loading || (options.loadMore && !hasMorePosts)) return;

    try {
      loading = true;
      error = null;

      let query = supabase
        .from('posts')
        .select(`
          *,
          author:user_id(
            id,
            username,
            avatar_url,
            is_verified
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (options.loadMore) {
        query = query.lt('created_at', posts[posts.length - 1].created_at);
      }

      if (selectedTab === 'following' && $user) {
        const { data: following } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', $user.id);

        if (following?.length) {
          query = query.in('user_id', following.map(f => f.following_id));
        }
      } else if (selectedTab === 'trending') {
        query = query.order('trending_score', { ascending: false });
      } else if (selectedTab === 'news') {
        query = query.eq('is_breaking_news', true);
      }

      if (searchQuery) {
        query = query.or(`content.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (options.loadMore) {
        posts = [...posts, ...(data || [])];
        hasMorePosts = data?.length === 20;
      } else {
        posts = data || [];
        lastPostTime = new Date().toISOString();
        hasNewPosts = false;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      if (options.loadMore) {
        isLoadingMore = false;
      }
    }
  }

  function setupRealtimeSubscription() {
    realtimeSubscription = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newPost } = await supabase
              .from('posts')
              .select(`
                *,
                author:user_id(
                  id,
                  username,
                  avatar_url,
                  is_verified
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (newPost) {
              if (new Date(newPost.created_at) > new Date(lastPostTime)) {
                hasNewPosts = true;
              } else {
                posts = [newPost, ...posts];
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            posts = posts.map(post =>
              post.id === payload.new.id ? { ...post, ...payload.new } : post
            );
          } else if (payload.eventType === 'DELETE') {
            posts = posts.filter(post => post.id !== payload.old.id);
          }
        }
      )
      .subscribe();
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    const bottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;

    if (bottom && !isLoadingMore && hasMorePosts) {
      isLoadingMore = true;
      loadPosts({ loadMore: true });
    }
  }

  $: {
    if (selectedTab || searchQuery) {
      loadPosts();
    }
  }

  onMount(() => {
    loadPosts();
    setupRealtimeSubscription();
  });

  onDestroy(() => {
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
    }
  });
</script>

<div class="relative">
  <!-- New Posts Alert -->
  {#if hasNewPosts}
    <div
      class="sticky top-0 z-10 py-2 px-4"
      transition:slide
    >
      <button
        class="w-full bg-cyberpunk-red text-white py-2 px-4 rounded-lg shadow-neon flex items-center justify-center space-x-2 hover:bg-cyberpunk-red-600 transition-colors"
        on:click={() => loadPosts()}
      >
        <svg class="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <span>New posts available</span>
      </button>
    </div>
  {/if}

  <!-- Feed Content -->
  <div
    class="space-y-4 overflow-auto max-h-screen pb-20"
    on:scroll={handleScroll}
  >
    {#if loading && !isLoadingMore}
      <div class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyberpunk-red"></div>
      </div>
    {:else if error}
      <Alert variant="error" title="Error" message={error} />
    {:else if posts.length === 0}
      <div class="text-center py-8">
        <p class="text-gray-400">No posts found</p>
      </div>
    {:else}
      {#each posts as post (post.id)}
        <div transition:fade>
          <PostCard {post} />
        </div>
      {/each}

      {#if isLoadingMore}
        <div class="flex justify-center py-4">
          <div class="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyberpunk-red"></div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style lang="postcss">
  .shadow-neon {
    box-shadow: 0 0 10px theme('colors.cyberpunk-red.500/20'),
                0 0 20px theme('colors.cyberpunk-red.500/10');
  }
</style> 