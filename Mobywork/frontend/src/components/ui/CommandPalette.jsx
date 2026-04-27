import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, LayoutDashboard, Mail, Users, ShoppingCart, BarChart2, Megaphone, TrendingUp, Bot, Settings, ArrowRight, Keyboard, Hash } from 'lucide-react';

// Commandes intégrées
const STATIC_COMMANDS = [
  // Navigation
  { id: 'nav-dashboard',   group: 'Navigation',    icon: <LayoutDashboard size={15} />, label: 'Aller au Dashboard IA',   color: '#3b82f6', action: 'navigate', module: 'dashboard' },
  { id: 'nav-mail',        group: 'Navigation',    icon: <Mail size={15} />,           label: 'Aller aux Emails',         color: '#6366f1', action: 'navigate', module: 'mail' },
  { id: 'nav-crm',         group: 'Navigation',    icon: <Users size={15} />,          label: 'Aller au CRM Clients',     color: '#10b981', action: 'navigate', module: 'crm' },
  { id: 'nav-orders',      group: 'Navigation',    icon: <ShoppingCart size={15} />,   label: 'Aller aux Commandes',      color: '#f59e0b', action: 'navigate', module: 'orders' },
  { id: 'nav-finance',     group: 'Navigation',    icon: <BarChart2 size={15} />,      label: 'Aller à Finance IA',       color: '#8b5cf6', action: 'navigate', module: 'finance' },
  { id: 'nav-marketing',   group: 'Navigation',    icon: <Megaphone size={15} />,      label: 'Aller au Marketing IA',    color: '#ec4899', action: 'navigate', module: 'marketing' },
  { id: 'nav-prospection', group: 'Navigation',    icon: <TrendingUp size={15} />,     label: 'Aller à Prospection IA',   color: '#14b8a6', action: 'navigate', module: 'prospection' },
  { id: 'nav-autopilot',   group: 'Navigation',    icon: <Bot size={15} />,            label: 'Aller à Automatisation',   color: '#a78bfa', action: 'navigate', module: 'autopilot' },
  { id: 'nav-settings',    group: 'Navigation',    icon: <Settings size={15} />,       label: 'Aller aux Paramètres',     color: '#94a3b8', action: 'navigate', module: 'settings' },
  // Actions
  { id: 'act-compose',     group: 'Actions',       icon: <Mail size={15} />,           label: 'Composer un nouvel email', color: '#6366f1', action: 'compose', shortcut: 'C' },
  { id: 'act-sync',        group: 'Actions',       icon: <Hash size={15} />,           label: 'Synchroniser les données', color: '#3b82f6', action: 'sync', shortcut: 'R' },
];

const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl/⌘', 'Shift', 'K'], label: 'Ouvrir la palette' },
  { keys: ['T'], label: 'Marquer email traité' },
  { keys: ['A'], label: 'Archiver email' },
  { keys: ['Echap'], label: 'Fermer / Annuler' },
];

export default function CommandPalette({ onNavigate, onCompose, onSync, isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef(null);

  // Filter commands
  const q = query.toLowerCase().trim();
  const filtered = q.length === 0
    ? STATIC_COMMANDS
    : STATIC_COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(q) || cmd.group.toLowerCase().includes(q));

  // Group commands
  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flatList = Object.values(grouped).flat();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const executeCommand = useCallback((cmd) => {
    if (!cmd) return;
    if (cmd.action === 'navigate' && cmd.module) {
      onNavigate?.(cmd.module);
    } else if (cmd.action === 'compose') {
      onCompose?.();
    } else if (cmd.action === 'sync') {
      onSync?.();
    }
    onClose();
  }, [onNavigate, onCompose, onSync, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flatList.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); executeCommand(flatList[selectedIdx]); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, flatList, selectedIdx, executeCommand, onClose]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  if (!isOpen) return null;

  let flatIdx = 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '560px', margin: '0 1rem',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          animation: 'cmdSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={18} color="var(--text-muted)" strokeWidth={2} />
          <input
            ref={inputRef} value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une commande, un module..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => setShowShortcuts(s => !s)}
            title="Raccourcis clavier"
            style={{ padding: '0.35rem', borderRadius: 6, background: showShortcuts ? 'rgba(59,130,246,0.1)' : 'none', border: 'none', color: showShortcuts ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Keyboard size={15} />
          </button>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>Echap</div>
        </div>

        {/* Shortcuts panel */}
        {showShortcuts && (
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(99,102,241,0.04)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Raccourcis clavier
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {KEYBOARD_SHORTCUTS.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {s.keys.map((k, j) => (
                      <kbd key={j} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commands */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem' }}>
          {Object.entries(grouped).length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Aucune commande pour "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, cmds]) => (
              <div key={group} style={{ marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem 0.25rem' }}>
                  {group}
                </div>
                {cmds.map(cmd => {
                  const currentIdx = flatIdx++;
                  const isSelected = currentIdx === selectedIdx;
                  return (
                    <div
                      key={cmd.id}
                      onMouseEnter={() => setSelectedIdx(currentIdx)}
                      onClick={() => executeCommand(cmd)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 0.75rem', borderRadius: 8,
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${cmd.color}15`, color: cmd.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {cmd.icon}
                      </div>
                      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {cmd.label}
                      </span>
                      {cmd.shortcut && (
                        <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 7px', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                      {isSelected && <ArrowRight size={14} color="var(--accent-blue)" />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.6rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {[['↵', 'Sélectionner'], ['↑↓', 'Naviguer'], ['Echap', 'Fermer']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: '0.65rem' }}>{key}</kbd>
              {label}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cmdSlideIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
