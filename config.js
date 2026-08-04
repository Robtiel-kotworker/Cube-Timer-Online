// ============================================================================
// Cube Timer – Konfiguration
// Trage hier deine Supabase- und EmailJS-Zugangsdaten ein (siehe README, Schritte
// "Supabase verbinden" und "EmailJS verbinden"). Diese Datei kannst du später
// jederzeit direkt auf github.com im Browser bearbeiten – dafür ist kein
// Computer und kein Terminal nötig.
// ============================================================================
window.CUBE_TIMER_CONFIG = {
  supabaseUrl: "https://jcsyikicwdzzqfbwrans.supabase.co",
  supabaseAnonKey: "sb_publishable_82adPoK3oOJvSBAWHxJP2g_IAmf4MP-",

  // EmailJS (für den "Entwickler kontaktieren"-Button bei der Cheat-Warnung).
  // Alle drei Werte findest du in deinem EmailJS-Konto (siehe README, Schritt
  // "EmailJS verbinden"). Der Empfänger (robtiel@mail.de) wird NICHT hier
  // eingetragen, sondern direkt im EmailJS-Template als "To Email" hinterlegt.
  emailjsPublicKey: "DEIN-EMAILJS-PUBLIC-KEY",
  emailjsServiceId: "DEIN-EMAILJS-SERVICE-ID",
  emailjsTemplateId: "DEIN-EMAILJS-TEMPLATE-ID"
};
