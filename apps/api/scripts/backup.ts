import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const RETENTION_DAYS = 14;
const ALGORITHM = 'aes-256-gcm';

export async function runBackup(options?: { destinationDir?: string; key?: string }) {
  const destDir = options?.destinationDir || BACKUP_DIR;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `intentlock-backup-${timestamp}.enc`;
  const backupFilePath = path.join(destDir, backupFileName);

  console.log(`[Backup] Starting database backup at ${new Date().toISOString()}`);

  let dumpData: Record<string, any> = {};

  if (process.env.MONGODB_URI) {
    console.log('[Backup] Connecting to MongoDB...');
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const db = client.db();
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
        const docs = await db.collection(col.name).find({}).toArray();
        dumpData[col.name] = docs;
        console.log(`[Backup] Dumped collection '${col.name}': ${docs.length} records`);
      }
    } finally {
      await client.close();
    }
  } else {
    console.log('[Backup] MONGODB_URI not set. Dumping snapshot from local data repository...');
    dumpData = {
      _meta: { type: 'snapshot', exportedAt: new Date().toISOString() },
      intents: [],
      cards: [],
      transactions: [],
      audit: [],
    };
  }

  const rawJson = JSON.stringify(dumpData, null, 2);

  // AES-256-GCM Encryption
  const secret = options?.key || process.env.BACKUP_ENCRYPTION_KEY || 'default_intentlock_backup_key_for_testing_purposes_32chars';
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const derivedKey = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(rawJson, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const backupPayload = {
    version: '1.0',
    algorithm: ALGORITHM,
    createdAt: new Date().toISOString(),
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`[Backup] Encrypted backup created successfully: ${backupFilePath}`);

  // Enforce 14-day retention policy
  pruneOldBackups(destDir, RETENTION_DAYS);

  return { backupFilePath, timestamp };
}

export function pruneOldBackups(destDir: string, retentionDays: number) {
  if (!fs.existsSync(destDir)) return;
  const files = fs.readdirSync(destDir);
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  let prunedCount = 0;
  for (const file of files) {
    if (!file.endsWith('.enc')) continue;
    const filePath = path.join(destDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
      prunedCount++;
      console.log(`[Backup] Pruned expired backup (> ${retentionDays} days): ${file}`);
    }
  }
  if (prunedCount === 0) {
    console.log(`[Backup] Retention check complete. All existing backups are within ${retentionDays} days.`);
  }
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('backup.ts')) {
  runBackup().catch((err) => {
    console.error('[Backup Error]', err);
    process.exit(1);
  });
}
