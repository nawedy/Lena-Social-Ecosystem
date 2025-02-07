<script lang="ts">
  import { toasts } from '../stores/toasts';
  import Toast from './Toast.svelte';
</script>

<div
  class="fixed top-4 right-4 z-50 max-w-md"
  aria-live="polite"
  aria-atomic="true"
>
  {#each $toasts as toast (toast.id)}
    <Toast {toast} />
  {/each}
</div> 