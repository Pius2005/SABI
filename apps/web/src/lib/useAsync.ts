import { useEffect, useRef, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((previous: T | null) => T | null)) => void;
}

/**
 * Runs an async loader and keeps the latest result. The loader is held in a
 * ref so callers do not need to memoise it; pass the values it depends on.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [nonce, setNonce] = useState(0);
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setDataState(result);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return {
    data,
    error,
    loading,
    reload: () => setNonce((value) => value + 1),
    setData: (updater) =>
      setDataState((previous) => (typeof updater === 'function' ? (updater as (value: T | null) => T | null)(previous) : updater)),
  };
}
