import { config } from '../config.js';
import { EncryptedFileRecord } from '../types.js';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite');

class GuardianDatabase {
  private db: any;

  constructor() {
    this.db = new DatabaseSync(config.dbPath);
    this.init();
  }

  private init() {
    // Pragmas for durability and speed
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        storage_key TEXT NOT NULL,
        iv TEXT NOT NULL,
        salt TEXT,
        size_bytes INTEGER NOT NULL,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
    `);
  }

  public createFile(record: EncryptedFileRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (
        id, storage_key, iv, salt, size_bytes, max_downloads, download_count, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.storage_key,
      record.iv,
      record.salt || null,
      record.size_bytes,
      record.max_downloads,
      record.download_count,
      record.expires_at,
      record.created_at
    );
  }

  public getFile(id: string): EncryptedFileRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM files WHERE id = ?`);
    const row = stmt.get(id);
    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Atomically records a download and determines if the file reached its threshold (Burn After Reading).
   */
  public incrementDownload(id: string): { record: EncryptedFileRecord | null; shouldBurn: boolean } {
    const file = this.getFile(id);
    if (!file) return { record: null, shouldBurn: false };

    const newCount = file.download_count + 1;
    const shouldBurn = file.max_downloads !== null && newCount >= file.max_downloads;

    const updateStmt = this.db.prepare(`UPDATE files SET download_count = ? WHERE id = ?`);
    updateStmt.run(newCount, id);

    file.download_count = newCount;
    return { record: file, shouldBurn };
  }

  public deleteFile(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM files WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public getExpiredFiles(currentTimeMs: number = Date.now()): EncryptedFileRecord[] {
    const stmt = this.db.prepare(`SELECT * FROM files WHERE expires_at <= ?`);
    const rows = stmt.all(currentTimeMs);
    return rows.map((r: any) => this.mapRow(r));
  }

  private mapRow(row: any): EncryptedFileRecord {
    return {
      id: row.id,
      storage_key: row.storage_key,
      iv: row.iv,
      salt: row.salt ?? null,
      size_bytes: Number(row.size_bytes),
      max_downloads: row.max_downloads !== null ? Number(row.max_downloads) : null,
      download_count: Number(row.download_count),
      expires_at: Number(row.expires_at),
      created_at: Number(row.created_at),
    };
  }
}

export const db = new GuardianDatabase();
