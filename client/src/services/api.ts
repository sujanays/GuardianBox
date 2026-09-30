import { bufferToBase64Url, base64UrlToBuffer } from '../crypto/keys';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://guardianbox-server.onrender.com/api';

export interface UploadPayloadOptions {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  salt?: Uint8Array | null;
  maxDownloads: number | null;
  ttlSeconds: number;
}

export interface UploadResult {
  id: string;
  expires_at: number;
  max_downloads: number | null;
}

export interface RemoteFileMetadata {
  id: string;
  size_bytes: number;
  iv: string;
  salt: string | null;
  expires_at: number;
  max_downloads: number | null;
  download_count: number;
  remaining_downloads: number | null;
}

export interface DownloadResult {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array | null;
  wasBurned: boolean;
  downloadCount: number;
  maxDownloads: number | null;
}

/**
 * Uploads encrypted ciphertext blob and metadata to blind server.
 * ZERO-KNOWLEDGE GUARANTEE: Never includes secret keys or unencrypted filenames.
 */
export async function uploadEncryptedPayload(options: UploadPayloadOptions): Promise<UploadResult> {
  const formData = new FormData();
  
  // Convert ciphertext ArrayBuffer to Blob
  const blob = new Blob([options.ciphertext], { type: 'application/octet-stream' });
  formData.append('file', blob, 'encrypted.bin');
  
  // Encode IV to Base64
  formData.append('iv', bufferToBase64Url(options.iv));

  if (options.salt) {
    formData.append('salt', bufferToBase64Url(options.salt));
  }

  if (options.maxDownloads !== null) {
    formData.append('max_downloads', options.maxDownloads.toString());
  }

  formData.append('ttl_seconds', options.ttlSeconds.toString());

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Upload failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    expires_at: data.expires_at,
    max_downloads: data.max_downloads,
  };
}

/**
 * Inspects remote metadata without decrementing burn counter.
 */
export async function fetchFileMetadata(fileId: string): Promise<RemoteFileMetadata> {
  const response = await fetch(`${API_BASE}/files/${fileId}/meta`);
  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      throw new Error('This file has expired or was permanently destroyed after being read.');
    }
    throw new Error(`Failed to load file status (${response.status})`);
  }

  const json = await response.json();
  return json.data;
}

/**
 * Fetches ciphertext blob and increments burn counter.
 */
export async function fetchEncryptedCiphertext(fileId: string): Promise<DownloadResult> {
  const response = await fetch(`${API_BASE}/files/${fileId}/download`);
  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      throw new Error('This file has expired or was already burned after reaching its download limit.');
    }
    throw new Error(`Download failed (${response.status})`);
  }

  const ivBase64 = response.headers.get('X-Guardian-IV');
  if (!ivBase64) {
    throw new Error('Server response missing IV security header.');
  }

  const saltBase64 = response.headers.get('X-Guardian-Salt');
  const wasBurned = response.headers.get('X-Guardian-Burned') === 'true';
  const downloadCount = parseInt(response.headers.get('X-Guardian-Downloads-Count') || '1', 10);
  const maxDownloadsHeader = response.headers.get('X-Guardian-Max-Downloads');
  const maxDownloads = maxDownloadsHeader ? parseInt(maxDownloadsHeader, 10) : null;

  const ciphertext = await response.arrayBuffer();

  return {
    ciphertext,
    iv: new Uint8Array(base64UrlToBuffer(ivBase64)),
    salt: saltBase64 ? new Uint8Array(base64UrlToBuffer(saltBase64)) : null,
    wasBurned,
    downloadCount,
    maxDownloads,
  };
}
