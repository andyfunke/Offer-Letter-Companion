import { useCallback } from 'react';
import { apiBase } from '@/hooks/use-auth';

export function useInteractionLog() {
  const log = useCallback((element: string, action: string, details?: Record<string, unknown>) => {
    const page = window.location.pathname;
    fetch(`${apiBase()}/telemetry/log`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ element, action, page, details }),
    }).catch(() => {});
  }, []);

  return { log };
}
