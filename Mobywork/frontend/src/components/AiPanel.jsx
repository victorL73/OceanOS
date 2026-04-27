import React, { useState } from 'react';
import { Sparkles, CheckCircle, Archive, MessageSquare, AlertCircle, RefreshCw, CornerDownRight } from 'lucide-react';
import axios from 'axios';

export default function AiPanel({ mail, onStatusChange, onReplyFilled }) {
    const [isRegen, setIsRegen] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState('Professionnel');

    if (!mail) return null;

    const isSpamOrNewsletter = mail.action_recommandee === 'Archiver' || mail.action_recommandee === 'Ignorer';

    const handleRegen = async () => {
        setIsRegen(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/ai/generate-reply/${mail.id}`, { style: selectedStyle });
            onStatusChange(); // trigger refresh parent
        } catch (error) {
            console.error(error);
        }
        setIsRegen(false);
    };

    const getActionBadgeColor = (action) => {
        if (action === 'Répondre') return 'var(--accent-blue)';
        if (action === 'Ignorer') return 'var(--text-muted)';
        if (action === 'Archiver') return 'var(--accent-orange)';
        return 'var(--text-secondary)';
    };

    return (
        <div className="ai-panel">
            
            {/* L'ACTION RECOMMANDÉE PROACTIVE */}
            <div className="ai-proactive-bar" style={{ 
                background: 'var(--bg-elevated)', 
                border: `1px solid ${getActionBadgeColor(mail.action_recommandee)}`,
                borderRadius: '8px', 
                padding: '1rem',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
            }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                 <div style={{ background: `${getActionBadgeColor(mail.action_recommandee)}22`, color: getActionBadgeColor(mail.action_recommandee), padding: '8px', borderRadius: '50%' }}>
                    {mail.action_recommandee === 'Répondre' ? <MessageSquare size={20} /> : mail.action_recommandee === 'Archiver' ? <Archive size={20} /> : <AlertCircle size={20} />}
                 </div>
                 <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Décision de l'Assistant IA</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Action : {mail.action_recommandee || "Non défini"}</div>
                 </div>
               </div>
               
               {isSpamOrNewsletter ? (
                   <button className="action-btn outline" onClick={() => onStatusChange('archive')} style={{ color: 'var(--accent-orange)' }}>
                       <Archive size={14} /> Archiver ce message
                   </button>
               ) : (
                   <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                       <CheckCircle size={14} /> Attention requise
                   </div>
               )}
            </div>

            {/* LE RÉSUMÉ IA */}
            <div className="ai-summary-card">
                <div className="ai-summary-title">
                    <Sparkles size={14} /> Synthèse du contexte
                </div>
                <div className="ai-summary-text">
                    {mail.resume || "L'IA n'a pas pu générer de résumé."}
                </div>
            </div>

            {/* SECTEUR RÉPONSES SI REQUIS */}
            {!isSpamOrNewsletter && (
                <div className="ai-responses-section" style={{ marginTop: '0.5rem' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.8rem' }}>
                        <div className="ai-replies-title" style={{ margin: 0 }}>
                            <CornerDownRight size={14} /> Réponses proposées
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mémoire IA (Ton) :</span>
                            <select 
                                className="crm-input" 
                                style={{ width: '130px', padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}
                                value={selectedStyle}
                                onChange={(e) => setSelectedStyle(e.target.value)}
                            >
                                <option>Professionnel</option>
                                <option>Cool / Amical</option>
                                <option>Très formel</option>
                                <option>Direct / Concis</option>
                            </select>
                            <button className="crm-icon-btn" onClick={handleRegen} disabled={isRegen} title="Régénérer avec ce ton" style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                                <RefreshCw size={14} className={isRegen ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="reply-variants">
                        <div className="reply-variant-card" onClick={() => onReplyFilled(mail.reponse_formelle)}>
                            <div className="reply-variant-label">Version Détaillée</div>
                            <div className="reply-variant-preview">{mail.reponse_formelle || "Vide"}</div>
                        </div>
                        
                        <div className="reply-variant-card" onClick={() => onReplyFilled(mail.reponse_rapide)}>
                            <div className="reply-variant-label">Version Courte</div>
                            <div className="reply-variant-preview">{mail.reponse_rapide || "Vide"}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
