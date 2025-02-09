<!-- Icon.svelte -->
<script lang="ts">
  export let name: string;
  export let size: number = 24;
  export let color: string = 'currentColor';

  const icons = {
    send: `<path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    receive: `<path d="M22 15L11 4M22 15L15 22L11 4M22 15L2 9L11 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    exchange: `<path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    gift: `<path d="M20 12V22H4V12M22 7H2V12H22V7ZM12 22V7M12 7H7.5C6.83696 7 6.20107 6.73661 5.73223 6.26777C5.26339 5.79893 5 5.16304 5 4.5C5 3.83696 5.26339 3.20107 5.73223 2.73223C6.20107 2.26339 6.83696 2 7.5 2C11 2 12 7 12 7ZM12 7H16.5C17.163 7 17.7989 6.73661 18.2678 6.26777C18.7366 5.79893 19 5.16304 19 4.5C19 3.83696 18.7366 3.20107 18.2678 2.73223C17.7989 2.26339 17.163 2 16.5 2C13 2 12 7 12 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    star: `<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    'trend-up': `<path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    'trend-down': `<path d="M7 7L17 17M17 17H7M17 17V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    cryptocurrency: `<path d="M11.767 19.089c4.924.868 9.593-2.535 10.461-7.599.868-5.064-2.535-9.593-7.599-10.461-5.064-.868-9.593 2.535-10.461 7.599-.868 5.064 2.535 9.593 7.599 10.461z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 9.5c-.863-1.725-2.525-2.583-5-2.583-3.75 0-5 2.583-5 3.875C5.5 13.792 7.5 14.5 9 14.5c1.5 0 3.5.708 3.5 3.875 0 1.292-1.25 3.875-5 3.875-2.475 0-4.137-.858-5-2.583" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    wallet: `<path d="M21 12V7H5C3.89543 7 3 6.10457 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V16M21 12H17C15.8954 12 15 12.8954 15 14V14C15 15.1046 15.8954 16 17 16H21M21 12V16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
  };

  $: icon = icons[name] || '';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  {...$$restProps}
>
  {@html icon}
</svg> 