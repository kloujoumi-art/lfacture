const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle,
  ShadingType, HeadingLevel, VerticalAlign, TableLayoutType,
} = require('docx');
const Invoice = require('../models/Invoice');
const { db } = require('../database/db');

function getSettings(userId) {
  return db.get('settings').find({ user_id: Number(userId) }).value() || {};
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
}

function dateStr(s) {
  return s ? new Date(s).toLocaleDateString('fr-FR') : '';
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

// Lighten a hex color toward white by factor (0=same, 1=white)
function lightenHex(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  const toHex = v => Math.round(v + (255 - v) * factor).toString(16).padStart(2, '0');
  return toHex(r) + toHex(g) + toHex(b);
}

function accentForTemplate(tpl) {
  const map = {
    classic: '4F46E5', minimal: '111827', blue: '1d4ed8', green: '059669',
    orange: 'f97316', red: 'dc2626', navy: '0f172a', slate: '334155', creative: '9333ea',
  };
  return map[tpl] || '4F46E5';
}

function infoCell(label, lines) {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 18, color: '374151', allCaps: true })],
      spacing: { after: 40 },
    }),
    ...lines.filter(Boolean).map((l, i) =>
      new Paragraph({
        children: [new TextRun({ text: l, size: i === 0 ? 22 : 18, bold: i === 0, color: '1e293b' })],
        spacing: { after: 20 },
      })
    ),
  ];
  return new TableCell({
    children,
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
  });
}

