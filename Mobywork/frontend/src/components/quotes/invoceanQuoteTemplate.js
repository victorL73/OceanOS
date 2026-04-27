export const INVOCEAN_QUOTE_TEMPLATE = `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 780px; margin: 0 auto; color: #18252a; background: #ffffff;">
  <div style="padding: 18px 15mm 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
    <div style="width: 48%;">
      {company_logo_html}
    </div>
    <div style="width: 45%; text-align: right;">
      <div style="font-size: 25px; line-height: 1; font-weight: 800; color: #0c2630; letter-spacing: 0;">DEVIS</div>
      <div style="margin-top: 7px; font-size: 10px; line-height: 1.2; font-weight: 800; color: #f95614; text-transform: uppercase;">Proposition commerciale</div>
      <div style="margin-top: 6px; font-size: 8px; color: #54646a;">Document genere par Mobywork</div>
    </div>
  </div>

  <div style="height: 1px; background: #0e3b53; margin: 0 15mm;"></div>

  <div style="display: flex; justify-content: flex-end; padding: 5mm 15mm 0;">
    <div style="width: 75mm; background: #f3f8f9; border: 1px solid #dae5e7; padding: 6mm;">
      <div style="display: flex; justify-content: space-between; gap: 12px; font-size: 9px; color: #0b374e; font-weight: 800;">
        <span>Numero</span><span style="font-size: 12px;">{reference}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; font-size: 8px; color: #0b374e;">
        <span>Date</span><span>{date}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; font-size: 8px; color: #0b374e;">
        <span>Valable jusqu'au</span><span>{date_expiration}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; font-size: 8px; color: #0b374e;">
        <span>Statut</span><span>{status}</span>
      </div>
    </div>
  </div>

  <div style="display: flex; gap: 12mm; padding: 11mm 15mm 0;">
    <div style="width: 50%; min-height: 45mm; background: #f9fbfb; border: 1px solid #dae5e7; padding: 5mm;">
      <div style="font-size: 9px; font-weight: 800; color: #0b374e; text-transform: uppercase; margin-bottom: 5px;">Vendeur</div>
      <div style="font-size: 8.5px; line-height: 1.55; color: #18252a;">
        <strong>{company_name}</strong><br />
        {company_address}<br />
        {company_city}<br />
        {company_phone}<br />
        {company_email}<br />
        {company_siret_line}
      </div>
    </div>
    <div style="width: 50%; min-height: 45mm; background: #f9fbfb; border: 1px solid #dae5e7; padding: 5mm;">
      <div style="font-size: 9px; font-weight: 800; color: #0b374e; text-transform: uppercase; margin-bottom: 5px;">Client facture</div>
      <div style="font-size: 8.5px; line-height: 1.55; color: #18252a;">
        <strong>{client_nom}</strong><br />
        {client_email}
      </div>
    </div>
  </div>

  {lines_table}

  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; padding: 8mm 15mm 0;">
    <div style="width: 48%; color: #4a5b61; font-size: 8px; line-height: 1.5;">
      <strong>Conditions de reglement</strong><br />
      {payment_terms}<br /><br />
      {footer_note}
    </div>
    <div style="width: 77mm; background: #f3f8f9; border: 1px solid #dae5e7; padding: 6mm;">
      <div style="display: flex; justify-content: space-between; font-size: 9px; color: #1d2d32;">
        <span>Total HT</span><span>{total_ht} EUR</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 9px; color: #1d2d32;">
        <span>TVA</span><span>{total_tva} EUR</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; padding-top: 8px; border-top: 1px solid #dae5e7;">
        <span style="font-size: 12px; font-weight: 800; color: #0b374e;">Total TTC</span>
        <span style="font-size: 12px; font-weight: 800; color: #f95614;">{total_ttc} EUR</span>
      </div>
    </div>
  </div>

  <div style="position: relative; margin: 16mm 15mm 0; padding-top: 4mm; border-top: 1px solid #dee7e8; text-align: center; color: #667378; font-size: 7.5px;">
    RenovBoat - Reparation nautique - Devis genere avec la base graphique Invocean
  </div>
</div>`;

