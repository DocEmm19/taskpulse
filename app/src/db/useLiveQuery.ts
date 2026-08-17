import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeTable } from './events';

interface State<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Runs `queryFn` once, then re-runs it automatically whenever any table in
 * `tables` is written to (see events.ts). This is the app's substitute for
 * Drift's reactive `Stream<List<T>>` — every screen that reads from SQLite
 * uses this hook so it updates the instant a task/remark/attachment/etc
 * changes, with no manual refresh anywhere in the app.
 *
 * `deps` behaves like a normal dependency array — pass filter/search state so
 * the query re-runs when the *inputs* change too, not just the table.
 */
export function useLiveQuery<T>(
  tables: string | string[],
  queryFn: () => Promise<T>,
  deps: React.DependencyList = []
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: undefined, loading: true, error: null });
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;
  const mountedRef = useRef(true);

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    queryFnRef
      .current()
      .then((data) => {
        if (mountedRef.current) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (mountedRef.current) setState({ data: undefined, loading: false, error });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    run();
    const list = Array.isArray(tables) ? tables : [tables];
    const unsubs = list.map((t) => subscribeTable(t, run));
    return () => {
      mountedRef.current = false;
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  return { ...state, reload: run };
}
