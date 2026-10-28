import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const ALGORITHM = 'aes-256-gcm';

export async function runRestore(targetFile?: string, options?: { dryRun?: boolean; key?: string }) {
  console.log(`[Restore] Initiating restore procedure...`);

  let fileToRestore = targetFile;
  if (!fileToRestore) {
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`Backup directory does not exist: ${BACKUP_DIR}`);
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.enc'))
      .sort()
      .reverse();
    if (files.length === 0) {
      throw new Error(`No .enc backup files found in ${BACKUP_DIR}`);
    }
    fileToRestore = path.join(BACKUP_DIR, files[0]);
  }

  console.log(`[Restore] Reading backup from: ${fileToRestore}`);
  const rawPayload = JSON.parse(fs.readFileSync(fileToRestore, 'utf8'));

  const secret = options?.key || process.env.BACKUP_ENCRYPTION_KEY || 'default_intentlock_backup_key_for_testing_purposes_32chars';
  const salt = Buffer.from(rawPayload.salt, 'hex');
  const iv = Buffer.from(rawPayload.iv, 'hex');
  const authTag = Buffer.from(rawPayload.authTag, 'hex');
  const ciphertext = Buffer.from(rawPayload.ciphertext, 'hex');

  const derivedKey = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error('Backup integrity verification failed: Decryption authentication tag mismatch or invalid key.');
  }

  const restoredData = JSON.parse(decrypted.toString('utf8'));
  console.log(`[Restore] Decryption & integrity verification successful. Backup created at: ${rawPayload.createdAt}`);

  if (options?.dryRun) {
    console.log('[Restore] Dry run mode enabled. Data validated successfully without writing to DB.');
    return restoredData;
  }

  if (process.env.MONGODB_URI) {
    console.log('[Restore] Restoring records to MongoDB database...');
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const db = client.db();
      for (const [collectionName, records] of Object.entries(restoredData)) {
        if (!Array.isArray(records) || records.length === 0) continue;
        const col = db.collection(collectionName);
        await col.deleteMany({});
        await col.insertMany(records);
        console.log(`[Restore] Restored ${records.length} records into collection '${collectionName}'`);
      }
    } finally {
      await client.close();
    }
  } else {
    console.log('[Restore] MONGODB_URI not set. Restored payload validated in memory.');
  }

  console.log('[Restore] Database restore completed successfully.');
  return restoredData;
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('restore.ts')) {
  const target = process.argv[2];
  runRestore(target).catch((err) => {
    console.error('[Restore Error]', err);
    process.exit(1);
  });
}