export const QUOTE_TEMPLATE_VARS = [
  ['{company_logo_html}', 'Logo / nom entreprise'],
  ['{company_name}', 'Nom entreprise'],
  ['{company_address}', 'Adresse'],
  ['{company_city}', 'Ville & CP'],
  ['{company_phone}', 'Telephone'],
  ['{company_email}', 'Email entreprise'],
  ['{company_siret}', 'SIRET'],
  ['{company_siret_line}', 'Ligne SIRET'],
  ['{reference}', 'N devis'],
  ['{date}', 'Date emission'],
  ['{date_expiration}', 'Date expiration'],
  ['{status}', 'Statut'],
  ['{vendor}', 'Votre nom'],
  ['{client_nom}', 'Nom client'],
  ['{client_email}', 'Email client'],
  ['{total_ht}', 'Total HT'],
  ['{total_tva}', 'Total TVA'],
  ['{total_ttc}', 'Total TTC'],
  ['{payment_terms}', 'Conditions paiement'],
  ['{footer_note}', 'Pied de page'],
  ['{lines_table}', 'Tableau des produits'],
];

export function isLegacyMobyworkQuoteTemplate(template) {
  const value = String(template || '');
  return value.includes('background: #14213a')
    || value.includes('background:#3b82f6')
    || value.includes('font-weight: bold; color: #3b82f6;">DEVIS');
}

export function getQuoteTemplate(template) {
  const value = String(template || '').trim();
  if (!value || isLegacyMobyworkQuoteTemplate(value)) {
    return INVOCEAN_QUOTE_TEMPLATE;
  }
  return value;
}

export function formatQuoteAmount(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number)
    ? number.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
}

export function formatQuoteMoney(value) {
  return `${formatQuoteAmount(value)} EUR`;
}

export function formatQuoteQuantity(value) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

