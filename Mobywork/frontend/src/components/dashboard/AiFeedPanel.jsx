import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, CheckCircle, Pencil, X, ChevronRight, Loader2 } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || '/api'}`;

const authConfig = () => {
  const token = localStorage.getItem('moby_token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const TYPE_STYLES = {
  relance:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'  },
  contenu:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)' },
  stock:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)' },
  client:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  perf:     { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
  email:    { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.2)'  },
};

const PRIORITY_LABELS = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high:   { label: 'Haute',  color: '#f59e0b' },
  medium: { label: 'Moyenne', color: '#3b82f6' },
  low:    { label: 'Basse',   color: '#475569' },
};

function SuggestionCard({ suggestion, index, onExecute, onIgnore, onModuleNav }) {
  const [state, setState] = useState('idle'); // idle | running | done | ignored
  const style = TYPE_STYLES[suggestion.type] || TYPE_STYLES.perf;
  const priority = PRIORITY_LABELS[suggestion.priority];

  const handleExecute = async () => {
    setState('running');
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    setState('done');
    onExecute(suggestion.id);
  };

  if (state === 'ignored') return null;

  return (
    <div
      className="ai-suggestion-card"
      style={{
        '--sug-color': style.color,
        '--sug-bg': style.bg,
        '--sug-border': style.border,
        animationDelay: `${index * 80}ms`,
        opacity: state === 'done' ? 0.6 : 1,
      }}
    >
      {/* Accent border gauche */}
      <div className="sug-accent-bar" style={{ background: style.color }} />

      <div className="sug-content">
        <div className="sug-top-row">
          <span className="sug-icon">{suggestion.icon}</span>
          <span className="sug-title">{suggestion.title}</span>
          <span className="sug-priority" style={{ color: priority.color, borderColor: `${priority.color}44`, background: `${priority.color}12` }}>
            {priority.label}
          </span>
        </div>

        <p className="sug-description">{suggestion.description}</p>

        <div className="sug-action-row">
          <span className="sug-action-label">→ {suggestion.action}</span>
          <span className="sug-impact">{suggestion.impact}</span>
        </div>
      </div>

      <div className="sug-btn-group">
        {state === 'idle' && (
          <>
            <button className="sug-btn execute" onClick={handleExecute}>
              <CheckCircle size={13} /> Exécuter
            </button>
            <button className="sug-btn modify" onClick={() => onModuleNav(suggestion.module)}>
              <Pencil size={13} /> Modifier
            </button>
            <button className="sug-btn ignore" onClick={() => { setState('ignored'); onIgnore(suggestion.id); }}>
              <X size={13} />
            </button>
          </>
        )}
        {state === 'running' && (
          <div className="sug-running">
            <Loader2 size={14} className="animate-spin" /> Exécution...
          </div>
        )}
        {state === 'done' && (
          <div className="sug-done">
            <CheckCircle size={14} style={{ color: '#10b981' }} /> Effectué
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiFeedPanel({ onModuleNav }) {
  const [suggestions, setSuggestions] = useState([]);
  const [executed, setExecuted] = useState([]);
  const [ignored, setIgnored] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setIsRefreshing(true);
    try {
      const res = await axios.get(`${API}/dashboard/suggestions`, authConfig());
      if (Array.isArray(res.data)) {
        setSuggestions(res.data);
      } else {
        setSuggestions([]);
      }
      setExecuted([]);
      setIgnored([]);
    } catch(e) {
      console.error("Erreur chargement suggestions IA", e);
      setSuggestions([{
        id: "sug_error",
        type: "relance",
        priority: "urgent",
        icon: "❌",
        title: "Serveur non synchronisé",
        description: "La nouvelle intelligence ne peut pas démarrer. Merci de fermer la console noire (backend) et de la relancer (Start.bat ou node).",
        action: "Redémarrer le serveur",
        impact: "Activation de l'IA",
        module: "dashboard"
      }]);
    }
    setIsRefreshing(false);
  };

  const visible = showAll ? suggestions : suggestions.slice(0, 4);
  const active = suggestions.filter(s => !executed.includes(s.id) && !ignored.includes(s.id));

  const handleRefresh = async () => {
    await fetchSuggestions();
  };

  return (
    <div className="ai-feed-panel">
      <div className="ai-feed-header">
        <div className="ai-feed-title">
          <Sparkles size={16} className="ai-feed-icon" />
          <span>Feed IA — Suggestions prioritaires</span>
          {active.length > 0 && (
            <span className="ai-feed-count">{active.length}</span>
          )}
        </div>
        <button className="ai-feed-refresh" onClick={handleRefresh} disabled={isRefreshing}>
          <Loader2 size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Analyse...' : 'Actualiser'}
        </button>
      </div>

      {isRefreshing && (
        <div className="ai-feed-loading">
          <div className="ai-feed-loading-bar" />
          <span>L'IA analyse vos données en temps réel...</span>
        </div>
      )}

      <div className="ai-feed-list">
        {visible.map((s, i) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            index={i}
            onExecute={async (id) => {
              setExecuted(prev => [...prev, id]);
              try { await axios.post(`${API}/dashboard/dismiss-suggestion`, { suggestionId: id }, authConfig()); } catch (e) { console.error(e); }
            }}
            onIgnore={async (id) => {
              setIgnored(prev => [...prev, id]);
              try { await axios.post(`${API}/dashboard/dismiss-suggestion`, { suggestionId: id }, authConfig()); } catch (e) { console.error(e); }
            }}
            onModuleNav={onModuleNav}
          />
        ))}
      </div>

      {suggestions.length > 4 && (
        <button className="ai-feed-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Réduire' : `Voir ${suggestions.length - 4} autres suggestions`}
          <ChevronRight size={13} style={{ transform: showAll ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
        </button>
      )}
    </div>
  );
}
