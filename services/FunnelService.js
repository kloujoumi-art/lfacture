const nodemailer = require('nodemailer');
const { db, nextId } = require('../database/db');

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';
const FROM = () => `"${process.env.MAIL_FROM_NAME || 'LFacture'}" <${process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER}>`;

function transporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
}

function logEmail(userId, type) {
  db.get('funnel_logs').push({
    id: nextId('funnel_log'),
    user_id: userId,
    type,
    sent_at: new Date().toISOString(),
  }).write();
}

function alreadySent(userId, type) {
  return !!db.get('funnel_logs').find(l => l.user_id === userId && l.type === type).value();
}

// ── Email 1 : Vérification d'adresse email — code OTP 6 chiffres ─────────
async function sendVerificationEmail(user) {
  const code = user.verification_token; // code OTP 6 chiffres
  const digits = String(code).split('');
  const digitBoxes = digits.map(d =>
    `<span style="display:inline-block;width:52px;height:64px;line-height:64px;border:2px solid #e0e7ff;border-radius:12px;font-size:32px;font-weight:900;color:#4F46E5;text-align:center;background:#f8faff;margin:0 4px;">${d}</span>`
  ).join('');

  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Votre code de vérification LFacture</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px 40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">LFacture</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Logiciel de facturation gratuit</p>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:22px;font-weight:800;">Bonjour ${user.name} 👋</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 32px;">Voici votre code de vérification pour activer votre compte LFacture. Saisissez-le sur la page de vérification.</p>

        <!-- Code OTP -->
        <div style="text-align:center;margin:0 0 32px;">
          <p style="color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin:0 0 16px;">Votre code de vérification</p>
          <div style="display:inline-block;">${digitBoxes}</div>
          <p style="color:#9ca3af;font-size:13px;margin:16px 0 0;">Ce code est valable <strong>24 heures</strong></p>
        </div>

        <!-- Ou copier le code -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;text-align:center;margin-bottom:28px;">
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Code complet :</p>
          <p style="margin:0;color:#4F46E5;font-size:28px;font-weight:900;letter-spacing:8px;">${code}</p>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${APP_URL()}/verify-email" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:800;font-size:15px;box-shadow:0 4px 15px rgba(79,70,229,.3);">
            Saisir mon code →
          </a>
        </div>

        <p style="color:#9ca3af;font-size:13px;text-align:center;">Si vous n'avez pas créé de compte LFacture, ignorez cet email.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture — logiciel de facturation gratuit</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  try {
    await transporter().sendMail({ from: FROM(), to: user.email, subject: `${code} — Votre code de vérification LFacture`, html });
    logEmail(user.id, 'verification');
    console.log(`[Funnel] Verification OTP → ${user.email} (code: ${code})`);
  } catch (e) { console.error('[Funnel] verification error:', e.message); }
}

// ── Email 2 : Bienvenue après vérification ────────────────────────────────
async function sendWelcomeEmail(user) {
  if (alreadySent(user.id, 'welcome')) return;
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bienvenue sur LFacture !</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">LFacture</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Logiciel de facturation gratuit</p>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:24px;font-weight:900;">🎉 Compte activé — Bienvenue ${user.name} !</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant créer vos premières factures et devis.</p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">Email :</td><td style="padding:8px 0;color:#1a1a2e;font-weight:700;font-size:14px;">${user.email}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Plan :</td><td style="padding:8px 0;color:#4F46E5;font-weight:700;font-size:14px;">Gratuit — 8 factures + 8 devis</td></tr>
          </table>
        </div>

        <div style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1px solid #c7d2fe;border-radius:12px;padding:20px;margin-bottom:28px;text-align:center;">
          <p style="margin:0;color:#4338ca;font-weight:800;font-size:16px;">✅ Plan gratuit activé</p>
          <p style="margin:8px 0 0;color:#4F46E5;font-size:14px;">8 factures + 8 devis professionnels offerts</p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="${APP_URL()}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:800;font-size:15px;box-shadow:0 4px 15px rgba(79,70,229,.3);">
            Créer ma première facture →
          </a>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">📄 8 factures professionnelles offertes</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">📋 8 devis professionnels offerts</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">📥 Téléchargement PDF instantané</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">👥 Gestion des clients</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;">🎨 Logo + 3 modèles de factures</td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture — logiciel de facturation gratuit</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  try {
    await transporter().sendMail({ from: FROM(), to: user.email, subject: '🎉 Compte LFacture activé — créez votre première facture !', html });
    logEmail(user.id, 'welcome');
    console.log(`[Funnel] Welcome email → ${user.email}`);
  } catch (e) { console.error('[Funnel] welcome error:', e.message); }
}

