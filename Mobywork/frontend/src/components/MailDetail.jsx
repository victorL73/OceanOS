import React, { useEffect, useState, useRef } from 'react';
import { Check, Archive, Clock, Send, Edit3, Paperclip, X, ChevronRight } from 'lucide-react';
import AiPanel from './AiPanel';
import EmailAttachments from './EmailAttachments';
import axios from 'axios';

function getSafeHtml(html) {
  if (!html) return '';
  const base = '<base target="_blank"><style> body { color: #1e293b; font-family: -apple-system, sans-serif; line-height:1.6; margin: 0; padding: 20px; } a { color: #3b82f6; } img { max-width: 100%; height: auto; } * { box-sizing: border-box; } </style>';
  if (html.includes('<head>')) return html.replace('<head>', '<head>' + base);
  return base + html;
}

function renderCleanText(text) {
  if (!text) return null;
  const clean = text.replace(/<[^>]*>/g, '').trim();
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return clean.split(urlRegex).map((part, i) =>
    part.match(urlRegex)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>[Lien]</a>
      : <span key={i}>{part}</span>
  );
}

function calcReadTime(text) {
  if (!text) return 1;
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

export default function MailDetail({ mail, onMarkDone, onArchive, onMailUpdated, onBack }) {
  const [activeTab, setActiveTab] = useState('ai');
  const [draftReply, setDraftReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState([]);
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

  const isSent = !!mail && (mail.direction === 'sent' || mail.status === 'sent');

  useEffect(() => {
    if (isSent) setActiveTab('full');
  }, [isSent, mail?.id]);

  if (!mail) {
    return (
      <div className="mail-detail-panel">
        <div className="mail-detail-empty">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <h3>MobyWorkspace</h3>
          <p style={{ fontSize: '0.8rem' }}>Sélectionnez un message pour commencer le tri proactif.</p>
        </div>
      </div>
    );
  }

  // Compter les pièces jointes
  let attachmentCount = 0;
  try { attachmentCount = JSON.parse(mail.attachments || '[]').length; } catch(e) {}

  const handleSend = async () => {
      if(!draftReply.trim() && replyAttachments.length === 0) return;
      setIsSending(true);
      try {
          const formData = new FormData();
          formData.append('message', draftReply);
          if (senderId) formData.append('senderId', senderId);
          replyAttachments.forEach(file => {
              formData.append('attachments', file);
          });
          
          await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/emails/${mail.id}/reply`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          onMarkDone(mail.id);
          setDraftReply('');
          setReplyAttachments([]);
      } catch (e) {
          alert("Erreur lors de l'envoi.");
      }
      setIsSending(false);
  };

  return (
    <div className="mail-detail-panel animate-slide-right" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="mail-detail-header">
        <div className="mail-detail-header-top">
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             {/* Back button for mobile */}
             <button className="mobile-back-btn" onClick={onBack} title="Retour à la liste">
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
             </button>

             <div style={{ flex: 1, minWidth: 0 }}>
               {/* Tag Business Prioritaire si présent */}
               {mail.is_business === 1 && (
                   <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                       💰 Potentiel de Revenu
                   </div>
               )}
              <div className="mail-detail-subject">{mail.subject}</div>
              <div className="mail-detail-meta">
                {isSent ? 'A' : 'De'} : <strong style={{ color: 'var(--text-primary)' }}>{isSent ? (mail.to_address || mail.from_address) : mail.from_address}</strong>
                {isSent && mail.from_address && <>&nbsp;-&nbsp; Depuis : <strong style={{ color: 'var(--text-primary)' }}>{mail.from_address}</strong></>}
                {!isSent && mail.mailbox_address && <>&nbsp;-&nbsp; Boite : <strong style={{ color: 'var(--text-primary)' }}>{mail.mailbox_address}</strong></>}
                &nbsp;-&nbsp;
                <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                {calcReadTime(mail.content)} min de lecture
              </div>
             </div>
          </div>
          {!isSent && <div className="mail-detail-actions">
            <button
              className="action-btn success"
              onClick={() => onMarkDone(mail.id)}
              title="Marquer traité (T)"
            >
              <Check size={13} /> Traité
            </button>
            <button
              className="action-btn outline"
              onClick={() => onArchive(mail.id)}
              title="Archiver (A)"
            >
              <Archive size={13} /> Archiver
            </button>
          </div>}
        </div>

        {/* Tabs */}
        <div className="detail-tabs" style={{ marginTop: '0.75rem' }}>
          {!isSent && <div
            className={`detail-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            ✨ Assistant IA Proactif
          </div>}
          <div
            className={`detail-tab ${activeTab === 'full' ? 'active' : ''}`}
            onClick={() => setActiveTab('full')}
          >
            📄 Email brut complet
            {attachmentCount > 0 && (
              <span style={{
                marginLeft: '0.35rem', background: 'rgba(245,158,11,0.2)',
                color: '#fbbf24', fontSize: '0.6rem', fontWeight: 700,
                padding: '1px 5px', borderRadius: '999px'
              }}>📎 {attachmentCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="detail-body">
        {activeTab === 'ai' && !isSent ? (
          <div className="detail-scroll" style={{ paddingBottom: '120px' }}>
            <AiPanel
              mail={mail}
              onStatusChange={(status) => {
                  if (status === 'archive') onArchive(mail.id);
                  else onMailUpdated();
              }}
              onReplyFilled={(text) => {
                  setDraftReply(text);
                  // scroll vers le bas
                  const ta = document.getElementById('reply-box');
                  if (ta) ta.focus();
              }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {attachmentCount > 0 && (
              <div style={{ padding: '1rem 1.5rem 0', flexShrink: 0 }}>
                <EmailAttachments mailId={mail.id} attachmentsJson={mail.attachments} />
              </div>
            )}
            {mail.html_content ? (
              <div className="email-iframe-wrapper">
                <iframe
                  title="Email complet"
                  srcDoc={getSafeHtml(mail.html_content)}
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                />
              </div>
            ) : (
              <div className="email-plaintext">
                {renderCleanText(mail.content)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ZONE DE REPONSE FIXE EN BAS */}
      {(!isSent && activeTab === 'ai' && (mail.action_recommandee === 'Répondre' || mail.action_recommandee === 'Ignorer')) && (
         <div style={{ 
             position: 'sticky', bottom: 0, left: 0, right: 0, 
             background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', 
             padding: '1rem',
             boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.1)',
             zIndex: 10
         }}>
             {senders.length > 0 && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>De</span>
                 <select
                   className="crm-input"
                   value={senderId}
                   onChange={(e) => setSenderId(e.target.value)}
                   disabled={isSending}
                   style={{ maxWidth: '340px', height: '34px', padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                 >
                   {senders.map(sender => (
                     <option key={sender.id} value={sender.id}>
                       {sender.label || sender.email} - {sender.email}
                     </option>
                   ))}
                 </select>
               </div>
             )}
             <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <textarea 
                   id="reply-box"
                   className="crm-textarea" 
                   value={draftReply}
                   onChange={(e) => setDraftReply(e.target.value)}
                   placeholder="Tapez ici votre réponse..."
                   rows={3}
                   disabled={isSending}
                   style={{ flex: 1 }}
                />
                <button 
                  className="crm-btn-primary" 
                  onClick={handleSend} 
                  disabled={isSending || (!draftReply.trim() && replyAttachments.length === 0)}
                  style={{ height: '100%', padding: '0.8rem', alignSelf: 'stretch' }}
                >
                   {isSending ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
             </div>
             
             {/* Liste des pièces jointes */}
             {replyAttachments.length > 0 && (
                 <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {replyAttachments.map((f, i) => (
                       <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                          <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <button onClick={() => setReplyAttachments(replyAttachments.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: 0 }}>
                              <X size={12} />
                          </button>
                       </div>
                    ))}
                 </div>
             )}

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                 <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span><Edit3 size={11} style={{ display: 'inline', verticalAlign: '-1px' }}/> Éditable librement</span>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--accent-blue)', fontWeight: 600 }} title="Ajouter une pièce jointe">
                       <Paperclip size={13} /> Ajouter une pièce jointe
                       <input type="file" multiple style={{ display: 'none' }} onChange={(e) => {
                           if (e.target.files) {
                               setReplyAttachments([...replyAttachments, ...Array.from(e.target.files)]);
                               e.target.value = null;
                           }
                       }} />
                    </label>
                 </div>
                 <span><Send size={11} style={{ display: 'inline', verticalAlign: '-1px' }}/> Envoi direct</span>
             </div>
         </div>
      )}
    </div>
  );
}
