import { useState, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions<T> {
  fetchData: (cursor?: string) => Promise<{
    data: T[];
    cursor?: string;
  }>;
  threshold?: number;
}

export function useInfiniteScroll<T>({ fetchData, threshold = 0.8 }: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursor = useRef<string | undefined>();
  const observer = useRef<IntersectionObserver>();

  const lastElementRef = useCallback(
    (node: Element | null) => {
      if (loading) return;

      if (observer.current) {
        observer.current.disconnect();
      }

      observer.current = new IntersectionObserver(
        async (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            try {
              setLoading(true);
              setError(null);
              const response = await fetchData(cursor.current);

              setItems((prev) => [...prev, ...response.data]);
              cursor.current = response.cursor;
              setHasMore(!!response.cursor);
            } catch (err) {
              setError(err instanceof Error ? err : new Error('Failed to fetch data'));
            } finally {
              setLoading(false);
            }
          }
        },
        { threshold }
      );

      if (node) {
        observer.current.observe(node);
      }
    },
    [fetchData, hasMore, loading, threshold]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      cursor.current = undefined;
      const response = await fetchData();
      setItems(response.data);
      cursor.current = response.cursor;
      setHasMore(!!response.cursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  return {
    items,
    loading,
    error,
    hasMore,
    lastElementRef,
    refresh,
  };
}
