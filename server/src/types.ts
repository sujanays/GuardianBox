export interface EncryptedFileRecord {
  id: string;
  storage_key: string;
  iv: string; // Base64 encoded 12-byte initialization vector
  salt?: string | null; // Base64 encoded salt if derived via PBKDF2
  size_bytes: number; // Size of ciphertext blob in bytes
  max_downloads: number | null; // Burn after N downloads (null = unlimited until expiration)
  download_count: number;
  expires_at: number; // Unix timestamp in ms
  created_at: number; // Unix timestamp in ms
}

export interface FileMetadataResponse {
  id: string;
  size_bytes: number;
  iv: string;
  salt?: string | null;
  expires_at: number;
  max_downloads: number | null;
  download_count: number;
  remaining_downloads: number | null;
}

export interface UploadResponse {
  id: string;
  expires_at: number;
  max_downloads: number | null;
  message: string;
}
