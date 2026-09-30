import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Download, 
  ShieldCheck, 
  Flame, 
  Key, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  Lock,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { importKeyFromString, getKeyFingerprint } from '../crypto/keys';
import { decryptFile } from '../crypto/aes';
import type { DecryptedResult } from '../crypto/aes';
import { fetchFileMetadata, fetchEncryptedCiphertext } from '../services/api';
import type { RemoteFileMetadata } from '../services/api';

interface DownloadViewProps {
  fileId: string;
  initialKeyString: string | null;
  onNavigateHome: () => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({
  fileId,
  initialKeyString,
  onNavigateHome,
}) => {
  const [keyString, setKeyString] = useState(initialKeyString || '');
  const [showKeyText, setShowKeyText] = useState(false);

  const [metadata, setMetadata] = useState<RemoteFileMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptProgress, setDecryptProgress] = useState(0);
  const [decryptedFile, setDecryptedFile] = useState<DecryptedResult | null>(null);
  const [wasBurned, setWasBurned] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [keyFingerprint, setKeyFingerprint] = useState<string>('');

  // Load metadata on mount
  useEffect(() => {
    let isMounted = true;

    async function loadMeta() {
      try {
        setIsLoadingMeta(true);
        setMetaError(null);
        const data = await fetchFileMetadata(fileId);
        if (isMounted) {
          setMetadata(data);
          setIsLoadingMeta(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setMetaError(err.message || 'File not found or expired');
          setIsLoadingMeta(false);
        }
      }
    }

    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [fileId]);

  // Compute key fingerprint if key is available
  useEffect(() => {
    if (keyString) {
      getKeyFingerprint(keyString).then(setKeyFingerprint).catch(() => {});
    } else {
      setKeyFingerprint('');
    }
  }, [keyString]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDecryptAndDownload = async () => {
    if (!keyString.trim()) {
      setDecryptionError('Please provide the secret decryption key.');
      return;
    }

    try {
      setIsDecrypting(true);
      setDecryptionError(null);
      setDecryptProgress(15);

      // 1. Import Web Crypto AES-GCM Key
      let cryptoKey: CryptoKey;
      try {
        cryptoKey = await importKeyFromString(keyString.trim());
      } catch (e) {
        throw new Error('Invalid key format. Please check the secret key.');
      }

      setDecryptProgress(35);

      // 2. Fetch encrypted ciphertext blob and IV from backend
      const result = await fetchEncryptedCiphertext(fileId);
      setWasBurned(result.wasBurned);
      setDecryptProgress(65);

      // 3. Client-Side AES-GCM Decryption & Authenticity Verification
      const decrypted = await decryptFile(result.ciphertext, cryptoKey, result.iv, (pct) => {
        setDecryptProgress(65 + Math.floor(pct * 0.3));
      });

      setDecryptProgress(100);
      setDecryptedFile(decrypted);

      // 4. Trigger Native Browser Download
      const url = URL.createObjectURL(decrypted.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decrypted.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up object URL after short delay
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Fire celebratory confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        gravity:0.5,
        origin: { y: 0.6 },
        colors: ['#00f2aa', '#00e5ff', '#38bdf8', '#ffffff'],
      });

      setIsDecrypting(false);
    } catch (err: any) {
      console.error('Decryption failed:', err);
      setDecryptionError(err.message || 'Decryption failed. The key may be incorrect.');
      setIsDecrypting(false);
    }
  };

  if (isLoadingMeta) {
    return (
      <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-emerald)', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
        <h3>Locating Encrypted Blob...</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Contacting blind storage server</p>
      </div>
    );
  }

  if (metaError || !metadata) {
    return (
      <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', margin: '0 auto 1.25rem', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.3)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
          <Flame size={32} />
        </div>
        <h2 style={{ marginBottom: '0.5rem' }}>File Expired or Burned</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
          {metaError || 'This file has reached its maximum download limit or its time-to-live expired. It has been permanently destroyed.'}
        </p>
        <button className="btn btn-secondary" onClick={onNavigateHome}>
          Upload a New Secure File
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      
      {/* Burn Notice Banner */}
      {metadata.max_downloads !== null && (
        <div className="burn-warning-banner">
          <Flame size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <strong>Burn Policy Active: {metadata.max_downloads === 1 ? 'Burn After Reading' : `${metadata.remaining_downloads} downloads remaining`}</strong>
            <p style={{ fontSize: '0.82rem', margin: '0.15rem 0 0', opacity: 0.9 }}>
              {metadata.max_downloads === 1 
                ? 'This file will be permanently wiped from the server immediately after this download.'
                : `Allowed downloads: ${metadata.max_downloads}. Download count: ${metadata.download_count}.`}
            </p>
          </div>
        </div>
      )}

      {/* Post-Download Burn Confirmation */}
      {wasBurned && (
        <div style={{ background: 'rgba(255, 71, 87, 0.15)', border: '1px solid var(--danger)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ff8a93' }}>
          <Flame size={22} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <strong>Server Payload Purged!</strong>
            <p style={{ fontSize: '0.8rem', margin: '0.1rem 0 0' }}>
              The server has completed the burn operation. The encrypted ciphertext blob and database entries have been destroyed.
            </p>
          </div>
        </div>
      )}

      {/* Decryption Error */}
      {decryptionError && (
        <div className="burn-warning-banner">
          <AlertTriangle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <strong>Decryption Verification Failed</strong>
            <p style={{ fontSize: '0.82rem', margin: '0.15rem 0 0' }}>{decryptionError}</p>
          </div>
        </div>
      )}

      {/* Success Download Card */}
      {decryptedFile ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <div style={{ width: '64px', height: '64px', margin: '0 auto 1.25rem', background: 'rgba(0, 242, 170, 0.15)', border: '1px solid var(--accent-emerald)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)', boxShadow: '0 0 25px var(--accent-glow)' }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ marginBottom: '0.4rem' }}>Decryption Successful!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Authenticated via AES-GCM 128-bit tag. The file has been saved to your downloads.
          </p>

          <div className="file-card" style={{ maxWidth: '450px', margin: '0 auto 1.5rem', textAlign: 'left' }}>
            <div className="file-info">
              <div className="file-info-icon">
                <FileText size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#ffffff' }}>{decryptedFile.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {formatFileSize(decryptedFile.size)} • {decryptedFile.type}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleDecryptAndDownload}>
              <RefreshCw size={16} />
              <span>Download Again</span>
            </button>
            <button className="btn btn-primary" onClick={onNavigateHome}>
              <span>Upload New File</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* File summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '42px', height: '42px', background: 'rgba(0, 242, 170, 0.1)', border: '1px solid rgba(0, 242, 170, 0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
                <Lock size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Encrypted Ciphertext Blob</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Size: {formatFileSize(metadata.size_bytes)} • Algorithm: AES-256-GCM
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="status-tag active">
                <ShieldCheck size={12} />
                <span>INTEGRITY PROTECTED</span>
              </span>
            </div>
          </div>

          {/* Key status & input if required */}
          <div className="option-box" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div className="option-label" style={{ margin: 0 }}>
                <Key size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>DECRYPTION KEY (FROM URL HASH)</span>
              </div>
              {keyFingerprint && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Fingerprint: <strong style={{ color: 'var(--accent-cyan)' }}>{keyFingerprint}</strong>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type={showKeyText ? 'text' : 'password'}
                className="select-control mono-text"
                placeholder="Enter 256-bit base64 secret key"
                value={keyString}
                onChange={(e) => setKeyString(e.target.value)}
                disabled={isDecrypting}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowKeyText(!showKeyText)}
                style={{ padding: '0.65rem 0.85rem' }}
                title={showKeyText ? 'Hide Key' : 'Reveal Key'}
              >
                {showKeyText ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 Extracted safely from <code>window.location.hash</code>. Never sent to the server.
            </div>
          </div>

          {/* Decryption Progress Bar */}
          {isDecrypting && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${decryptProgress}%` }}></div>
            </div>
          )}

          {/* Action button */}
          <button
            className="btn btn-primary btn-block"
            onClick={handleDecryptAndDownload}
            disabled={isDecrypting || !keyString.trim()}
          >
            {isDecrypting ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Decrypting In-Memory ({decryptProgress}%)...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Decrypt & Download Original File</span>
              </>
            )}
          </button>

          <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Decryption is computed entirely inside your browser's WebAssembly / Web Crypto runtime.
          </div>
        </div>
      )}

    </div>
  );
};
