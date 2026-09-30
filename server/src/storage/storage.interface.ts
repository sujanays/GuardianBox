import { Readable } from 'node:stream';

export interface StorageProvider {
  /**
   * Save an encrypted ciphertext buffer or stream
   */
  save(key: string, data: Buffer): Promise<void>;

  /**
   * Retrieve encrypted ciphertext as a readable stream
   */
  getStream(key: string): Promise<Readable>;

  /**
   * Retrieve encrypted ciphertext as a buffer
   */
  getBuffer(key: string): Promise<Buffer>;

  /**
   * Permanently delete ciphertext from storage
   */
  delete(key: string): Promise<void>;
}
