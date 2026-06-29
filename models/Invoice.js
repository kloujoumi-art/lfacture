const { db, nextId } = require('../database/db');

class Invoice {
  static generateNumber(userId, type) {
    const settings = db.get('settings').find({ user_id: Number(userId) }).value();
    const prefix = type === 'invoice' ? (settings?.invoice_prefix || 'FAC') : (settings?.quote_prefix || 'DEV');
    const year = new Date().getFullYear();

    let counter = 1;
    if (settings) {
      const key = type === 'invoice' ? 'invoice_counter' : 'quote_counter';
      counter = settings[key] || 1;
      db.get('settings').find({ user_id: Number(userId) }).assign({ [key]: counter + 1 }).write();
    } else {
      db.get('settings').push({
        id: nextId('settings'),
        user_id: Number(userId),
        invoice_counter: 2,
        quote_counter: 2,
        invoice_prefix: 'FAC',
        quote_prefix: 'DEV',
        default_tva: 20,
        payment_terms: 'Paiement à 30 jours',
      }).write();
    }

    return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
  }

  static create(data) {
    const { user_id, client_id, type, issue_date, due_date, notes, payment_terms, template, items } = data;
    const invoice_number = this.generateNumber(user_id, type);

    let subtotal = 0, tva_amount = 0;
    const processedItems = [];

    if (items && items.length > 0) {
      items.forEach(item => {
        const lineHT = (item.quantity || 1) * (item.unit_price || 0);
        const lineTVA = lineHT * ((item.tva_rate || 20) / 100);
        const lineTTC = lineHT + lineTVA;
        subtotal += lineHT;
        tva_amount += lineTVA;
        processedItems.push({
          id: nextId('invoice_item'),
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          tva_rate: item.tva_rate || 20,
          total: lineTTC,
        });
      });
    }

    const invoice = {
      id: nextId('invoice'),
      user_id: Number(user_id),
      client_id: client_id ? Number(client_id) : null,
      invoice_number,
      type: type || 'invoice',
      status: 'draft',
      issue_date: issue_date || new Date().toISOString().split('T')[0],
      due_date: due_date || null,
      subtotal,
      tva_amount,
      total: subtotal + tva_amount,
      notes: notes || null,
      payment_terms: payment_terms || null,
      template: template || 'classic',
      items: processedItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.get('invoices').push(invoice).write();
    return this.findById(invoice.id);
  }

  static findById(id) {
    const invoice = db.get('invoices').find({ id: Number(id) }).value();
    if (!invoice) return null;

    const client = invoice.client_id ? db.get('clients').find({ id: invoice.client_id }).value() : null;
    return {
      ...invoice,
      client_name: client?.name || null,
      client_email: client?.email || null,
      client_address: client?.address || null,
      client_city: client?.city || null,
      client_postal: client?.postal_code || null,
      client_country: client?.country || null,
      client_company: client?.company || null,
      client_siret: client?.siret || null,
      client_tva: client?.tva || null,
      client_logo: client?.logo || null,
    };
  }

  static findByUser(userId, type = null, status = null) {
    let collection = db.get('invoices').filter({ user_id: Number(userId) });
    if (type) collection = collection.filter({ type });
    if (status) collection = collection.filter({ status });

    return collection.sortBy(i => -new Date(i.created_at).getTime()).map(invoice => {
      const client = invoice.client_id ? db.get('clients').find({ id: invoice.client_id }).value() : null;
      return { ...invoice, client_name: client?.name || null };
    }).value();
  }

  static updateStatus(id, status) {
    db.get('invoices').find({ id: Number(id) }).assign({ status, updated_at: new Date().toISOString() }).write();
  }

  static delete(id) {
    db.get('invoices').remove({ id: Number(id) }).write();
  }

  static getRecentByUser(userId, limit = 5) {
    return db.get('invoices')
      .filter({ user_id: Number(userId) })
      .sortBy(i => -new Date(i.created_at).getTime())
      .take(limit)
      .map(invoice => {
        const client = invoice.client_id ? db.get('clients').find({ id: invoice.client_id }).value() : null;
        return { ...invoice, client_name: client?.name || null };
      })
      .value();
  }
}

module.exports = Invoice;
