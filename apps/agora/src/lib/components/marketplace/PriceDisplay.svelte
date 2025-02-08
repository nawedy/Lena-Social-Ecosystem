<!-- PriceDisplay.svelte -->
<script lang="ts">
  import { formatCurrency } from '$lib/utils';
  import { cn } from '$lib/utils';
  import { Icon } from '$lib/components/ui';

  export let price: number;
  export let currency: string = 'USD';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let showIcon = false;
  export let class: string = '';

  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const currencyIcons = {
    ETH: 'ethereum',
    BTC: 'bitcoin',
    USDC: 'circle-dollar-sign',
    USDT: 'circle-dollar-sign'
  } as const;

  $: formattedPrice = formatCurrency(price, currency);
  $: isCrypto = currency in currencyIcons;
</script>

<div class={cn('flex items-center space-x-1 font-medium', sizes[size], class)}>
  {#if showIcon && isCrypto}
    <Icon
      name={currencyIcons[currency as keyof typeof currencyIcons]}
      class="h-4 w-4"
    />
  {/if}
  <span>{formattedPrice}</span>
</div>

<style>
  /* Add any component-specific styles here */
</style> 