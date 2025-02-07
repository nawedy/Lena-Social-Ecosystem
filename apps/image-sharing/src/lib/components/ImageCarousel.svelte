<!-- ImageCarousel.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Swiper from 'swiper';
  import { Navigation, Pagination } from 'swiper/modules';
  import 'swiper/css';
  import 'swiper/css/navigation';
  import 'swiper/css/pagination';

  export let images: string[] = [];
  export let alt: string = '';

  let swiper: Swiper;
  let swiperElement: HTMLElement;

  onMount(() => {
    swiper = new Swiper(swiperElement, {
      modules: [Navigation, Pagination],
      slidesPerView: 1,
      spaceBetween: 0,
      loop: images.length > 1,
      navigation: images.length > 1 ? {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      } : false,
      pagination: images.length > 1 ? {
        el: '.swiper-pagination',
        clickable: true,
      } : false,
    });

    return () => {
      if (swiper) swiper.destroy();
    };
  });
</script>

<div bind:this={swiperElement} class="swiper w-full h-full">
  <div class="swiper-wrapper">
    {#each images as image}
      <div class="swiper-slide">
        <img
          src={image}
          {alt}
          class="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    {/each}
  </div>

  {#if images.length > 1}
    <div class="swiper-button-prev !text-white !opacity-75 hover:!opacity-100" />
    <div class="swiper-button-next !text-white !opacity-75 hover:!opacity-100" />
    <div class="swiper-pagination !bottom-2" />
  {/if}
</div>

<style lang="postcss">
  :global(.swiper-button-prev),
  :global(.swiper-button-next) {
    @apply !w-8 !h-8;
  }

  :global(.swiper-button-prev::after),
  :global(.swiper-button-next::after) {
    @apply !text-lg;
  }

  :global(.swiper-pagination-bullet) {
    @apply !bg-white !opacity-50;
  }

  :global(.swiper-pagination-bullet-active) {
    @apply !opacity-100;
  }
</style> 