import { randomUUID } from 'node:crypto';

export type DemoUser = { id: string; email: string; name: string };
const sessions = new Map<string, DemoUser>();

export function loginDemo(email: string, _password: string): { token: string; user: DemoUser } {
  const normalized = email.trim().toLowerCase();
  const user = { id: `user_${randomUUID().slice(0, 8)}`, email: normalized, name: normalized.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Demo User' };
  const token = `demo_${randomUUID()}`;
  sessions.set(token, user);
  return { token, user };
}

export function getDemoUser(token: string | undefined): DemoUser | undefined { return token ? sessions.get(token) : undefined; }
export function logoutDemo(token: string | undefined): void { if (token) sessions.delete(token); }
