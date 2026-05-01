import React, { useEffect, useState, useRef } from 'react';
import { Check, Archive, Clock, Send, Edit3, Paperclip, X, ChevronRight, Reply, ReplyAll } from 'lucide-react';
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

function formatThreadDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cleanPreview(text = '') {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countAttachments(attachmentsJson) {
  try {
    const attachments = JSON.parse(attachmentsJson || '[]');
    return Array.isArray(attachments) ? attachments.length : 0;
  } catch {
    return 0;
  }
}

function extractEmails(value = '') {
  const matches = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return Array.from(new Set((matches || []).map(email => email.toLowerCase())));
}

function formatRecipients(values = []) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean))).join(', ');
}

function buildReplyRecipients(mail, senders = [], mode = 'single') {
  if (!mail) return { to: '', cc: '', bcc: '' };

  const to = formatRecipients(extractEmails(mail.reply_to_address || mail.reply_to || mail.from_address));
  if (mode !== 'all') return { to, cc: '', bcc: '' };

  const ownEmails = new Set([
    ...extractEmails(mail.mailbox_address),
    ...senders.flatMap(sender => extractEmails(sender.email)),
  ]);
  const directRecipients = new Set(extractEmails(to));
  const ccCandidates = [
    ...extractEmails(mail.to_address),
    ...extractEmails(mail.cc_address),
  ].filter(email => !ownEmails.has(email) && !directRecipients.has(email));

  return {
    to,
    cc: formatRecipients(ccCandidates),
    bcc: '',
  };
}

function findSenderForMail(mail, senders = [], fallbackId = '') {
  if (!mail || senders.length === 0) return fallbackId;

  const mailboxEmails = new Set([
    ...extractEmails(mail.mailbox_address),
    ...extractEmails(mail.to_address),
    ...extractEmails(mail.bcc_address),
  ]);

  const matchingSender = senders.find(sender =>
    extractEmails(sender.email).some(email => mailboxEmails.has(email))
  );

  return matchingSender?.id || fallbackId || senders.find(sender => sender.isDefault)?.id || senders[0]?.id || '';
}

