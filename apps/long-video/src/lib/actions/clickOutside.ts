/**
 * Svelte action to handle clicks outside of an element
 */
export function clickOutside(node: HTMLElement) {
  const handleClick = (event: MouseEvent) => {
    if (
      node && 
      !node.contains(event.target as Node) && 
      !event.defaultPrevented
    ) {
      node.dispatchEvent(new CustomEvent('clickoutside'));
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
  };
} 