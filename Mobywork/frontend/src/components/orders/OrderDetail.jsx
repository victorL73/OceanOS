import React from 'react';
import { 
    Package, MapPin, Truck, Mail, Info, 
    ShieldAlert, Sparkles, CheckCircle2, User, Loader2,
    Download, HandHeart, Activity, DollarSign, Calendar, ChevronRight
} from 'lucide-react';

export default function OrderDetail({ data, isLoading, onAction, onBack }) {
  if (isLoading) {
    return (
      <div className="detail-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '0.85rem' }}>Analyse de la commande...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="detail-panel empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', opacity: 0.4 }}>
          <div style={{ transform: 'scale(1.5)', margin: '0 auto 1.5rem', color: 'var(--text-muted)' }}><LayoutIcon /></div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Sélectionnez une commande</h3>
          <p style={{ fontSize: '0.85rem' }}>Le Cockpit Opérationnel IA s'affichera ici.</p>
        </div>
      </div>
    );
  }

  const score = data.priorite?.score || 0;
  const isUrgent = score >= 75;
  const scoreColor = isUrgent ? 'var(--accent-red)' : (score >= 40 ? 'var(--accent-orange)' : 'var(--accent-green)');

  return (
    <div className="detail-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', borderLeft: '1px solid var(--border-color)' }}>
      
      {/* ── HEADER COCKPIT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
            <button className="mobile-back-btn" onClick={onBack} title="Retour à la liste" style={{ flexShrink: 0 }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{data.reference}</span>
                <span>•</span>
                <span>{formatCleanDate(data.date)}</span>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, lineHeight: 1.2 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.client?.nom}</span>
                {data.client?.isVIP && (
                  <span style={{ fontSize: '0.55rem', padding: '2px 6px', background: 'var(--accent-purple)', color: 'white', borderRadius: 5, fontWeight: 800, flexShrink: 0 }}>VIP</span>
                )}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-elevated)', padding: '0.2rem 0.5rem', borderRadius: 5 }}>
                  <Mail size={12} color="var(--text-muted)" /> {data.client?.email || 'N/A'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)', padding: '0.2rem 0.5rem', borderRadius: 5, fontWeight: 600 }}>
                  <CheckCircle2 size={12} /> {data.statut}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Score IA</div>
                <div style={{ fontSize: '0.65rem', color: scoreColor, fontWeight: 600 }}>Priorité {data.priorite?.tag}</div>
              </div>
              <div style={{ 
                width: 44, height: 44, borderRadius: '50%', border: `2px solid ${scoreColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 800, color: scoreColor, position: 'relative'
              }}>
                <svg width="44" height="44" style={{ position: 'absolute', top: -2, left: -2, transform: 'rotate(-90deg)' }}>
                  <circle cx="22" cy="22" r="20.5" fill="none" stroke={scoreColor} strokeWidth="2.5" strokeDasharray="128.8" strokeDashoffset={128.8 - (128.8 * score)/100} style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                {score}
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {data.montant} €
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── ACTIONS PRINCIPALES ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {(data.statutCategory === 'attente' || data.statutCategory === 'a_traiter') ? (
            <button 
              onClick={() => onAction('marquer_traite')}
              style={{ flex: '1 1 auto', background: 'var(--text-primary)', color: 'var(--bg-base)', border: 'none', padding: '0.6rem 1rem', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'opacity 0.2s', fontWeight: 600, fontSize: '0.82rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <Truck size={15} />
              Valider expédition
            </button>
          ) : (
            <div style={{ flex: '1 1 auto', background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
              <CheckCircle2 size={15} />
              Déjà Expédié
            </div>
          )}

          <button 
            onClick={() => alert('Contacter client via le module natif')}
            style={{ flex: '1 1 auto', background: 'var(--bg-surface)', color: 'var(--accent-blue)', border: '1px solid rgba(59,130,246,0.3)', padding: '0.6rem 1rem', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600, fontSize: '0.82rem' }}>
            <Mail size={15} />
            Contacter (CRM)
          </button>

          <button 
            onClick={() => onAction('telecharger_bordereau')}
            style={{ flex: '1 1 auto', background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600, fontSize: '0.82rem' }}>
            <Download size={15} />
            Bordereau PDF/TXT
          </button>
        </div>

        {/* ── AI INSIGHT BOARD ────────────────────────────────────────────── */}
        <div style={{ 
          background: 'var(--bg-tertiary)', 
          border: `1px solid ${scoreColor}40`, 
          borderRadius: 12, 
          padding: '1rem 1rem 1rem 1.25rem', 
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: scoreColor }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <Sparkles size={15} color={scoreColor} />
            <h3 style={{ margin: 0, fontSize: '0.85rem', color: scoreColor, fontWeight: 700 }}>Analyse Auto-Pilote</h3>
          </div>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {data.priorite?.reason || "Commande standard, rien à signaler."}
          </p>

          {isUrgent && (
             <button 
                onClick={() => onAction('relancer_client')}
                style={{ background: 'var(--accent-red)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
                Envoyer le template "Excuses Retard" (Auto)
             </button>
          )}
        </div>

        {/* ── GRID DETAILS ────────────────────────────────────────────────── */}
        <div className="mobile-grid-2-to-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          {/* Produits */}
          <div>
            <h3 style={{ fontSize: '0.8rem', margin: '0 0 0.6rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
              <Package size={14} color="var(--text-muted)" /> Produits ({data.produitsCount})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {data.produits && data.produits.map((prod, idx) => (
                <div key={idx} style={{ 
                    display: 'flex', alignItems: 'center', padding: '0.65rem 0.75rem', 
                    background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 9 
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '0.75rem', flexShrink: 0 }}>
                    <Package size={16} color="var(--text-muted)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Qté: {prod.qty}</div>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, marginLeft: '0.5rem' }}>
                    {parseFloat(prod.price * prod.qty).toFixed(2)} €
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logistique & Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ background: 'var(--bg-surface)', padding: '0.875rem', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.6rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                <Truck size={12} /> Expédition
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>
                <strong>Transporteur:</strong> {data.transporteur}<br/>
                <strong>Adresse:</strong><br/>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{data.adresseLivraison}</span>
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '0.75rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Timeline</h3>
              <div style={{ position: 'relative', paddingLeft: '1.25rem' }}>
                <div style={{ position: 'absolute', top: 5, bottom: 5, left: 6, width: 2, background: 'var(--border-color)' }} />
                
                {data.timeline && data.timeline.map((event, idx) => (
                  <div key={idx} style={{ position: 'relative', marginBottom: '1rem', opacity: idx === 0 ? 1 : 0.6 }}>
                    <div style={{ position: 'absolute', left: '-1.85rem', top: 0, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-surface)', border: `2px solid ${idx === 0 ? 'var(--accent-blue)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: idx === 0 ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {event.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                      {formatCleanDate(event.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function formatCleanDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const LayoutIcon = ({style}) => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={style}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>;
