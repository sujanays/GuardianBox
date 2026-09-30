const webCrypto = typeof window !== 'undefined' && window.crypto 
  ? window.crypto 
  : (typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null);

if (!webCrypto || !webCrypto.subtle) {
  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
}

/**
 * Encodes an ArrayBuffer or Uint8Array into a URL-safe Base64 string (RFC 4648 § 5)
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
export function bufferToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === 'function' 
    ? btoa(binary) 
    : Buffer.from(bytes).toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 string into an ArrayBuffer
 * @param {string} base64url
 * @returns {ArrayBuffer}
 */
export function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } else {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
}

/**
 * Generates a cryptographically secure 256-bit symmetric key for AES-GCM
 * @returns {Promise<CryptoKey>}
 */
export async function generateKey() {
  return await webCrypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // Extractable for client URL-fragment embedding
    ['encrypt', 'decrypt']
  );
}

// Alias matching generateAesKey
export const generateAesKey = generateKey;

/**
 * Exports a CryptoKey to a URL-safe Base64 string
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function exportKey(key) {
  const raw = await webCrypto.subtle.exportKey('raw', key);
  return bufferToBase64Url(raw);
}

export const exportKeyToString = exportKey;

/**
 * Imports a 256-bit AES-GCM key from a URL-safe Base64 string
 * @param {string} keyString
 * @returns {Promise<CryptoKey>}
 */
export async function importKey(keyString) {
  const rawBuffer = base64UrlToBuffer(keyString);
  return await webCrypto.subtle.importKey(
    'raw',
    rawBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['decrypt', 'encrypt']
  );
}

export const importKeyFromString = importKey;

/**
 * Computes a SHA-256 fingerprint of the key for visual confirmation
 * @param {string} keyString
 * @returns {Promise<string>}
 */
export async function getKeyFingerprint(keyString) {
  const enc = new TextEncoder();
  const hashBuffer = await webCrypto.subtle.digest('SHA-256', enc.encode(keyString));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

/**
 * Encrypts data using AES-GCM 256-bit with a 96-bit CSPRNG IV.
 * 
 * Supports data as:
 * - string (UTF-8)
 * - Uint8Array / ArrayBuffer (binary)
 * 
 * Returns an EncryptedContainer object:
 * {
 *   ciphertext: ArrayBuffer,
 *   iv: Uint8Array,
 *   packed: Uint8Array, // [12-byte IV + ciphertext (includes 16-byte auth tag)]
 *   isString: boolean
 * }
 * 
 * @param {string | Uint8Array | ArrayBuffer} data
 * @param {CryptoKey | string} key
 * @returns {Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array, packed: Uint8Array, isString: boolean }>}
 */
export async function encrypt(data, key) {
  const cryptoKey = typeof key === 'string' ? await importKey(key) : key;

  // 1. Generate 96-bit (12-byte) cryptographically secure random IV
  const iv = webCrypto.getRandomValues(new Uint8Array(12));

  // 2. Prepare plaintext buffer & format flag
  let plaintextBuffer;
  let isString = false;

  if (typeof data === 'string') {
    plaintextBuffer = new TextEncoder().encode(data);
    isString = true;
  } else if (data instanceof Uint8Array) {
    plaintextBuffer = data;
  } else if (data instanceof ArrayBuffer) {
    plaintextBuffer = new Uint8Array(data);
  } else {
    // Attempt JSON serialization for objects
    plaintextBuffer = new TextEncoder().encode(JSON.stringify(data));
    isString = true;
  }

  // 3. Perform AES-GCM encryption with 128-bit authentication tag
  const ciphertext = await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    cryptoKey,
    plaintextBuffer
  );

  // 4. Create packed contiguous buffer [12 bytes IV] + [Ciphertext with Auth Tag]
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), 12);

  return {
    ciphertext,
    iv,
    packed,
    isString,
  };
}

/**
 * Decrypts AES-GCM 256-bit ciphertext and verifies the 128-bit authentication tag.
 * 
 * Accepts ciphertext in multiple ergonomic forms:
 * - Container object: { ciphertext, iv, isString? }
 * - Packed Uint8Array / ArrayBuffer where the first 12 bytes are the IV
 * - Standalone ciphertext with IV provided as 3rd parameter: decrypt(ciphertext, key, iv)
 * 
 * @param {Object | ArrayBuffer | Uint8Array} ciphertext
 * @param {CryptoKey | string} key
 * @param {Uint8Array} [optionalIv]
 * @returns {Promise<string | Uint8Array>}
 */
