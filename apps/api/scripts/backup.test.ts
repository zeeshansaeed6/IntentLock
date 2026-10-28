import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBackup, pruneOldBackups } from './backup.js';
import { runRestore } from './restore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_BACKUP_DIR = path.resolve(__dirname, 'test_backups');

describe('Milestone 6 Security: Database Backup & Restore System', () => {
  afterEach(() => {
    if (fs.existsSync(TEST_BACKUP_DIR)) {
      fs.rmSync(TEST_BACKUP_DIR, { recursive: true, force: true });
    }
  });

  it('creates an AES-256-GCM encrypted backup file', async () => {
    const { backupFilePath } = await runBackup({
      destinationDir: TEST_BACKUP_DIR,
      key: 'test_backup_encryption_key_32bytes!',
    });

    expect(fs.existsSync(backupFilePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    expect(content.algorithm).toBe('aes-256-gcm');
    expect(content.ciphertext).toBeDefined();
    expect(content.authTag).toBeDefined();
    expect(content.salt).toBeDefined();
    expect(content.iv).toBeDefined();
    // Verify ciphertext is NOT raw JSON (it is encrypted)
    expect(content.ciphertext).not.toContain('intents');
  });

  it('decrypts and verifies backup data integrity during restore', async () => {
    const testKey = 'test_backup_encryption_key_32bytes!';
    const { backupFilePath } = await runBackup({
      destinationDir: TEST_BACKUP_DIR,
      key: testKey,
    });

    const restored = await runRestore(backupFilePath, { dryRun: true, key: testKey });
    expect(restored).toBeDefined();
    expect(restored._meta).toBeDefined();
    expect(restored._meta.type).toBe('snapshot');
  });

  it('detects tampering and rejects corrupted backup payload', async () => {
    const testKey = 'test_backup_encryption_key_32bytes!';
    const { backupFilePath } = await runBackup({
      destinationDir: TEST_BACKUP_DIR,
      key: testKey,
    });

    // Tamper with the ciphertext
    const content = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const tamperedHex = content.ciphertext.substring(0, content.ciphertext.length - 2) + '00';
    content.ciphertext = tamperedHex;
    fs.writeFileSync(backupFilePath, JSON.stringify(content));

    await expect(
      runRestore(backupFilePath, { dryRun: true, key: testKey })
    ).rejects.toThrow('Backup integrity verification failed');
  });

  it('prunes backups older than 14 days retention window', () => {
    if (!fs.existsSync(TEST_BACKUP_DIR)) {
      fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
    }

    const oldFilePath = path.join(TEST_BACKUP_DIR, 'intentlock-backup-old.enc');
    const newFilePath = path.join(TEST_BACKUP_DIR, 'intentlock-backup-new.enc');

    fs.writeFileSync(oldFilePath, 'mock-old-data');
    fs.writeFileSync(newFilePath, 'mock-new-data');

    // Set old file modified time to 15 days ago
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    fs.utimesSync(oldFilePath, new Date(fifteenDaysAgo), new Date(fifteenDaysAgo));

    pruneOldBackups(TEST_BACKUP_DIR, 14);

    expect(fs.existsSync(oldFilePath)).toBe(false);
    expect(fs.existsSync(newFilePath)).toBe(true);
  });
});