// ── Email 3 : J+5 Rappel essai bientôt terminé ───────────────────────────
async function sendTrialEndingSoon(user) {
  if (alreadySent(user.id, 'trial_ending')) return;
  const daysLeft = Math.ceil((new Date(user.trial_ends_at) - new Date()) / 86400000);
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Votre essai se termine dans ${daysLeft} jours</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#F59E0B,#D97706);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">⏰ LFacture</h1>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:22px;font-weight:800;">Bonjour ${user.name}, votre essai se termine dans <span style="color:#D97706;">${daysLeft} jours</span></h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">Vous avez utilisé LFacture pendant 5 jours. Continuez sans interruption en choisissant votre abonnement maintenant.</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:24px;margin-bottom:28px;">
          <p style="margin:0 0 16px;color:#92400e;font-weight:700;font-size:16px;">Nos offres :</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;color:#374151;font-size:14px;">📅 Mensuel</td><td style="text-align:right;color:#1a1a2e;font-weight:700;font-size:14px;">5€/mois</td></tr>
            <tr><td style="padding:8px 0;color:#374151;font-size:14px;">📆 Semestriel</td><td style="text-align:right;color:#1a1a2e;font-weight:700;font-size:14px;">30€/6 mois <span style="color:#059669;font-size:12px;">−10%</span></td></tr>
            <tr style="background:#fef3c7;"><td style="padding:10px 8px;color:#92400e;font-size:14px;font-weight:800;border-radius:6px;">⭐ Annuel — LE PLUS POPULAIRE</td><td style="text-align:right;padding:10px 8px;color:#92400e;font-weight:900;font-size:15px;">50€/an <span style="color:#059669;font-size:12px;">−35%</span></td></tr>
          </table>
        </div>
        <div style="text-align:center;">
          <a href="${APP_URL()}/pricing" style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:800;font-size:15px;">
            Choisir mon abonnement →
          </a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  try {
    await transporter().sendMail({ from: FROM(), to: user.email, subject: `⏰ Votre essai LFacture se termine dans ${daysLeft} jours`, html });
    logEmail(user.id, 'trial_ending');
    console.log(`[Funnel] Trial ending email → ${user.email}`);
  } catch (e) { console.error('[Funnel] trial_ending error:', e.message); }
}

// ── Email 4 : J+7 Essai terminé — Passez Premium ─────────────────────────
async function sendTrialExpired(user) {
  if (alreadySent(user.id, 'trial_expired')) return;
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Votre essai LFacture est terminé</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">LFacture</h1>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:22px;font-weight:800;">Bonjour ${user.name}, votre essai est terminé 😔</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">Votre essai gratuit de 7 jours est arrivé à son terme. Nous espérons que vous avez adoré LFacture !</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px;font-weight:600;">Pour continuer à créer des factures et devis professionnels, choisissez votre abonnement :</p>
        <div style="border:2px solid #4F46E5;border-radius:14px;padding:28px;margin-bottom:28px;text-align:center;background:linear-gradient(135deg,#eef2ff,#f5f3ff);">
          <p style="margin:0 0 8px;color:#4F46E5;font-weight:800;font-size:18px;">⭐ Offre Annuelle recommandée</p>
          <p style="margin:0 0 16px;color:#1a1a2e;font-size:36px;font-weight:900;">50€<span style="font-size:16px;color:#6b7280;">/an</span></p>
          <p style="margin:0 0 20px;color:#059669;font-weight:700;">Soit seulement 4,17€/mois — Économisez 35%</p>
          <a href="${APP_URL()}/pricing" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:800;font-size:15px;">Je m'abonne maintenant</a>
        </div>
        <p style="color:#9ca3af;font-size:13px;text-align:center;">Vos données sont conservées. Abonnez-vous pour y accéder.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  try {
    await transporter().sendMail({ from: FROM(), to: user.email, subject: '😔 Votre essai LFacture est terminé — Continuez avec un abonnement', html });
    logEmail(user.id, 'trial_expired');
    console.log(`[Funnel] Trial expired email → ${user.email}`);
  } catch (e) { console.error('[Funnel] trial_expired error:', e.message); }
}