export async function decrypt(ciphertext, key, optionalIv) {
  const cryptoKey = typeof key === 'string' ? await importKey(key) : key;

  let rawCiphertext;
  let iv;
  let expectString = false;

  // Form 1: Passed the container object returned by encrypt()
  if (ciphertext && typeof ciphertext === 'object' && 'ciphertext' in ciphertext && 'iv' in ciphertext) {
    rawCiphertext = ciphertext.ciphertext;
    iv = ciphertext.iv;
    expectString = Boolean(ciphertext.isString);
  }
  // Form 2: Standalone ciphertext with IV in 3rd argument
  else if (optionalIv) {
    rawCiphertext = ciphertext;
    iv = optionalIv;
  }
  // Form 3: Packed buffer [12 bytes IV + ciphertext]
  else {
    const packedBytes = ciphertext instanceof Uint8Array 
      ? ciphertext 
      : new Uint8Array(ciphertext);

    if (packedBytes.byteLength < 12 + 16) {
      throw new Error('Ciphertext payload is too short to contain a valid IV and AES-GCM tag.');
    }
    iv = packedBytes.subarray(0, 12);
    rawCiphertext = packedBytes.subarray(12);
  }

  // Perform AES-GCM decryption
  let decryptedBuffer;
  try {
    decryptedBuffer = await webCrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      cryptoKey,
      rawCiphertext
    );
  } catch (err) {
    throw new Error('Integrity Verification Failed: Decryption failed. Invalid secret key or ciphertext was corrupted/tampered with.');
  }

  const decryptedBytes = new Uint8Array(decryptedBuffer);

  // If known string or valid UTF-8 text, return decoded string
  if (expectString) {
    return new TextDecoder().decode(decryptedBytes);
  }

  // Attempt UTF-8 decoding if text-like, otherwise return Uint8Array
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(decryptedBytes);
  } catch {
    return decryptedBytes;
  }
}

/**
 * Encrypts a File with an envelope that conceals original name and MIME type.
 * @param {File} file
 * @param {CryptoKey} key
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array, metadata: Object }>}
 */
export async function encryptFile(file, key, onProgress) {
  onProgress?.(10);
  const iv = webCrypto.getRandomValues(new Uint8Array(12));

  const metadata = {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  };

  const headerJson = JSON.stringify(metadata);
  const headerBytes = new TextEncoder().encode(headerJson);
  const headerLength = headerBytes.byteLength;

  onProgress?.(30);
  const fileBuffer = await file.arrayBuffer();

  onProgress?.(50);
  const totalLength = 4 + headerLength + fileBuffer.byteLength;
  const packedBuffer = new Uint8Array(totalLength);
  const view = new DataView(packedBuffer.buffer);
  view.setUint32(0, headerLength, false);

  packedBuffer.set(headerBytes, 4);
  packedBuffer.set(new Uint8Array(fileBuffer), 4 + headerLength);

  onProgress?.(70);
  const ciphertext = await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    key,
    packedBuffer
  );

  onProgress?.(100);
  return { ciphertext, iv, metadata };
}

/**
 * Decrypts a file ciphertext and unpacks original filename, MIME type, and Blob.
 * @param {ArrayBuffer} ciphertext
 * @param {CryptoKey} key
 * @param {Uint8Array} iv
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ blob: Blob, name: string, type: string, size: number }>}
 */
export async function decryptFile(ciphertext, key, iv, onProgress) {
  onProgress?.(20);
  let decryptedBuffer;
  try {
    decryptedBuffer = await webCrypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      ciphertext
    );
  } catch (err) {
    throw new Error('Integrity Verification Failed: Decryption failed. Invalid secret key or ciphertext was corrupted/tampered with.');
  }

  onProgress?.(60);
  const view = new DataView(decryptedBuffer);
  const headerLength = view.getUint32(0, false);

  const headerBytes = new Uint8Array(decryptedBuffer, 4, headerLength);
  const headerJson = new TextDecoder().decode(headerBytes);
  const metadata = JSON.parse(headerJson);

  onProgress?.(80);
  const fileBytes = new Uint8Array(decryptedBuffer, 4 + headerLength);
  const blob = typeof Blob !== 'undefined' 
    ? new Blob([fileBytes], { type: metadata.type })
    : null;

  onProgress?.(100);
  return {
    blob,
    bytes: fileBytes,
    name: metadata.name,
    type: metadata.type,
    size: metadata.size,
  };
}

export default {
  generateKey,
  generateAesKey,
  exportKey,
  exportKeyToString,
  importKey,
  importKeyFromString,
  getKeyFingerprint,
  encrypt,
  decrypt,
  encryptFile,
  decryptFile,
  bufferToBase64Url,
  base64UrlToBuffer,
};
