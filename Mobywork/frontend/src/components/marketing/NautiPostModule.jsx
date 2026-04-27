import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = `${import.meta.env.VITE_API_URL || '/api'}`;

const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const OCEANOS_AI_URL = "/OceanOS/api/ai.php";
const OCEANOS_GROQ_URL = "/OceanOS/api/groq.php";
const MAX_HISTORY = 20;

const NETWORKS = {
  linkedin:  { name: "LinkedIn",   limit: 3000, emoji: "💼", color: "#0A66C2", prompt: "Génère un post LinkedIn (Max 3000 caractères). Style Professionnel B2B, accroche forte, appel à l'action. 3 à 5 hashtags pertinents maximum." },
  facebook:  { name: "Facebook",   limit: 2000, emoji: "📘", color: "#1877F2", prompt: "Génère un post Facebook (Max 2000 caractères). Style Convivial, storytelling, émotionnel, centré sur la communauté ou les plaisanciers. 3 à 4 hashtags." },
  instagram: { name: "Instagram",  limit: 2200, emoji: "📸", color: "#E1306C", prompt: "Génère un post Instagram (Max 2200 caractères). Style Lifestyle nautique, très visuel, emojis marins fréquents (⚓⛵🌊). 15 à 20 hashtags pertinents en bas." },
  twitter:   { name: "X / Twitter",limit: 280,  emoji: "𝕏",  color: "#14171A", prompt: "Génère un tweet (Max 280 caractères, strict !). Style ultra concis, percutant, direct au but. 1 à 2 hashtags courts." },
};

const TONES = [
  { value: 'plaisancier', label: 'Plaisancier Passionné' },
  { value: 'expert',      label: 'Expert Technique' },
  { value: 'aventurier',  label: 'Aventurier' },
  { value: 'luxe',        label: 'Luxe / Premium' },
];

