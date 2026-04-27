import React from 'react';
import { BrainCircuit, Activity, Flame, Snowflake, AlertTriangle, PenLine, Percent, Zap } from 'lucide-react';

export default function AIInsights({ ai, onAction }) {
  if (!ai) return null;

  let highlightColor = '#3b82f6';
  if (ai.temperature.includes('Chaud')) highlightColor = '#ef4444'; 
  if (ai.temperature.includes('Froid')) highlightColor = '#3b82f6';
  if (ai.temperature.includes('Tiède')) highlightColor = '#f59e0b';

  return (
    <div className="crm-ai-dashboard animate-fade-in" style={{ marginTop: '1.5rem', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
      
      {/* Header Bar AI */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'rgba(59, 130, 246, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
          <BrainCircuit size={18} style={{ color: 'var(--accent-blue)' }} /> 
          Centre de contrôle IA
        </div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: highlightColor, display: 'flex', alignItems: 'center', gap: '0.35rem', background: `${highlightColor}15`, padding: '2px 10px', borderRadius: '12px' }}>
          {ai.temperature.includes('Chaud') ? <Flame size={14} /> : ai.temperature.includes('Froid') ? <Snowflake size={14} /> : <AlertTriangle size={14} />}
          Statut: {ai.temperature}
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* TOP ROW : Gauges & Score */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'stretch', justifyContent: 'space-between' }}>
          
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              {typeof ai.score === 'number' ? (Number.isInteger(ai.score) ? ai.score : ai.score.toFixed(1)) : ai.score}
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: 700 }}>Score Santé</div>
          </div>
          
          <div style={{ display: 'flex', flex: 1, minWidth: '200px', flexDirection: 'column', justifyContent: 'center' }}>
             <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>{ai.summary}</p>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ai.recommendation}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Probabilité d'achat</div>
             <div style={{ width: '100%', height: '8px', background: 'var(--bg-active)', borderRadius: '4px', overflow: 'hidden' }}>
               <div style={{ width: `${ai.probability}%`, height: '100%', background: ai.probability > 60 ? '#10b981' : ai.probability > 30 ? '#f59e0b' : '#ef4444', borderRadius: '4px' }}></div>
             </div>
             <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.3rem' }}>{ai.probability}%</div>
          </div>
        </div>

        {/* BOTTOM ROW : Actions Directes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px outset rgba(255,255,255,0.02)' }}>
          <button 
            className="ai-action-btn primary" 
            onClick={() => onAction('relance', "Rédige un email très court et incitatif pour relancer ce client selon ses habitudes d'achat et son score.")}
          >
            <PenLine size={14} /> Relancer avec IA
          </button>
          <button 
            className="ai-action-btn secondary"
            onClick={() => onAction('promo', "Génère une offre spéciale personnalisée avec une accroche percutante pour ce client.")}
          >
            <Percent size={14} /> Créer une promo
          </button>
          <button 
            className="ai-action-btn outline"
            onClick={() => onAction('vip', "Génère un email chaleureux invitant ce client à rejoindre notre club VIP exclusif nautique.")}
          >
            <Zap size={14} /> Proposer offre VIP
          </button>
        </div>
      </div>
    </div>
  );
}
