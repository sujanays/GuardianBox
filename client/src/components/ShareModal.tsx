import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Eye, EyeOff, ShieldAlert, QrCode as QrIcon, Flame, Clock, X } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  shareUrl: string;
  keyString: string;
  maxDownloads: number | null;
  expiresAt: number;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  shareUrl,
  keyString,
  maxDownloads,
  expiresAt,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (showQr && qrCanvasRef.current && shareUrl) {
      QRCode.toCanvas(qrCanvasRef.current, shareUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#00f2aa',
          light: '#07090e',
        },
      });
    }
  }, [showQr, shareUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const maskedUrl = shareUrl.replace(/#k=([^&]+)/, (match, key) => {
    return showKey ? match : `#k=${'•'.repeat(Math.min(key.length, 16))}`;
  });

  const formattedExpiry = new Date(expiresAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3>Encrypted Link Ready</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Your file is encrypted. Send this link to your recipient.
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Ephemeral badges */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div className="nav-badge" style={{ background: 'rgba(255, 71, 87, 0.1)', borderColor: 'rgba(255, 71, 87, 0.25)', color: 'var(--danger)' }}>
            <Flame size={14} />
            <span>{maxDownloads ? `BURNS AFTER ${maxDownloads} DOWNLOAD${maxDownloads > 1 ? 'S' : ''}` : 'UNLIMITED DOWNLOADS'}</span>
          </div>

          <div className="nav-badge" style={{ background: 'rgba(255, 165, 2, 0.1)', borderColor: 'rgba(255, 165, 2, 0.25)', color: 'var(--warning)' }}>
            <Clock size={14} />
            <span>EXPIRES: {formattedExpiry}</span>
          </div>
        </div>

        {/* URL Box */}
        <div className="copy-input-group">
          <input 
            type="text" 
            readOnly 
            value={maskedUrl} 
            className="copy-input"
          />
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Mask decryption key' : 'Show decryption key'}
            style={{ padding: '0.45rem 0.65rem', marginRight: '0.35rem' }}
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleCopy}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Separate Raw Key Copy */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.78rem', marginBottom: '1rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Raw 256-Bit Secret Key:</span>
          <button
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
            onClick={async () => {
              await navigator.clipboard.writeText(keyString);
              setCopiedKey(true);
              setTimeout(() => setCopiedKey(false), 2000);
            }}
          >
            {copiedKey ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedKey ? 'Key Copied' : 'Copy Key Only'}</span>
          </button>
        </div>

        {/* QR Code toggle */}
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowQr(!showQr)}
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', gap: '0.4rem' }}
          >
            <QrIcon size={14} />
            <span>{showQr ? 'Hide QR Code' : 'Show Air-Drop QR Code'}</span>
          </button>
        </div>

        {showQr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1.25rem 0', padding: '1rem', background: '#07090e', borderRadius: '12px', border: '1px solid rgba(0, 242, 170, 0.2)' }}>
            <canvas ref={qrCanvasRef} style={{ borderRadius: '8px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Scan with phone camera to open and decrypt instantly
            </span>
          </div>
        )}

        {/* Zero-Knowledge Disclaimer */}
        <div className="security-banner">
          <ShieldAlert size={20} style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#ffffff' }}>The Decryption Key Lives Only In This URL</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', lineHeight: '1.4' }}>
              The part of the URL after the <code>#</code> is never seen by the server. If you lose this link, there is no password reset and no administrator recovery possible.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
