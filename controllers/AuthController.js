const User = require('../models/User');
const EmailService = require('../services/EmailService');
const { db, nextId } = require('../database/db');

class AuthController {
  static showRegister(req, res) {
    res.renderLayout('auth/register', { title: 'Créer un compte — LFacture', errors: [], old: {} });
  }

  static async register(req, res) {
    const { name, email, password, password_confirm } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) errors.push('Le nom doit contenir au moins 2 caractères.');
    if (!email || !email.includes('@')) errors.push('Adresse email invalide.');
    if (!password || password.length < 8) errors.push('Le mot de passe doit contenir au moins 8 caractères.');
    if (password !== password_confirm) errors.push('Les mots de passe ne correspondent pas.');

    if (errors.length > 0) {
      return res.renderLayout('auth/register', { title: 'Créer un compte — LFacture', errors, old: { name, email } });
    }

    const existing = User.findByEmail(email);
    if (existing) {
      return res.renderLayout('auth/register', { title: 'Créer un compte — LFacture', errors: ['Cet email est déjà utilisé.'], old: { name, email } });
    }

    try {
      const user = User.create({ name: name.trim(), email: email.toLowerCase().trim(), password });

      // Initialise les paramètres par défaut
      db.get('settings').push({
        id: nextId('settings'),
        user_id: user.id,
        invoice_prefix: 'FAC',
        quote_prefix: 'DEV',
        invoice_counter: 1,
        quote_counter: 1,
        default_tva: 20,
        payment_terms: 'Paiement à 30 jours',
      }).write();

      req.session.userId = user.id;

      EmailService.sendWelcomeEmail(user, password).catch(() => {});

      req.flash('success', `Bienvenue ${user.name} ! Votre essai gratuit de 7 jours est activé.`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      return res.renderLayout('auth/register', { title: 'Créer un compte — LFacture', errors: ['Erreur lors de la création du compte. Réessayez.'], old: { name, email } });
    }
  }

  static showLogin(req, res) {
    res.renderLayout('auth/login', { title: 'Connexion — LFacture' });
  }

  static login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error', 'Veuillez remplir tous les champs.');
      return res.redirect('/login');
    }

    const user = User.findByEmail(email.toLowerCase().trim());
    if (!user || !User.verifyPassword(password, user.password)) {
      req.flash('error', 'Email ou mot de passe incorrect.');
      return res.redirect('/login');
    }

    req.session.userId = user.id;
    req.flash('success', `Bon retour, ${user.name} !`);
    res.redirect('/dashboard');
  }

  static logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
}

module.exports = AuthController;
