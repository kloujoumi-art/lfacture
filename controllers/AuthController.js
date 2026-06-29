const User = require('../models/User');
const EmailService = require('../services/EmailService');
const FunnelService = require('../services/FunnelService');
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

      // Paramètres par défaut
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

      // Envoi du code OTP — si échec SMTP, on stocke l'erreur pour l'afficher
      let emailSent = false;
      try {
        await FunnelService.sendVerificationEmail(user);
        emailSent = true;
      } catch (smtpErr) {
        console.error('[Auth] SMTP error during registration:', smtpErr.message);
      }

      res.renderLayout('auth/verify-pending', {
        title: 'Vérifiez votre email — LFacture',
        email: user.email,
        name: user.name,
        emailSent,
      });
    } catch (err) {
      console.error('Registration error:', err);
      return res.renderLayout('auth/register', { title: 'Créer un compte — LFacture', errors: ['Erreur lors de la création du compte. Réessayez.'], old: { name, email } });
    }
  }

  // GET /verify-email — affiche le formulaire de saisie du code
  static showVerifyEmail(req, res) {
    const { email } = req.query;
    res.renderLayout('auth/verify-pending', {
      title: 'Vérifiez votre email — LFacture',
      email: email || '',
      name: '',
    });
  }

  // POST /verify-email — vérifie le code OTP saisi
  static async verifyEmail(req, res) {
    const digits = ['d1','d2','d3','d4','d5','d6'].map(k => req.body[k] || '').join('');
    const code = (req.body.code || digits).replace(/\s/g, '');
    const email = (req.body.email || '').toLowerCase().trim();

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.renderLayout('auth/verify-pending', {
        title: 'Vérifiez votre email — LFacture',
        email,
        name: '',
        error: 'Veuillez saisir le code complet à 6 chiffres.',
      });
    }

    const result = User.verifyEmail(code);

    if (result.error === 'expired') {
      return res.renderLayout('auth/verify-pending', {
        title: 'Vérifiez votre email — LFacture',
        email,
        name: '',
        error: 'Ce code a expiré. Cliquez sur "Renvoyer le code" pour en recevoir un nouveau.',
      });
    }

    if (result.error === 'invalid') {
      return res.renderLayout('auth/verify-pending', {
        title: 'Vérifiez votre email — LFacture',
        email,
        name: '',
        error: 'Code incorrect. Vérifiez votre email et réessayez.',
      });
    }

    const user = result.user;
    FunnelService.addToContacts(user);
    FunnelService.sendWelcomeEmail(user).catch(() => {});
    req.session.userId = user.id;
    req.flash('success', `Email vérifié ! Bienvenue ${user.name} — votre plan gratuit est activé.`);
    res.redirect('/dashboard');
  }

  // POST /verify-email/resend — renvoie un nouveau code
  static async resendCode(req, res) {
    const email = (req.body.email || '').toLowerCase().trim();
    const user = User.refreshOTP(email);
    if (user) {
      FunnelService.sendVerificationEmail(user).catch(() => {});
    }
    // Toujours répondre la même chose (sécurité)
    res.renderLayout('auth/verify-pending', {
      title: 'Vérifiez votre email — LFacture',
      email,
      name: user ? user.name : '',
      success: 'Un nouveau code a été envoyé à votre adresse email.',
    });
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

  // GET /auth/magic/:token — connexion directe via lien magique (envoyé par admin)
  static loginWithMagicToken(req, res) {
    const { token } = req.params;
    const user = User.findByMagicToken(token);
    if (!user) {
      req.flash('error', 'Ce lien de connexion est invalide ou a expiré.');
      return res.redirect('/login');
    }
    User.clearMagicToken(user.id);
    req.session.userId = user.id;
    req.flash('success', `Bienvenue ${user.name} !`);
    res.redirect('/dashboard');
  }

  static logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
}

module.exports = AuthController;
