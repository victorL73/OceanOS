import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import OrdersSidebar from './OrdersSidebar';
import OrderList from './OrderList';
import OrderKanban from './OrderKanban';
import OrderTimeline from './OrderTimeline';
import OrderDetail from './OrderDetail';
import { Target, LayoutGrid, List, Clock, Zap, FileText, LayoutDashboard, ChevronRight } from 'lucide-react';

const API_URL = 'http://localhost:3002/api/orders';

export default function OrdersLayout({ navContext, setNavContext }) {
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState('toutes');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderData, setSelectedOrderData] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  
  // Nouveaux states métier
  const [viewMode, setViewMode] = useState('list'); // 'list', 'kanban', 'timeline'
  const [focusMode, setFocusMode] = useState(false); // Cache la sidebar et filtre auto

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setOrders(res.data);
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (navContext && navContext.id) {
       fetchOrderDetails(navContext.id);
       if (setNavContext) setNavContext(null);
    }
  }, [navContext, setNavContext]);

  const fetchOrderDetails = async (id) => {
    try {
      setIsOrderLoading(true);
      const res = await axios.get(`${API_URL}/${id}`);
      setSelectedOrderData(res.data);
    } catch (err) {
      console.error('Erreur détails commande:', err);
      setSelectedOrderData(null);
    } finally {
      setIsOrderLoading(false);
    }
  };

  const handleSelectOrder = (order) => {
    if (!order) return setSelectedOrderData(null);
    fetchOrderDetails(order.id);
  };

  const handleAction = async (actionType, orderIdOverride = null) => {
      const orderIdObj = orderIdOverride || selectedOrderData?.id;
      if (!orderIdObj) return;

      try {
          if (actionType === 'telecharger_bordereau') {
              const orderData = orderIdOverride ? orders.find(o => o.id === orderIdOverride) : selectedOrderData;
              if (!orderData) return;
              const res = await axios.get(`${API_URL}/${orderData.id}/bordereau`, { responseType: 'blob' });
              const url = window.URL.createObjectURL(new Blob([res.data]));
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', `bordereau_${orderData.reference}.txt`);
              document.body.appendChild(link);
              link.click();
              link.parentNode.removeChild(link);
              return;
          }

          await axios.post(`${API_URL}/${orderIdObj}/action`, { action: actionType });
          if (selectedOrderData?.id === orderIdObj) fetchOrderDetails(orderIdObj);
          fetchOrders();
      } catch (err) {
          console.error("Erreur action", err);
      }
  };

  // KPI intelligents
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.date).toDateString() === todayStr);
  const caDay = todayOrders.reduce((sum, o) => sum + o.montant, 0);
  const urgentesCount = orders.filter(o => o.priorite?.tag === 'URGENT').length;
  const aTraiterCount = orders.filter(o => o.statutCategory === 'attente' || o.statutCategory === 'a_traiter').length;

  // Filtre
  let filteredOrders = orders.filter(o => {
    if (focusMode) {
      // Focus mode = uniquement URGENT ou HAUTE pour prioriser
      if (o.priorite?.tag !== 'URGENT' && o.priorite?.tag !== 'HAUTE') return false;
    } else {
      if (activeFilter === 'urgentes') { if(o.priorite?.tag !== 'URGENT') return false; }
      else if (activeFilter === 'vip') { if(!o.client.isVIP) return false; }
      else if (activeFilter === 'a_traiter') { if(o.statutCategory !== 'attente' && o.statutCategory !== 'a_traiter') return false; }
      else if (activeFilter === 'expediees') { if(o.statutCategory !== 'expedie') return false; }
      else if (activeFilter === 'annulees') { if(o.statutCategory !== 'annule') return false; }
      else if (activeFilter === 'en_retard') { if(o.priorite?.tag !== 'URGENT' && o.priorite?.tag !== 'HAUTE') return false; }
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!o.client.nom.toLowerCase().includes(s) && 
          !o.client.email.toLowerCase().includes(s) &&
          !o.reference.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className={`app-content orders-layout ${selectedOrderData ? 'has-selection' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* ── HEADER INTELLIGENT ─────────────────────────────────────── */}
      <div className="orders-header" style={{ 
          padding: '0.75rem 1.25rem', 
          borderBottom: '1px solid var(--border)', 
          background: 'var(--bg-surface)',
          flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="mobile-back-btn" onClick={() => handleSelectOrder(null)} title="Retour à la liste">
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div>
              <h1 style={{ fontSize: '1rem', margin: '0 0 0.1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <LayoutDashboard size={15} color="var(--accent-blue)" /> 
                Cockpit Commandes
              </h1>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gérez vos flux opérationnels intelligemment.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="orders-header-stats" style={{ display: 'flex', gap: '1rem', borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>À Traiter</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{aTraiterCount}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Urgences</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: urgentesCount > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{urgentesCount}</div>
              </div>
              <div className="hide-mobile">
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CA Jour</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-green)' }}>{caDay.toFixed(0)} €</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="view-mode-toggle" style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 7, padding: 2, border: '1px solid var(--border)' }}>
                <button onClick={() => setViewMode('list')} style={{ background: viewMode === 'list' ? 'var(--bg-surface)' : 'transparent', border: 'none', borderRadius: 5, padding: '0.3rem 0.5rem', color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.15s' }}>
                  <List size={13} /> <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Liste</span>
                </button>
                <button onClick={() => setViewMode('kanban')} style={{ background: viewMode === 'kanban' ? 'var(--bg-surface)' : 'transparent', border: 'none', borderRadius: 5, padding: '0.3rem 0.5rem', color: viewMode === 'kanban' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.15s' }}>
                  <LayoutGrid size={13} /> <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Kanban</span>
                </button>
                <button className="hide-mobile" onClick={() => setViewMode('timeline')} style={{ background: viewMode === 'timeline' ? 'var(--bg-surface)' : 'transparent', border: 'none', borderRadius: 5, padding: '0.3rem 0.5rem', color: viewMode === 'timeline' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: viewMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.15s' }}>
                  <Clock size={13} /> <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Timeline</span>
                </button>
              </div>

              <button 
                className="hide-mobile"
                onClick={() => setFocusMode(!focusMode)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.3rem', 
                  padding: '0.4rem 0.75rem', borderRadius: 7, 
                  background: focusMode ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-elevated)', 
                  color: focusMode ? 'var(--accent-blue)' : 'var(--text-primary)', 
                  border: `1px solid ${focusMode ? 'var(--accent-blue)' : 'var(--border)'}`, 
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', transition: 'all 0.2s' 
                }}
              >
                <Target size={13} />
                {focusMode ? 'Focus On' : 'Focus Off'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!focusMode && (
          <OrdersSidebar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            orders={orders}
          />
        )}

        {/* Standardized Slider for List + Detail */}
        <div className="orders-slider-wrapper">
          <div className={`orders-inner-slider ${selectedOrderData ? 'has-selection' : ''}`}>
            
            {/* PANE 1: LIST / KANBAN / TIMELINE */}
            <div className="orders-list-panel" style={viewMode !== 'list' ? { width: '100%', flex: 1, minWidth: 0 } : undefined}>
              {viewMode === 'list' && (
                <OrderList
                  orders={filteredOrders}
                  selectedOrderId={selectedOrderData?.id}
                  onSelect={handleSelectOrder}
                  searchTerm={searchTerm}
                  onSearch={setSearchTerm}
                  isLoading={isLoading}
                  onAction={handleAction}
                />
              )}

              {viewMode === 'kanban' && (
                <OrderKanban
                  orders={filteredOrders}
                  isLoading={isLoading}
                  onSelect={handleSelectOrder}
                  onAction={handleAction}
                />
              )}

              {viewMode === 'timeline' && (
                <OrderTimeline
                  orders={filteredOrders}
                  isLoading={isLoading}
                  onSelect={handleSelectOrder}
                />
              )}
            </div>

            {/* PANE 2: DETAIL */}
            <div 
              className="orders-detail-panel"
              style={viewMode !== 'list' && selectedOrderData ? { 
                position: 'absolute', top: 0, right: 0, bottom: 0, 
                width: '100%', maxWidth: '600px', 
                zIndex: 100, boxShadow: '-5px 0 30px rgba(0,0,0,0.7)' 
              } : undefined}
            >
              <OrderDetail
                data={selectedOrderData}
                isLoading={isOrderLoading}
                onAction={handleAction}
                onBack={() => handleSelectOrder(null)}
              />
            </div>

          </div>
        </div>
      </div>
    </div>

  );
}