export function escapeQuoteHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function suiteOrigin() {
  if (typeof window === 'undefined') return '';
  const devPorts = new Set(['3000', '5173', '5174']);
  if (devPorts.has(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}`;
  }
  return window.location.origin;
}

export function getQuoteLogoSrc(settings = {}) {
  const customLogo = String(settings.quote_company_logo || '').trim();
  if (customLogo) return customLogo;
  return `${suiteOrigin()}/Invocean/assets/renovboat-logo-pdf.jpg`;
}

export function buildQuoteLogoHtml(settings = {}) {
  const companyName = escapeQuoteHtml(settings.quote_company_name || 'RenovBoat');
  const src = getQuoteLogoSrc(settings);
  if (!src) {
    return `<div style="font-size: 22px; font-weight: 800; color: #0c2630;">${companyName}</div>`;
  }

  return `<img src="${escapeQuoteHtml(src)}" alt="${companyName}" style="display: block; max-width: 210px; max-height: 78px; object-fit: contain; object-position: left top;" />`;
}

export function buildQuoteLinesTable(lines = []) {
  const rows = Array.isArray(lines) ? lines : [];
  const body = rows.length > 0
    ? rows.map((line, index) => {
      const quantity = Number.parseFloat(line.quantity) || 0;
      const unitPrice = Number.parseFloat(line.unit_price_ht) || 0;
      const taxRate = Number.parseFloat(line.tax_rate) || 0;
      const totalHt = quantity * unitPrice;
      const totalTtc = totalHt * (1 + taxRate / 100);
      const background = index % 2 === 0 ? '#f8fbfb' : '#ffffff';
      const reference = line.product_id ? ` <span style="color:#667378;">- Ref. ${escapeQuoteHtml(line.product_id)}</span>` : '';

      return `<tr style="background: ${background}; border-bottom: 1px solid #dee7e8;">
        <td style="padding: 9px 8px; font-size: 8.5px; color: #1a2428;">${escapeQuoteHtml(line.name || 'Produit')}${reference}</td>
        <td style="padding: 9px 6px; font-size: 8.5px; color: #1a2428; text-align: right;">${formatQuoteQuantity(quantity)}</td>
        <td style="padding: 9px 6px; font-size: 8.5px; color: #1a2428; text-align: right;">${formatQuoteMoney(unitPrice)}</td>
        <td style="padding: 9px 6px; font-size: 8.5px; color: #1a2428; text-align: right;">${formatQuoteMoney(totalHt)}</td>
        <td style="padding: 9px 8px; font-size: 8.5px; color: #1a2428; text-align: right; font-weight: 800;">${formatQuoteMoney(totalTtc)}</td>
      </tr>`;
    }).join('')
    : `<tr style="background:#f8fbfb;border-bottom:1px solid #dee7e8;">
        <td colspan="5" style="padding: 12px 8px; font-size: 8.5px; color: #667378; text-align: center;">Aucune ligne de devis</td>
      </tr>`;

  return `<table style="width: calc(100% - 30mm); margin: 13mm 15mm 0; border-collapse: collapse;">
    <thead>
      <tr style="background: #0b374e; color: #ffffff;">
        <th style="padding: 8px 8px; font-size: 8px; text-align: left; font-weight: 800;">Designation</th>
        <th style="padding: 8px 6px; font-size: 8px; text-align: right; font-weight: 800;">Qte</th>
        <th style="padding: 8px 6px; font-size: 8px; text-align: right; font-weight: 800;">PU HT</th>
        <th style="padding: 8px 6px; font-size: 8px; text-align: right; font-weight: 800;">Total HT</th>
        <th style="padding: 8px 8px; font-size: 8px; text-align: right; font-weight: 800;">Total TTC</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function fillQuoteTemplate(template, settings = {}, quote = {}) {
  const today = new Date();
  const expDate = new Date(today);
  expDate.setDate(expDate.getDate() + (Number.parseInt(settings.quote_validity_days, 10) || 30));
  const fmt = (date) => date.toLocaleDateString('fr-FR');
  const totalHt = Number.parseFloat(quote.total_ht || 0) || 0;
  const totalTtc = Number.parseFloat(quote.total_ttc || 0) || 0;
  const totalTva = totalTtc - totalHt;
  const companySiret = String(settings.quote_company_siret || '').trim();

  const replacements = {
    '{company_logo_html}': buildQuoteLogoHtml(settings),
    '{company_logo_src}': escapeQuoteHtml(getQuoteLogoSrc(settings)),
    '{company_name}': escapeQuoteHtml(settings.quote_company_name || 'RenovBoat'),
    '{company_address}': escapeQuoteHtml(settings.quote_company_address || ''),
    '{company_city}': escapeQuoteHtml(settings.quote_company_city || ''),
    '{company_phone}': escapeQuoteHtml(settings.quote_company_phone || ''),
    '{company_email}': escapeQuoteHtml(settings.quote_company_email || ''),
    '{company_siret}': escapeQuoteHtml(companySiret),
    '{company_siret_line}': companySiret ? `SIRET ${escapeQuoteHtml(companySiret)}` : '',
    '{reference}': escapeQuoteHtml(quote.reference || 'Brouillon'),
    '{date}': fmt(today),
    '{date_expiration}': fmt(expDate),
    '{status}': escapeQuoteHtml(quote.status || 'Brouillon'),
    '{vendor}': escapeQuoteHtml(settings.nom || ''),
    '{client_nom}': escapeQuoteHtml(quote.client_name || ''),
    '{client_email}': escapeQuoteHtml(quote.client_email || ''),
    '{total_ht}': formatQuoteAmount(totalHt),
    '{total_tva}': formatQuoteAmount(totalTva),
    '{total_ttc}': formatQuoteAmount(totalTtc),
    '{payment_terms}': escapeQuoteHtml(settings.quote_payment_terms || 'Virement bancaire a 30 jours'),
    '{footer_note}': escapeQuoteHtml(settings.quote_footer_note || 'Merci de votre confiance.'),
    '{lines_table}': buildQuoteLinesTable(quote.lines || []),
  };

  return Object.entries(replacements).reduce(
    (html, [token, value]) => html.split(token).join(value),
    getQuoteTemplate(template)
  );
}

export function buildQuotePreviewHtml(settings = {}) {
  return fillQuoteTemplate(getQuoteTemplate(settings.quote_html_template), settings, {
    reference: 'DEV-2026-0001',
    status: 'Brouillon',
    client_name: 'Marine Equipement',
    client_email: 'contact@marine-equip.fr',
    total_ht: 153.60,
    total_ttc: 184.32,
    lines: [
      {
        product_id: 'RB-LW44ST',
        name: 'Winch Lewmar 44ST inox',
        quantity: 1,
        unit_price_ht: 153.60,
        tax_rate: 20,
      },
    ],
  });
}