class WordController {
  static async download(req, res) {
    try {
      const invoice = Invoice.findById(req.params.id);
      if (!invoice || invoice.user_id !== req.user.id) return res.status(404).send('Document introuvable.');

      const settings = getSettings(req.user.id);
      const tplRaw = invoice.template || 'classic';
      const tpl = tplRaw === 'modern' ? 'classic' : tplRaw;
      const accent = accentForTemplate(tpl);
      const accentLight = lightenHex('#' + accent, 0.88).toUpperCase();
      const accentLighter = lightenHex('#' + accent, 0.95).toUpperCase();

      const docType = invoice.type === 'invoice' ? 'FACTURE' : 'DEVIS';
      const companyName = settings.company_name || 'Mon Entreprise';

      // ── HEADER ─────────────────────────────────────────────────────────────
      const headerTable = new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
        },
        rows: [new TableRow({
          children: [
            // Left — company
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: companyName, bold: true, size: 36, color: 'FFFFFF' })],
                  spacing: { after: 60 },
                }),
                ...(settings.company_address ? [new Paragraph({
                  children: [new TextRun({ text: settings.company_address, size: 18, color: 'D0D4F8' })],
                  spacing: { after: 30 },
                })] : []),
                ...(settings.company_city ? [new Paragraph({
                  children: [new TextRun({ text: (settings.company_postal || '') + ' ' + settings.company_city, size: 18, color: 'D0D4F8' })],
                  spacing: { after: 30 },
                })] : []),
                ...(settings.company_siret ? [new Paragraph({
                  children: [new TextRun({ text: 'SIRET : ' + settings.company_siret, size: 16, color: 'B0B4E8' })],
                })] : []),
              ],
              width: { size: 55, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: accent },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              },
              margins: { top: 300, bottom: 300, left: 400, right: 300 },
              verticalAlign: VerticalAlign.CENTER,
            }),
            // Right — invoice details
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: docType, bold: true, size: 52, color: accent })],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 60 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: invoice.invoice_number, bold: true, size: 24, color: '374151' })],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 60 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'Date : ', bold: true, size: 19, color: '374151' }), new TextRun({ text: dateStr(invoice.issue_date), size: 19, color: '374151' })],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 40 },
                }),
                ...(invoice.due_date ? [new Paragraph({
                  children: [new TextRun({ text: 'Échéance : ', bold: true, size: 19, color: '374151' }), new TextRun({ text: dateStr(invoice.due_date), size: 19, color: '374151' })],
                  alignment: AlignmentType.RIGHT,
                })] : []),
              ],
              width: { size: 45, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: 'F8FAFC' },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              },
              margins: { top: 300, bottom: 300, left: 300, right: 400 },
              verticalAlign: VerticalAlign.CENTER,
            }),
          ],
        })],
      });

      // ── ÉMETTEUR / DESTINATAIRE ─────────────────────────────────────────────
      const emetteurLines = [
        companyName,
        settings.company_address,
        settings.company_city ? (settings.company_postal || '') + ' ' + settings.company_city : null,
        settings.company_siret ? 'SIRET : ' + settings.company_siret : null,
        settings.company_tva ? 'N° TVA : ' + settings.company_tva : null,
      ].filter(Boolean);

      const clientLines = [
        invoice.client_name,
        invoice.client_company,
        invoice.client_address,
        invoice.client_city ? (invoice.client_postal || '') + ' ' + invoice.client_city : null,
      ].filter(Boolean);

      const infoRow = new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
        },
        rows: [new TableRow({
          children: [
            infoCell('Émetteur', emetteurLines),
            infoCell('Facturé à', clientLines.length ? clientLines : ['—']),
          ],
        })],
      });

      // ── ITEMS TABLE ─────────────────────────────────────────────────────────
      const colWidths = [45, 8, 14, 10, 11, 12]; // %

      function th(text, align = AlignmentType.LEFT) {
        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 18, color: 'FFFFFF' })],
            alignment: align,
          })],
          shading: { type: ShadingType.SOLID, color: accent },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
        });
      }

      function td(text, align = AlignmentType.LEFT, isLast = false, rowEven = false) {
        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: text || '', size: 19, color: isLast ? accent : '1e293b', bold: isLast })],
            alignment: align,
          })],
          shading: rowEven ? { type: ShadingType.SOLID, color: 'F9FAFB' } : undefined,
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'F1F5F9' },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
        });
      }

      const items = invoice.items || [];
      const itemRows = items.length > 0 ? items.map((item, i) => new TableRow({
        children: [
          td(item.description || '', AlignmentType.LEFT, false, i % 2 === 1),
          td(String(item.quantity || ''), AlignmentType.CENTER, false, i % 2 === 1),
          td(fmt(item.unit_price), AlignmentType.RIGHT, false, i % 2 === 1),
          td((item.tva_rate || 0) + '%', AlignmentType.CENTER, false, i % 2 === 1),
          td(fmt((item.unit_price || 0) * (item.quantity || 1)), AlignmentType.RIGHT, false, i % 2 === 1),
          td(fmt(item.total), AlignmentType.RIGHT, true, i % 2 === 1),
        ],
      })) : [new TableRow({
        children: [new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Aucune ligne', size: 18, color: '94a3b8', italics: true })], alignment: AlignmentType.CENTER })],
          columnSpan: 6,
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          margins: { top: 160, bottom: 160 },
        })],
      })];

      const itemsTable = new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
        },
        columnWidths: colWidths.map(p => Math.round(p * 90.72)), // 9072 twips = 100%
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              th('Description', AlignmentType.LEFT),
              th('Qté', AlignmentType.CENTER),
              th('PU HT', AlignmentType.RIGHT),
              th('TVA', AlignmentType.CENTER),
              th('Total HT', AlignmentType.RIGHT),
              th('TTC', AlignmentType.RIGHT),
            ],
          }),
          ...itemRows,
        ],
      });

      // ── TOTAUX ──────────────────────────────────────────────────────────────
      function totalRow(label, value, isLast = false) {
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: label, bold: isLast, size: isLast ? 22 : 19, color: isLast ? 'FFFFFF' : '1e293b' })],
                alignment: AlignmentType.LEFT,
              })],
              shading: isLast ? { type: ShadingType.SOLID, color: accent } : { type: ShadingType.SOLID, color: isLast ? accent : 'F9FAFB' },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: value, bold: true, size: isLast ? 24 : 19, color: isLast ? 'FFFFFF' : '1e293b' })],
                alignment: AlignmentType.RIGHT,
              })],
              shading: isLast ? { type: ShadingType.SOLID, color: accent } : { type: ShadingType.SOLID, color: isLast ? accent : 'F9FAFB' },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
          ],
        });
      }

      const totalsTable = new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 38, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: accent },
          bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
        },
        float: { horizontalAnchor: 'text', absoluteHorizontalPosition: 'right' },
        rows: [
          totalRow('Sous-total HT', fmt(invoice.subtotal)),
          totalRow('TVA', fmt(invoice.tva_amount)),
          totalRow('TOTAL TTC', fmt(invoice.total), true),
        ],
      });

      // ── FOOTER ──────────────────────────────────────────────────────────────
      const footerTable = new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: accent },
          bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
        },
        rows: [new TableRow({
          children: [
            // Conditions
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Conditions : ', bold: true, size: 19, color: '1e293b' }),
                    new TextRun({ text: invoice.payment_terms || 'Paiement à 30 jours', size: 19, color: '1e293b' }),
                  ],
                  spacing: { after: 60 },
                }),
                ...(invoice.notes ? [new Paragraph({ children: [new TextRun({ text: invoice.notes, size: 18, color: '1e293b', italics: true })], spacing: { after: 60 } })] : []),
                ...(settings.company_siret ? [new Paragraph({ children: [new TextRun({ text: 'SIRET : ' + settings.company_siret + (settings.company_tva ? ' · N° TVA : ' + settings.company_tva : ''), size: 17, color: '374151' })] })] : []),
              ],
              width: { size: 55, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              margins: { top: 200, bottom: 200, left: 0, right: 200 },
            }),
            // Coordonnées bancaires
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'COORDONNÉES BANCAIRES', bold: true, size: 17, color: accent, allCaps: true })],
                  alignment: AlignmentType.RIGHT, spacing: { after: 60 },
                }),
                ...(settings.bank_name ? [new Paragraph({ children: [new TextRun({ text: settings.bank_name, bold: true, size: 19, color: '374151' })], alignment: AlignmentType.RIGHT, spacing: { after: 40 } })] : []),
                ...(settings.bank_iban ? [new Paragraph({ children: [new TextRun({ text: settings.bank_iban, size: 18, color: '374151', font: 'Courier New' })], alignment: AlignmentType.RIGHT, spacing: { after: 40 } })] : []),
                ...(settings.bank_bic ? [new Paragraph({ children: [new TextRun({ text: 'BIC : ' + settings.bank_bic, size: 18, color: '374151', font: 'Courier New' })], alignment: AlignmentType.RIGHT })] : []),
                ...(!settings.bank_iban && !settings.bank_name ? [new Paragraph({ children: [new TextRun({ text: 'À configurer dans les paramètres', size: 17, color: 'd1d5db', italics: true })], alignment: AlignmentType.RIGHT })] : []),
              ],
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              margins: { top: 200, bottom: 200, left: 200, right: 0 },
            }),
          ],
        })],
      });

      // ── DOCUMENT ASSEMBLY ───────────────────────────────────────────────────
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: 'Calibri', size: 20, color: '1e293b' },
            },
          },
        },
        sections: [{
          properties: {
            page: {
              margin: { top: 720, bottom: 720, left: 900, right: 900 },
            },
          },
          children: [
            headerTable,
            new Paragraph({ text: '', spacing: { after: 280 } }),
            infoRow,
            new Paragraph({ text: '', spacing: { after: 280 } }),
            itemsTable,
            new Paragraph({ text: '', spacing: { after: 140 } }),
            // totals right-aligned using indented paragraph + table trick
            new Table({
              layout: TableLayoutType.FIXED,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
              },
              rows: [new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph('')],
                    width: { size: 62, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  }),
                  new TableCell({
                    children: [totalsTable],
                    width: { size: 38, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  }),
                ],
              })],
            }),
            new Paragraph({ text: '', spacing: { after: 360 } }),
            footerTable,
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);

      const filename = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('[Word] Error:', err);
      res.status(500).send('Erreur lors de la génération du fichier Word.');
    }
  }
}

module.exports = WordController;
