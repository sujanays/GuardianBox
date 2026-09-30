import { StorageProvider } from './storage.interface.js';
import { LocalStorageProvider } from './local.storage.js';
import { S3StorageProvider } from './s3.storage.js';
import { config } from '../config.js';

let storageInstance: StorageProvider;

const isAwsConfigured = Boolean(
  config.s3.accessKeyId &&
  config.s3.accessKeyId !== 'your_access_key_id_here' &&
  config.s3.secretAccessKey &&
  config.s3.secretAccessKey !== 'your_secret_access_key_here'
);

if (config.storageType === 's3' && isAwsConfigured) {
  console.log(`[Storage] Initialized AWS S3 Provider (Bucket: ${config.s3.bucket}, Region: ${config.s3.region})`);
  storageInstance = new S3StorageProvider();
} else {
  if (config.storageType === 's3') {
    console.warn('[Storage] S3 selected but AWS credentials not provided in .env (or are placeholders). Falling back seamlessly to Local Storage Provider.');
  } else {
    console.log(`[Storage] Initialized Local Storage Provider at: ${config.localStorageDir}`);
  }
  storageInstance = new LocalStorageProvider();
}

export const storage = storageInstance;
export * from './storage.interface.js';
