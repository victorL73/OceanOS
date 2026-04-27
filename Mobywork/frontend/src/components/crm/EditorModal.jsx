import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, RefreshCcw, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function EditorModal({ context, onClose, onSuccess }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [senders, setSenders] = useState([]);
  const [senderId, setSenderId] = useState('');

  useEffect(() => {
    const loadSenders = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || '/api'}/settings/mail-senders`);
        const list = Array.isArray(res.data) ? res.data : [];
        setSenders(list);
        setSenderId(list.find(sender => sender.isDefault)?.id || list[0]?.id || '');
      } catch (err) {
        console.error('Erreur chargement expediteurs:', err);
      }
    };
    loadSenders();
  }, []);

  useEffect(() => {
    // Simuler la génération de l'IA (en réalité on appellerait Groq ici la future API Prestashop)
    setIsGenerating(true);
    
    setTimeout(() => {
      let draftSub = "Un petit mot pour vous...";
      let draftMsg = `Bonjour ${context.client?.nom || ''},\n\nNous espérons que vous allez bien.\n\nCeci est un message de relance.`;

      if (context.type === 'promo') {
        draftSub = "Offre Spéciale : -10% rien que pour vous !";
        draftMsg = `Bonjour ${context.client?.nom || ''},\n\nNous avons remarqué que cela faisait quelque temps que nous ne vous avions pas vu sur notre boutique d'accastillage.\n\nPour vous remercier de votre fidélité, voici un code promo de 10% valable 48h : MOBY-10.\n\nÀ très vite !\nL'équipe MobyWorkspace`;
      } else if (context.type === 'vip') {
        draftSub = "Invitation exclusive ✨ Club VIP MobyWorkspace";
        draftMsg = `Bonjour ${context.client?.nom || ''},\n\nVotre fidélité mérite d'être récompensée. Étant l'un de nos meilleurs clients, nous avons le plaisir de vous offrir un accès gratuit à notre espace VIP.\n\nDécouvrez les nouveautés nautiques en avant-première.\n\nL'équipe MobyWorkspace`;
      } else if (context.type === 'relance') {
        draftSub = "Besoin d'aide pour votre bateau ?";
        draftMsg = `Bonjour ${context.client?.nom || ''},\n\nToujours prêt pour la saison ? Nous avons pensé à vous et sélectionné quelques articles d'entretien qui pourraient vous convenir selon vos précédents achats.\n\nN'hésitez pas à nous solliciter pour tout conseil technique.\n\nBonne navigation,\nL'équipe`;
      }

      setSubject(draftSub);
      setMessage(draftMsg);
      setIsGenerating(false);
    }, 1200); // 1.2s de fake load
  }, [context]);

  const handleSend = async () => {
    if (!message || !subject) return;
    
    try {
      setIsSending(true);
      await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/crm/send-email`, {
        to: context.client.email,
        subject: subject,
        message: message,
        clientId: context.client.id,
        type: context.type,
        senderId
      });
      
      alert(`✅ Email envoyé avec succès à ${context.client.email}`);
      if (onSuccess) onSuccess();
      else onClose();
    } catch (err) {
      console.error("Erreur envoi CRM:", err);
      const errMsg = err.response?.data?.error || err.message;
      alert(`❌ Échec de l'envoi : ${errMsg}\n\nVérifiez votre configuration SMTP dans le fichier .env.`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="crm-modal-overlay">
      <div className="crm-modal-content animate-slide-up">
        {/* Header */}
        <div className="crm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Sparkles size={18} style={{ color: 'var(--accent-blue)' }} /> 
            Génération IA
          </div>
          <button className="crm-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="crm-modal-body">
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            <strong>Prompt contextuel utilisé :</strong> <i>{context.prompt}</i>
          </p>

          <div style={{ marginBottom: '1rem' }}>
            {senders.length > 0 && (
              <>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Adresse d'envoi :</label>
                <select
                  className="crm-input"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  disabled={isGenerating || isSending}
                  style={{ marginBottom: '1rem' }}
                >
                  {senders.map(sender => (
                    <option key={sender.id} value={sender.id}>
                      {sender.label || sender.email} - {sender.email}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Objet de l'email :</label>
            <input 
              type="text" 
              className="crm-input" 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              disabled={isGenerating} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Corps du message :</label>
            <textarea 
               className="crm-textarea" 
               rows="8"
               value={message}
               onChange={(e) => setMessage(e.target.value)}
               disabled={isGenerating}
            ></textarea>
          </div>
          
          {isGenerating && (
            <div className="crm-loading-overlay">
               <RefreshCcw className="animate-spin" size={24} style={{ color: 'var(--accent-blue)', marginBottom: '0.75rem' }} />
               <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Rédaction en cours...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="crm-modal-footer">
           <button className="crm-btn-outline" onClick={onClose} disabled={isGenerating || isSending}>Annuler</button>
           <button className="crm-btn-primary" onClick={handleSend} disabled={isGenerating || isSending}>
             {isSending ? (
               <><RefreshCw size={14} className="animate-spin" /> Envoi...</>
             ) : (
               <><Send size={14} /> Envoyer maintenant</>
             )}
           </button>
        </div>
      </div>
    </div>
  );
}
