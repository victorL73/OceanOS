import React, { useState } from 'react';
import axios from 'axios';
import { 
  Zap, Mail, Phone, MapPin, Building, Star, 
  Send, MoreHorizontal, History, Shield, 
  Target, BarChart, Copy, RefreshCw, CheckCircle,
  Trash2, Edit2, Save, X
} from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/prospects`;

export default function ProspectDetail({ prospect, onUpdate, onDelete }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [emailVariants, setEmailVariants] = useState(null);
  const [activeVariant, setActiveVariant] = useState('commercial');
  
  // États Mode Édition
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const handleStartEdit = () => {
    setEditData({
      company_name: prospect.company_name,
      email: prospect.email,
      phone: prospect.phone,
      type: prospect.type,
      city: prospect.city,
      street: prospect.street || '',
      category: prospect.category || '',
      comments: prospect.comments || '',
      confidence: prospect.confidence || 0
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onUpdate(prospect.id, editData);
    setIsEditing(false);
  };

  const handleGenerateEmail = async () => {
    if (!prospect) return;
    setIsGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/${prospect.id}/generate-email`);
      setEmailVariants(res.data);
    } catch (err) {
      console.error('Erreur génération email:', err);
      alert('Erreur IA Groq.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!prospect) {
    return (
      <div className="prospect-detail-empty" style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', height: '100%', color: 'var(--text-muted)',
        background: 'rgba(255,255,255,0.01)', padding: '2rem', textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.2 }}>🔍</div>
        <p>Sélectionnez un prospect pour voir l'analyse IA détaillée.</p>
      </div>
    );
  }

  const cleaned = prospect.cleaned_data ? JSON.parse(prospect.cleaned_data) : {};
  const tags = prospect.tags ? JSON.parse(prospect.tags) : [];

  return (
    <div className="prospect-detail" style={{ 
      display: 'flex', flexDirection: 'column', height: '100%', 
      background: 'rgba(255,255,255,0.02)', overflowY: 'auto'
    }}>
      
      {/* Header Fiche */}
      <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '16px', 
            background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
          }}>
            ⚓
          </div>
          <div>
            {isEditing ? (
              <input 
                value={editData.company_name}
                onChange={(e) => setEditData({...editData, company_name: e.target.value})}
                style={{ 
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent-blue)',
                  color: '#fff', fontSize: '1.2rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px',
                  width: '100%', outline: 'none'
                }}
              />
            ) : (
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                {prospect.company_name}
              </h3>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {isEditing ? (
                <input 
                  value={editData.category}
                  onChange={(e) => setEditData({...editData, category: e.target.value})}
                  placeholder="Catégorie (ex: Client, Urgent...)"
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', outline: 'none'
                  }}
                />
              ) : (
                <span style={{ 
                  fontSize: '0.75rem', padding: '2px 10px', borderRadius: '4px',
                  background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', 
                  border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600
                }}>
                  {prospect.category || 'Sans catégorie'}
                </span>
              )}
              {tags.map(t => (
                <span key={t} style={{ fontSize: '0.65rem', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {isEditing ? (
              <>
                <button 
                  onClick={handleSave}
                  style={{ padding: '8px', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer' }}
                  title="Enregistrer"
                >
                  <Save size={16} />
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}
                  title="Annuler"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <button 
                onClick={handleStartEdit}
                style={{ 
                  padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                title="Modifier manuellement"
              >
                <Edit2 size={16} />
              </button>
            )}
            <button 
              onClick={() => onDelete(prospect.id)}
              style={{ 
                padding: '8px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s'
              }}
              title="Supprimer le prospect"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Confidence Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONFIANCE MANUELLE</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--accent-blue)', fontWeight: 800 }}>{isEditing ? editData.confidence : (prospect.confidence || 0)}%</span>
            </div>
            {isEditing ? (
              <input 
                type="range" min="0" max="100" step="5"
                value={editData.confidence}
                onChange={(e) => setEditData({...editData, confidence: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
              />
            ) : (
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${prospect.confidence || 0}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '3px' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Areas */}
      <div style={{ padding: '0 2rem 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Espace Commentaire */}
        <section>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={14} color="var(--accent-blue)" /> ESPACE COMMENTAIRE
          </h4>
          {isEditing ? (
            <textarea 
              value={editData.comments}
              onChange={(e) => setEditData({...editData, comments: e.target.value})}
              placeholder="Ajoutez vos notes ici..."
              style={{ 
                width: '100%', height: '120px', background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                padding: '1rem', color: '#fff', fontSize: '0.9rem', resize: 'none', outline: 'none'
              }}
            />
          ) : (
            <div style={{ 
              padding: '1rem', background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
              fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)',
              minHeight: '80px', fontStyle: prospect.comments ? 'normal' : 'italic'
            }}>
              {prospect.comments || "Aucun commentaire pour le moment. Cliquez sur 'Modifier' pour en ajouter."}
            </div>
          )}
        </section>

        {/* Informations */}
        <section>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>CONTACT & LOCALISATION</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
               <Mail size={14} opacity={0.5} /> 
               {isEditing ? (
                 <input 
                   value={editData.email} 
                   onChange={(e) => setEditData({...editData, email: e.target.value})}
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '4px 8px', flex: 1, outline: 'none' }}
                 />
               ) : (prospect.email || 'Non détecté')}
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
               <Phone size={14} opacity={0.5} /> 
               {isEditing ? (
                 <input 
                   value={editData.phone} 
                   onChange={(e) => setEditData({...editData, phone: e.target.value})}
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '4px 8px', flex: 1, outline: 'none' }}
                 />
               ) : (prospect.phone || 'Non détecté')}
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
               <MapPin size={14} opacity={0.5} /> 
               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                 {isEditing ? (
                   <>
                     <input 
                       value={editData.street} 
                       onChange={(e) => setEditData({...editData, street: e.target.value})}
                       placeholder="Rue / Adresse exacte"
                       style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}
                     />
                     <input 
                       value={editData.city} 
                       onChange={(e) => setEditData({...editData, city: e.target.value})}
                       placeholder="Ville"
                       style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}
                     />
                   </>
                 ) : (
                   <>
                     <span style={{ fontWeight: 600, color: '#fff' }}>{prospect.street || 'Rue non renseignée'}</span>
                     <span style={{ color: 'var(--text-muted)' }}>{prospect.city}, {prospect.country}</span>
                   </>
                 )}
               </div>
             </div>
          </div>
        </section>

        {/* Email Generator */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GÉNÉRATEUR D'EMAIL IA</h4>
            <button 
              onClick={handleGenerateEmail}
              disabled={isGenerating}
              style={{ 
                background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(59, 130, 246, 0.2)',
                padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {isGenerating ? <RefreshCw size={12} className="gs-spinner" /> : <Zap size={12} />}
              {emailVariants ? "Régénérer" : "Générer email"}
            </button>
          </div>

          {emailVariants && (
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', 
              borderRadius: '12px', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['short', 'commercial', 'aggressive'].map(v => (
                  <button 
                    key={v}
                    onClick={() => setActiveVariant(v)}
                    style={{ 
                      flex: 1, padding: '8px', fontSize: '0.7rem', border: 'none',
                      background: activeVariant === v ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      color: activeVariant === v ? 'var(--accent-blue)' : 'var(--text-muted)',
                      cursor: 'pointer', textTransform: 'capitalize'
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ padding: '1rem', fontSize: '0.85rem', lineHeight: '1.5', minHeight: '120px', color: 'var(--text-secondary)' }}>
                {emailVariants[activeVariant]}
              </div>
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Copy size={12} /> Copier
                </button>
                <button style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--accent-blue)', border: 'none', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <Send size={12} /> Envoyer
                </button>
              </div>
            </div>
          )}

          {!emailVariants && (
             <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
               <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>L'IA peut rédiger votre email de prospection sur mesure en un clic.</p>
             </div>
          )}
        </section>

      </div>
    </div>
  );
}
