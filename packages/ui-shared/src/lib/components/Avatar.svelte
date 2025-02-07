<script lang="ts">
  export let src: string | null = null;
  export let alt = '';
  export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let status: 'online' | 'offline' | 'away' | null = null;
  export let fallback: string | null = null;
  export let border = false;
  export let verified = false;

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    away: 'bg-yellow-500'
  };

  function getFallbackInitials(text: string): string {
    return text
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  $: containerClasses = [
    'relative inline-flex rounded-full overflow-hidden',
    sizeClasses[size],
    border ? 'ring-2 ring-primary-500' : '',
    '$$props.class'
  ].join(' ');

  $: statusClasses = [
    'absolute bottom-0 right-0 rounded-full ring-2 ring-black',
    size === 'xs' ? 'w-2 h-2' : 'w-3 h-3',
    status ? statusColors[status] : ''
  ].join(' ');
</script>

<div class={containerClasses}>
  {#if src}
    <img {src} {alt} class="w-full h-full object-cover" />
  {:else if fallback}
    <div class="w-full h-full bg-primary-900/50 flex items-center justify-center text-white font-medium">
      {getFallbackInitials(fallback)}
    </div>
  {:else}
    <div class="w-full h-full bg-primary-900/50 flex items-center justify-center">
      <svg class="w-1/2 h-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </div>
  {/if}

  {#if status}
    <span class={statusClasses} />
  {/if}

  {#if verified}
    <span
      class="absolute top-0 right-0 bg-primary-500 rounded-full p-0.5 transform translate-x-1/3 -translate-y-1/3"
    >
      <svg class="w-2 h-2 text-white" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </span>
  {/if}
</div> 