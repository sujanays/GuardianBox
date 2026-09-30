import React from 'react';
import { Shield, Info, ServerOff } from 'lucide-react';

interface NavbarProps {
  onOpenHowItWorks: () => void;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenHowItWorks, onNavigateHome }) => {
  return (
    <nav className="navbar">
      <div className="nav-brand" onClick={onNavigateHome}>
        <div className="logo-icon">
          <Shield size={22} />
        </div>
        <div>
          <div className="brand-title">Guardian<span className="gradient-text">Box</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="nav-badge" title="The server cannot decrypt your files. It only stores blind ciphertext.">
          <span className="pulse-dot"></span>
          <ServerOff size={14} />
          <span>BLIND SERVER (E2EE)</span>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={onOpenHowItWorks}
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', gap: '0.4rem' }}
        >
          <Info size={15} />
          <span>Security Architecture</span>
        </button>
      </div>
    </nav>
  );
};
