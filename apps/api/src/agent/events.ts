import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

export type AgentEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  tone: 'violet' | 'green' | 'rose' | 'amber';
  timestamp: string;
  ownerId?: string;
  data?: Record<string, unknown>;
};

class EventBus {
  private readonly clients = new Map<Response, { userId?: string; role?: 'admin' | 'user' }>();

  connect(response: Response, userId?: string, role?: 'admin' | 'user'): () => void {
    this.clients.set(response, { userId, role });
    return () => this.clients.delete(response);
  }

  publish(event: AgentEvent): void {
    const message = `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [client, meta] of this.clients.entries()) {
      const isAdmin = meta.role === 'admin';
      if (isAdmin || (event.ownerId && meta.userId === event.ownerId)) client.write(message);
    }
  }
}

export const eventBus = new EventBus();

export function publishAgentEvent(event: Omit<AgentEvent, 'id' | 'timestamp'>): AgentEvent {
  const fullEvent = { ...event, id: randomUUID(), timestamp: new Date().toISOString() };
  eventBus.publish(fullEvent);
  return fullEvent;
}