export default function NautiPostModule({ onConvertToAd }) {
  const [apiKey, setApiKey] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedNetworks, setSelectedNetworks] = useState(['linkedin']);
  const [selectedTone, setSelectedTone] = useState('plaisancier');
  const [productInfo, setProductInfo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('nautipost_history') || '[]'));
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const fetchKey = async () => {
      try {
        const res = await fetch(OCEANOS_AI_URL, { credentials: 'include' });
        const payload = await res.json();
        setApiKey(payload?.settings?.hasApiKey ? 'oceanos' : '');
      } catch (err) {
        console.error('Erreur chargement clé API:', err);
      }
    };
    fetchKey();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleImageFile = (file) => {
    if (!file || !file.type.match(/image\/(jpeg|png|webp)/)) {
      showToast('Format invalide. JPG, PNG ou WEBP.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage({ base64: e.target.result.split(',')[1], type: file.type });
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  }, []);

  const saveToHistory = (network, text, img) => {
    const newItem = { id: Date.now() + Math.random(), network, text, image: img, date: new Date().toISOString() };
    const newHistory = [newItem, ...history].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    localStorage.setItem('nautipost_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('nautipost_history');
    showToast('Historique vidé.');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copié dans le presse-papier !');
  };

  const generatePosts = async () => {
    if (!apiKey) { showToast('Veuillez configurer la cle Groq dans OceanOS.', 'error'); return; }
    if (!productInfo && !image) { showToast('Décrivez un produit ou ajoutez une image.', 'error'); return; }
    if (selectedNetworks.length === 0) { showToast('Sélectionnez au moins un réseau.', 'error'); return; }

    setIsGenerating(true);
    setResults([]);

    const promises = selectedNetworks.map(async (networkId) => {
      const net = NETWORKS[networkId];
      const toneLabel = TONES.find(t => t.value === selectedTone)?.label;
      
      let promptText = `${net.prompt}\n\nContexte : ${productInfo}\nTon : ${toneLabel}\n\nIMPORTANT : Ne mentionne pas le nom du réseau dans le texte.`;
      
      let messages = [];
      if (image) {
        messages = [{
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: `data:${image.type};base64,${image.base64}` } }
          ]
        }];
      } else {
        messages = [{ role: 'user', content: promptText }];
      }

      const currentModel = image ? GROQ_VISION_MODEL : GROQ_MODEL;

      const body = {
        model: currentModel,
        messages: messages,
        max_tokens: 1024
      };

      try {
        const response = await fetch(OCEANOS_GROQ_URL, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const payload = await response.json();
        const data = payload.data;
        
        if (!response.ok || payload.ok === false || !data?.choices || !data.choices[0]) {
          throw new Error(payload.message || payload.error || "Erreur de l'API Groq (Choices undefined)");
        }

        const text = data?.choices?.[0]?.message?.content?.trim() || "Réponse IA vide";
        saveToHistory(networkId, text, imagePreview);
        return { networkId, text, error: null };
      } catch (err) {
        console.error("Génération Post Error:", err);
        return { networkId, text: null, error: err.message };
      }
    });

    const results = await Promise.all(promises);
    setResults(results);
    setIsGenerating(false);
    showToast('Génération terminée !');
  };

  const baseInput = {
    width: '100%', padding: '0.75rem 1rem',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: '10px', color: 'var(--text-primary)',
    fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden', flex: 1 }}>
      
      {/* HEADER SIMPLIFIÉ (Intégré aux onglets Marketing) */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>🚀 Social Posts IA (NautiPost)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Préparez vos publications organiques cohérentes.</p>
        </div>
        <button onClick={() => setShowHistory(true)} className="chart-period-btn" style={{ padding: '0.5rem 1rem' }}>
          📋 Historique ({history.length})
        </button>
      </div>

      <div className="module-scroll marketing-main-grid" style={{ flex: 1, padding: '1.5rem', display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !imagePreview && fileInputRef.current.click()}
            style={{
              borderRadius: '14px', border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--border-hover)'}`,
              background: isDragging ? 'var(--accent-blue-glow)' : 'var(--bg-surface)',
              minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: imagePreview ? 'default' : 'pointer', overflow: 'hidden', position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setImage(null); setImagePreview(null); }}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: 'white', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🖼️</div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Déposez une image ici</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>ou cliquez pour parcourir</div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
          </div>

          <div className="db-card" style={{ padding: '1rem' }}>
             <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description / Produit</label>
             <textarea 
                value={productInfo}
                onChange={(e) => setProductInfo(e.target.value)}
                placeholder="Décrivez votre produit, promo ou événement..."
                style={{ ...baseInput, height: '100px', resize: 'none', background: 'var(--bg-base)' }}
             />
          </div>

          <div className="db-card" style={{ padding: '1rem' }}>
             <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Réseaux ciblés</label>
             <div className="mobile-grid-2-to-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {Object.entries(NETWORKS).map(([id, net]) => (
                  <button
                    key={id}
                    onClick={() => setSelectedNetworks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    style={{
                      padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)',
                      background: selectedNetworks.includes(id) ? `${net.color}15` : 'var(--bg-base)',
                      color: selectedNetworks.includes(id) ? net.color : 'var(--text-secondary)',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                    }}
                  >
                    {net.emoji} {net.name}
                  </button>
                ))}
             </div>
          </div>

          <div className="db-card" style={{ padding: '1rem' }}>
             <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ton de voix</label>
             <select 
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value)}
                style={{ ...baseInput, background: 'var(--bg-base)' }}
             >
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
             </select>
          </div>

          <button 
             onClick={generatePosts}
             disabled={isGenerating}
             className="gs-autopilot-btn"
             style={{ height: '50px', fontSize: '1rem' }}
          >
            {isGenerating ? '⏳ Génération...' : '✨ Générer les publications'}
          </button>
        </div>

        {/* RIGHT PANEL - RESULTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {results.length === 0 && !isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛰️</span>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>Prêt à conquérir les réseaux ?</div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Remplissez les détails à gauche pour commencer.</div>
            </div>
          )}

          {isGenerating && (
             <div className="ai-feed-loading" style={{ height: '400px' }}>
                <div className="gs-spinner"></div>
                <span>L'IA rédige vos publications omnicanales...</span>
             </div>
          )}

          {results.map(({ networkId, text, error }) => {
            const net = NETWORKS[networkId];
            return (
              <div key={networkId} className="db-card" style={{ overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ padding: '0.75rem 1.25rem', background: `${net.color}10`, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: net.color, fontSize: '0.85rem' }}>{net.emoji} {net.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => copyToClipboard(text)} className="chart-period-btn" style={{ padding: '3px 10px', fontSize: '0.7rem' }}>📋 Copier</button>
                      <button 
                        onClick={() => onConvertToAd({ product: text, tone: selectedTone })} 
                        className="chart-period-btn" 
                        style={{ padding: '3px 10px', fontSize: '0.7rem', color: 'var(--accent-blue)', borderColor: 'var(--accent-blue-glow)' }}
                      >
                        🚀 Créer Ads
                      </button>
                  </div>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  {error ? <span style={{ color: '#ef4444' }}>❌ {error}</span> : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{text}</pre>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', width: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>📋 Historique</h3>
              <button onClick={() => setShowHistory(false)} className="chart-period-btn">✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {history.map(item => (
                <div key={item.id} style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                   <div style={{ fontWeight: 700, fontSize: '0.8rem', color: NETWORKS[item.network]?.color }}>{NETWORKS[item.network]?.emoji} {NETWORKS[item.network]?.name}</div>
                   <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#ef4444' : '#22c55e', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '10px', zIndex: 2000, boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>{toast.msg}</div>}
    </div>
  );
}
