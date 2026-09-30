import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Flame, 
  Clock, 
  AlertTriangle, 
  Lock, 
  X
} from 'lucide-react';
import { generateAesKey, exportKeyToString, getKeyFingerprint } from '../crypto/keys';
import { encryptFile } from '../crypto/aes';
import { buildShareUrl } from '../crypto/hash';
import { uploadEncryptedPayload } from '../services/api';
import { CryptoVisualizer } from './CryptoVisualizer';
import type { CryptoStep } from './CryptoVisualizer';
import { ShareModal } from './ShareModal';

export const UploadView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ttlSeconds, setTtlSeconds] = useState<number>(86400); // 24 hours
  const [maxDownloads, setMaxDownloads] = useState<number | null>(1); // 1 = burn after reading

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [keyFingerprint, setKeyFingerprint] = useState<string>('');
  const [cryptoSteps, setCryptoSteps] = useState<CryptoStep[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [expiresAt, setExpiresAt] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleStartEncryption = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setProgressPercent(10);

      // Define visualizer steps
      const initialSteps: CryptoStep[] = [
        { id: '1', label: 'Web Crypto API Key Generation', detail: '256-bit AES-GCM CSPRNG', status: 'running' },
        { id: '2', label: 'CSPRNG IV Generation', detail: '96-bit (12 bytes) Initialization Vector', status: 'idle' },
        { id: '3', label: 'Envelope Packaging', detail: 'Concealing filename & MIME in payload', status: 'idle' },
        { id: '4', label: 'AES-256-GCM Encryption', detail: 'Computing 128-bit authentication tag', status: 'idle' },
        { id: '5', label: 'Blind Ciphertext Dispatch', detail: 'Zero key material sent to backend', status: 'idle' },
      ];
      setCryptoSteps(initialSteps);

      // Step 1: Key Generation
      const aesKey = await generateAesKey();
      const rawKeyString = await exportKeyToString(aesKey);
      const fingerprint = await getKeyFingerprint(rawKeyString);
      setKeyFingerprint(fingerprint);

      setCryptoSteps((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, status: 'completed' } : idx === 1 ? { ...s, status: 'running' } : s))
      );
      setProgressPercent(30);

      // Step 2 & 3 & 4: Encryption & Envelope Packing
      setCryptoSteps((prev) =>
        prev.map((s, idx) => (idx <= 1 ? { ...s, status: 'completed' } : idx === 2 ? { ...s, status: 'running' } : s))
      );

      const encrypted = await encryptFile(file, aesKey, (pct) => {
        setProgressPercent(30 + Math.floor(pct * 0.4));
      });

      setCryptoSteps((prev) =>
        prev.map((s, idx) => (idx <= 3 ? { ...s, status: 'completed' } : idx === 4 ? { ...s, status: 'running' } : s))
      );
      setProgressPercent(75);

      // Step 5: Upload encrypted ciphertext to blind backend
      const uploadResult = await uploadEncryptedPayload({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        maxDownloads: maxDownloads,
        ttlSeconds: ttlSeconds,
      });

      setCryptoSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
      setProgressPercent(100);

      // Construct client-side zero-knowledge share URL
      const shareUrl = buildShareUrl(uploadResult.id, rawKeyString, false);
      setGeneratedShareUrl(shareUrl);
      setGeneratedKey(rawKeyString);
      setExpiresAt(uploadResult.expires_at);

      setTimeout(() => {
        setShareModalOpen(true);
        setIsProcessing(false);
      }, 600);

    } catch (err: any) {
      console.error('Encryption / Upload failed:', err);
      setErrorMessage(err.message || 'Encryption or upload failed');
      setIsProcessing(false);
      setCryptoSteps((prev) => prev.map((s) => (s.status === 'running' ? { ...s, status: 'failed' } : s)));
    }
  };

  const handleReset = () => {
    setFile(null);
    setCryptoSteps([]);
    setProgressPercent(0);
    setKeyFingerprint('');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        
        {/* Error Alert */}
        {errorMessage && (
          <div className="burn-warning-banner" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dropzone or Selected File */}
        {!file ? (
          <div
            className={`dropzone-container ${isDragging ? 'is-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div className="dropzone-icon">
              <Upload size={30} />
            </div>
            <h3 style={{ marginBottom: '0.4rem' }}>Drop your secret file here</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              or click to browse your local device
            </p>
            <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--accent-emerald)', background: 'rgba(0, 242, 170, 0.08)', padding: '0.3rem 0.75rem', borderRadius: '999px' }}>
              <Lock size={12} />
              <span>Client-side Web Crypto AES-256-GCM</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="file-card">
              <div className="file-info">
                <div className="file-info-icon">
                  <FileText size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: '#ffffff' }}>{file.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatFileSize(file.size)} • {file.type || 'Binary Stream'}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleReset} 
                disabled={isProcessing}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem' }}
                title="Remove file"
              >
                <X size={20} />
              </button>
            </div>

            {/* Ephemeral Configuration */}
            <div className="options-grid">
              
              {/* Max Downloads (Burn after reading) */}
              <div className="option-box">
                <div className="option-label">
                  <Flame size={16} style={{ color: 'var(--danger)' }} />
                  <span>DESTRUCTION TRIGGER (BURN POLICY)</span>
                </div>
                <select
                  className="select-control"
                  value={maxDownloads === null ? 'unlimited' : maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value === 'unlimited' ? null : parseInt(e.target.value, 10))}
                  disabled={isProcessing}
                >
                  <option value="1">🔥 Burn after 1 download (Strict Zero-Trace)</option>
                  <option value="3">3 downloads allowed</option>
                  <option value="5">5 downloads allowed</option>
                  <option value="unlimited">Unlimited downloads (Purge by TTL only)</option>
                </select>
                <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  File ciphertext is wiped permanently from server upon limit.
                </div>
              </div>

              {/* Time-To-Live (TTL) */}
              <div className="option-box">
                <div className="option-label">
                  <Clock size={16} style={{ color: 'var(--warning)' }} />
                  <span>EXPIRATION WINDOW (TTL)</span>
                </div>
                <select
                  className="select-control"
                  value={ttlSeconds}
                  onChange={(e) => setTtlSeconds(parseInt(e.target.value, 10))}
                  disabled={isProcessing}
                >
                  <option value="900">15 Minutes</option>
                  <option value="3600">1 Hour</option>
                  <option value="21600">6 Hours</option>
                  <option value="86400">24 Hours (1 Day)</option>
                  <option value="604800">7 Days</option>
                </select>
                <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Automated background cron sweeps and deletes expired blobs.
                </div>
              </div>

            </div>

            {/* Progress Bar when encrypting */}
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
              </div>
            )}

            {/* Live Cryptographic Steps Inspection */}
            {cryptoSteps.length > 0 && (
              <CryptoVisualizer steps={cryptoSteps} keyFingerprint={keyFingerprint} />
            )}

            {/* Action button */}
            <div style={{ marginTop: '1.75rem' }}>
              <button
                className="btn btn-primary btn-block"
                onClick={handleStartEncryption}
                disabled={isProcessing}
              >
                <Lock size={18} />
                <span>{isProcessing ? `Encrypting & Uploading (${progressPercent}%)...` : 'Encrypt in Browser & Generate Secret Link'}</span>
              </button>
            </div>

            <div style={{ marginTop: '0.85rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              🛡️ The encryption key will be created locally and appended only to the URL hash fragment.
            </div>

          </div>
        )}

      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={shareModalOpen}
        shareUrl={generatedShareUrl}
        keyString={generatedKey}
        maxDownloads={maxDownloads}
        expiresAt={expiresAt}
        onClose={() => {
          setShareModalOpen(false);
          handleReset();
        }}
      />
    </div>
  );
};
