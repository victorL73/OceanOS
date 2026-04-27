const fs = require('fs');
const path = require('path');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MM = 72 / 25.4;

function mm(value) {
    return value * MM;
}

function yTop(value) {
    return PAGE_H - mm(value);
}

function color([r, g, b]) {
    return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
}

function asciiText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function pdfEscape(value) {
    return asciiText(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function safeFilename(value) {
    return asciiText(value || 'devis')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120) || 'devis';
}

function formatMoney(value) {
    const amount = Number.parseFloat(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    return `${safe.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function formatQuantity(value) {
    const qty = Number.parseFloat(value);
    if (!Number.isFinite(qty)) return '0';
    return qty.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function estimateWidth(text, size) {
    return asciiText(text).length * size * 0.48;
}

function wrapText(text, maxChars) {
    const words = asciiText(text || '').split(' ').filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

class PdfCanvas {
    constructor() {
        this.pages = [];
        this.current = '';
    }

    addPage() {
        if (this.current) this.pages.push(this.current);
        this.current = '';
    }

    finish() {
        if (this.current || this.pages.length === 0) this.pages.push(this.current);
        return buildPdf(this.pages);
    }

    fill(rgb) {
        this.current += `${color(rgb)} rg\n`;
    }

    stroke(rgb) {
        this.current += `${color(rgb)} RG\n`;
    }

    lineWidth(width) {
        this.current += `${width.toFixed(2)} w\n`;
    }

    rect(x, y, w, h, mode = 'F') {
        this.current += `${mm(x).toFixed(2)} ${(PAGE_H - mm(y + h)).toFixed(2)} ${mm(w).toFixed(2)} ${mm(h).toFixed(2)} re ${mode}\n`;
    }

    line(x1, y1, x2, y2) {
        this.current += `${mm(x1).toFixed(2)} ${yTop(y1).toFixed(2)} m ${mm(x2).toFixed(2)} ${yTop(y2).toFixed(2)} l S\n`;
    }

    text(x, y, value, size = 9, font = 'F1', rgb = [26, 36, 40]) {
        this.fill(rgb);
        this.current += `BT /${font} ${size.toFixed(1)} Tf 1 0 0 1 ${mm(x).toFixed(2)} ${yTop(y).toFixed(2)} Tm (${pdfEscape(value)}) Tj ET\n`;
    }

    textRight(x, y, value, size = 9, font = 'F1', rgb = [26, 36, 40]) {
        const xPt = mm(x) - estimateWidth(value, size);
        this.fill(rgb);
        this.current += `BT /${font} ${size.toFixed(1)} Tf 1 0 0 1 ${xPt.toFixed(2)} ${yTop(y).toFixed(2)} Tm (${pdfEscape(value)}) Tj ET\n`;
    }
}

function buildPdf(pageStreams) {
    const objects = [null, null];
    const addObject = (body) => {
        objects.push(body);
        return objects.length;
    };
    const setObject = (id, body) => {
        objects[id - 1] = body;
    };

    setObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const regularFont = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFont = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const pageIds = [];
    for (const stream of pageStreams) {
        const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
        const pageId = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${contentId} 0 R >>`);
        pageIds.push(pageId);
    }
    setObject(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((body, index) => {
        offsets[index + 1] = Buffer.byteLength(pdf, 'latin1');
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'latin1');
}

function buildSellerLines(settings) {
    return [
        settings.quote_company_name || 'RenovBoat',
        settings.quote_company_address,
        settings.quote_company_city,
        settings.quote_company_phone,
        settings.quote_company_email,
        settings.quote_company_siret ? `SIRET ${settings.quote_company_siret}` : '',
    ].filter((line) => asciiText(line) !== '');
}

function buildBuyerLines(quote) {
    return [
        quote.client_name || 'Client',
        quote.client_email,
    ].filter((line) => asciiText(line) !== '');
}

function drawHeader(pdf, quote, settings) {
    const company = settings.quote_company_name || 'RenovBoat';
    const reference = quote.reference || 'Brouillon';
    const date = new Date(quote.date_created || Date.now()).toLocaleDateString('fr-FR');
    const validity = new Date(Date.now() + (Number.parseInt(settings.quote_validity_days, 10) || 30) * 86400000).toLocaleDateString('fr-FR');

    pdf.text(15, 21, company, 18, 'F2', [12, 38, 48]);
    pdf.text(15, 28, 'Reparation nautique', 9, 'F1', [84, 100, 106]);
    pdf.stroke([14, 59, 83]);
    pdf.lineWidth(0.8);
    pdf.line(15, 43, 195, 43);

    pdf.textRight(195, 22, 'DEVIS', 25, 'F2', [12, 38, 48]);
    pdf.textRight(195, 29, 'PROPOSITION COMMERCIALE', 10, 'F2', [249, 86, 20]);
    pdf.textRight(195, 36, 'Document genere par Mobywork', 8, 'F1', [84, 100, 106]);

    pdf.fill([243, 248, 249]);
    pdf.stroke([218, 229, 231]);
    pdf.rect(120, 48, 75, 33, 'B');
    pdf.text(126, 58, 'Numero', 9, 'F2', [11, 55, 78]);
    pdf.textRight(189, 58, reference, 12, 'F2', [11, 55, 78]);
    pdf.text(126, 65, 'Date', 8, 'F1', [11, 55, 78]);
    pdf.textRight(189, 65, date, 8, 'F1', [11, 55, 78]);
    pdf.text(126, 71, 'Valable', 8, 'F1', [11, 55, 78]);
    pdf.textRight(189, 71, validity, 8, 'F1', [11, 55, 78]);
    pdf.text(126, 77, 'Statut', 8, 'F1', [11, 55, 78]);
    pdf.textRight(189, 77, quote.status || 'Brouillon', 8, 'F1', [11, 55, 78]);
}

function drawPartyBox(pdf, x, y, title, lines) {
    pdf.fill([249, 251, 251]);
    pdf.stroke([218, 229, 231]);
    pdf.rect(x, y, 84, 45, 'B');
    pdf.text(x + 5, y + 10, title.toUpperCase(), 9, 'F2', [11, 55, 78]);
    let cursor = y + 17;
    lines.slice(0, 5).forEach((line, index) => {
        pdf.text(x + 5, cursor, line, index === 0 ? 8.8 : 8.2, index === 0 ? 'F2' : 'F1', [24, 37, 42]);
        cursor += 5;
    });
}

function drawTableHeader(pdf, y) {
    const x = 15;
    const widths = [82, 16, 26, 28, 28];
    const labels = ['Designation', 'Qte', 'PU HT', 'Total HT', 'Total TTC'];
    pdf.fill([11, 55, 78]);
    pdf.rect(x, y, 180, 8, 'F');
    let colX = x;
    labels.forEach((label, index) => {
        if (index === 0) pdf.text(colX + 2, y + 5.4, label, 8, 'F2', [255, 255, 255]);
        else pdf.textRight(colX + widths[index] - 2, y + 5.4, label, 8, 'F2', [255, 255, 255]);
        colX += widths[index];
    });
}

function generateQuotePdf(quote, settings = {}) {
    const storageDir = path.join(__dirname, '..', '..', 'storage', 'quotes');
    fs.mkdirSync(storageDir, { recursive: true });

    const reference = quote.reference || `DEV-${Date.now()}`;
    const filename = `${safeFilename(reference)}.pdf`;
    const absolutePath = path.join(storageDir, filename);
    const relativePath = `storage/quotes/${filename}`;

    const pdf = new PdfCanvas();
    pdf.addPage();
    drawHeader(pdf, quote, settings);
    drawPartyBox(pdf, 15, 92, 'Vendeur', buildSellerLines(settings));
    drawPartyBox(pdf, 111, 92, 'Client facture', buildBuyerLines(quote));

    let y = 150;
    drawTableHeader(pdf, y);
    y += 8;
    const widths = [82, 16, 26, 28, 28];
    const lines = Array.isArray(quote.lines) ? quote.lines : [];
    lines.forEach((line, index) => {
        const quantity = Number.parseFloat(line.quantity) || 0;
        const unitPrice = Number.parseFloat(line.unit_price_ht) || 0;
        const taxRate = Number.parseFloat(line.tax_rate) || 0;
        const totalHt = quantity * unitPrice;
        const totalTtc = totalHt * (1 + taxRate / 100);
        const label = line.product_id ? `${line.name || 'Produit'} - Ref. ${line.product_id}` : (line.name || 'Produit');
        const labelLines = wrapText(label, 44);
        const rowHeight = Math.max(10, labelLines.length * 5 + 4);

        if (y + rowHeight > 244) {
            pdf.addPage();
            drawHeader(pdf, quote, settings);
            y = 92;
            drawTableHeader(pdf, y);
            y += 8;
        }

        if (index % 2 === 0) {
            pdf.fill([248, 251, 251]);
            pdf.rect(15, y, 180, rowHeight, 'F');
        }
        pdf.stroke([222, 231, 232]);
        pdf.lineWidth(0.25);
        pdf.line(15, y + rowHeight, 195, y + rowHeight);

        labelLines.slice(0, 4).forEach((labelLine, lineIndex) => {
            pdf.text(17, y + 5 + lineIndex * 5, labelLine, 8.2, 'F1', [26, 36, 40]);
        });
        pdf.textRight(15 + widths[0] + widths[1] - 2, y + 6, formatQuantity(quantity), 8.2, 'F1', [26, 36, 40]);
        pdf.textRight(15 + widths[0] + widths[1] + widths[2] - 2, y + 6, formatMoney(unitPrice), 8.2, 'F1', [26, 36, 40]);
        pdf.textRight(15 + widths[0] + widths[1] + widths[2] + widths[3] - 2, y + 6, formatMoney(totalHt), 8.2, 'F1', [26, 36, 40]);
        pdf.textRight(193, y + 6, formatMoney(totalTtc), 8.2, 'F2', [26, 36, 40]);
        y += rowHeight;
    });

    if (lines.length === 0) {
        pdf.fill([248, 251, 251]);
        pdf.rect(15, y, 180, 12, 'F');
        pdf.text(74, y + 7.5, 'Aucune ligne de devis', 8.5, 'F1', [102, 115, 120]);
        y += 12;
    }

    let totalY = Math.max(y + 12, 220);
    if (totalY > 244) {
        pdf.addPage();
        drawHeader(pdf, quote, settings);
        totalY = 92;
    }

    const totalHt = Number.parseFloat(quote.total_ht || 0) || 0;
    const totalTtc = Number.parseFloat(quote.total_ttc || 0) || 0;
    const totalVat = Math.max(0, totalTtc - totalHt);
    pdf.text(15, totalY + 5, 'Conditions de reglement', 8.2, 'F2', [74, 91, 97]);
    wrapText(settings.quote_payment_terms || 'Virement bancaire a 30 jours', 44).slice(0, 3).forEach((line, index) => {
        pdf.text(15, totalY + 11 + index * 4.5, line, 8, 'F1', [74, 91, 97]);
    });

    pdf.fill([243, 248, 249]);
    pdf.stroke([218, 229, 231]);
    pdf.rect(118, totalY, 77, 40, 'B');
    pdf.text(124, totalY + 11, 'Total HT', 9, 'F1', [29, 45, 50]);
    pdf.textRight(188, totalY + 11, formatMoney(totalHt), 9, 'F1', [29, 45, 50]);
    pdf.text(124, totalY + 18, 'TVA', 9, 'F1', [29, 45, 50]);
    pdf.textRight(188, totalY + 18, formatMoney(totalVat), 9, 'F1', [29, 45, 50]);
    pdf.text(124, totalY + 28, 'Total TTC', 12, 'F2', [11, 55, 78]);
    pdf.textRight(188, totalY + 28, formatMoney(totalTtc), 12, 'F2', [249, 86, 20]);

    pdf.stroke([222, 231, 232]);
    pdf.line(15, 281, 195, 281);
    pdf.text(47, 287, 'RenovBoat - Reparation nautique - Devis genere avec la base graphique Invocean', 7.5, 'F1', [102, 115, 120]);

    fs.writeFileSync(absolutePath, pdf.finish());
    return { absolutePath, relativePath, filename };
}

module.exports = {
    generateQuotePdf,
};
