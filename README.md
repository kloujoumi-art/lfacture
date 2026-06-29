# LFacture — SaaS de facturation

**Créez vos factures et devis en quelques secondes.**

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et configurer l'environnement
copy .env.example .env
# Éditez .env avec vos paramètres SMTP

# 3. Lancer le serveur
npm start
# → http://localhost:3000
```

## Structure du projet

```
LFATCURE/
├── server.js              # Point d'entrée Express
├── .env                   # Configuration (SMTP, session, etc.)
├── database/
│   ├── db.js              # Mini-ORM JSON (aucune compilation native)
│   └── lfacture.json      # Base de données (auto-créée au premier lancement)
├── models/
│   ├── User.js
│   ├── Client.js
│   └── Invoice.js
├── controllers/
│   ├── AuthController.js
│   └── DashboardController.js
├── services/
│   └── EmailService.js    # Emails automatiques (Nodemailer)
├── middleware/
│   └── auth.js            # Protection des routes
├── routes/
│   └── web.js             # Toutes les routes
├── views/
│   ├── layouts/
│   │   ├── main.ejs       # Layout pages publiques
│   │   └── dashboard.ejs  # Layout dashboard
│   ├── index.ejs          # Landing page
│   ├── pricing.ejs        # Page tarifs
│   ├── auth/              # Connexion / Inscription
│   └── dashboard/         # Toutes les pages app
└── helpers/
    └── render.js          # Helper layout EJS
```

## Configuration Email (.env)

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=votre@gmail.com
MAIL_PASS=votre_mot_de_passe_application
MAIL_FROM_NAME=LFacture
MAIL_FROM_EMAIL=noreply@lfacture.com
```

> Pour Gmail : activez l'authentification à 2 facteurs et créez un "mot de passe d'application".

## Fonctionnalités

- Essai gratuit 7 jours (activation automatique à l'inscription)
- Email de bienvenue avec identifiants
- Factures et devis illimités (PDF via impression navigateur)
- Gestion clients avec carnet d'adresses complet
- Tableau de bord avec statistiques
- Paramètres entreprise (SIRET, TVA, IBAN, logo…)
- 3 offres d'abonnement sur la page /pricing

## Lancement en production

```bash
# Avec PM2
npm install -g pm2
pm2 start server.js --name lfacture
pm2 save
```
