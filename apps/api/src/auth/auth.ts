import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

export type UserRole = 'admin' | 'user';

export type UserAccount = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
};

export type Session = {
  token: string;
  userId: string;
  role: UserRole;
  email: string;
  expiresAt: number;
};

// In-memory accounts and sessions store (can be backed by MongoDB)
const users = new Map<string, UserAccount>();
const sessions = new Map<string, Session>();

const BCRYPT_SALT_ROUNDS = 12;

const BLOCKED_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'admin123',
  'qwerty123',
  'welcome123',
  'intentlock',
]);

// Initialize default admin user with hashed password
const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@intentlock.io').toLowerCase();
const defaultAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'IntentLockAdmin2026!';
const defaultAdminHash = bcrypt.hashSync(defaultAdminPassword, BCRYPT_SALT_ROUNDS);

const adminUser: UserAccount = {
  id: 'usr_admin_001',
  email: defaultAdminEmail,
  passwordHash: defaultAdminHash,
  role: 'admin',
  createdAt: new Date().toISOString(),
};
users.set(defaultAdminEmail, adminUser);

// Initialize a standard non-admin demo user
const regularUserEmail = 'user@intentlock.io';
const regularUserHash = bcrypt.hashSync('RegularUserPass2026!', BCRYPT_SALT_ROUNDS);
users.set(regularUserEmail, {
  id: 'usr_regular_002',
  email: regularUserEmail,
  passwordHash: regularUserHash,
  role: 'user',
  createdAt: new Date().toISOString(),
});

export async function registerAccount(input: {
  email: string;
  password: string;
  role?: UserRole;
}): Promise<{ id: string; email: string; role: UserRole }> {
  const email = input.email.trim().toLowerCase();

  if (users.has(email)) {
    throw new Error('An account with this email already exists.');
  }

  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  if (BLOCKED_PASSWORDS.has(input.password.toLowerCase())) {
    throw new Error('This password is too common and cannot be used.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  const user: UserAccount = {
    id: `usr_${randomUUID().slice(0, 12)}`,
    email,
    passwordHash,
    role: input.role ?? 'user',
    createdAt: new Date().toISOString(),
  };

  users.set(email, user);
  return { id: user.id, email: user.email, role: user.role };
}

export async function authenticateCredentials(
  email: string,
  password: string
): Promise<Session> {
  const normalized = email.trim().toLowerCase();
  const user = users.get(normalized);

  // Use constant-time comparison dummy hash if user not found to prevent timing attack
  const dummyHash = '$2a$12$e80MvXjW4mJm1s033.s1e.45.mJm1s033.s1e.45.mJm1s033.s1';
  const targetHash = user ? user.passwordHash : dummyHash;
  const isMatch = await bcrypt.compare(password, targetHash);

  if (!user || !isMatch) {
    throw new Error('Invalid email or password.');
  }

  // Generate high-entropy 256-bit session token
  const token = `sess_${randomBytes(32).toString('hex')}`;
  const session: Session = {
    token,
    userId: user.id,
    role: user.role,
    email: user.email,
    expiresAt: Date.now() + 24 * 3600 * 1000, // 24 hours
  };

  sessions.set(token, session);
  return session;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

export function getSession(token: string | undefined): Session | undefined {
  if (!token) return undefined;
  const session = sessions.get(token);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token =
    req.cookies?.intentlock_session ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  const session = getSession(token);
  if (session) {
    req.user = {
      id: session.userId,
      email: session.email,
      role: session.role,
    };
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' },
    });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' },
    });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Admin privileges required to perform this action.' },
    });
    return;
  }
  next();
}
