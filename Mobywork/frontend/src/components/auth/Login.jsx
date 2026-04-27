import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, Lock, Zap, ChevronRight, Shield, BarChart2, Users, ShoppingCart, Eye, EyeOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const FEATURES = [
  { icon: <BarChart2 size={18} />, title: 'Dashboard IA', desc: 'KPIs PrestaShop en temps réel' },
  { icon: <Mail size={18} />, title: 'Gestion Emails', desc: 'IA, tri automatique & réponses rapides' },
  { icon: <Users size={18} />, title: 'CRM Clients', desc: 'Scoring IA & automatisations' },
  { icon: <ShoppingCart size={18} />, title: 'Cockpit Commandes', desc: 'Kanban, timeline & alertes intelligentes' },
];

export default function Login({ onLoginComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      if (res.data.success) {
        onLoginComplete(res.data.token, res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion au serveur. Vérifiez que le backend est démarré.');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="login-container">
      {/* ── LEFT PANEL — Branding ─────────────────────── */}
      <div className="login-branding-panel" style={{
        padding: '3rem',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(150deg, #0f1724 0%, #0a1220 50%, #080d16 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateX(-20px)',
        transition: 'opacity 0.6s, transform 0.6s',
      }}>
        {/* Glowing orbs background */}
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-150px', right: '-100px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'auto' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
          }}>⚓</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f1f5f9' }}>MobyWorkspace</div>
            <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>IA BETA</div>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 999, padding: '0.35rem 0.875rem', marginBottom: '1.5rem'
          }}>
            <Zap size={13} color="#a78bfa" fill="#a78bfa" />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Propulsé par l'IA</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.15, marginBottom: '1rem' }}>
            Votre cockpit<br />
            <span style={{ background: 'linear-gradient(135deg, #3b82f6, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              eCommerce intelligent
            </span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: '340px' }}>
            Centralisez emails, CRM, commandes et finance en un seul outil IA. Gagnez du temps, prenez de meilleures décisions.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.875rem',
              padding: '0.75rem 1rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
              transition: 'background 0.2s',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>{f.title}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>{f.desc}</div>
              </div>
              <ChevronRight size={14} color="#334155" style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={13} color="#475569" />
          <span style={{ fontSize: '0.72rem', color: '#475569' }}>Données hébergées en Europe · Chiffrement TLS · RGPD conforme</span>
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ──────────────────────────── */}
      <div className="login-form-panel" style={{
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)',
        transition: 'opacity 0.6s 0.15s, transform 0.6s 0.15s',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.5rem' }}>
              Bonne reprise 👋
            </h2>
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>
              Connectez-vous à votre espace de travail.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.875rem 1rem',
              background: 'rgba(239,68,68,0.08)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12, fontSize: '0.85rem',
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              marginBottom: '1.5rem', lineHeight: 1.5
            }}>
              <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠️</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.02em' }}>
                Adresse email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                <input
                  type="email" value={email} autoComplete="email"
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  style={{
                    width: '100%', padding: '0.875rem 1rem 0.875rem 2.75rem',
                    background: '#0f1724', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem', letterSpacing: '0.02em' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} autoComplete="current-password"
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '0.875rem 3rem 0.875rem 2.75rem',
                    background: '#0f1724', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={isLoading}
              style={{
                marginTop: '0.5rem', width: '100%', padding: '0.9rem',
                background: isLoading ? '#1d4ed8' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white', border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s, transform 0.15s',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              {isLoading
                ? <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'login-spin 0.7s linear infinite' }} /> Connexion...</>
                : <>Se connecter <ChevronRight size={16} /></>
              }
            </button>
          </form>

          {/* Footer note */}
          <div style={{ marginTop: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.75rem', lineHeight: 1.6 }}>
            Accès réservé aux membres de l'équipe.<br />
            <span style={{ color: '#475569' }}>Contactez votre administrateur pour obtenir un accès.</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes login-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        ::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}
