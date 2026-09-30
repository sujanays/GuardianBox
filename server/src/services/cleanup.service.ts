import { db } from '../db/database.js';
import { storage } from '../storage/index.js';
import { config } from '../config.js';

export class CleanupService {
  private timer: NodeJS.Timeout | null = null;

  public start(): void {
    console.log(`[Cleanup] Background TTL sweep worker active (Interval: ${config.cleanupIntervalMs / 1000}s)`);
    this.timer = setInterval(() => this.sweep(), config.cleanupIntervalMs);
    // Initial sweep
    this.sweep();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async sweep(): Promise<void> {
    try {
      const now = Date.now();
      const expiredFiles = db.getExpiredFiles(now);

      if (expiredFiles.length > 0) {
        console.log(`[Cleanup] Found ${expiredFiles.length} expired file(s) to purge.`);
        for (const file of expiredFiles) {
          try {
            await storage.delete(file.storage_key);
            db.deleteFile(file.id);
            console.log(`[Cleanup] Successfully purged expired file: ${file.id}`);
          } catch (err) {
            console.error(`[Cleanup] Failed to delete file ${file.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Cleanup] Error during sweep cycle:', err);
    }
  }
}

export const cleanupService = new CleanupService();
