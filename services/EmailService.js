const nodemailer = require('nodemailer');

class EmailService {
  static getTransporter() {
    return nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.MAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  static async sendWelcomeEmail(user, password) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const trialDays = parseInt(process.env.TRIAL_DAYS) || 7;
    const trialEnd = new Date(user.trial_ends_at);
    const trialEndFormatted = trialEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bienvenue sur LFacture</title></head>
<body style="margin:0;padding:0;background-color:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:32px;font-weight:800;letter-spacing:-1px;">LFacture</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Créez vos factures et devis en quelques secondes.</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:48px 40px;">
            <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:24px;font-weight:700;">Bienvenue, ${user.name} ! 🎉</h2>
            <p style="color:#6b7280;margin:0 0 32px;font-size:16px;line-height:1.6;">Votre compte LFacture est prêt. Commencez dès maintenant votre essai gratuit de ${trialDays} jours.</p>

            <!-- Credentials Box -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:32px;">
              <h3 style="color:#1a1a2e;margin:0 0 16px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Vos informations de connexion</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Adresse email :</td><td style="padding:8px 0;color:#1a1a2e;font-weight:600;font-size:14px;">${user.email}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Mot de passe :</td><td style="padding:8px 0;color:#1a1a2e;font-weight:600;font-size:14px;font-family:monospace;">${password}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Fin de l'essai :</td><td style="padding:8px 0;color:#059669;font-weight:600;font-size:14px;">${trialEndFormatted}</td></tr>
              </table>
            </div>

            <!-- Trial Badge -->
            <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #6ee7b7;border-radius:12px;padding:20px;margin-bottom:32px;text-align:center;">
              <p style="margin:0;color:#065f46;font-weight:700;font-size:16px;">✅ Essai gratuit de ${trialDays} jours activé</p>
              <p style="margin:8px 0 0;color:#047857;font-size:14px;">Accès à toutes les fonctionnalités • Aucune carte bancaire requise</p>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin-bottom:32px;">
              <a href="${appUrl}/login" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:700;font-size:16px;">Accéder à mon compte →</a>
            </div>

            <!-- Features -->
            <div style="border-top:1px solid #f1f5f9;padding-top:32px;">
              <p style="color:#6b7280;font-size:14px;margin:0 0 16px;">Pendant votre essai, vous avez accès à :</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;color:#374151;font-size:14px;">✅ Factures et devis illimités</td></tr>
                <tr><td style="padding:6px 0;color:#374151;font-size:14px;">✅ Gestion des clients et produits</td></tr>
                <tr><td style="padding:6px 0;color:#374151;font-size:14px;">✅ Téléchargement PDF professionnel</td></tr>
                <tr><td style="padding:6px 0;color:#374151;font-size:14px;">✅ Plusieurs modèles de factures</td></tr>
                <tr><td style="padding:6px 0;color:#374151;font-size:14px;">✅ Logo personnalisé</td></tr>
              </table>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#9ca3af;font-size:13px;">© 2024 LFacture • <a href="${appUrl}" style="color:#6b7280;">lfacture.com</a></p>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">Vous avez reçu cet email car vous venez de créer un compte LFacture.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME || 'LFacture'}" <${process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER}>`,
        to: user.email,
        subject: `Bienvenue sur LFacture — Votre essai gratuit commence maintenant !`,
        html,
      });
      console.log(`[Email] Welcome email sent to ${user.email}`);
    } catch (err) {
      console.error(`[Email] Failed to send welcome email: ${err.message}`);
    }
  }

  static async sendTrialEndingEmail(user) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Votre essai se termine bientôt</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#F59E0B,#D97706);padding:40px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:32px;font-weight:800;">LFacture</h1>
        </td></tr>
        <tr><td style="padding:48px 40px;">
          <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:22px;">⏰ Votre essai se termine dans 2 jours</h2>
          <p style="color:#6b7280;line-height:1.6;">Bonjour ${user.name}, votre essai gratuit de 7 jours se termine bientôt. Pour continuer à utiliser LFacture sans interruption, choisissez votre abonnement.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${appUrl}/pricing" style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:700;font-size:16px;">Choisir mon abonnement →</a>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;text-align:center;">
            <p style="margin:0;color:#92400e;font-weight:600;">🔥 Offre recommandée : 50€/an — Économisez 35%</p>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#9ca3af;font-size:13px;">© 2024 LFacture</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"LFacture" <${process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER}>`,
        to: user.email,
        subject: `⏰ Votre essai LFacture se termine dans 2 jours`,
        html,
      });
    } catch (err) {
      console.error(`[Email] Failed to send trial ending email: ${err.message}`);
    }
  }
}

module.exports = EmailService;
