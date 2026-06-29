require('dotenv').config();
const { db } = require('../database/db');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-admin.js votre@email.com');
  process.exit(1);
}

const user = db.get('users').find(u => u.email === email.toLowerCase()).value();
if (!user) {
  console.error(`Utilisateur "${email}" introuvable. Créez d'abord un compte sur /register`);
  process.exit(1);
}

db.get('users').find({ id: user.id }).assign({ is_admin: 1 }).write();
console.log(`✅ ${user.name} (${user.email}) est maintenant administrateur.`);
console.log(`   Accédez au panel : http://localhost:3000/admin`);
