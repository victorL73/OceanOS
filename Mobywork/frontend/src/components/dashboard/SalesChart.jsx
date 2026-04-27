import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';

const W = 600, H = 180, PAD = { top: 20, right: 16, bottom: 32, left: 48 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function buildPath(points) {
  if (!points.length) return '';
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return d;
}

function buildSmooth(points) {
  if (points.length < 2) return buildPath(points);
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) / 3;
    const cp1y = points[i - 1].y;
    const cp2x = points[i].x - (points[i].x - points[i - 1].x) / 3;
    const cp2y = points[i].y;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export default function SalesChart() {
  const [hovered, setHovered] = useState(null);
  const [period, setPeriod] = useState(30);
  const [rawSalesData, setRawSalesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('moby_token');
        const res = await axios.get('http://localhost:3002/api/dashboard/sales', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRawSalesData(res.data);
      } catch (err) {
        console.error("Erreur sales history:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const data = useMemo(() => rawSalesData.slice(-period), [rawSalesData, period]);

  const maxRev = data.length > 0 ? Math.max(...data.map(d => d.revenue)) : 1000;
  const minRev = data.length > 0 ? Math.min(...data.map(d => d.revenue)) : 0;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (Math.max(1, data.length - 1))) * IW,
    y: PAD.top + (1 - (d.revenue - minRev) / (maxRev - minRev || 1)) * IH,
    revenue: d.revenue,
    orders: d.orders,
    date: d.date,
  }));

  const linePath = buildSmooth(points);
  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x} ${PAD.top + IH} L ${points[0].x} ${PAD.top + IH} Z` : '';

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minRev + (i / yTicks) * (maxRev - minRev);
    return { y: PAD.top + (1 - i / yTicks) * IH, label: `${Math.round(val / 100) / 10}k€` };
  });

  const xLabels = data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, ii) => {
    const i = ii * Math.ceil(data.length / 6);
    return {
      x: PAD.left + (i / (Math.max(1, data.length - 1))) * IW,
      label: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    };
  });

  const totalRev = data.reduce((s, d) => s + d.revenue, 0);
  const totalOrd = data.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Évolution des ventes</div>
          <div className="chart-subtitle">
            {isLoading ? '...' : totalRev.toLocaleString('fr-FR')}€ · {isLoading ? '...' : totalOrd} commandes
          </div>
        </div>
        <div className="chart-period-tabs">
          {[7, 14, 30].map(p => (
            <button
              key={p}
              className={`chart-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
              disabled={isLoading}
            >
              {p}j
            </button>
          ))}
        </div>
      </div>

      <div className="chart-svg-wrap" style={{ position: 'relative', minHeight: '160px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Chargement des données réelles...
          </div>
        ) : data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Aucune vente sur la période.
          </div>
        ) : (
          <>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '160px' }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Grille horizontale */}
            {yLabels.map((t, i) => (
              <g key={i}>
                <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
                <text x={PAD.left - 6} y={t.y + 4} textAnchor="end"
                  fill="rgba(148,163,184,0.6)" fontSize="9">{t.label}</text>
              </g>
            ))}

            {/* Axe X labels */}
            {xLabels.map((l, i) => (
              <text key={i} x={l.x} y={H - 4} textAnchor="middle"
                fill="rgba(148,163,184,0.5)" fontSize="9">{l.label}</text>
            ))}

            {/* Aire */}
            <path d={areaPath} fill="url(#chartGrad)" />

            {/* Ligne principale */}
            <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Points interactifs */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x} cy={p.y} r={hovered === i ? 5 : 3}
                fill={hovered === i ? '#3b82f6' : 'transparent'}
                stroke={hovered === i ? 'white' : 'transparent'}
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {hovered !== null && (
            <div className="chart-tooltip" style={{
              left: `${((points[hovered].x - PAD.left) / IW) * 100}%`,
            }}>
              <div className="chart-tooltip-date">
                {new Date(data[hovered].date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              <div className="chart-tooltip-val">{data[hovered].revenue.toLocaleString('fr-FR')}€</div>
              <div className="chart-tooltip-sub">{data[hovered].orders} commandes</div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