// ── Email 5 : J+9 Relance ─────────────────────────────────────────────────
async function sendFollowUp(user) {
  if (alreadySent(user.id, 'followup')) return;
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>On pense à vous — LFacture</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px 40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">LFacture</h1>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:22px;font-weight:800;">Bonjour ${user.name} 👋</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 20px;">Vous nous manquez ! Depuis la fin de votre essai, nous avons continué à améliorer LFacture.</p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">Des centaines d'indépendants et PME françaises utilisent LFacture chaque jour pour :</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;">✅ Créer des factures PDF professionnelles en 30 secondes</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;">✅ Envoyer des devis et les transformer en factures</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;">✅ Gérer leurs clients et suivre leurs paiements</td></tr>
          <tr><td style="padding:8px 0;color:#374151;font-size:14px;">✅ Économiser des heures chaque mois</td></tr>
        </table>
        <div style="text-align:center;">
          <a href="${APP_URL()}/pricing" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:800;font-size:15px;">
            Reprendre LFacture →
          </a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  try {
    await transporter().sendMail({ from: FROM(), to: user.email, subject: '👋 LFacture vous manque ? Voici une raison de revenir', html });
    logEmail(user.id, 'followup');
    console.log(`[Funnel] Follow-up email → ${user.email}`);
  } catch (e) { console.error('[Funnel] followup error:', e.message); }
}

// ── Email 6 : J+12 DERNIÈRE CHANCE — 15% de réduction sur 1 AN ───────────
async function sendLastChanceDiscount(user) {
  if (alreadySent(user.id, 'discount')) return;
  const prixOriginal = 50;
  const reduction = 15;
  const prixReduit = (prixOriginal * (1 - reduction / 100)).toFixed(0);
  // Code promo unique basé sur l'ID
  const codePromo = `LFACT15-${String(user.id).padStart(4, '0')}`;
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>🔥 -15% sur LFacture — Offre exclusive</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:40px;text-align:center;">
        <p style="color:#fca5a5;font-size:13px;font-weight:700;margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Offre exclusive — Expire dans 48h</p>
        <h1 style="color:#fff;margin:0;font-size:32px;font-weight:900;">🔥 −${reduction}% sur l'abonnement annuel</h1>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:22px;font-weight:800;">Bonjour ${user.name},</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">C'est notre dernière tentative. Nous voulons vraiment vous garder dans la famille LFacture, c'est pourquoi nous vous offrons une <strong>réduction exclusive de ${reduction}%</strong> sur l'abonnement annuel, <strong>réservée uniquement pour vous</strong>.</p>

        <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:2px solid #fca5a5;border-radius:14px;padding:32px;margin-bottom:28px;text-align:center;">
          <p style="margin:0 0 4px;color:#dc2626;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Votre offre personnelle</p>
          <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:16px 0;">
            <p style="margin:0;text-decoration:line-through;color:#9ca3af;font-size:24px;">50€</p>
            <p style="margin:0;color:#dc2626;font-size:48px;font-weight:900;">${prixReduit}€</p>
            <p style="margin:0;color:#6b7280;font-size:16px;">/an</p>
          </div>
          <p style="margin:0 0 20px;color:#dc2626;font-weight:700;font-size:15px;">Vous économisez ${prixOriginal - parseInt(prixReduit)}€ — plus de 40% de réduction au total !</p>
          <div style="background:#fff;border:2px dashed #fca5a5;border-radius:8px;padding:14px;margin-bottom:24px;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600;">VOTRE CODE PROMO</p>
            <p style="margin:0;color:#dc2626;font-size:24px;font-weight:900;letter-spacing:3px;font-family:monospace;">${codePromo}</p>
          </div>
          <a href="${APP_URL()}/pricing" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:900;font-size:16px;box-shadow:0 4px 15px rgba(220,38,38,.4);">
            🔥 J'en profite maintenant
          </a>
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
          <p style="margin:0;color:#c2410c;font-weight:700;font-size:14px;">⏰ Cette offre expire dans <strong>48 heures</strong></p>
          <p style="margin:6px 0 0;color:#9a3412;font-size:13px;">Après ça, le prix normal de 50€/an reprend.</p>
        </div>

        <p style="color:#9ca3af;font-size:13px;line-height:1.6;">Ce code promo est personnel et ne peut être utilisé qu'une seule fois. Il vous donne accès à toutes les fonctionnalités LFacture pendant 1 an complet.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture • <a href="${APP_URL()}" style="color:#6b7280;">lfacture.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  try {
    await transporter().sendMail({ from: FROM(), to: user.email, subject: `🔥 DERNIÈRE CHANCE : −${reduction}% sur LFacture — Code ${codePromo} (expire dans 48h)`, html });
    logEmail(user.id, 'discount');
    console.log(`[Funnel] Discount email → ${user.email} (code: ${codePromo})`);
  } catch (e) { console.error('[Funnel] discount error:', e.message); }
}

