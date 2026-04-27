import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Send, Paperclip, Clock } from 'lucide-react';

export default function ComposeMailModal({ onClose, onSent }) {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState([]);
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

    const handleSend = async () => {
        if (!to || !message) return;
        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append('to', to);
            formData.append('subject', subject);
            formData.append('message', message);
            if (senderId) formData.append('senderId', senderId);
            attachments.forEach(file => {
                formData.append('attachments', file);
            });
            
            await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/emails/compose`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onSent();
            onClose();
        } catch (e) {
            alert("Erreur lors de l'envoi de l'email.");
            setIsSending(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', 
            backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', 
            alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', 
                boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', animation: 'slideInRight 0.3s ease'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-elevated)'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         Nouveau message
                    </h3>
                    <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {senders.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>De</label>
                            <select
                                className="crm-input"
                                value={senderId}
                                onChange={(e) => setSenderId(e.target.value)}
                                disabled={isSending}
                            >
                                {senders.map(sender => (
                                    <option key={sender.id} value={sender.id}>
                                        {sender.label || sender.email} - {sender.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>À</label>
                        <input 
                            type="email" 
                            className="crm-input" 
                            value={to} 
                            onChange={(e) => setTo(e.target.value)} 
                            placeholder="exemple@domaine.com"
                            disabled={isSending}
                            style={{ flex: 1 }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Objet</label>
                        <input 
                            type="text" 
                            className="crm-input" 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)} 
                            placeholder="Objet du message"
                            disabled={isSending}
                            style={{ flex: 1 }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Message</label>
                        <textarea 
                            className="crm-textarea" 
                            value={message} 
                            onChange={(e) => setMessage(e.target.value)} 
                            placeholder="Écrivez votre message..."
                            disabled={isSending}
                            rows={8}
                        />
                    </div>

                    {attachments.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '-0.3rem' }}>
                           {attachments.map((f, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                                 <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                 <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: 0 }}>
                                     <X size={12} />
                                 </button>
                              </div>
                           ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ 
                    padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-base)'
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--accent-blue)', fontWeight: 600, fontSize: '0.85rem' }} title="Ajouter une pièce jointe">
                       <Paperclip size={16} /> Joindre un fichier
                       <input type="file" multiple style={{ display: 'none' }} disabled={isSending} onChange={(e) => {
                           if (e.target.files) {
                               setAttachments([...attachments, ...Array.from(e.target.files)]);
                               e.target.value = null;
                           }
                       }} />
                    </label>

                    <button 
                        className="crm-btn-primary" 
                        onClick={handleSend} 
                        disabled={isSending || !to || !message}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}
                    >
                        {isSending ? (
                            <><Clock size={16} className="animate-spin" /> Envoi...</>
                        ) : (
                            <><Send size={16} /> Envoyer</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
