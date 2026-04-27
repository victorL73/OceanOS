import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3002/api/marketing';

export default function MarketingCopilot() {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Bonjour ! Je suis votre Copilote Marketing IA. Je connais parfaitement vos campagnes Google Ads et Meta Ads. Comment puis-je vous aider aujourd'hui ? (ex: 'Quel est mon ROAS moyen ?', 'Quelles campagnes optimiser ?')" 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/copilot`, { messages: newMessages });
      setMessages([...newMessages, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      console.error("Erreur Copilote IA:", err);
      setMessages([...newMessages, { role: 'assistant', content: "⚠️ Désolé, j'ai rencontré une erreur lors de l'analyse. Veuillez réessayer." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'calc(100vh - 250px)', 
      background: 'var(--bg-surface)', 
      borderRadius: '16px', 
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      {/* Header du Chat */}
      <div style={{ 
        padding: '1rem 1.5rem', 
        borderBottom: '1px solid var(--border)', 
        background: 'linear-gradient(90deg, rgba(99,102,241,0.05), transparent)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          background: 'var(--accent-indigo)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '1rem'
        }}>💬</div>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Copilote Marketing IA</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600 }}>En direct de vos campagnes</div>
        </div>
      </div>

      {/* Zone des messages */}
      <div className="module-scroll" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((m, idx) => (
          <div 
            key={idx} 
            style={{ 
              maxWidth: '85%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: m.role === 'user' ? 'white' : 'var(--text-primary)',
              padding: '0.875rem 1.125rem',
              borderRadius: '14px',
              borderTopRightRadius: m.role === 'user' ? '2px' : '14px',
              borderTopLeftRadius: m.role === 'user' ? '14px' : '2px',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'pre-wrap'
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ 
            alignSelf: 'flex-start', 
            background: 'var(--bg-elevated)', 
            padding: '0.75rem 1rem', 
            borderRadius: '14px', 
            borderTopLeftRadius: '2px',
            display: 'flex',
            gap: '3px'
          }}>
            <div className="dot-typing" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'dotPulse 1.5s infinite' }}></div>
            <div className="dot-typing" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'dotPulse 1.5s infinite 0.2s' }}></div>
            <div className="dot-typing" style={{ width: '6px', height: '6px', background: 'var(--text-muted)', borderRadius: '50%', animation: 'dotPulse 1.5s infinite 0.4s' }}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de chat */}
      <form onSubmit={handleSend} style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Posez une question sur vos publicités..."
          style={{ 
            flex: 1, 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border)', 
            borderRadius: '10px', 
            padding: '0.75rem 1rem', 
            color: 'var(--text-primary)',
            outline: 'none'
          }}
          disabled={loading}
        />
        <button 
          type="submit" 
          className="gs-autopilot-btn" 
          style={{ width: 'auto', padding: '0 1.25rem' }}
          disabled={loading || !input.trim()}
        >
          Envoyer
        </button>
      </form>

      <style>{`
        @keyframes dotPulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
