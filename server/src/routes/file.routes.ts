import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fileService } from '../services/file.service.js';
import { config } from '../config.js';

const router = Router();
const upload = multer({
  limits: {
    fileSize: config.maxFileSizeBytes,
  },
  storage: multer.memoryStorage(),
});

/**
 * Middleware: Enforces Zero-Knowledge architecture.
 * Rejects requests containing secret key parameters.
 */
function zeroKnowledgeGuard(req: Request, res: Response, next: NextFunction) {
  const forbiddenKeys = ['key', 'secret', 'password', 'passphrase', 'decryption_key'];
  for (const key of forbiddenKeys) {
    if (req.body?.[key] || req.query?.[key] || req.headers[`x-${key}`]) {
      return res.status(400).json({
        error: 'ZERO_KNOWLEDGE_VIOLATION',
        message: 'Security Violation: GuardianBox is a zero-knowledge system. Secret keys must never be transmitted to the server.',
      });
    }
  }
  next();
}

/**
 * POST /api/files/upload
 */
router.post('/upload', upload.single('ciphertext'), zeroKnowledgeGuard, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing ciphertext payload file' });
    }
    const iv = req.body.iv;
    if (!iv || typeof iv !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid IV (Initialization Vector)' });
    }
    const salt = req.body.salt || null;
    const maxDownloads = req.body.max_downloads ? parseInt(req.body.max_downloads, 10) : null;
    const ttlSeconds = req.body.ttl_seconds ? parseInt(req.body.ttl_seconds, 10) : 86400;

    const result = await fileService.uploadFile({
      iv,
      salt,
      maxDownloads,
      ttlSeconds,
      buffer: req.file.buffer,
    });

    console.log(`[Upload] File committed: ${result.id} | Size: ${req.file.size} bytes`);
    return res.status(201).json({
      success: true,
      id: result.id,
      expires_at: result.expires_at,
      max_downloads: result.max_downloads,
      message: 'Ciphertext stored securely with Zero-Knowledge guarantees.',
    });
  } catch (err) {
    console.error('[Upload] Error processing upload:', err);
    // The caught error is of type 'unknown' in TypeScript. Narrow it to an Error instance
    // before accessing its message property.
    let message = 'An unexpected error occurred';
    if (err instanceof Error) {
      message = err.message;
    }
    return res.status(500).json({ error: 'Upload failed', details: message });
  }
});

/**
 * GET /api/files/:id/meta
 */
router.get('/:id/meta', async (req, res) => {
  try {
    const id = String(req.params.id);
    const meta = await fileService.getMetadata(id);
    if (!meta) {
      return res.status(404).json({
        error: 'NOT_FOUND_OR_EXPIRED',
        message: 'This file has either expired or been permanently deleted.',
      });
    }
    return res.json({
      success: true,
      data: meta,
    });
  } catch (err) {
    console.error(`[Meta] Error fetching metadata for ${req.params.id}:`, err);
    return res.status(500).json({ error: 'Metadata retrieval failed' });
  }
});

/**
 * GET /api/files/:id/download
 */
router.get('/:id/download', async (req, res) => {
  try {
    const id = String(req.params.id);
    const fileResult = await fileService.getCiphertextAndBurnIfNeeded(id);
    if (!fileResult) {
      return res.status(404).json({
        error: 'FILE_UNAVAILABLE',
        message: 'This file is no longer available. It may have expired or reached its maximum download limit.',
      });
    }

    const { buffer, record, wasBurned } = fileResult;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('X-Guardian-IV', record.iv);
    if (record.salt) {
      res.setHeader('X-Guardian-Salt', record.salt);
    }
    res.setHeader('X-Guardian-Burned', wasBurned ? 'true' : 'false');
    res.setHeader('X-Guardian-Downloads-Count', record.download_count.toString());
    if (record.max_downloads !== null) {
      res.setHeader('X-Guardian-Max-Downloads', record.max_downloads.toString());
    }

    // Expose headers explicitly for browser clients on Vercel
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Guardian-IV, X-Guardian-Salt, X-Guardian-Burned, X-Guardian-Downloads-Count, X-Guardian-Max-Downloads'
    );

    return res.send(buffer);
  } catch (err) {
    console.error(`[Download] Error fetching ciphertext for ${req.params.id}:`, err);
    return res.status(500).json({ error: 'Download failed' });
  }
});

/**
 * DELETE /api/files/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    await fileService.deleteFile(id);
    return res.json({ success: true, message: 'File destroyed permanently.' });
  } catch (err) {
    return res.status(500).json({ error: 'Deletion failed' });
  }
});

export default router;