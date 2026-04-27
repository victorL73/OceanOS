import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, FileText, Download, Trash2, Save, Send, X } from 'lucide-react';
import QuoteList from './QuoteList';
import QuoteBuilder from './QuoteBuilder';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const QUOTE_DRAFT_CONTEXT_KEY = 'mobywork.quoteDraftContext';
const QUOTE_DRAFT_CONTEXT_TTL_MS = 5 * 60 * 1000;

function clearStoredDraftQuoteContext() {
  try {
    sessionStorage.removeItem(QUOTE_DRAFT_CONTEXT_KEY);
  } catch {}
}

function readStoredDraftQuoteContext() {
  try {
    const raw = sessionStorage.getItem(QUOTE_DRAFT_CONTEXT_KEY);
    if (!raw) return null;

    const context = JSON.parse(raw);
    const createdAt = Number(context?.created_at || 0);
    const isFresh = createdAt && Date.now() - createdAt < QUOTE_DRAFT_CONTEXT_TTL_MS;

    if (context?.id === 'new' && isFresh) return context;
  } catch {}

  clearStoredDraftQuoteContext();
  return null;
}

export default function QuotesLayout({ navContext, setNavContext }) {
  const [quotes, setQuotes] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [draftQuoteContext, setDraftQuoteContext] = useState(null);
  
  // Si on clique sur "Créer devis" depuis le CRM, on l'intercepte ici 
  const isCreatingNew = selectedQuoteId === 'new';

  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/quotes`);
      setQuotes(res.data);
    } catch (e) {
      console.error('Erreur charment devis: ', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
    
    if (navContext?.id) {
        setSelectedQuoteId(navContext.id); // ex: 'new' passé depuis CRM
        const incomingDraftContext = navContext.id === 'new' ? navContext : null;
        setDraftQuoteContext(incomingDraftContext);
        if (incomingDraftContext) clearStoredDraftQuoteContext();
        setNavContext(null);
        return;
    }

    const storedDraftContext = readStoredDraftQuoteContext();
    if (storedDraftContext) {
        setSelectedQuoteId('new');
        setDraftQuoteContext(storedDraftContext);
        clearStoredDraftQuoteContext();
    }
  }, [navContext, setNavContext]);

  const filteredQuotes = quotes.filter(q => 
    q.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.reference?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedQuote = isCreatingNew ? {
    id: 'new',
    client_id: draftQuoteContext?.client_id || '',
    client_name: draftQuoteContext?.client_name || '',
    client_email: draftQuoteContext?.client_email || '',
    status: 'Brouillon',
    lines: [],
    total_ht: 0,
    total_ttc: 0
  } : quotes.find(q => q.id === selectedQuoteId);

  const handleSaveQuote = async (quoteData) => {
    try {
        if (quoteData.id === 'new') {
            await axios.post(`${API_URL}/quotes`, quoteData);
        } else {
            await axios.put(`${API_URL}/quotes/${quoteData.id}`, quoteData);
        }
        fetchQuotes();
        setSelectedQuoteId(null);
        setDraftQuoteContext(null);
        clearStoredDraftQuoteContext();
    } catch(e) {
        console.error('Erreur save: ', e);
        alert('Erreur: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Supprimer ce devis ?")) return;
    try {
        await axios.delete(`${API_URL}/quotes/${id}`);
        setSelectedQuoteId(null);
        setDraftQuoteContext(null);
        clearStoredDraftQuoteContext();
        fetchQuotes();
    } catch(e) {
        console.error('Del error:', e);
    }
  };

  return (
    <div className={`app-content crm-layout ${selectedQuoteId ? 'has-selection' : ''}`}>
      
      {/* SIDEBAR TROP RAPIDE POUR LES FILTRES (Optionnelle, similaire à CRM) */}
      <div className="crm-sidebar" style={{ width: '220px', background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem 1rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
             <FileText size={20} /> Devis
          </h2>
          <button 
             onClick={() => {
               setDraftQuoteContext(null);
               clearStoredDraftQuoteContext();
               setSelectedQuoteId('new');
             }}
             style={{ 
               marginTop: '1.5rem', width: '100%', padding: '0.75rem', 
               background: 'var(--accent-blue)', color: 'white', borderRadius: '8px',
               border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
               cursor: 'pointer', fontWeight: 600
             }}
          >
             <Plus size={16} /> Créer un devis
          </button>
        </div>
        
        <div style={{ padding: '0 1rem' }}>
           <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Filtres rapides</h3>
           {/* Future filtres stats */}
        </div>
      </div>

      <div className="crm-slider-wrapper">
         <div className={`crm-inner-slider ${selectedQuoteId ? 'has-selection' : ''}`}>
            
            {/* CENTRE: LISTE DES DEVIS */}
            <div className="crm-list-container" style={{ width: '380px', borderRight: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
               <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <div style={{ position: 'relative' }}>
                     <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                     <input 
                       type="text" 
                       placeholder="Rechercher (Client, Réf)..." 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'white' }}
                     />
                  </div>
               </div>
               
               <QuoteList 
                 quotes={filteredQuotes} 
                 selectedId={selectedQuoteId} 
                 onSelect={(id) => {
                   setDraftQuoteContext(null);
                   clearStoredDraftQuoteContext();
                   setSelectedQuoteId(id);
                 }} 
                 loading={isLoading} 
               />
            </div>

            {/* DROITE: BUILDER / DETAILS DU DEVIS */}
            <div className="detail-panel" style={{ flex: 1, background: 'var(--bg-base)', overflowY: 'auto' }}>
               {selectedQuote ? (
                 <QuoteBuilder 
                     quote={selectedQuote} 
                     onSave={handleSaveQuote} 
                     onCancel={() => {
                       setSelectedQuoteId(null);
                       setDraftQuoteContext(null);
                       clearStoredDraftQuoteContext();
                     }} 
                     onDelete={() => handleDelete(selectedQuote.id)}
                  />
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                     <FileText size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                     <p>Sélectionnez ou créez un devis pour afficher les détails.</p>
                  </div>
               )}
            </div>

         </div>
      </div>
    </div>
  );
}
