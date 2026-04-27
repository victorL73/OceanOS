import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Package, RefreshCw } from 'lucide-react';
import axios from 'axios';

const ALERT_LABELS = {
  stock_low:     { label: 'Stock faible', color: '#f59e0b' },
  out_of_stock:  { label: 'Rupture',      color: '#ef4444' },
};

export default function TopProducts() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTop = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('moby_token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || '/api'}/dashboard/top-products`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProducts(res.data);
      } catch (err) {
        console.error("Erreur top products:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTop();
  }, []);

  return (
    <div className="db-card">
      <div className="db-card-header">
        <div className="db-card-title"><Package size={15} /> Top Produits (Live)</div>
        <span className="db-card-subtitle">Basé sur les ventes réelles</span>
      </div>
      <div className="top-products-list" style={{ minHeight: '100px', position: 'relative' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.5rem', color: 'var(--text-muted)' }}>
             <RefreshCw size={24} className="animate-spin" />
             <p style={{ fontSize: '0.85rem' }}>Analyse des ventes en cours...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Aucune donnée de vente disponible.
          </div>
        ) : (
          products.map((p, i) => (
            <div key={p.id} className="tp-row">
              <div className="tp-rank">{i + 1}</div>
              <div className="tp-info">
                <div className="tp-name">
                  {p.name}
                  {p.alert && (
                    <span className="tp-alert" style={{ color: ALERT_LABELS[p.alert].color, borderColor: `${ALERT_LABELS[p.alert].color}44`, background: `${ALERT_LABELS[p.alert].color}12` }}>
                      ⚠ {ALERT_LABELS[p.alert].label}
                    </span>
                  )}
                </div>
                <div className="tp-meta">{p.ref} · {p.category}</div>
              </div>
              <div className="tp-stats">
                <div className="tp-revenue">{Math.round(p.revenue).toLocaleString('fr-FR')}€</div>
                <div className="tp-orders">{p.sales} unités</div>
              </div>
              <div className={`tp-trend ${p.trend >= 0 ? 'up' : 'down'}`}>
                {p.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(p.trend)}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
