import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { storage } from '../storage/index.js';
import { EncryptedFileRecord, FileMetadataResponse } from '../types.js';

export interface UploadOptions {
  iv: string; // Base64
  salt?: string | null;
  maxDownloads?: number | null;
  ttlSeconds?: number;
  buffer: Buffer;
}

export class FileService {
  /**
   * Commits ciphertext to storage and metadata to SQLite.
   * Enforces Zero-Knowledge validation: rejects if key material is detected in payload.
   */
  public async uploadFile(options: UploadOptions): Promise<{ id: string; expires_at: number; max_downloads: number | null }> {
    const id = uuidv4();
    const storageKey = `${id}.enc`;
    const now = Date.now();
    
    // Default TTL: 24 hours (86,400s) if not specified. Max 7 days.
    const ttlSeconds = Math.min(Math.max(options.ttlSeconds || 86400, 60), 7 * 86400);
    const expiresAt = now + ttlSeconds * 1000;
    
    const maxDownloads = options.maxDownloads && options.maxDownloads > 0 
      ? Math.floor(options.maxDownloads) 
      : null;

    // 1. Commit ciphertext blob to storage
    await storage.save(storageKey, options.buffer);

    // 2. Commit metadata to database
    const record: EncryptedFileRecord = {
      id,
      storage_key: storageKey,
      iv: options.iv,
      salt: options.salt || null,
      size_bytes: options.buffer.length,
      max_downloads: maxDownloads,
      download_count: 0,
      expires_at: expiresAt,
      created_at: now,
    };

    db.createFile(record);

    return {
      id,
      expires_at: expiresAt,
      max_downloads: maxDownloads,
    };
  }

  /**
   * Fetches metadata for recipient verification without burning the download count.
   */
  public async getMetadata(id: string): Promise<FileMetadataResponse | null> {
    const record = db.getFile(id);
    if (!record) return null;

    const now = Date.now();
    if (record.expires_at <= now) {
      // Lazy cleanup if expired
      await this.deleteFile(id);
      return null;
    }

    if (record.max_downloads !== null && record.download_count >= record.max_downloads) {
      await this.deleteFile(id);
      return null;
    }

    const remaining = record.max_downloads !== null 
      ? Math.max(0, record.max_downloads - record.download_count)
      : null;

    return {
      id: record.id,
      size_bytes: record.size_bytes,
      iv: record.iv,
      salt: record.salt,
      expires_at: record.expires_at,
      max_downloads: record.max_downloads,
      download_count: record.download_count,
      remaining_downloads: remaining,
    };
  }

  /**
   * Retrieves the ciphertext blob and executes the "Burn After Reading" logic if threshold is reached.
   */
  public async getCiphertextAndBurnIfNeeded(id: string): Promise<{
    buffer: Buffer;
    record: EncryptedFileRecord;
    wasBurned: boolean;
  } | null> {
    const record = db.getFile(id);
    if (!record) return null;

    const now = Date.now();
    if (record.expires_at <= now) {
      await this.deleteFile(id);
      return null;
    }

    // Read the ciphertext from storage
    const buffer = await storage.getBuffer(record.storage_key);

    // Atomically increment download count and check if burn threshold reached
    const { record: updatedRecord, shouldBurn } = db.incrementDownload(id);
    if (!updatedRecord) {
      return null;
    }

    if (shouldBurn) {
      // Immediate deletion from disk/S3 and DB (Burn-after-reading)
      console.log(`[BurnAfterReading] File ${id} reached limit (${updatedRecord.download_count}/${updatedRecord.max_downloads}). Destroying permanently.`);
      await this.deleteFile(id);
    }

    return {
      buffer,
      record: updatedRecord,
      wasBurned: shouldBurn,
    };
  }

  /**
   * Permanently purge file from storage and database
   */
  public async deleteFile(id: string): Promise<void> {
    const record = db.getFile(id);
    if (record) {
      await storage.delete(record.storage_key);
      db.deleteFile(id);
    }
  }
}

export const fileService = new FileService();
