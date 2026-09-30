import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { StorageProvider } from './storage.interface.js';
import { config } from '../config.js';

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = config.localStorageDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = path.basename(key);
    return path.join(this.baseDir, safeKey);
  }

  public async save(key: string, data: Buffer): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.promises.writeFile(filePath, data);
  }

  public async getStream(key: string): Promise<Readable> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Encrypted blob not found in storage: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  public async getBuffer(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Encrypted blob not found in storage: ${key}`);
    }
    return await fs.promises.readFile(filePath);
  }

  public async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.error(`Error deleting storage file ${key}:`, err);
    }
  }
}