// ── Email Admin : Lien de connexion magique ───────────────────────────────
async function sendMagicLoginEmail(user, magicLink) {
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Votre lien de connexion LFacture</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px 40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">LFacture</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Logiciel de facturation gratuit</p>
      </td></tr>
      <tr><td style="padding:48px 40px;">
        <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:22px;font-weight:800;">Bonjour ${user.name} 👋</h2>
        <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">Voici votre lien de connexion direct à votre espace LFacture. Cliquez sur le bouton ci-dessous pour accéder immédiatement à votre tableau de bord.</p>

        <div style="text-align:center;margin:0 0 28px;">
          <a href="${magicLink}" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;text-decoration:none;padding:18px 48px;border-radius:10px;font-weight:800;font-size:16px;box-shadow:0 4px 15px rgba(79,70,229,.3);">
            🔑 Accéder à mon espace →
          </a>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:24px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">⏰ Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
        </div>

        <p style="color:#9ca3af;font-size:13px;text-align:center;word-break:break-all;">Ou copiez ce lien : ${magicLink}</p>

        <p style="color:#9ca3af;font-size:13px;text-align:center;margin-top:24px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">© ${new Date().getFullYear()} LFacture — logiciel de facturation gratuit</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  await transporter().sendMail({ from: FROM(), to: user.email, subject: '🔑 Votre lien de connexion LFacture', html });
  console.log(`[Admin] Magic login link → ${user.email}`);
}

// ── Ajouter dans la liste de contacts ─────────────────────────────────────
function addToContacts(user) {
  const existing = db.get('contacts').find(c => c.email === user.email).value();
  if (!existing) {
    db.get('contacts').push({
      id: nextId('contact'),
      name: user.name,
      email: user.email,
      user_id: user.id,
      source: 'trial',
      subscribed_at: new Date().toISOString(),
      tags: ['trial'],
    }).write();
    console.log(`[Contacts] ${user.email} ajouté à la liste mailing`);
  }
}

// ── Scheduler — vérifie toutes les 30 minutes qui doit recevoir un email ──
function startFunnelScheduler() {
  console.log('[Funnel] Scheduler démarré (vérification toutes les 30 min)');

  async function runCheck() {
    const now = new Date();
    const users = db.get('users').filter(u => u.email_verified && u.plan === 'trial' && u.trial_started_at).value();

    for (const user of users) {
      const startedAt = new Date(user.trial_started_at);
      const daysSinceStart = (now - startedAt) / 86400000;
      const trialEnd = new Date(user.trial_ends_at);
      const daysUntilEnd = (trialEnd - now) / 86400000;

      // J+5 : Rappel fin d'essai
      if (daysSinceStart >= 5 && daysUntilEnd > 0) {
        await sendTrialEndingSoon(user);
      }
      // J+7 : Essai expiré
      if (daysUntilEnd <= 0) {
        await sendTrialExpired(user);
      }
    }

    // Relances post-essai
    const expiredUsers = db.get('users').filter(u =>
      u.email_verified && u.plan === 'trial' && u.trial_ends_at && new Date(u.trial_ends_at) <= now
    ).value();

    for (const user of expiredUsers) {
      const trialEnd = new Date(user.trial_ends_at);
      const daysSinceExpiry = (now - trialEnd) / 86400000;

      // J+9 (2 jours après expiration) : Follow-up
      if (daysSinceExpiry >= 2) {
        await sendFollowUp(user);
      }
      // J+12 (5 jours après expiration) : Réduction 15%
      if (daysSinceExpiry >= 5) {
        await sendLastChanceDiscount(user);
      }
    }
  }

  // Lancer immédiatement puis toutes les 30 min
  runCheck().catch(console.error);
  setInterval(() => runCheck().catch(console.error), 30 * 60 * 1000);
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendMagicLoginEmail,
  sendTrialEndingSoon,
  sendTrialExpired,
  sendFollowUp,
  sendLastChanceDiscount,
  addToContacts,
  startFunnelScheduler,
};
