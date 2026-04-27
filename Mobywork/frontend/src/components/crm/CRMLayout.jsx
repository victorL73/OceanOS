import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CRMSidebar from './CRMSidebar';
import ClientList from './ClientList';
import ClientDetails from './ClientDetails';
import EditorModal from './EditorModal';

const API_URL = 'http://localhost:3002/api/crm';

export default function CRMLayout({ navContext, setNavContext, onGlobalNavigate }) {
  const [clients, setClients] = useState([]);
  const [activeFilter, setActiveFilter] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientData, setSelectedClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClientLoading, setIsClientLoading] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorContext, setEditorContext] = useState(null);

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/clients`);
      setClients(res.data);
    } catch (err) {
      console.error('Erreur chargement CRM clients:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    if (navContext && navContext.id) {
      fetchClientDetails(navContext.id);
      if (setNavContext) setNavContext(null);
    }
  }, [navContext, setNavContext]);

  const fetchClientDetails = async (id) => {
    try {
      setIsClientLoading(true);
      const res = await axios.get(`${API_URL}/clients/${id}?_t=${Date.now()}`);
      setSelectedClientData(res.data);
    } catch (err) {
      console.error('Erreur détails client:', err);
      setSelectedClientData(null);
    } finally {
      setIsClientLoading(false);
    }
  };

  const handleSelectClient = (client) => {
    if (!client) { setSelectedClientData(null); return; }
    fetchClientDetails(client.id);
  };

  const openEditor = (type, prompt) => {
    setEditorContext({ type, prompt, client: selectedClientData?.client });
    setIsEditorOpen(true);
  };

  const filteredClients = clients.filter(c => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!c.nom.toLowerCase().includes(s) && !c.email.toLowerCase().includes(s)) return false;
    }
    const tag = c.ai?.tag;
    if (activeFilter === 'vip') return tag === 'VIP';
    if (activeFilter === 'gros_depensiers') return c.totalSpent >= 500;
    if (activeFilter === 'nouveaux_clients') return c.ordersCount === 1;
    if (activeFilter === 'relancer') return tag === 'À relancer';
    if (activeFilter === 'perdu') return tag === 'Perdu';
    if (activeFilter === 'inactif') return c.ordersCount === 0 || (c.lastOrderDaysAgo && c.lastOrderDaysAgo > 90);
    return true;
  });

  const hasSelection = !!selectedClientData;

  return (
    <div className={`app-content crm-layout ${hasSelection ? 'has-selection' : ''}`}>
      <CRMSidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <div className="crm-slider-wrapper">
        <div className={`crm-inner-slider ${hasSelection ? 'has-selection' : ''}`}>
          <div className="crm-list-container">
            <ClientList
              clients={filteredClients}
              selectedClientId={selectedClientData?.client?.id}
              onSelect={handleSelectClient}
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              isLoading={isLoading}
            />
          </div>

          <div className="crm-detail-container">
            <ClientDetails
              data={selectedClientData}
              isLoading={isClientLoading}
              onAction={openEditor}
              onBack={() => handleSelectClient(null)}
              onQuote={() => onGlobalNavigate && onGlobalNavigate('quotes', { id: 'new', client_id: selectedClientData.client.id, client_name: selectedClientData.client.nom })}
            />
          </div>
        </div>
      </div>

      {isEditorOpen && (
        <EditorModal
          context={editorContext}
          onClose={() => setIsEditorOpen(false)}
          onSuccess={() => {
            if (selectedClientData?.client?.id) fetchClientDetails(selectedClientData.client.id);
            setIsEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
