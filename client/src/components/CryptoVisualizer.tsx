import React from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

export interface CryptoStep {
  id: string;
  label: string;
  detail: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

interface CryptoVisualizerProps {
  steps: CryptoStep[];
  keyFingerprint?: string;
}

export const CryptoVisualizer: React.FC<CryptoVisualizerProps> = ({ steps, keyFingerprint }) => {
  return (
    <div className="crypto-live-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
          <ShieldCheck size={16} />
          <span>CRYPTO ENGINE MONITOR</span>
        </div>
        {keyFingerprint && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            KEY FINGERPRINT: <span style={{ color: 'var(--accent-cyan)' }}>{keyFingerprint}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {steps.map((step) => (
          <div key={step.id} className="crypto-step-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {step.status === 'completed' && <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)' }} />}
              {step.status === 'running' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-cyan)', animation: 'spin 1s linear infinite' }} />}
              {step.status === 'idle' && <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid var(--text-muted)' }} />}
              <span style={{ color: step.status === 'running' ? 'var(--accent-cyan)' : step.status === 'completed' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {step.label}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{step.detail}</span>
              <span className={`status-tag ${step.status === 'completed' ? 'active' : step.status === 'running' ? 'active' : 'pending'}`}>
                {step.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
