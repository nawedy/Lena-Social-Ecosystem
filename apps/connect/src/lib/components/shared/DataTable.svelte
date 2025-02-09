<!-- DataTable.svelte -->
<script lang="ts">
  import { fade } from 'svelte/transition';

  export let data: Array<Record<string, any>>;
  export let columns: Array<{
    key: string;
    label: string;
    format?: 'number' | 'percent' | 'currency' | 'date';
    width?: string;
    align?: 'left' | 'center' | 'right';
  }>;
  export let sortable = true;
  export let pagination = true;
  export let pageSize = 10;

  let currentPage = 1;
  let sortKey: string | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';

  $: totalPages = Math.ceil(data.length / pageSize);
  $: startIndex = (currentPage - 1) * pageSize;
  $: endIndex = Math.min(startIndex + pageSize, data.length);

  $: sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const direction = sortDirection === 'asc' ? 1 : -1;
        return aVal > bVal ? direction : aVal < bVal ? -direction : 0;
      })
    : data;

  $: displayData = pagination
    ? sortedData.slice(startIndex, endIndex)
    : sortedData;

  function formatValue(value: any, format?: string): string {
    if (value == null) return '';

    switch (format) {
      case 'number':
        return new Intl.NumberFormat('en-US').format(value);
      case 'percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }).format(value);
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      case 'date':
        return new Date(value).toLocaleDateString();
      default:
        return String(value);
    }
  }

  function handleSort(key: string) {
    if (!sortable) return;

    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }
</script>

<div class="data-table" transition:fade>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          {#each columns as column}
            <th
              style={column.width ? `width: ${column.width}` : ''}
              class={column.align || 'left'}
              class:sortable
              on:click={() => handleSort(column.key)}
            >
              <span class="header-content">
                {column.label}
                {#if sortable && sortKey === column.key}
                  <i class="fas fa-sort-{sortDirection}" />
                {/if}
              </span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each displayData as row}
          <tr>
            {#each columns as column}
              <td class={column.align || 'left'}>
                {formatValue(row[column.key], column.format)}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if pagination && totalPages > 1}
    <div class="pagination">
      <button
        class="page-button"
        disabled={currentPage === 1}
        on:click={() => prevPage()}
      >
        <i class="fas fa-chevron-left" />
      </button>

      {#if totalPages <= 7}
        {#each Array(totalPages) as _, i}
          <button
            class="page-button"
            class:active={currentPage === i + 1}
            on:click={() => goToPage(i + 1)}
          >
            {i + 1}
          </button>
        {/each}
      {:else}
        {#if currentPage > 3}
          <button
            class="page-button"
            on:click={() => goToPage(1)}
          >
            1
          </button>
          {#if currentPage > 4}
            <span class="ellipsis">...</span>
          {/if}
        {/if}

        {#each Array(3) as _, i}
          {@const page = currentPage + i - 1}
          {#if page > 0 && page <= totalPages}
            <button
              class="page-button"
              class:active={currentPage === page}
              on:click={() => goToPage(page)}
            >
              {page}
            </button>
          {/if}
        {/each}

        {#if currentPage < totalPages - 2}
          {#if currentPage < totalPages - 3}
            <span class="ellipsis">...</span>
          {/if}
          <button
            class="page-button"
            on:click={() => goToPage(totalPages)}
          >
            {totalPages}
          </button>
        {/if}
      {/if}

      <button
        class="page-button"
        disabled={currentPage === totalPages}
        on:click={() => nextPage()}
      >
        <i class="fas fa-chevron-right" />
      </button>
    </div>
  {/if}
</div>

<style lang="postcss">
  .data-table {
    width: 100%;
    overflow: hidden;
    background: var(--surface-2);
    border-radius: 8px;
  }

  .table-container {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    white-space: nowrap;
  }

  th {
    padding: 12px 16px;
    background: var(--surface-3);
    font-weight: 600;
    color: var(--text-1);
    text-align: left;
    user-select: none;

    &.sortable {
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background: var(--surface-4);
      }
    }

    &.center {
      text-align: center;
    }

    &.right {
      text-align: right;
    }
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      font-size: 12px;
      opacity: 0.5;
    }
  }

  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--surface-3);
    color: var(--text-2);

    &.center {
      text-align: center;
    }

    &.right {
      text-align: right;
    }
  }

  tr:last-child td {
    border-bottom: none;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px;
    border-top: 1px solid var(--surface-3);
  }

  .page-button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-2);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--surface-3);
      color: var(--text-1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.active {
      background: var(--primary-color);
      color: white;
    }
  }

  .ellipsis {
    color: var(--text-2);
    padding: 0 4px;
  }
</style> 