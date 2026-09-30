import {
  encryptFile,
  decryptFile,
  generateKey,
  exportKey,
  importKey,
  bufferToBase64Url,
  base64UrlToBuffer,
} from '../cryptoUtils.js';

// Production Render Server Endpoint
const API_BASE_URL = 'https://guardianbox-server.onrender.com/api/files';

export interface UploadOptions {
  ttl_seconds?: number;
  max_downloads?: number;
  onProgress?: (percent: number) => void;
}

export interface UploadResponse {
  id: string;
  expires_at: number;
  max_downloads: number | null;
  key: string;
  shareableUrl: string;
}

export interface FileMetadata {
  id: string;
  size_bytes: number;
  iv: string;
  salt: string | null;
  expires_at: number;
  max_downloads: number | null;
  download_count: number;
  remaining_downloads: number | null;
}

/**
 * Encrypts a file client-side and posts the ciphertext payload to POST /api/files/upload
 */
export async function uploadEncryptedFile(
  file: File,
  options?: UploadOptions
): Promise<UploadResponse> {
  // 1. Generate 256-bit AES-GCM secret key client-side
  const key = await generateKey();
  const exportedKeyStr = await exportKey(key);

  // 2. Encrypt file client-side
  const { ciphertext, iv } = await encryptFile(file, key, options?.onProgress);
  const ivBase64 = bufferToBase64Url(iv);

  // 3. Construct FormData matching server expectations
  const formData = new FormData();
  const fileBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
  
  // Field name MUST be 'ciphertext' to match Multer on the backend
  formData.append('ciphertext', fileBlob, file.name);
  formData.append('iv', ivBase64);

  if (options?.ttl_seconds) {
    formData.append('ttl_seconds', options.ttl_seconds.toString());
  }
  if (options?.max_downloads) {
    formData.append('max_downloads', options.max_downloads.toString());
  }

  // 4. Send upload request
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `Upload failed with status ${response.status}`);
  }

  const result = await response.json();

  // Anchor secret key ONLY in client-side URL hash fragment (#)
  const shareableUrl = `${window.location.origin}/#${result.id}:${exportedKeyStr}`;

  return {
    id: result.id,
    expires_at: result.expires_at,
    max_downloads: result.max_downloads,
    key: exportedKeyStr,
    shareableUrl,
  };
}

/**
 * Fetches pre-download file metadata from server (GET /api/files/:id/meta)
 */
export async function getFileMetadata(id: string): Promise<FileMetadata> {
  const response = await fetch(`${API_BASE_URL}/${id}/meta`);
  if (!response.ok) {
    throw new Error('File not found or expired.');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Downloads ciphertext from server (GET /api/files/:id/download) and decrypts client-side
 */
export async function downloadAndDecryptFile(
  id: string,
  secretKeyStr: string,
  onProgress?: (percent: number) => void
) {
  const key = await importKey(secretKeyStr);

  const response = await fetch(`${API_BASE_URL}/${id}/download`);
  if (!response.ok) {
    throw new Error('File not found, expired, or maximum download limit reached.');
  }

  const ivHeader = response.headers.get('X-Guardian-IV');
  if (!ivHeader) {
    throw new Error('Missing initialization vector header from server response.');
  }

  const iv = new Uint8Array(base64UrlToBuffer(ivHeader));
  const ciphertextBuffer = await response.arrayBuffer();

  return await decryptFile(ciphertextBuffer, key, iv, onProgress);
}