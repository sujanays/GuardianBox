/**
 * AES-GCM (256-bit) End-to-End Encryption & Decryption Engine
 * Implements authenticated encryption with zero metadata leakage to the server.
 */

export interface FileMetadataHeader {
  name: string;
  type: string;
  size: number;
}

export interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  metadata: FileMetadataHeader;
}

export interface DecryptedResult {
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

/**
 * Packs metadata header with file contents and encrypts using AES-GCM 256.
 * The server never sees the filename, extension, or MIME type.
 */
export async function encryptFile(
  file: File,
  key: CryptoKey,
  onProgress?: (percent: number) => void
): Promise<EncryptedPayload> {
  onProgress?.(10);

  // 1. Generate 96-bit (12-byte) cryptographically secure random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Prepare metadata header
  const metadata: FileMetadataHeader = {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };

  const headerJson = JSON.stringify(metadata);
  const headerBytes = new TextEncoder().encode(headerJson);
  const headerLength = headerBytes.byteLength;

  onProgress?.(30);

  // 3. Read original file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  onProgress?.(50);

  // 4. Construct contiguous payload envelope:
  // [4 bytes: uint32 header length] + [headerBytes] + [fileBuffer]
  const totalLength = 4 + headerLength + fileBuffer.byteLength;
  const packedBuffer = new Uint8Array(totalLength);

  const view = new DataView(packedBuffer.buffer);
  view.setUint32(0, headerLength, false); // Big-endian 32-bit integer

  packedBuffer.set(headerBytes, 4);
  packedBuffer.set(new Uint8Array(fileBuffer), 4 + headerLength);

  onProgress?.(70);

  // 5. Encrypt packed payload with AES-GCM
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 128-bit authentication tag
    },
    key,
    packedBuffer
  );

  onProgress?.(100);

  return {
    ciphertext,
    iv,
    metadata,
  };
}

/**
 * Decrypts AES-GCM ciphertext, verifies the 128-bit authentication tag,
 * and unpacks the original file blob with original filename and MIME type.
 */
export async function decryptFile(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
  onProgress?: (percent: number) => void
): Promise<DecryptedResult> {
  onProgress?.(20);

  // 1. Decrypt ciphertext using Web Crypto API
  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        tagLength: 128,
      },
      key,
      ciphertext
    );
  } catch (err: any) {
    throw new Error('Integrity Verification Failed: Decryption failed. Invalid secret key or ciphertext was corrupted/tampered with.');
  }

  onProgress?.(60);

  // 2. Unpack metadata envelope
  const view = new DataView(decryptedBuffer);
  const headerLength = view.getUint32(0, false);

  const headerBytes = new Uint8Array(decryptedBuffer, 4, headerLength);
  const headerJson = new TextDecoder().decode(headerBytes);
  const metadata: FileMetadataHeader = JSON.parse(headerJson);

  onProgress?.(80);

  // 3. Extract original file body
  const fileBytes = new Uint8Array(decryptedBuffer, 4 + headerLength);
  const blob = new Blob([fileBytes], { type: metadata.type });

  onProgress?.(100);

  return {
    blob,
    name: metadata.name,
    type: metadata.type,
    size: metadata.size,
  };
}
