const { db, nextId } = require('../database/db');

class Client {
  static create(data) {
    const client = {
      id: nextId('client'),
      user_id: Number(data.user_id),
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      postal_code: data.postal_code || null,
      country: data.country || 'France',
      company: data.company || null,
      siret: data.siret || null,
      tva: data.tva || null,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
    };
    db.get('clients').push(client).write();
    return client;
  }

  static findById(id) {
    return db.get('clients').find({ id: Number(id) }).value() || null;
  }

  static findByUser(userId) {
    return db.get('clients')
      .filter({ user_id: Number(userId) })
      .sortBy('name')
      .value();
  }

  static update(id, data) {
    db.get('clients').find({ id: Number(id) }).assign({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      postal_code: data.postal_code || null,
      country: data.country || 'France',
      company: data.company || null,
      siret: data.siret || null,
      tva: data.tva || null,
      notes: data.notes || null,
    }).write();
  }

  static delete(id) {
    db.get('clients').remove({ id: Number(id) }).write();
  }
}

module.exports = Client;
