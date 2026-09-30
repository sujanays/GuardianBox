import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadView } from './components/UploadView';
import { DownloadView } from './components/DownloadView';
import { SecurityDrawer } from './components/SecurityDrawer';
import { parseCurrentUrl } from './crypto/hash';
import { ShieldCheck, EyeOff, Lock, Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isSecurityDrawerOpen, setIsSecurityDrawerOpen] = useState(false);

  // Sync state with URL hash
  const syncFromUrl = () => {
    const parsed = parseCurrentUrl();
    setActiveFileId(parsed.fileId);
    setActiveKey(parsed.keyString);
  };

  useEffect(() => {
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  const handleNavigateHome = () => {
    window.location.hash = '';
    window.history.pushState(null, '', window.location.pathname);
    setActiveFileId(null);
    setActiveKey(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        onOpenHowItWorks={() => setIsSecurityDrawerOpen(true)}
        onNavigateHome={handleNavigateHome}
      />

      <main className="app-container" style={{ flex: 1 }}>
        
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge">
            <Lock size={13} style={{ color: 'var(--accent-emerald)' }} />
            <span>Applied Cryptography • Zero-Knowledge Engine</span>
          </div>

          <h1 className="hero-title">
            The Server Is <span className="gradient-text">Blind.</span>
          </h1>

          <p className="hero-subtitle">
            Files are encrypted in browser memory with AES-256-GCM before upload. The secret key is anchored in the URL hash and never touches our servers.
          </p>
        </section>

        {/* Dynamic Route: Download/Decrypt View or Upload View */}
        {activeFileId ? (
          <DownloadView
            fileId={activeFileId}
            initialKeyString={activeKey}
            onNavigateHome={handleNavigateHome}
          />
        ) : (
          <UploadView />
        )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', padding: '2rem 1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span>Web Crypto Native AES-GCM</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <EyeOff size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>Zero-Knowledge Server Blindness</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={14} style={{ color: 'var(--warning)' }} />
            <span>Disposable Ephemeral Storage</span>
          </span>
        </div>
        <p>GuardianBox Project • End-to-End Encrypted File Exchange Architecture</p>
      </footer>

      {/* Security Architecture Drawer */}
      <SecurityDrawer
        isOpen={isSecurityDrawerOpen}
        onClose={() => setIsSecurityDrawerOpen(false)}
      />
    </div>
  );
};

export default App;
