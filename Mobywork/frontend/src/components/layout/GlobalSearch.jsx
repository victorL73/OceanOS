import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Package, Mail, User } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:3002/api';

export default function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch base CRM & orders once to allow fast offline autocomplete
  useEffect(() => {
    if (isOpen && clients.length === 0) {
      axios.get(`${API_URL}/crm/clients`).then(res => setClients(res.data)).catch(console.error);
      axios.get(`${API_URL}/orders`).then(res => setOrders(res.data)).catch(console.error);
    }
  }, [isOpen, clients.length]);

  // Combine results with debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    
    const search = async () => {
      setIsSearching(true);
      const lowerQ = query.toLowerCase();
      const newResults = [];

      // 1. Match Clients
      const matchedClients = clients.filter(c => 
        (c.nom && c.nom.toLowerCase().includes(lowerQ)) || 
        (c.email && c.email.toLowerCase().includes(lowerQ))
      ).slice(0, 3);
      
      matchedClients.forEach(c => newResults.push({
        type: 'crm',
        id: c.id,
        title: c.nom,
        subtitle: c.email,
        icon: <User size={14} />,
        data: c
      }));

      // 2. Match Orders
      const matchedOrders = orders.filter(o => 
         (o.reference && o.reference.toLowerCase().includes(lowerQ)) ||
         (o.client?.nom && o.client.nom.toLowerCase().includes(lowerQ))
      ).slice(0, 3);
      
      matchedOrders.forEach(o => newResults.push({
        type: 'orders',
        id: o.id,
        title: `Commande #${o.id} - ${o.reference || ''}`,
        subtitle: `${o.client?.nom || ''} - ${o.montant}€`,
        icon: <Package size={14} />,
        data: o
      }));

      // 3. Match Emails via Backend
      try {
        const mailRes = await axios.get(`${API_URL}/emails?search=${encodeURIComponent(query)}`);
        const matchedMails = mailRes.data.slice(0, 4);
        matchedMails.forEach(m => newResults.push({
          type: 'mail',
          id: m.id,
          title: m.subject || "Sans objet",
          subtitle: `De: ${m.from_address}`,
          icon: <Mail size={14} />,
          data: m
        }));
      } catch (err) {
        console.error("Error fetching emails for search", err);
      }

      setResults(newResults);
      setIsSearching(false);
    };

    const delayDebounceFn = setTimeout(() => {
      search();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, clients, orders]);

  const handleSelect = (item) => {
    setIsOpen(false);
    setQuery('');
    if (onNavigate) {
      onNavigate(item.type, { id: item.id });
    }
  };

  return (
    <div className="global-search-container" ref={containerRef}>
      <div className={`gs-input-wrapper ${isOpen ? 'active' : ''}`}>
        <Search size={15} className="gs-icon" />
        <input 
          type="text" 
          placeholder="Rechercher (Nom, Email, Commande)..." 
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {isSearching && (
          <Loader2 
            size={14} 
            className="animate-spin" 
            style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="gs-dropdown">
          {results.length > 0 ? (
            results.map((item, idx) => (
              <div key={`${item.type}-${item.id}-${idx}`} className="gs-dropdown-item" onClick={() => handleSelect(item)}>
                <div className={`gs-item-icon-bg ${item.type}`}>
                  {item.icon}
                </div>
                <div className="gs-item-info">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
                <div className="gs-item-type-badge">
                  {item.type === 'crm' ? 'Fiche Client' : item.type === 'orders' ? 'Commande' : 'Email'}
                </div>
              </div>
            ))
          ) : (
            !isSearching && <div className="gs-no-results">Aucun résultat trouvé pour "{query}".</div>
          )}
        </div>
      )}
    </div>
  );
}
