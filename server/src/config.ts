import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load .env from current directory or parent (monorepo root)
const envLocations = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];
for (const envPath of envLocations) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config();

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure local upload storage directory exists on startup
const localStorageDir = process.env.LOCAL_STORAGE_DIR || path.join(dataDir, 'uploads');
if (!fs.existsSync(localStorageDir)) {
  fs.mkdirSync(localStorageDir, { recursive: true });
}

const accessKey = process.env.AWS_ACCESS_KEY_ID || '';
const secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
const hasValidAwsKeys = Boolean(
  accessKey && 
  accessKey !== 'your_access_key_id_here' && 
  secretKey && 
  secretKey !== 'your_secret_access_key_here'
);

export const config = {
  // Bind host (0.0.0.0 allows remote/container access, localhost locks to local machine)
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  dataDir,
  dbPath: process.env.DB_PATH || path.join(dataDir, 'guardianbox.db'),
  localStorageDir,

  // Storage selection: 's3' or 'local'
  storageType: ((process.env.STORAGE_TYPE === 's3' || hasValidAwsKeys) ? 's3' : 'local') as 'local' | 's3',

  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'guardianbox-encrypted-blobs',
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    endpoint: process.env.AWS_ENDPOINT, // Optional custom endpoint for MinIO / LocalStack
    forcePathStyle: process.env.AWS_FORCE_PATH_STYLE === 'true',
  },

  // Max upload size (100 MB)
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '', 10) || 300 * 1024 * 1024,
  cleanupIntervalMs: 60 * 1000, // Runs every 60 seconds
};