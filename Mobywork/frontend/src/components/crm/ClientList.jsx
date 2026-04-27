import React from 'react';
import { Search } from 'lucide-react';
import ClientCard from './ClientCard';

export default function ClientList({ clients, selectedClientId, onSelect, searchTerm, onSearch, isLoading }) {
  return (
    <div className="list-panel" style={{ width: 'var(--list-w)' }}>
      {/* Search Header */}
      <div className="mail-list-header">
        <div className="mail-list-search">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="list-scroll">
        {isLoading ? (
          <div className="empty-state">Chargement des clients...</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            Aucun client trouvé.
          </div>
        ) : (
          clients.map(client => (
            <ClientCard 
              key={client.id} 
              client={client} 
              isSelected={selectedClientId === client.id}
              onClick={() => onSelect(client)}
            />
          ))
        )}
      </div>
    </div>
  );
}
