import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

export type AgentEvent = { id: string; type: string; title: string; detail: string; tone: 'violet' | 'green' | 'rose' | 'amber'; timestamp: string; data?: Record<string, unknown> };

class EventBus {
  private readonly clients = new Set<Response>();

  connect(response: Response): () => void {
    this.clients.add(response);
    return () => this.clients.delete(response);
  }

  publish(event: AgentEvent): void {
    const message = `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(message);
  }
}

export const eventBus = new EventBus();

export function publishAgentEvent(event: Omit<AgentEvent, 'id' | 'timestamp'>): AgentEvent {
  const fullEvent = { ...event, id: randomUUID(), timestamp: new Date().toISOString() };
  eventBus.publish(fullEvent);
  return fullEvent;
}
