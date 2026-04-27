import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Search, Trash2, FileText, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  fillQuoteTemplate,
  getQuoteTemplate,
} from './invoceanQuoteTemplate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export default function QuoteBuilder({ quote, onSave, onCancel, onDelete }) {
  const [formData, setFormData] = useState({ ...quote });
  const [productsCache, setProductsCache] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [companySettings, setCompanySettings] = useState({});

  useEffect(() => {
    setFormData({ ...quote });
  }, [quote]);

  // Chargement des produits PrestaShop et des paramètres entreprise en parallèle
  useEffect(() => {
    const fetchAll = async () => {
      setProductsLoading(true);
      try {
        const [productsRes, settingsRes] = await Promise.all([
          axios.get(`${API_URL}/prestashop/products`),
          axios.get(`${API_URL}/settings`)
        ]);
        setProductsCache(productsRes.data || []);
        setCompanySettings(settingsRes.data || {});
        console.log(`✅ ${productsRes.data?.length || 0} produits PrestaShop chargés dans le builder.`);
      } catch(e) {
        console.error("Erreur chargement builder:", e);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Dérivé dynamiquement (évite les bugs de désynchro réseau si l'utilisateur tape avant la fin de la requête)
  const searchResults = searchQuery.length < 2 ? [] : productsCache.filter(p => {
       const psName = p.name ? (typeof p.name === 'string' ? p.name : p.name[0]?.value) : 'Produit inconnu';
       return psName.toLowerCase().includes(searchQuery.toLowerCase()) || String(p.id).includes(searchQuery.toLowerCase());
  }).slice(0, 10);

  const handleSearchProduct = (q) => {
    setSearchQuery(q);
  };

  const addLine = (product) => {
      const psName = product.name ? (typeof product.name === 'string' ? product.name : product.name[0]?.value) : 'Produit inconnu';
      const price = parseFloat(product.price || 0);
      // Tax fallback if prestashop returns raw price
      
      const newLines = [...(formData.lines || []), {
          product_id: product.id,
          name: psName,
          quantity: 1,
          unit_price_ht: price,
          tax_rate: 20 // Simulation Taux TVA
      }];
      
      recalculate(newLines);
      setSearchQuery('');
  };

  const updateLine = (index, field, value) => {
      const newLines = [...(formData.lines || [])];
      newLines[index][field] = parseFloat(value) || 0;
      recalculate(newLines);
  };

  const removeLine = (index) => {
      const newLines = (formData.lines || []).filter((_, i) => i !== index);
      recalculate(newLines);
  };

  const recalculate = (lines) => {
      let ht = 0;
      let ttc = 0;
      lines.forEach(l => {
          const lHt = (l.quantity * l.unit_price_ht);
          ht += lHt;
          ttc += lHt * (1 + (l.tax_rate / 100));
      });
      setFormData(prev => ({ ...prev, lines, total_ht: ht, total_ttc: ttc }));
  };

  const handleExportPDF = async () => {
      try {
        const c = companySettings;
        const template = fillQuoteTemplate(getQuoteTemplate(c.quote_html_template), c, formData);

        if (template) {
          // ── Rendu via Template HTML ─────────────────────────
          const today = new Date();
          const expDate = new Date(today);
          expDate.setDate(expDate.getDate() + (parseInt(c.quote_validity_days) || 30));
          const fmt = (d) => d.toLocaleDateString('fr-FR');

          // Construction du tableau de lignes HTML
          const linesHtml = `<table style="width:calc(100% - 60px);margin:0 30px;border-collapse:collapse">
            <thead><tr style="background:#3b82f6;color:white;font-size:12px">
              <th style="padding:10px 12px;text-align:left">Description</th>
              <th style="padding:10px;text-align:center">Qté</th>
              <th style="padding:10px;text-align:right">Prix U. HT</th>
              <th style="padding:10px;text-align:center">TVA</th>
              <th style="padding:10px;text-align:right">Total TTC</th>
            </tr></thead>
            <tbody>${(formData.lines || []).map((l, i) => `
              <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'}">
                <td style="padding:10px 12px;font-size:13px">${l.name}</td>
                <td style="padding:10px;text-align:center;font-size:13px">${l.quantity}</td>
                <td style="padding:10px;text-align:right;font-size:13px">${parseFloat(l.unit_price_ht).toFixed(2)} €</td>
                <td style="padding:10px;text-align:center;font-size:13px">${l.tax_rate}%</td>
                <td style="padding:10px;text-align:right;font-size:13px;font-weight:bold">${(l.quantity * l.unit_price_ht * (1 + l.tax_rate / 100)).toFixed(2)} €</td>
              </tr>`).join('')}
            </tbody></table>`;

          const totalTva = parseFloat(formData.total_ttc || 0) - parseFloat(formData.total_ht || 0);

          // Injection des variables dans le template
          const filled = template
            .replace(/{company_name}/g, c.quote_company_name || '')
            .replace(/{company_address}/g, c.quote_company_address || '')
            .replace(/{company_city}/g, c.quote_company_city || '')
            .replace(/{company_phone}/g, c.quote_company_phone || '')
            .replace(/{company_email}/g, c.quote_company_email || '')
            .replace(/{company_siret}/g, c.quote_company_siret || '')
            .replace(/{reference}/g, formData.reference || 'Brouillon')
            .replace(/{date}/g, fmt(today))
            .replace(/{date_expiration}/g, fmt(expDate))
            .replace(/{vendor}/g, c.nom || '')
            .replace(/{client_nom}/g, formData.client_name || '')
            .replace(/{client_email}/g, formData.client_email || '')
            .replace(/{total_ht}/g, parseFloat(formData.total_ht || 0).toFixed(2))
            .replace(/{total_tva}/g, totalTva.toFixed(2))
            .replace(/{total_ttc}/g, parseFloat(formData.total_ttc || 0).toFixed(2))
            .replace(/{payment_terms}/g, c.quote_payment_terms || '')
            .replace(/{footer_note}/g, c.quote_footer_note || 'Merci de votre confiance.')
            .replace(/{lines_table}/g, linesHtml);

          // Rendu dans un iframe caché
          const container = document.createElement('div');
          container.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;background:white;padding:20px;font-family:Arial,sans-serif;';
          container.innerHTML = filled;
          document.body.appendChild(container);

          await new Promise(r => setTimeout(r, 400)); // attendre le rendu

          // Capture avec html2canvas
          const { default: html2canvas } = await import('html2canvas');
          const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 900 });
          document.body.removeChild(container);

          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pageW = 210, pageH = 297;
          const imgH = (canvas.height * pageW) / canvas.width;
          let posY = 0;
          while (posY < imgH) {
            if (posY > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, -posY, pageW, imgH);
            posY += pageH;
          }
          doc.save(`${formData.reference || 'devis'}.pdf`);

        } else {
          // ── Fallback PDF codé ────────────────────────────────
          const doc = new jsPDF();
          const pageW = 210, margin = 14;
          doc.setFillColor(20, 30, 48);
          doc.rect(0, 0, pageW, 38, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18); doc.setFont('helvetica', 'bold');
          doc.text(c.quote_company_name || 'Mon Entreprise', margin, 16);
          doc.setFontSize(22); doc.setTextColor(59, 130, 246);
          doc.text('DEVIS', pageW - margin, 18, { align: 'right' });
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 215, 230);
          doc.text(formData.reference || 'Brouillon', pageW - margin, 25, { align: 'right' });
          doc.setTextColor(50, 60, 80); doc.setFontSize(9);
          doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, margin, 48);
          doc.text(`Client : ${formData.client_name || ''}`, margin, 54);
          autoTable(doc, {
            startY: 62,
            head: [['Description', 'Qté', 'Prix HT', 'TVA', 'Total TTC']],
            body: (formData.lines || []).map(l => [l.name, l.quantity, `${parseFloat(l.unit_price_ht).toFixed(2)} €`, `${l.tax_rate}%`, `${(l.quantity * l.unit_price_ht * (1 + l.tax_rate / 100)).toFixed(2)} €`]),
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            margin: { left: margin, right: margin }
          });
          const finalY = doc.lastAutoTable.finalY + 8;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(59, 130, 246);
          doc.text(`Total TTC : ${parseFloat(formData.total_ttc || 0).toFixed(2)} €`, pageW - margin, finalY + 10, { align: 'right' });
          doc.save(`${formData.reference || 'devis'}.pdf`);
        }
      } catch(e) {
          console.error('PDF error:', e);
          alert('Erreur PDF : ' + e.message);
      }
  };


  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', color: 'var(--text-primary)' }}>
       {/* HEADER ACTIONS */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
               {formData.id === 'new' ? 'Nouveau Devis' : formData.reference}
            </h1>
            <select 
               value={formData.status} 
               onChange={e => setFormData({...formData, status: e.target.value})}
               style={{ 
                   marginTop: '0.5rem', padding: '4px 8px', borderRadius: '4px', 
                   background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' 
               }}
            >
               <option value="Brouillon">Brouillon</option>
               <option value="Envoyé">Envoyé</option>
               <option value="Accepté">Accepté (Convertir)</option>
               <option value="Refusé">Refusé</option>
               <option value="Expiré">Expiré</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {formData.id !== 'new' && (
              <>
                 <button onClick={handleExportPDF} className="icon-btn" title="Export PDF" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', padding: '8px 12px', borderRadius: '8px', display:'flex', gap:'8px', cursor:'pointer' }}>
                   <Download size={16} /> PDF
                 </button>
                 {formData.status === 'Envoyé' && (
                     <button className="icon-btn" title="Convertir en Commande" style={{ border: 'none', background: 'var(--accent-purple)', color: 'white', padding: '8px 12px', borderRadius: '8px', display:'flex', gap:'8px', cursor:'pointer' }}>
                        Convertir
                     </button>
                 )}
              </>
            )}
            <button onClick={() => onSave(formData)} style={{ background: 'var(--accent-blue)', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
               <Save size={16} /> Enregistrer
            </button>
            {formData.id !== 'new' && (
              <button onClick={onDelete} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                 <Trash2 size={16} />
              </button>
            )}
          </div>
       </div>

       {/* INFOS CLIENT */}
       <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-muted)' }}>Informations Client</h3>
          <div className="grid-responsive-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                  <label style={{ display:'block', fontSize:'0.75rem', marginBottom:'0.25rem' }}>Nom du client</label>
                  <input type="text" value={formData.client_name || ''} onChange={e => setFormData({...formData, client_name: e.target.value})} placeholder="Ex: Marine Equipement..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'white' }} />
              </div>
              <div>
                  <label style={{ display:'block', fontSize:'0.75rem', marginBottom:'0.25rem' }}>Email de contact</label>
                  <input type="email" value={formData.client_email || ''} onChange={e => setFormData({...formData, client_email: e.target.value})} placeholder="contact@domaine.com" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'white' }} />
              </div>
          </div>
       </div>

       {/* LIGNES DEVIS */}
       <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-muted)' }}>Lignes de produits</h3>
           
           {/* Table des lignes */}
           {formData.lines && formData.lines.length > 0 ? (
               <div style={{ marginBottom: '1.5rem' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                       <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                           <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Description</th>
                           <th style={{ padding: '8px', width: '80px', color: 'var(--text-muted)' }}>Qté</th>
                           <th style={{ padding: '8px', width: '120px', color: 'var(--text-muted)' }}>Prix U. HT</th>
                           <th style={{ padding: '8px', width: '80px', color: 'var(--text-muted)' }}>TVA %</th>
                           <th style={{ padding: '8px', width: '120px', color: 'var(--text-muted)' }}>Total TTC</th>
                           <th style={{ padding: '8px', width: '50px' }}></th>
                       </tr>
                    </thead>
                    <tbody>
                       {formData.lines.map((l, idx) => {
                           const ttc = (l.quantity * l.unit_price_ht) * (1 + (l.tax_rate/100));
                           return (
                               <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                   <td style={{ padding: '8px' }}>{l.name}</td>
                                   <td style={{ padding: '8px' }}>
                                       <input type="number" value={l.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} min="1" step="1" style={{ width: '60px', padding: '4px', background: 'var(--bg-base)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                   </td>
                                   <td style={{ padding: '8px' }}>
                                       <input type="number" value={l.unit_price_ht} onChange={e => updateLine(idx, 'unit_price_ht', e.target.value)} step="0.01" style={{ width: '80px', padding: '4px', background: 'var(--bg-base)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} /> €
                                   </td>
                                   <td style={{ padding: '8px' }}>
                                       <input type="number" value={l.tax_rate} onChange={e => updateLine(idx, 'tax_rate', e.target.value)} step="0.1" style={{ width: '50px', padding: '4px', background: 'var(--bg-base)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                   </td>
                                   <td style={{ padding: '8px', fontWeight: 600 }}>{ttc.toFixed(2)} €</td>
                                   <td style={{ padding: '8px', textAlign: 'right' }}>
                                       <button onClick={() => removeLine(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                   </td>
                               </tr>
                           );
                       })}
                    </tbody>
                 </table>
               </div>
           ) : (
               <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                  Aucune ligne dans ce devis. Cherchez un produit ci-dessous pour commencer.
               </div>
           )}

           {/* ADD PRODUCT SEARCH */}
           <div style={{ position: 'relative' }}>
               <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--accent-blue)', borderRadius: '8px', padding: '0.5rem 1rem', background: 'rgba(59, 130, 246, 0.05)' }}>
                  <Search size={16} color="var(--accent-blue)" style={{ marginRight: '8px', flexShrink: 0 }} />
                  <input 
                     type="text" 
                     placeholder={productsLoading ? 'Chargement du catalogue PrestaShop...' : `Rechercher parmi ${productsCache.length} produits (Nom ou ID)...`}
                     value={searchQuery}
                     onChange={e => handleSearchProduct(e.target.value)}
                     disabled={productsLoading}
                     style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', outline: 'none', opacity: productsLoading ? 0.5 : 1 }}
                  />
                  {productsLoading && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>⏳ Chargement...</span>}
               </div>
               
               {searchResults.length > 0 && (
                   <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', zIndex: 50, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                      {searchResults.map(p => {
                          const psName = p.name ? (typeof p.name === 'string' ? p.name : p.name[0]?.value) : 'Produit inconnu';
                          return (
                              <div 
                                 key={p.id} 
                                 onClick={() => addLine(p)}
                                 style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                 onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                 onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                              >
                                 <div>
                                     <div style={{ fontWeight: 600 }}>{psName}</div>
                                     <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Réf: {p.reference || p.id}</div>
                                 </div>
                                 <div style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                                    {parseFloat(p.price || 0).toFixed(2)} € HT
                                 </div>
                              </div>
                          );
                      })}
                   </div>
               )}
           </div>
       </div>

       {/* TOTALS */}
       <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '300px', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                  <span>Total HT</span>
                  <span>{(formData.total_ht || 0).toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                  <span>TVA Estimée</span>
                  <span>{((formData.total_ttc || 0) - (formData.total_ht || 0)).toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>
                  <span>Total TTC</span>
                  <span>{(formData.total_ttc || 0).toFixed(2)} €</span>
              </div>
          </div>
       </div>
    </div>
  );
}
