import React from 'react';
import { X, ShieldCheck, Key, EyeOff, Flame, Lock } from 'lucide-react';

interface SecurityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityDrawer: React.FC<SecurityDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ color: 'var(--accent-emerald)', background: 'rgba(0, 242, 170, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <h3>Zero-Knowledge Architecture</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Why the GuardianBox server can never read your files</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
          
          <div className="option-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-emerald)', marginBottom: '0.4rem' }}>
              <Lock size={18} />
              <strong>1. Browser-Native Web Crypto API</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Encryption happens inside your browser's memory before the upload button is even pressed. We use military-grade <strong>AES-256-GCM</strong> with an authenticated 128-bit integrity tag. The server only ever receives a blob of encrypted random noise.
            </p>
          </div>

          <div className="option-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-cyan)', marginBottom: '0.4rem' }}>
              <Key size={18} />
              <strong>2. The URL Fragment (#) Secret Anchor</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Under <strong>RFC 3986</strong>, everything following the hashtag (e.g. <code>.../#file/123#k=SecretKey</code>) is an internal browser anchor. Web browsers <em>never transmit the fragment to the server</em> in HTTP headers or URLs. The decryption key stays 100% local to the browser.
            </p>
          </div>

          <div className="option-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#a78bfa', marginBottom: '0.4rem' }}>
              <EyeOff size={18} />
              <strong>3. Blind Metadata Envelope</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Standard cloud storage leaks filenames, extensions, and MIME types. In GuardianBox, the original file name, size, and type are packed <em>inside</em> the encrypted ciphertext payload. The server has no knowledge of what kind of file is being exchanged.
            </p>
          </div>

          <div className="option-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--danger)', marginBottom: '0.4rem' }}>
              <Flame size={18} />
              <strong>4. Ephemeral Lifecycles & Burn-After-Reading</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Files are automatically purged when their time-to-live expires or immediately after a set number of downloads (Burn After Reading). Once destroyed, the ciphertext is permanently unrecoverable.
            </p>
          </div>

        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem' }}>
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
