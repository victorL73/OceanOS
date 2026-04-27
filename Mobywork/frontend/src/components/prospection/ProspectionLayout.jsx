import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, Search, Filter, LayoutGrid, List as ListIcon, 
  Trash2, Mail, CheckCircle, Clock, Zap, Star, AlertCircle,
  TrendingUp, Ship, Droplets, MapPin, Building
} from 'lucide-react';
import ProspectSidebar from './ProspectSidebar';
import ProspectList from './ProspectList';
import ProspectKanban from './ProspectKanban';
import ProspectDetail from './ProspectDetail';

const API_URL = 'http://localhost:3002/api/prospects';

export default function ProspectionLayout() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'kanban'
  const [importProgress, setImportProgress] = useState(null); // null, or 0-100
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    status: '',
    city: '',
    category: ''
  });

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, { params: filters });
      setProspects(res.data);
    } catch (err) {
      console.error('Erreur chargement prospects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [filters]);

  const handleUpdateProspect = async (id, data) => {
    try {
      await axios.patch(`${API_URL}/${id}`, data);
      fetchProspects();
    } catch (err) {
      console.error('Erreur update:', err);
    }
  };

  const handleImport = async (rawData) => {
    const lines = rawData.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    const BATCH_SIZE = 3; // Réduit pour voir la barre progresser plus vite
    const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
    
    setImportProgress(0);

    try {
      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const chunk = lines.slice(i, i + BATCH_SIZE).join('\n');
        await axios.post(`${API_URL}/import`, { rawData: chunk });
        
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        setImportProgress(Math.round((currentBatch / totalBatches) * 100));
      }
      
      setTimeout(() => setImportProgress(null), 2000); // Cache après 2s
      fetchProspects();
    } catch (err) {
      console.error('Erreur import:', err);
      alert('Erreur lors de l\'import IA. Vérifiez votre clé Groq ou vos limites API.');
      setImportProgress(null);
    }
  };

  const handleDeleteProspect = async (id) => {
    if (!window.confirm('Supprimer ce prospect ?')) return;
    
    // Optimistic UI : on retire tout de suite de la liste
    const originalProspects = [...prospects];
    setProspects(prev => prev.filter(p => p.id !== id));
    setSelectedId(null);

    const deleteUrl = `${API_URL}/${id}`;
    console.log(`📤 Tentative de suppression via: ${deleteUrl}`);

    try {
      const res = await axios.delete(deleteUrl);
      if (res.data.changes === 0) {
        console.warn("⚠️ Aucune ligne supprimée en base.");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      const status = err.response?.status;
      console.error('❌ Erreur suppression:', errorMsg, 'Status:', status);
      alert(`Erreur lors de la suppression (${status || 'Network Error'}): ${errorMsg}. Le prospect a été restauré.`);
      setProspects(originalProspects); // Restauration en cas d'échec
    }
  };

  const handleAutoPilot = async () => {
    // Dans cet exemple, l'auto-pilote nettoie tous les prospects "Nouveaux"
    const newProspects = prospects.filter(p => p.status === 'Nouveau');
    if (newProspects.length === 0) return alert('Aucun nouveau prospect à traiter.');
    
    alert(`Lancement du nettoyage IA pour ${newProspects.length} prospects...`);
    // Logique simplifiée pour la démo: on pourrait boucler ou avoir un endpoint batch
    fetchProspects();
  };

  const selectedProspect = prospects.find(p => p.id === selectedId);
  const hasSelection = !!selectedId;

  return (
    <div className={`app-content prospection-layout ${hasSelection ? 'has-selection' : ''}`}>
      
      {/* COLONNE 1 : SOURCES & FILTRES */}
      <ProspectSidebar 
        filters={filters} 
        setFilters={setFilters} 
        onImport={handleImport}
        categories={[...new Set(prospects.map(p => p.category).filter(Boolean))]}
        importProgress={importProgress}
      />

      <div className="prospection-slider-wrapper">
        <div className={`prospection-inner-slider ${hasSelection ? 'has-selection' : ''}`}>
          {/* COLONNE 2 : LISTE / KANBAN */}
          <div className="prospection-main" style={viewMode !== 'list' ? { width: '100%', flex: 1, minWidth: 0 } : undefined}>
            {/* Header de la liste - Fixé en haut */}
            <div style={{ 
              padding: '1.5rem', 
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(8, 13, 22, 0.95)',
              backdropFilter: 'blur(10px)',
              zIndex: 10,
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Prospection IA
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {prospects.length} prospects détectés
                </p>
              </div>
              <div className="view-switcher" style={{ 
                display: 'flex', 
                background: 'rgba(255,255,255,0.05)', 
                padding: '4px', 
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <button 
                  onClick={() => { setViewMode('list'); }}
                  style={{ 
                    padding: '8px 16px', borderRadius: '8px', border: 'none', 
                    background: viewMode === 'list' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                  }}
                >
                  <ListIcon size={14} /> Liste
                </button>
                <button 
                  onClick={() => { setViewMode('kanban'); }}
                  style={{ 
                    padding: '8px 16px', borderRadius: '8px', border: 'none', 
                    background: viewMode === 'kanban' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                  }}
                >
                  <LayoutGrid size={14} /> Pipeline
                </button>
              </div>
            </div>

            {/* Contenu dynamique */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {viewMode === 'list' ? (
                <ProspectList 
                  prospects={prospects} 
                  selectedId={selectedId} 
                  onSelect={setSelectedId} 
                  loading={loading}
                />
              ) : (
                <ProspectKanban 
                  prospects={prospects} 
                  onUpdateStatus={handleUpdateProspect}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </div>

          {/* COLONNE 3 : FICHE DÉTAILLÉE IA */}
          <div 
            className="detail-panel" 
            style={viewMode !== 'list' && hasSelection ? { 
              position: 'absolute', top: 0, right: 0, bottom: 0, 
              width: '100%', maxWidth: '600px', 
              zIndex: 100, boxShadow: '-5px 0 30px rgba(0,0,0,0.7)' 
            } : undefined}
          >
            <ProspectDetail 
              prospect={selectedProspect} 
              onUpdate={handleUpdateProspect}
              onDelete={handleDeleteProspect}
              onBack={() => setSelectedId(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
