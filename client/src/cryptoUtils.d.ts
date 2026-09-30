export interface EncryptedContainer {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  packed: Uint8Array;
  isString: boolean;
}

export interface FileMetadataHeader {
  name: string;
  type: string;
  size: number;
}

export interface DecryptedFileResult {
  blob: Blob | null;
  bytes: Uint8Array;
  name: string;
  type: string;
  size: number;
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string;
export function base64UrlToBuffer(base64url: string): ArrayBuffer;

export function generateKey(): Promise<CryptoKey>;
export function generateAesKey(): Promise<CryptoKey>;

export function exportKey(key: CryptoKey): Promise<string>;
export function exportKeyToString(key: CryptoKey): Promise<string>;

export function importKey(keyString: string): Promise<CryptoKey>;
export function importKeyFromString(keyString: string): Promise<CryptoKey>;

export function getKeyFingerprint(keyString: string): Promise<string>;

export function encrypt(
  data: string | Uint8Array | ArrayBuffer | object,
  key: CryptoKey | string
): Promise<EncryptedContainer>;

export function decrypt(
  ciphertext: EncryptedContainer | ArrayBuffer | Uint8Array,
  key: CryptoKey | string,
  optionalIv?: Uint8Array
): Promise<string | Uint8Array>;

export function encryptFile(
  file: File,
  key: CryptoKey,
  onProgress?: (percent: number) => void
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array; metadata: FileMetadataHeader }>;

export function decryptFile(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
  onProgress?: (percent: number) => void
): Promise<DecryptedFileResult>;

declare const cryptoUtils: {
  generateKey: typeof generateKey;
  generateAesKey: typeof generateAesKey;
  exportKey: typeof exportKey;
  exportKeyToString: typeof exportKeyToString;
  importKey: typeof importKey;
  importKeyFromString: typeof importKeyFromString;
  getKeyFingerprint: typeof getKeyFingerprint;
  encrypt: typeof encrypt;
  decrypt: typeof decrypt;
  encryptFile: typeof encryptFile;
  decryptFile: typeof decryptFile;
  bufferToBase64Url: typeof bufferToBase64Url;
  base64UrlToBuffer: typeof base64UrlToBuffer;
};

export default cryptoUtils;
