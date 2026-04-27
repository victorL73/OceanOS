import React, { useState, useRef } from 'react';
import { 
  Upload, Type, Filter, Search, MapPin, 
  ChevronDown, Database, Zap, Sparkles 
} from 'lucide-react';

export default function ProspectSidebar({ filters, setFilters, onImport, categories, importProgress }) {
  const [rawPayload, setRawPayload] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawPayload(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleImportClick = async () => {
    if (!rawPayload.trim()) return;
    setIsImporting(true);
    await onImport(rawPayload);
    setRawPayload('');
    setIsImporting(false);
  };

  return (
    <div className="prospect-sidebar" style={{ 
      padding: '1.5rem', 
      borderRight: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      overflowY: 'auto'
    }}>
      
      {/* 0. RECHERCHE GLOBALE */}
      <div className="sidebar-section">
        <label style={{ 
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', 
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', 
          alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
        }}>
          <Search size={12} /> Recherche rapide
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input 
            type="text" 
            placeholder="Nom, email, domaine..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            style={{ 
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              padding: '10px 10px 10px 34px', borderRadius: '10px', color: '#fff', outline: 'none', fontSize: '0.85rem'
            }}
          />
        </div>
      </div>

      {/* 1. IMPORT DATA */}
      <div className="sidebar-section">
        <label style={{ 
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', 
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', 
          alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
        }}>
          <Database size={12} /> Import de données
        </label>
        
        <div style={{ 
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem'
        }}>
          <textarea 
            placeholder="Collez ici (ex: Nom, email, ville...)"
            value={rawPayload}
            onChange={(e) => setRawPayload(e.target.value)}
            style={{ 
              width: '100%', height: '80px', background: 'transparent', border: 'none',
              color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'none', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            onClick={handleImportClick}
            disabled={isImporting || !rawPayload.trim()}
            style={{ 
              width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-blue-2))',
              color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: isImporting || !rawPayload.trim() ? 0.6 : 1, transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
            }}
          >
            {isImporting ? (
              <RefreshCw className="gs-spinner" size={16} />
            ) : (
              <Zap size={16} fill="white" />
            )}
            Nettoyer via IA
          </button>

          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              width: '100%', padding: '0.75rem', borderRadius: '10px', 
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Upload size={14} /> Importer CSV
          </button>
        </div>

        {/* Barre de Progression */}
        {importProgress !== null && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Analyse en cours...</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{importProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${importProgress}%`, height: '100%', 
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                transition: 'width 0.4s ease-out',
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
              }} />
            </div>
          </div>
        )}
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
          Format libre ou CSV supporté
        </p>
      </div>

      {/* 2. CATÉGORIES */}
      <div className="sidebar-section">
        <label style={{ 
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', 
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', 
          alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
        }}>
          <Filter size={12} /> Catégories
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select 
            value={filters.category || ''}
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            style={{ 
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              padding: '10px', borderRadius: '10px', color: '#fff', outline: 'none', fontSize: '0.85rem'
            }}
          >
            <option value="">Toutes les catégories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. FILTRES DYNAMIQUES */}
      <div className="sidebar-section">
        <label style={{ 
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', 
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', 
          alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'
        }}>
          <MapPin size={12} /> Zone Géographique
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="filter-group">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Région / Ville</span>
            <div style={{ position: 'relative' }}>
              <MapPin size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text" 
                placeholder="Ex: PACA, Marseille..."
                value={filters.city}
                onChange={(e) => setFilters({...filters, city: e.target.value})}
                style={{ 
                  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '10px 10px 10px 34px', borderRadius: '10px', color: '#fff', outline: 'none', fontSize: '0.85rem'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
