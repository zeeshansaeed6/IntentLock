import { useEffect, useRef } from 'react';

export type AgentEvent = {
  type: string;
  stage: string;
  message: string;
  tone: 'green' | 'rose' | 'amber' | 'slate';
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export function useSSE(onEvent?: (event: AgentEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as AgentEvent;
        if (onEvent) onEvent(parsed);
      } catch {
        // Ignore unparseable frames (like keep-alive ping)
      }
    };

    es.onerror = () => {
      // Browser handles auto-reconnect
    };

    return () => {
      es.close();
    };
  }, [onEvent]);
}