export default function MailDetail({ mail, onMarkDone, onArchive, onMailUpdated, onBack }) {
  const [activeTab, setActiveTab] = useState('ai');
  const [draftReply, setDraftReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAttachmentSyncing, setIsAttachmentSyncing] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [senders, setSenders] = useState([]);
  const [senderId, setSenderId] = useState('');
  const [replyMode, setReplyMode] = useState('single');
  const [replyTo, setReplyTo] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [thread, setThread] = useState([]);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const autoOpenedThreadFor = useRef(null);
  const attachmentSyncAttemptedFor = useRef(null);
  const attachmentCount = countAttachments(mail?.attachments);

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

  useEffect(() => {
    if (mail?.id && !isSent) setActiveTab('ai');
  }, [isSent, mail?.id]);

  useEffect(() => {
    const recipients = buildReplyRecipients(mail, senders, 'single');
    setReplyMode('single');
    setReplyTo(recipients.to);
    setReplyCc(recipients.cc);
    setReplyBcc(recipients.bcc);
    setDraftReply('');
    setReplyAttachments([]);
  }, [mail?.id]);

  useEffect(() => {
    if (!mail?.id || senders.length === 0) return;
    const preferredSenderId = findSenderForMail(mail, senders, senderId);
    if (preferredSenderId && preferredSenderId !== senderId) {
      setSenderId(preferredSenderId);
    }
  }, [mail?.id, senders]);

  const applyReplyMode = (mode) => {
    const recipients = buildReplyRecipients(mail, senders, mode);
    setReplyMode(mode);
    setReplyTo(recipients.to);
    setReplyCc(recipients.cc);
    setReplyBcc(recipients.bcc);
    const preferredSenderId = findSenderForMail(mail, senders, senderId);
    if (preferredSenderId) setSenderId(preferredSenderId);

    const ta = document.getElementById('reply-box');
    if (ta) ta.focus();
  };

  useEffect(() => {
    if (!mail?.id) {
      setThread([]);
      return;
    }

    let cancelled = false;
    const loadThread = async () => {
      setIsThreadLoading(true);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || '/api'}/emails/${mail.id}/thread`);
        if (!cancelled) setThread(Array.isArray(res.data?.thread) ? res.data.thread : []);
      } catch (err) {
        console.error('Erreur chargement historique mail:', err);
        if (!cancelled) setThread([]);
      } finally {
        if (!cancelled) setIsThreadLoading(false);
      }
    };

    loadThread();
    return () => { cancelled = true; };
  }, [mail?.id]);

  useEffect(() => {
    if (!mail?.id || isSent || autoOpenedThreadFor.current === mail.id) return;
    const hasPreviousSentMail = thread.some(item =>
      Number(item.id) !== Number(mail.id) && (item.direction === 'sent' || item.status === 'sent')
    );

    if (hasPreviousSentMail) {
      setActiveTab('history');
      autoOpenedThreadFor.current = mail.id;
    }
  }, [isSent, mail?.id, thread]);

  useEffect(() => {
    if (
      !mail?.id ||
      isSent ||
      attachmentCount > 0 ||
      mail.attachments_checked_at ||
      attachmentSyncAttemptedFor.current === mail.id
    ) {
      return;
    }

    let cancelled = false;
    attachmentSyncAttemptedFor.current = mail.id;
    setIsAttachmentSyncing(true);

    axios.post(`${import.meta.env.VITE_API_URL || '/api'}/emails/${mail.id}/attachments/sync`)
      .then((res) => {
        if (!cancelled && res.data?.mail) {
          onMailUpdated?.(res.data.mail);
        }
      })
      .catch((err) => {
        console.warn('Verification pieces jointes impossible:', err.response?.data?.error || err.message);
      })
      .finally(() => {
        if (!cancelled) setIsAttachmentSyncing(false);
      });

    return () => { cancelled = true; };
  }, [attachmentCount, isSent, mail?.attachments_checked_at, mail?.id, onMailUpdated]);

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
  const handleSend = async () => {
      if(!draftReply.trim() && replyAttachments.length === 0) return;
      if(!replyTo.trim()) {
          alert("Aucun destinataire de reponse.");
          return;
      }
      setIsSending(true);
      try {
          const formData = new FormData();
          formData.append('message', draftReply);
          formData.append('to', replyTo);
          formData.append('cc', replyCc);
          formData.append('bcc', replyBcc);
          if (senderId) formData.append('senderId', senderId);
          replyAttachments.forEach(file => {
              formData.append('attachments', file);
          });
          
          await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/emails/${mail.id}/reply`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          onMarkDone(mail.id);
          setDraftReply('');
          setReplyTo(buildReplyRecipients(mail, senders, 'single').to);
          setReplyCc('');
          setReplyBcc('');
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
              {(mail.cc_address || mail.bcc_address) && (
                <div className="mail-detail-meta" style={{ marginTop: '0.25rem' }}>
                  {mail.cc_address && <><span>Cc : </span><strong style={{ color: 'var(--text-primary)' }}>{mail.cc_address}</strong></>}
                  {mail.cc_address && mail.bcc_address && <>&nbsp;-&nbsp;</>}
                  {mail.bcc_address && <><span>Cci : </span><strong style={{ color: 'var(--text-primary)' }}>{mail.bcc_address}</strong></>}
                </div>
              )}
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
          <div
            className={`detail-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Historique ({isThreadLoading ? '...' : thread.length || 1})
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
            {attachmentCount > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <EmailAttachments mailId={mail.id} attachmentsJson={mail.attachments} />
              </div>
            )}
            {attachmentCount === 0 && isAttachmentSyncing && (
              <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Paperclip size={14} /> Verification des pieces jointes...
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          <div className="thread-history">
            {isThreadLoading ? (
              <div className="thread-empty">Chargement de l'historique...</div>
            ) : thread.length <= 1 ? (
              <div className="thread-empty">
                Aucun autre mail lie trouve pour ce sujet. Les prochains envois et receptions seront ajoutes ici automatiquement.
              </div>
            ) : (
              thread.map(item => {
                const itemSent = item.direction === 'sent' || item.status === 'sent';
                const itemCurrent = Number(item.id) === Number(mail.id);
                return (
                  <div key={item.id} className={`thread-card ${itemSent ? 'sent' : 'received'} ${itemCurrent ? 'current' : ''}`}>
                    <div className="thread-card-header">
                      <span className={`thread-badge ${itemSent ? 'sent' : 'received'}`}>{itemSent ? 'Envoye' : 'Recu'}</span>
                      <strong>{itemSent ? `A : ${item.to_address || item.from_address || 'Destinataire inconnu'}` : `De : ${item.from_address || 'Expediteur inconnu'}`}</strong>
                      <span>{formatThreadDate(item.date_reception)}</span>
                    </div>
                    {(item.cc_address || item.bcc_address) && (
                      <div className="thread-subject">
                        {item.cc_address && <span>Cc : {item.cc_address}</span>}
                        {item.cc_address && item.bcc_address && <span> - </span>}
                        {item.bcc_address && <span>Cci : {item.bcc_address}</span>}
                      </div>
                    )}
                    <div className="thread-subject">
                      {item.subject || 'Sans objet'} {itemCurrent && <span className="thread-current-label">mail ouvert</span>}
                    </div>
                    <div className="thread-preview">{cleanPreview(item.content || item.resume).slice(0, 700) || 'Aucun contenu texte.'}</div>
                    {item.attachments && item.attachments !== '[]' && (
                      <EmailAttachments mailId={item.id} attachmentsJson={item.attachments} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {attachmentCount > 0 && (
              <div style={{ padding: '1rem 1.5rem 0', flexShrink: 0 }}>
                <EmailAttachments mailId={mail.id} attachmentsJson={mail.attachments} />
              </div>
            )}
            {attachmentCount === 0 && isAttachmentSyncing && (
              <div style={{ padding: '1rem 1.5rem 0', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Paperclip size={14} /> Verification des pieces jointes...
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
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                   <button
                     type="button"
                     className={`action-btn outline ${replyMode === 'single' ? 'active' : ''}`}
                     onClick={() => applyReplyMode('single')}
                     disabled={isSending}
                     title="Repondre uniquement a l'expediteur"
                     style={{ height: '34px', padding: '0.35rem 0.7rem' }}
                   >
                     <Reply size={13} /> Repondre
                   </button>
                   <button
                     type="button"
                     className={`action-btn outline ${replyMode === 'all' ? 'active' : ''}`}
                     onClick={() => applyReplyMode('all')}
                     disabled={isSending}
                     title="Repondre a l'expediteur et aux personnes en copie"
                     style={{ height: '34px', padding: '0.35rem 0.7rem' }}
                   >
                     <ReplyAll size={13} /> Repondre a tous
                   </button>
                 </div>
               </div>
             )}
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 28 }}>A</span>
               <input
                 className="crm-input"
                 value={replyTo}
                 onChange={(e) => setReplyTo(e.target.value)}
                 placeholder="destinataire@domaine.com"
                 disabled={isSending}
                 style={{ height: '34px', padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
               />
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 28 }}>Cc</span>
                 <input
                   className="crm-input"
                   value={replyCc}
                   onChange={(e) => setReplyCc(e.target.value)}
                   placeholder="copie@domaine.com"
                   disabled={isSending}
                   style={{ height: '34px', padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                 />
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 28 }}>Cci</span>
                 <input
                   className="crm-input"
                   value={replyBcc}
                   onChange={(e) => setReplyBcc(e.target.value)}
                   placeholder="copie-cachee@domaine.com"
                   disabled={isSending}
                   style={{ height: '34px', padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                 />
               </div>
             </div>
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
