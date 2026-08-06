// ============================================================================
// Cube Timer – komplette App-Logik in einer Datei.
// Läuft direkt im Browser als ES-Modul, ohne Build-Schritt (kein npm/Vite nötig).
// React, ReactDOM, htm und Supabase werden per CDN geladen (esm.sh).
// ============================================================================

import { createElement, useState, useEffect, useCallback, useMemo, useRef } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const html = htm.bind(createElement);

/* ============================================================================
 * lib: Zeit-Formatierung
 * ==========================================================================*/
function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatTime(ms, format) {
  const totalCentis = Math.floor(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);

  if (format === 'minutes') {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${pad(seconds)}.${pad(centis)}`;
  }
  return `${totalSeconds}.${pad(centis)}`;
}

function formatDelta(deltaMs) {
  const sign = deltaMs > 0 ? '+' : deltaMs < 0 ? '-' : '±';
  const abs = Math.abs(deltaMs);
  const seconds = Math.floor(abs / 1000);
  const centis = Math.floor((abs % 1000) / 10);
  return `${sign}${seconds}.${pad(centis)}`;
}

function formatTotalTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

/* ============================================================================
 * lib: Namens-Farbverläufe
 * ==========================================================================*/
const NAME_STYLES = [
  { id: 'default', label: 'Standard', className: '' },
  { id: 'fire', label: 'Fire', className: 'name-fire' },
  { id: 'ice', label: 'Ice', className: 'name-ice' },
  { id: 'ocean', label: 'Ocean', className: 'name-ocean' },
  { id: 'rainbow', label: 'Rainbow', className: 'name-rainbow' },
  { id: 'purple-neon', label: 'Purple Neon', className: 'name-purple-neon' },
  { id: 'cyber', label: 'Cyber', className: 'name-cyber' },
  { id: 'gold', label: 'Gold', className: 'name-gold' },
  { id: 'matrix', label: 'Matrix', className: 'name-matrix' },
  { id: 'sunset', label: 'Sunset', className: 'name-sunset' },
  { id: 'aurora', label: 'Aurora', className: 'name-aurora' },
  { id: 'galaxy', label: 'Galaxy', className: 'name-galaxy' }
];

function getNameStyle(id) {
  return NAME_STYLES.find((s) => s.id === id) ?? NAME_STYLES[0];
}

/* ============================================================================
 * lib: Admin-Modus
 * ----------------------------------------------------------------------------
 * Gibt man beim Einloggen statt eines Spielernamens exakt diesen Text ein,
 * wird kein normaler Account angelegt, sondern der Admin-Modus aktiviert.
 * Da die App komplett ohne Backend/echtes Auth-System läuft, ist dieser Wert
 * zwangsläufig Teil des öffentlichen Frontend-Codes – er ist also eine einfache
 * Hürde, kein echter Schutz gegen jemanden, der gezielt den Quelltext ausliest.
 * ==========================================================================*/
const ADMIN_TRIGGER = 'Adminregelt';

/* ============================================================================
 * lib: LocalStorage (Login, Einstellungen, Solve-Historie)
 * ==========================================================================*/
const KEYS = {
  auth: 'cubetimer.auth',
  settings: 'cubetimer.settings',
  solves: 'cubetimer.solves',
  strikes: 'cubetimer.strikes'
};

const DEFAULT_SETTINGS = { timeFormat: 'seconds' };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage kann z. B. im privaten Modus fehlschlagen – App bleibt innerhalb der Session nutzbar.
  }
}

const loadAuth = () => read(KEYS.auth, null);
const saveAuth = (auth) => write(KEYS.auth, auth);
const clearAuth = () => localStorage.removeItem(KEYS.auth);
const loadSettings = () => read(KEYS.settings, DEFAULT_SETTINGS);
const saveSettings = (settings) => write(KEYS.settings, settings);
const loadSolves = () => read(KEYS.solves, []);
const saveSolves = (solves) => write(KEYS.solves, solves);

const DEFAULT_STRIKES = { count: 0, lockedAt: null };
const loadStrikes = () => read(KEYS.strikes, DEFAULT_STRIKES);
const saveStrikes = (strikes) => write(KEYS.strikes, strikes);

/* ============================================================================
 * lib: Supabase-Client (liest Zugangsdaten aus config.js)
 * ==========================================================================*/
const cfg = window.CUBE_TIMER_CONFIG || {};
const isSupabaseConfigured = Boolean(
  cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes('DEIN-PROJEKT')
);
const supabase = isSupabaseConfigured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

/* ============================================================================
 * lib: EmailJS-Client (liest Zugangsdaten aus config.js)
 * ==========================================================================*/
const isEmailjsConfigured = Boolean(
  cfg.emailjsPublicKey &&
    cfg.emailjsServiceId &&
    cfg.emailjsTemplateId &&
    !String(cfg.emailjsPublicKey).includes('DEIN-EMAILJS')
);

if (isEmailjsConfigured && window.emailjs) {
  window.emailjs.init({ publicKey: cfg.emailjsPublicKey });
}

async function sendDeveloperEmail({ userEmail, message, strikeCount, username }) {
  if (!isEmailjsConfigured || !window.emailjs) {
    return { ok: false, message: 'E-Mail-Versand ist nicht eingerichtet (config.js prüfen).' };
  }
  try {
    await window.emailjs.send(cfg.emailjsServiceId, cfg.emailjsTemplateId, {
      user_email: userEmail,
      message: message || '(kein zusätzlicher Text angegeben)',
      strike_count: String(strikeCount),
      username: username || '(nicht eingeloggt)',
      page_url: window.location.href,
      sent_at: new Date().toLocaleString('de-DE')
    });
    return { ok: true, message: null };
  } catch (err) {
    return { ok: false, message: 'E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.' };
  }
}

/* ============================================================================
 * lib: Cheat-Erkennung (eingereichte Zeit) & Strike-System
 * ----------------------------------------------------------------------------
 * Eine für die Bestenliste eingereichte Zeit zwischen 0 und 55 Sekunden gilt
 * als Cheat-Verdacht und wird nicht an die Bestenliste übermittelt.
 * ==========================================================================*/
// Eine für die Bestenliste eingereichte Zeit, die zwischen 0 und 55 Sekunden
// liegt, gilt als Cheat-Verdacht.
const CHEAT_TIME_THRESHOLD_MS = 55000;

function useStrikes() {
  const [strikes, setStrikes] = useState(() => loadStrikes());

  const addStrike = useCallback(() => {
    const next = {
      count: strikes.count + 1,
      lockedAt: strikes.count + 1 >= 3 ? new Date().toISOString() : null
    };
    saveStrikes(next);
    setStrikes(next);
    return next;
  }, [strikes]);

  return { strikes, addStrike, isLocked: Boolean(strikes.lockedAt) };
}

/* ============================================================================
 * Hook: Admin-Idle-Check ("Noch da?")
 * ----------------------------------------------------------------------------
 * Solange der Admin-Modus aktiv ist, erscheint alle 3 Minuten ein Dialog mit
 * genau einem Button ("Ja") und einem 15-Sekunden-Countdown. Wird er innerhalb
 * dieser 15 Sekunden gedrückt, läuft der 3-Minuten-Zyklus von vorne los.
 * Passiert nichts, wird onTimeout() aufgerufen (Admin-Modus wird verlassen).
 * ==========================================================================*/
const ADMIN_IDLE_INTERVAL_MS = 3 * 60 * 1000;
const ADMIN_IDLE_ANSWER_MS = 15 * 1000;

function useAdminIdleCheck(isActive, onTimeout) {
  const [showCheck, setShowCheck] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ADMIN_IDLE_ANSWER_MS / 1000);
  const idleTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const answerTimeoutRef = useRef(null);

  const startIdleCycle = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setSecondsLeft(ADMIN_IDLE_ANSWER_MS / 1000);
      setShowCheck(true);
    }, ADMIN_IDLE_INTERVAL_MS);
  }, []);

  // Zyklus starten/stoppen, sobald der Admin-Modus betreten/verlassen wird.
  useEffect(() => {
    if (!isActive) {
      clearTimeout(idleTimerRef.current);
      clearInterval(countdownRef.current);
      clearTimeout(answerTimeoutRef.current);
      setShowCheck(false);
      return;
    }
    startIdleCycle();
    return () => clearTimeout(idleTimerRef.current);
  }, [isActive, startIdleCycle]);

  // Countdown + Auto-Logout, solange der "Noch da?"-Dialog offen ist.
  useEffect(() => {
    if (!showCheck) return undefined;
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    answerTimeoutRef.current = setTimeout(() => {
      setShowCheck(false);
      onTimeout();
    }, ADMIN_IDLE_ANSWER_MS);
    return () => {
      clearInterval(countdownRef.current);
      clearTimeout(answerTimeoutRef.current);
    };
  }, [showCheck, onTimeout]);

  const confirmStillThere = useCallback(() => {
    clearInterval(countdownRef.current);
    clearTimeout(answerTimeoutRef.current);
    setShowCheck(false);
    startIdleCycle();
  }, [startIdleCycle]);

  return { showCheck, secondsLeft, confirmStillThere };
}

/* ============================================================================
 * Hooks
 * ==========================================================================*/
function useAuth() {
  const [auth, setAuth] = useState(() => loadAuth());

  const login = useCallback((input) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Exakter Admin-Trigger statt eines normalen Spielernamens.
    if (trimmed === ADMIN_TRIGGER) {
      const next = { isAdmin: true, username: null, nameStyle: 'default' };
      saveAuth(next);
      setAuth(next);
      return;
    }

    const limited = trimmed.slice(0, 20);
    const next = { isAdmin: false, username: limited, nameStyle: 'ice' };
    saveAuth(next);
    setAuth(next);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

  const setNameStyle = useCallback((styleId) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, nameStyle: styleId };
      saveAuth(next);
      return next;
    });
  }, []);

  return {
    auth,
    login,
    logout,
    setNameStyle,
    isLoggedIn: Boolean(auth),
    isAdmin: Boolean(auth?.isAdmin)
  };
}

function useSettings() {
  const [settings, setSettings] = useState(() => loadSettings());

  const setTimeFormat = useCallback((timeFormat) => {
    setSettings((prev) => {
      const next = { ...prev, timeFormat };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, setTimeFormat };
}

function average(msValues) {
  if (msValues.length < 3) {
    if (msValues.length === 0) return null;
    return msValues.reduce((a, b) => a + b, 0) / msValues.length;
  }
  const sorted = [...msValues].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function useStats() {
  const [solves, setSolves] = useState(() => loadSolves());

  const addSolve = useCallback((ms) => {
    const solve = { id: crypto.randomUUID(), ms, date: new Date().toISOString() };
    setSolves((prev) => {
      const next = [solve, ...prev];
      saveSolves(next);
      return next;
    });
    return solve;
  }, []);

  const stats = useMemo(() => {
    const best = solves.length ? Math.min(...solves.map((s) => s.ms)) : null;
    const last5 = solves.slice(0, 5).map((s) => s.ms);
    const last12 = solves.slice(0, 12).map((s) => s.ms);
    return {
      best,
      avg5: last5.length === 5 ? average(last5) : null,
      avg12: last12.length === 12 ? average(last12) : null,
      totalSolves: solves.length,
      totalTimeMs: solves.reduce((sum, s) => sum + s.ms, 0)
    };
  }, [solves]);

  // Löscht nur den einen Solve, der aktuell die persönliche Bestzeit darstellt.
  // Danach ergibt sich die neue Bestzeit automatisch aus dem nächstbesten Solve
  // (oder "--.--", falls keine Solves mehr übrig sind).
  const clearBest = useCallback(() => {
    setSolves((prev) => {
      if (prev.length === 0) return prev;
      const bestMs = Math.min(...prev.map((s) => s.ms));
      const idx = prev.findIndex((s) => s.ms === bestMs);
      if (idx === -1) return prev;
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      saveSolves(next);
      return next;
    });
  }, []);

  return { solves, addSolve, stats, clearBest };
}

function useLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Keine Datenbankverbindung konfiguriert (config.js prüfen).');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: dbError } = await supabase
      .from('leaderboard')
      .select('username, name_style, best_ms, updated_at')
      .order('best_ms', { ascending: true })
      .limit(10);

    if (dbError) setError(dbError.message);
    else setEntries(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submitScore = useCallback(
    async (username, nameStyle, ms) => {
      if (!isSupabaseConfigured) {
        return { ok: false, message: 'Keine Datenbankverbindung konfiguriert.' };
      }
      const { error: rpcError } = await supabase.rpc('submit_score', {
        p_username: username,
        p_style: nameStyle,
        p_ms: Math.round(ms)
      });
      if (rpcError) return { ok: false, message: rpcError.message };
      await refresh();
      return { ok: true, message: null };
    },
    [refresh]
  );

  // Admin: einzelnen Eintrag aus der Bestenliste entfernen (Reset Stats /
  // Schnell-Löschen per Dreifachklick).
  const adminRemoveEntry = useCallback(
    async (username) => {
      if (!isSupabaseConfigured) {
        return { ok: false, message: 'Keine Datenbankverbindung konfiguriert.' };
      }
      const { error: rpcError } = await supabase.rpc('admin_remove_entry', {
        p_admin_key: ADMIN_TRIGGER,
        p_username: username
      });
      if (rpcError) return { ok: false, message: rpcError.message };
      await refresh();
      return { ok: true, message: null };
    },
    [refresh]
  );

  // Admin: kompletten Benutzernamen sperren (verhindert künftige Einreichungen)
  // und ihn zugleich aus der Bestenliste entfernen.
  const adminBanUsername = useCallback(
    async (username) => {
      if (!isSupabaseConfigured) {
        return { ok: false, message: 'Keine Datenbankverbindung konfiguriert.' };
      }
      const { error: rpcError } = await supabase.rpc('admin_ban_username', {
        p_admin_key: ADMIN_TRIGGER,
        p_username: username
      });
      if (rpcError) return { ok: false, message: rpcError.message };
      await refresh();
      return { ok: true, message: null };
    },
    [refresh]
  );

  // Admin: komplette Bestenliste leeren.
  const adminResetAll = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { ok: false, message: 'Keine Datenbankverbindung konfiguriert.' };
    }
    const { error: rpcError } = await supabase.rpc('admin_reset_leaderboard', {
      p_admin_key: ADMIN_TRIGGER
    });
    if (rpcError) return { ok: false, message: rpcError.message };
    await refresh();
    return { ok: true, message: null };
  }, [refresh]);

  // Entfernt den eigenen Eintrag aus der Bestenliste, z. B. wenn der Nutzer
  // im Tab „Meine Statistik“ seine lokale Bestzeit löscht.
  const removeOwnScore = useCallback(
    async (username) => {
      if (!isSupabaseConfigured) {
        return { ok: false, message: 'Keine Datenbankverbindung konfiguriert.' };
      }
      const { error: rpcError } = await supabase.rpc('remove_own_score', {
        p_username: username
      });
      if (rpcError) return { ok: false, message: rpcError.message };
      await refresh();
      return { ok: true, message: null };
    },
    [refresh]
  );

  return { entries, loading, error, submitScore, removeOwnScore, adminRemoveEntry, adminBanUsername, adminResetAll };
}

/* ============================================================================
 * Komponenten
 * ==========================================================================*/
function Modal({ title, onClose, children }) {
  return html`
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick=${onClose}
    >
      <div
        onClick=${(e) => e.stopPropagation()}
        class="w-full sm:w-[420px] max-h-[85vh] overflow-y-auto bg-panel border border-panelBorder rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
      >
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold tracking-wide">${title}</h2>
          <button onClick=${onClose} aria-label="Schließen" class="text-muted hover:text-white text-xl leading-none px-2">✕</button>
        </div>
        ${children}
      </div>
    </div>
  `;
}

function CheatWarningModal({ strikeCount, onOk, onContactDeveloper }) {
  const reasonText =
    'Es wurde eine Zeit unter 55 Sekunden zur Bestenliste eingereicht. Solche Zeiten werden als Cheat-Verdacht eingestuft und nicht an die Bestenliste übermittelt.';

  return html`
    <${Modal} title="⚠️ Ungewöhnliche Aktivität erkannt" onClose=${onOk}>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-white leading-relaxed">
          ${reasonText}
        </p>
        <p class="text-sm text-bad font-semibold">
          Strike ${strikeCount} von 3${strikeCount >= 3 ? ' — dein Zugriff wurde gesperrt.' : '.'}
        </p>
        <p class="text-xs text-muted">
          Falls das ein Irrtum war (z. B. weil du selbst Entwickler bist oder ein Zubehör-Tool
          offen hattest), kannst du den Entwickler kontaktieren.
        </p>
        <div class="flex gap-3 mt-1">
          <button
            onClick=${onOk}
            class="flex-1 px-4 py-3 rounded-xl bg-panel border border-panelBorder text-white font-semibold active:scale-95 transition"
          >OK<//>
          <button
            onClick=${onContactDeveloper}
            class="flex-1 px-4 py-3 rounded-xl bg-accent text-black font-semibold active:scale-95 transition"
          >Entwickler kontaktieren<//>
        </div>
      </div>
    <//>
  `;
}

function ContactDeveloperDialog({ strikeCount, username, onClose }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setStatus('sending');
    setErrorMsg(null);
    const result = await sendDeveloperEmail({
      userEmail: trimmedEmail,
      message: message.trim(),
      strikeCount,
      username
    });
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('error');
      setErrorMsg(result.message);
    }
  };

  return html`
    <${Modal} title="Entwickler kontaktieren" onClose=${onClose}>
      ${status === 'sent'
        ? html`
          <div class="flex flex-col gap-4">
            <p class="text-sm text-good">Danke! Deine Nachricht wurde gesendet. Der Entwickler meldet sich per E-Mail bei dir.</p>
            <button onClick=${onClose} class="px-4 py-3 rounded-xl bg-accent text-black font-semibold active:scale-95 transition">Schließen<//>
          </div>
        `
        : html`
          <form onSubmit=${handleSubmit} class="flex flex-col gap-4">
            <p class="text-xs text-muted">
              Trage deine E-Mail-Adresse ein, damit der Entwickler dir antworten kann. Deine Nachricht
              wird zusammen mit Strike-Stand und Zeitstempel an den Entwickler geschickt.
            </p>
            <input
              autofocus
              type="email"
              required
              value=${email}
              onChange=${(e) => setEmail(e.target.value)}
              placeholder="deine@email.de"
              class="bg-base border border-panelBorder rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <textarea
              value=${message}
              onChange=${(e) => setMessage(e.target.value)}
              placeholder="Optional: kurze Nachricht an den Entwickler …"
              rows="3"
              class="bg-base border border-panelBorder rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            ></textarea>
            ${status === 'error' && html`<p class="text-bad text-xs">${errorMsg}</p>`}
            <button
              type="submit"
              disabled=${!email.trim() || status === 'sending'}
              class="px-4 py-3 rounded-xl bg-accent text-black font-semibold disabled:opacity-40 active:scale-95 transition"
            >${status === 'sending' ? 'Wird gesendet …' : 'Senden'}<//>
          </form>
        `}
    <//>
  `;
}

function ConfirmLogoutModal({ onConfirm, onCancel }) {
  return html`
    <${Modal} title="Ausloggen" onClose=${onCancel}>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-white leading-relaxed">
          Möchten Sie sich wirklich ausloggen?
        </p>
        <div class="flex gap-3">
          <button
            onClick=${onCancel}
            class="flex-1 px-4 py-3 rounded-xl bg-panel border border-panelBorder text-white font-semibold active:scale-95 transition"
          >Nein<//>
          <button
            onClick=${onConfirm}
            class="flex-1 px-4 py-3 rounded-xl bg-accent text-black font-semibold active:scale-95 transition"
          >Ja<//>
        </div>
      </div>
    <//>
  `;
}

function ConfirmClearBestModal({ onConfirm, onCancel }) {
  return html`
    <${Modal} title="Bestzeit löschen" onClose=${onCancel}>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-white leading-relaxed">
          Möchten Sie Ihre aktuelle persönliche Bestzeit wirklich löschen? Die
          nächstbeste Zeit aus Ihrer Solve-Historie wird danach zur neuen Bestzeit.
        </p>
        <div class="flex gap-3">
          <button
            onClick=${onCancel}
            class="flex-1 px-4 py-3 rounded-xl bg-panel border border-panelBorder text-white font-semibold active:scale-95 transition"
          >Abbrechen<//>
          <button
            onClick=${onConfirm}
            class="flex-1 px-4 py-3 rounded-xl bg-bad text-white font-semibold active:scale-95 transition"
          >Löschen<//>
        </div>
      </div>
    <//>
  `;
}

function AdminStillThereModal({ secondsLeft, onConfirm }) {
  return html`
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div class="w-[280px] bg-panel border border-panelBorder rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
        <h2 class="text-lg font-semibold text-white">Noch da?</h2>
        <p class="text-xs text-muted">Der Admin-Modus wird in ${secondsLeft}s automatisch beendet.</p>
        <button
          onClick=${onConfirm}
          class="px-6 py-3 rounded-xl bg-accent text-black font-semibold tracking-wide active:scale-95 transition"
        >Ja<//>
      </div>
    </div>
  `;
}

function LockedScreen({ onContactDeveloper, onLogout }) {
  return html`
    <div class="h-full min-h-screen flex flex-col">
      <div class="flex justify-end px-4 pt-4">
        <button
          onClick=${onLogout}
          class="text-xs text-muted underline underline-offset-2 active:opacity-60 transition"
        >Ausloggen<//>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5 -mt-10">
        <span class="text-5xl leading-none">🔒</span>
        <h1 class="text-lg font-semibold text-white">Zugriff gesperrt</h1>
        <p class="text-sm text-muted max-w-xs leading-relaxed">
          Es wurden 3 von 3 Strikes wegen wiederholt eingereichter Zeiten unter 55 Sekunden erreicht.
          Der Timer ist auf diesem Gerät gesperrt.
        </p>
        <button
          onClick=${onContactDeveloper}
          class="px-6 py-3 rounded-xl bg-accent text-black font-semibold tracking-wide active:scale-95 transition"
        >Entwickler kontaktieren<//>
      </div>
    </div>
  `;
}

function LoginDialog({ onClose, onSubmit }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return html`
    <${Modal} title="Bitte Nutzernamen für Ranked Games eingeben" onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="flex flex-col gap-4">
        <input
          autofocus
          value=${value}
          onChange=${(e) => setValue(e.target.value)}
          maxlength="20"
          placeholder="Spielername"
          class="bg-base border border-panelBorder rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p class="text-xs text-muted">Kein Passwort nötig — dieser Name identifiziert dich nur in der öffentlichen Bestenliste.</p>
        <button
          type="submit"
          disabled=${!value.trim()}
          class="px-4 py-3 rounded-xl bg-accent text-black font-semibold disabled:opacity-40 active:scale-95 transition"
        >
          Bestätigen
        </button>
      </form>
    <//>
  `;
}

function SettingsPanel({ onClose, timeFormat, onTimeFormatChange, isLoggedIn, isAdmin, nameStyle, onNameStyleChange, onLogout }) {
  return html`
    <${Modal} title="Einstellungen" onClose=${onClose}>
      <div class="flex flex-col gap-6">
        <section>
          <h3 class="text-xs uppercase tracking-widest text-muted mb-3">Zeitanzeige</h3>
          <div class="grid grid-cols-2 gap-2">
            <button
              onClick=${() => onTimeFormatChange('seconds')}
              class=${`py-2.5 rounded-xl border text-sm font-medium transition ${timeFormat === 'seconds' ? 'bg-accent text-black border-accent' : 'bg-base border-panelBorder text-muted hover:text-white'}`}
            >Sekunden<//>
            <button
              onClick=${() => onTimeFormatChange('minutes')}
              class=${`py-2.5 rounded-xl border text-sm font-medium transition ${timeFormat === 'minutes' ? 'bg-accent text-black border-accent' : 'bg-base border-panelBorder text-muted hover:text-white'}`}
            >Minuten:Sekunden<//>
          </div>
        </section>

        ${isLoggedIn && !isAdmin && html`
          <section>
            <h3 class="text-xs uppercase tracking-widest text-muted mb-3">Namensstil</h3>
            <div class="grid grid-cols-3 gap-2">
              ${NAME_STYLES.map((style) => html`
                <button
                  key=${style.id}
                  onClick=${() => onNameStyleChange(style.id)}
                  class=${`py-2 rounded-lg border text-xs font-semibold transition bg-base ${nameStyle === style.id ? 'border-accent' : 'border-panelBorder'}`}
                >
                  <span class=${style.className ? `name-gradient ${style.className}` : 'text-white'}>${style.label}</span>
                <//>
              `)}
            </div>
          </section>
        `}

        ${isLoggedIn && html`
          <button onClick=${onLogout} class="text-sm text-bad/90 hover:text-bad text-left">Abmelden<//>
        `}
      </div>
    <//>
  `;
}

// Erkennt Einzelklick vs. 3 schnell aufeinanderfolgende Klicks (nur im Admin-Modus
// relevant: Einzelklick öffnet die Nutzer-Statistik, Dreifachklick entfernt den
// Eintrag direkt aus der Bestenliste).
const RAPID_CLICK_WINDOW_MS = 550;

function useMultiClick(onSingle, onTriple) {
  const timestampsRef = useRef([]);
  const singleClickTimerRef = useRef(null);

  return useCallback(() => {
    const now = Date.now();
    const recent = [...timestampsRef.current.filter((t) => now - t < RAPID_CLICK_WINDOW_MS), now];
    timestampsRef.current = recent;

    if (recent.length >= 3) {
      timestampsRef.current = [];
      clearTimeout(singleClickTimerRef.current);
      onTriple();
      return;
    }

    clearTimeout(singleClickTimerRef.current);
    singleClickTimerRef.current = setTimeout(() => {
      if (timestampsRef.current.length > 0) onSingle();
      timestampsRef.current = [];
    }, RAPID_CLICK_WINDOW_MS);
  }, [onSingle, onTriple]);
}

function LeaderboardRow({ entry, index, timeFormat, isMe, isAdmin, onOpenStats, onQuickRemove }) {
  const style = getNameStyle(entry.name_style);
  const handleClick = useMultiClick(
    () => onOpenStats(entry),
    () => onQuickRemove(entry.username)
  );

  return html`
    <div
      onClick=${isAdmin ? handleClick : undefined}
      class=${`flex items-center justify-between px-3 py-2.5 rounded-xl transition ${isMe ? 'bg-accent/10 border border-accent/40' : 'bg-base'} ${isAdmin ? 'cursor-pointer active:scale-[0.99]' : ''}`}
    >
      <div class="flex items-center gap-3">
        <span class="text-muted text-sm w-5 tabular-digits">${index + 1}</span>
        <span class=${`text-sm font-medium ${style.className ? `name-gradient ${style.className}` : 'text-white'}`}>${entry.username}</span>
      </div>
      <span class="tabular-digits text-sm text-white">${formatTime(entry.best_ms, timeFormat)}</span>
    </div>
  `;
}

function ConfirmResetAllModal({ onConfirm, onCancel }) {
  return html`
    <${Modal} title="Bestenliste komplett zurücksetzen?" onClose=${onCancel}>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-white leading-relaxed">
          Das entfernt <span class="font-semibold text-bad">alle</span> Einträge der öffentlichen
          Bestenliste unwiderruflich. Fortfahren?
        </p>
        <div class="flex gap-3">
          <button
            onClick=${onCancel}
            class="flex-1 px-4 py-3 rounded-xl bg-panel border border-panelBorder text-white font-semibold active:scale-95 transition"
          >Abbrechen<//>
          <button
            onClick=${onConfirm}
            class="flex-1 px-4 py-3 rounded-xl bg-bad text-white font-semibold active:scale-95 transition"
          >Alle entfernen<//>
        </div>
      </div>
    <//>
  `;
}

function AdminUserStatsModal({ entry, timeFormat, busy, onBan, onResetStats, onClose }) {
  const style = getNameStyle(entry.name_style);
  const updatedLabel = entry.updated_at
    ? new Date(entry.updated_at).toLocaleString('de-DE')
    : '—';

  return html`
    <${Modal} title="Nutzer-Statistik" onClose=${onClose}>
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-3">
          <span class=${`text-lg font-semibold ${style.className ? `name-gradient ${style.className}` : 'text-white'}`}>
            ${entry.username}
          </span>
          <div class="grid grid-cols-2 gap-3">
            <${StatCard} label="Bestzeit" value=${formatTime(entry.best_ms, timeFormat)} />
            <${StatCard} label="Zuletzt aktualisiert" value=${updatedLabel} wide=${true} />
          </div>
        </div>

        <div class="flex gap-3">
          <button
            disabled=${busy}
            onClick=${onBan}
            style=${{ backgroundColor: '#ff5d5d', color: '#39ff14' }}
            class="flex-1 px-4 py-3 rounded-xl font-bold tracking-wide disabled:opacity-40 active:scale-95 transition"
          >Ban<//>
          <button
            disabled=${busy}
            onClick=${onResetStats}
            class="flex-1 px-4 py-3 rounded-xl bg-panel border border-panelBorder text-white font-semibold disabled:opacity-40 active:scale-95 transition"
          >Reset Stats<//>
        </div>
      </div>
    <//>
  `;
}

function LeaderboardPanel({
  onClose,
  timeFormat,
  entries,
  loading,
  error,
  stats,
  currentUsername,
  isAdmin,
  onBanUser,
  onResetUser,
  onResetAll,
  onClearBest
}) {
  const [tab, setTab] = useState('leaderboard');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [confirmClearBest, setConfirmClearBest] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminNotice, setAdminNotice] = useState(null);

  const flashNotice = useCallback((message) => {
    setAdminNotice(message);
    setTimeout(() => setAdminNotice(null), 3500);
  }, []);

  const handleQuickRemove = useCallback(
    async (username) => {
      setAdminBusy(true);
      const result = await onResetUser(username);
      setAdminBusy(false);
      flashNotice(result.ok ? `„${username}“ aus der Bestenliste entfernt.` : result.message);
    },
    [onResetUser, flashNotice]
  );

  const handleBan = useCallback(async () => {
    if (!selectedEntry) return;
    setAdminBusy(true);
    const result = await onBanUser(selectedEntry.username);
    setAdminBusy(false);
    if (result.ok) {
      flashNotice(`„${selectedEntry.username}“ wurde gesperrt.`);
      setSelectedEntry(null);
    } else {
      flashNotice(result.message);
    }
  }, [selectedEntry, onBanUser, flashNotice]);

  const handleResetStats = useCallback(async () => {
    if (!selectedEntry) return;
    setAdminBusy(true);
    const result = await onResetUser(selectedEntry.username);
    setAdminBusy(false);
    if (result.ok) {
      flashNotice(`Statistik von „${selectedEntry.username}“ zurückgesetzt.`);
      setSelectedEntry(null);
    } else {
      flashNotice(result.message);
    }
  }, [selectedEntry, onResetUser, flashNotice]);

  const handleResetAll = useCallback(async () => {
    setAdminBusy(true);
    const result = await onResetAll();
    setAdminBusy(false);
    setConfirmResetAll(false);
    flashNotice(result.ok ? 'Bestenliste wurde vollständig zurückgesetzt.' : result.message);
  }, [onResetAll, flashNotice]);

  return html`
    <${Modal} title="Bestenliste" onClose=${onClose}>
      <div class="flex gap-2 mb-5">
        <button
          onClick=${() => setTab('leaderboard')}
          class=${`flex-1 py-2 rounded-xl text-sm font-medium transition ${tab === 'leaderboard' ? 'bg-accent text-black' : 'bg-base text-muted border border-panelBorder'}`}
        >Top 10<//>
        <button
          onClick=${() => setTab('stats')}
          class=${`flex-1 py-2 rounded-xl text-sm font-medium transition ${tab === 'stats' ? 'bg-accent text-black' : 'bg-base text-muted border border-panelBorder'}`}
        >Meine Statistik<//>
      </div>

      ${tab === 'leaderboard'
        ? html`
          <div class="flex flex-col gap-1.5">
            ${isAdmin && html`
              <p class="text-[11px] text-muted mb-1">
                Admin: Eintrag antippen für Details · 3× schnell antippen zum sofortigen Entfernen.
              </p>
            `}
            ${error && html`<p class="text-bad text-sm">${error}</p>`}
            ${!error && loading && html`<p class="text-muted text-sm">Lade Bestenliste…</p>`}
            ${!error && !loading && entries.length === 0 && html`<p class="text-muted text-sm">Noch keine Einträge. Sei die/der Erste!</p>`}
            ${entries.map((entry, i) => html`
              <${LeaderboardRow}
                key=${entry.username}
                entry=${entry}
                index=${i}
                timeFormat=${timeFormat}
                isMe=${entry.username === currentUsername}
                isAdmin=${isAdmin}
                onOpenStats=${setSelectedEntry}
                onQuickRemove=${handleQuickRemove}
              />
            `)}
            ${isAdmin && entries.length > 0 && html`
              <button
                onClick=${() => setConfirmResetAll(true)}
                class="mt-3 px-4 py-2.5 rounded-xl bg-panel border border-bad/50 text-bad text-sm font-semibold active:scale-95 transition"
              >Bestenliste komplett zurücksetzen<//>
            `}
            ${adminNotice && html`<p class="text-xs text-accent mt-1">${adminNotice}</p>`}
          </div>
        `
        : html`
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-3">
              <${StatCard} label="Bestzeit" value=${stats.best !== null ? formatTime(stats.best, timeFormat) : '--.--'} />
              <${StatCard} label="Ø letzte 5" value=${stats.avg5 !== null ? formatTime(stats.avg5, timeFormat) : '--.--'} />
              <${StatCard} label="Ø letzte 12" value=${stats.avg12 !== null ? formatTime(stats.avg12, timeFormat) : '--.--'} />
              <${StatCard} label="Solves gesamt" value=${String(stats.totalSolves)} />
              <${StatCard} label="Gesamtspielzeit" value=${formatTotalTime(stats.totalTimeMs)} wide=${true} />
            </div>
            ${stats.best !== null && html`
              <button
                onClick=${() => setConfirmClearBest(true)}
                class="px-4 py-2 rounded-xl bg-panel border border-panelBorder text-muted text-xs font-semibold active:scale-95 transition self-start"
              >Bestzeit löschen<//>
            `}
          </div>
        `}
    <//>

    ${selectedEntry && html`
      <${AdminUserStatsModal}
        entry=${selectedEntry}
        timeFormat=${timeFormat}
        busy=${adminBusy}
        onBan=${handleBan}
        onResetStats=${handleResetStats}
        onClose=${() => setSelectedEntry(null)}
      />
    `}

    ${confirmResetAll && html`
      <${ConfirmResetAllModal}
        onConfirm=${handleResetAll}
        onCancel=${() => setConfirmResetAll(false)}
      />
    `}

    ${confirmClearBest && html`
      <${ConfirmClearBestModal}
        onConfirm=${() => { onClearBest(); setConfirmClearBest(false); }}
        onCancel=${() => setConfirmClearBest(false)}
      />
    `}
  `;
}

function StatCard({ label, value, wide }) {
  return html`
    <div class=${`bg-base border border-panelBorder rounded-xl p-4 ${wide ? 'col-span-2' : ''}`}>
      <p class="text-[11px] uppercase tracking-widest text-muted mb-1">${label}</p>
      <p class="tabular-digits text-lg text-white font-semibold">${value}</p>
    </div>
  `;
}

function Header({ personalBest, timeFormat, username, nameStyle, isAdmin, onOpenLeaderboard, onOpenSettings, onOpenLogin, onOpenLogout, onOpenTutorial }) {
  const style = getNameStyle(nameStyle);
  return html`
    <div class="flex items-start justify-between px-4 pt-4 sm:px-6 sm:pt-6 select-none">
      <button onClick=${onOpenLeaderboard} class="flex flex-col items-start gap-1 text-left group" aria-label="Bestenliste öffnen">
        <span class="text-2xl leading-none group-active:scale-90 transition-transform">🏆</span>
        <span class="text-[11px] uppercase tracking-widest text-muted">
          Beste<br />
          <span class="text-sm text-white tabular-digits normal-case tracking-normal">
            ${personalBest !== null ? formatTime(personalBest, timeFormat) : '--.--'}
          </span>
        </span>
      </button>

      <div class="flex flex-col items-end gap-2">
        <div class="flex items-center gap-3">
          ${isAdmin
            ? html`
              <span class="text-sm font-semibold text-bad tracking-wide">🛡 Admin-Modus</span>
              <button onClick=${onOpenLogout} class="text-sm px-3 py-1.5 rounded-lg bg-panel border border-panelBorder text-muted hover:text-white transition">Ausloggen<//>
            `
            : username
            ? html`
              <span class=${`text-sm font-semibold ${style.className ? `name-gradient ${style.className}` : 'text-white'}`}>${username}</span>
              <button onClick=${onOpenLogout} class="text-sm px-3 py-1.5 rounded-lg bg-panel border border-panelBorder text-muted hover:text-white transition">Ausloggen<//>
            `
            : html`<button onClick=${onOpenLogin} class="text-sm px-3 py-1.5 rounded-lg bg-panel border border-panelBorder text-muted hover:text-white transition">Einloggen<//>`}
          <button onClick=${onOpenSettings} aria-label="Einstellungen öffnen" class="text-xl leading-none active:scale-90 transition-transform">⚙<//>
        </div>
        <button
          onClick=${onOpenTutorial}
          aria-label="Tutorial öffnen"
          class="text-xs px-3 py-1.5 rounded-lg bg-panel border border-panelBorder text-muted hover:text-white transition"
        >Tutorial<//>
      </div>
    </div>
  `;
}

/* ============================================================================
 * Tutorial: Daten & Diagramme
 * ----------------------------------------------------------------------------
 * Eigenständig erstellte Illustrationen (kein Bildmaterial Dritter) zur
 * Erklärung von Würfelaufbau, Grundzügen und der Anfängermethode.
 * ==========================================================================*/
const CUBE_COLORS = {
  white: '#f2f3f5',
  yellow: '#ffd400',
  red: '#ff5d5d',
  orange: '#ff9f43',
  green: '#3ddc84',
  blue: '#4fa3ff',
  grey: '#20242e'
};

function FaceGrid({ cells, size = 96 }) {
  return html`
    <div
      class="grid grid-cols-3 gap-1 rounded-lg bg-[#05060a] p-1 mx-auto shrink-0"
      style=${{ width: `${size}px`, height: `${size}px` }}
    >
      ${cells.map((c, i) => {
        const cell = typeof c === 'string' ? { bg: c } : c;
        return html`
          <div key=${i} class="relative rounded-[3px]" style=${{ background: CUBE_COLORS[cell.bg] ?? CUBE_COLORS.grey }}>
            ${cell.dot && html`<span class="absolute inset-[6px] rounded-full" style=${{ background: CUBE_COLORS[cell.dot] }}></span>`}
          </div>
        `;
      })}
    </div>
  `;
}

function StructureDiagram() {
  const roleCells = ['corner', 'edge', 'corner', 'edge', 'center', 'edge', 'corner', 'edge', 'corner'];
  const roleColor = { corner: 'blue', edge: 'orange', center: 'red' };
  const cells = roleCells.map((r) => roleColor[r]);
  return html`
    <div class="flex flex-col items-center gap-3">
      <${FaceGrid} cells=${cells} size=${120} />
      <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span><span class="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style=${{ background: CUBE_COLORS.red }}></span>Mittelstein (1 Farbe, bewegt sich nicht)</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style=${{ background: CUBE_COLORS.orange }}></span>Kantenstein (2 Farben)</span>
        <span><span class="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style=${{ background: CUBE_COLORS.blue }}></span>Eckstein (3 Farben)</span>
      </div>
    </div>
  `;
}

function MoveIcon({ code, faceColor, dir, label }) {
  const cells = Array(9).fill(faceColor);
  return html`
    <div class="flex flex-col items-center gap-1.5 w-[92px]">
      <div class="relative">
        <${FaceGrid} cells=${cells} size=${72} />
        <span class="absolute inset-0 flex items-center justify-center text-2xl font-bold text-black/60">
          ${dir === 'cw' ? '↻' : '↺'}
        </span>
      </div>
      <span class="tabular-digits text-sm font-bold text-white">${code}</span>
      <span class="text-[10px] text-muted text-center leading-tight">${label}</span>
    </div>
  `;
}

const BASIC_MOVES = [
  { code: 'R', faceColor: 'red', dir: 'cw', label: 'Rechte Seite, Blick von rechts, im Uhrzeigersinn' },
  { code: "R'", faceColor: 'red', dir: 'ccw', label: 'Rechte Seite, gegen den Uhrzeigersinn' },
  { code: 'L', faceColor: 'orange', dir: 'cw', label: 'Linke Seite, Blick von links, im Uhrzeigersinn' },
  { code: "L'", faceColor: 'orange', dir: 'ccw', label: 'Linke Seite, gegen den Uhrzeigersinn' },
  { code: 'U', faceColor: 'white', dir: 'cw', label: 'Oberseite, Blick von oben, im Uhrzeigersinn' },
  { code: "U'", faceColor: 'white', dir: 'ccw', label: 'Oberseite, gegen den Uhrzeigersinn' },
  { code: 'D', faceColor: 'yellow', dir: 'cw', label: 'Unterseite, Blick von unten, im Uhrzeigersinn' },
  { code: "D'", faceColor: 'yellow', dir: 'ccw', label: 'Unterseite, gegen den Uhrzeigersinn' },
  { code: 'F', faceColor: 'green', dir: 'cw', label: 'Vorderseite, Blick von vorne, im Uhrzeigersinn' },
  { code: "F'", faceColor: 'green', dir: 'ccw', label: 'Vorderseite, gegen den Uhrzeigersinn' },
  { code: 'B', faceColor: 'blue', dir: 'cw', label: 'Rückseite, Blick von hinten, im Uhrzeigersinn' },
  { code: "B'", faceColor: 'blue', dir: 'ccw', label: 'Rückseite, gegen den Uhrzeigersinn' }
];

const TUTORIAL_STEPS = [
  {
    id: 'step-1',
    title: '1. Weißes Kreuz',
    text: 'Bilde zuerst ein weißes „Gänseblümchen“ um den gelben Mittelstein, dann klappe jede weiße Kante so nach unten, dass ihre zweite Farbe zur jeweiligen Seitenmitte passt. Am Ende bildet Weiß ein Kreuz, dessen vier Kanten farblich zur Seite passen.',
    algorithm: null,
    cells: ['grey', 'white', 'grey', 'white', 'white', 'white', 'grey', 'white', 'grey']
  },
  {
    id: 'step-2',
    title: '2. Weiße Ecken',
    text: 'Suche oben eine Ecke mit weißer Fläche und drehe die obere Schicht, bis ihre Seitenfarben über der passenden Mittelfarbe stehen. Wiederhole den Algorithmus, bis die weiße Fläche nach unten zeigt. Danach zeigt jede Seite ein umgedrehtes „T“.',
    algorithm: "R U R' U'",
    cells: ['blue', 'white', 'blue', 'grey', 'white', 'grey', 'blue', 'white', 'blue']
  },
  {
    id: 'step-3',
    title: '3. Mittlere Kanten',
    text: 'Jetzt kommen die vier mittleren Kantensteine (ohne Gelb) an ihren Platz. Finde oben ein passendes Kantenstück und schiebe es je nach Richtung mit einem der beiden Algorithmen seitlich ein. Danach bilden die unteren zwei Schichten ein farbiges Rechteck.',
    algorithm: "U R U R' U' F' U' F   /   U' L' U' L U F U F'",
    cells: ['grey', 'grey', 'grey', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue']
  },
  {
    id: 'step-4',
    title: '4. Gelbes Kreuz',
    text: 'Drehe den Würfel so, dass Gelb oben liegt. Führe den Algorithmus so oft aus, bis oben ein gelbes Kreuz entsteht — je nach Startmuster (Punkt, Linie oder Winkel) sind das ein bis drei Durchläufe.',
    algorithm: "F R U R' U' F'",
    cells: ['grey', 'yellow', 'grey', 'yellow', 'yellow', 'yellow', 'grey', 'yellow', 'grey']
  },
  {
    id: 'step-5',
    title: '5. Gelbe Kanten ausrichten',
    text: 'Die vier Kanten des gelben Kreuzes müssen jetzt noch farblich zur passenden Seite gedreht werden. Richte den Würfel so aus, dass möglichst viele Kanten schon passen, und wiederhole den Algorithmus, bis alle vier stimmen.',
    algorithm: "R U R' U R U2 R'",
    cells: ['grey', { bg: 'yellow', dot: 'red' }, 'grey', { bg: 'yellow', dot: 'green' }, 'yellow', { bg: 'yellow', dot: 'blue' }, 'grey', { bg: 'yellow', dot: 'orange' }, 'grey']
  },
  {
    id: 'step-6',
    title: '6. Gelbe Ecken einsortieren',
    text: 'Jetzt werden die vier Ecken an die richtige Position gebracht (die Ausrichtung ist noch egal). Halte eine bereits richtig positionierte Ecke oben rechts und wiederhole den Algorithmus, bis alle vier Ecken an ihrem Platz sind.',
    algorithm: "U R U' L' U R' U' L",
    cells: [{ bg: 'yellow', dot: 'grey' }, 'yellow', { bg: 'yellow', dot: 'grey' }, 'yellow', 'yellow', 'yellow', { bg: 'yellow', dot: 'grey' }, 'yellow', { bg: 'yellow', dot: 'grey' }]
  },
  {
    id: 'step-7',
    title: '7. Gelbe Ecken ausrichten',
    text: 'Zum Schluss wird jede Ecke einzeln oben rechts ausgerichtet, ohne den Würfel dabei zu drehen — nur die vordere Schicht darf zwischendurch gedreht werden, um zur nächsten Ecke zu wechseln. Wiederhole pro Ecke, bis die gelbe Fläche oben liegt.',
    algorithm: "U R' U' R",
    cells: Array(9).fill('yellow')
  }
];

function TutorialSection({ innerRef, eyebrow, title, children }) {
  return html`
    <section ref=${innerRef} class="scroll-mt-24 py-8 border-b border-panelBorder last:border-b-0">
      ${eyebrow && html`<p class="text-[11px] uppercase tracking-widest text-accent mb-1">${eyebrow}</p>`}
      <h3 class="text-lg font-semibold text-white mb-3">${title}</h3>
      ${children}
    </section>
  `;
}

function TutorialOverlay({ onClose }) {
  const sectionRefs = useRef({});
  const scrollAreaRef = useRef(null);

  const jumpTo = useCallback((id) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const legendItems = [
    { id: 'intro', label: 'Aufbau & Grundzüge' },
    ...TUTORIAL_STEPS.map((s) => ({ id: s.id, label: s.title }))
  ];

  return html`
    <div class="fixed inset-0 z-[70] bg-base flex flex-col">
      <div class="flex items-center justify-between px-4 py-3 sm:px-6 border-b border-panelBorder shrink-0">
        <button
          onClick=${onClose}
          class="flex items-center gap-1.5 text-sm font-semibold text-white active:opacity-60 transition"
        >
          <span class="text-lg leading-none">←</span> Beenden
        </button>
        <span class="text-sm font-semibold text-muted">Tutorial</span>
        <button
          onClick=${() => jumpTo('intro')}
          class="text-sm px-3 py-1.5 rounded-lg bg-accent text-black font-semibold active:scale-95 transition"
        >Anleitung starten<//>
      </div>

      <div ref=${scrollAreaRef} class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-5 sm:px-6 py-6">

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-3">Übersicht</h2>
            <div class="flex flex-wrap gap-2">
              ${legendItems.map((item) => html`
                <button
                  key=${item.id}
                  onClick=${() => jumpTo(item.id)}
                  class="text-xs px-3 py-2 rounded-xl bg-panel border border-panelBorder text-muted hover:text-white hover:border-accent transition"
                >${item.label}<//>
              `)}
            </div>
          </div>

          <${TutorialSection} innerRef=${(el) => (sectionRefs.current['intro'] = el)} eyebrow="Grundlagen" title="Aufbau des Würfels">
            <p class="text-sm text-muted leading-relaxed mb-4">
              Der Würfel besteht aus drei Steinarten: Mittelsteine (legen die feste Farbe einer Seite fest),
              Kantensteine (2 Farben) und Ecksteine (3 Farben). Mittelsteine bewegen sich nie relativ
              zueinander — sie zeigen dir also immer, welche Farbe eine Seite am Ende haben muss.
            </p>
            <${StructureDiagram} />
          <//>

          <${TutorialSection} innerRef=${(el) => (sectionRefs.current['intro-moves'] = el)} eyebrow="Grundlagen" title="Grundzüge & Notation">
            <p class="text-sm text-muted leading-relaxed mb-4">
              Jeder Zug dreht eine Außenschicht um 90°. Der Buchstabe steht für die Seite, ein Apostroph
              (z. B. R') bedeutet gegen den Uhrzeigersinn — jeweils betrachtet mit Blick direkt auf diese Seite.
            </p>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-x-2 gap-y-4 justify-items-center">
              ${BASIC_MOVES.map((m) => html`<${MoveIcon} key=${m.code} ...${m} />`)}
            </div>
          <//>

          ${TUTORIAL_STEPS.map((step) => html`
            <${TutorialSection} key=${step.id} innerRef=${(el) => (sectionRefs.current[step.id] = el)} eyebrow="Anfängermethode" title=${step.title}>
              <div class="flex flex-col sm:flex-row gap-5 items-start">
                <${FaceGrid} cells=${step.cells} size=${104} />
                <div class="flex-1">
                  <p class="text-sm text-muted leading-relaxed mb-3">${step.text}</p>
                  ${step.algorithm && html`
                    <div class="inline-block bg-panel border border-panelBorder rounded-lg px-3 py-2">
                      <span class="tabular-digits text-sm font-semibold text-accent">${step.algorithm}</span>
                    </div>
                  `}
                </div>
              </div>
            <//>
          `)}

          <div class="pt-6 pb-2 text-center">
            <p class="text-sm text-muted mb-4">Geschafft! Wenn alle sechs Seiten einfarbig sind, ist der Würfel gelöst.</p>
            <button
              onClick=${onClose}
              class="px-6 py-3 rounded-xl bg-accent text-black font-semibold tracking-wide active:scale-95 transition"
            >Zur Stoppuhr<//>
          </div>
        </div>
      </div>
    </div>
  `;
}

function TimerScreen({ timeFormat, personalBest, onPhaseChange, onConfirm }) {
  const [phase, setPhase] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalMs, setFinalMs] = useState(null);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  const setPhaseAndNotify = useCallback((next) => {
    setPhase(next);
    onPhaseChange(next);
  }, [onPhaseChange]);

  const tick = useCallback(() => {
    setElapsedMs(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (phase === 'idle') {
      setPhaseAndNotify('holding');
    } else if (phase === 'running') {
      const ms = performance.now() - startRef.current;
      cancelAnimationFrame(rafRef.current);
      setFinalMs(ms);
      setPhaseAndNotify('result');
    }
  }, [phase, setPhaseAndNotify]);

  const handlePointerUp = useCallback(() => {
    if (phase === 'holding') {
      startRef.current = performance.now();
      setElapsedMs(0);
      setPhaseAndNotify('running');
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [phase, setPhaseAndNotify, tick]);

  const reset = useCallback(() => {
    setFinalMs(null);
    setElapsedMs(0);
    setPhaseAndNotify('idle');
  }, [setPhaseAndNotify]);

  const improvementMs = finalMs !== null && personalBest !== null ? personalBest - finalMs : null;

  return html`
    <div
      class="no-select flex-1 flex flex-col items-center justify-center transition-colors duration-150"
      style=${{ background: phase === 'holding' ? '#ffcc33' : 'transparent' }}
      onPointerDown=${phase === 'idle' || phase === 'running' ? handlePointerDown : undefined}
      onPointerUp=${phase === 'holding' ? handlePointerUp : undefined}
      role="button"
      aria-label="Timer-Touchfläche"
    >
      ${phase === 'idle' && html`<p class="text-muted text-sm sm:text-base tracking-widest uppercase">Bildschirm berühren zum Start</p>`}

      ${(phase === 'holding' || phase === 'running') && html`
        <span
          class=${`tabular-digits font-bold leading-none ${phase === 'holding' ? 'text-black/80' : 'text-white'}`}
          style=${{ fontSize: 'min(22vw, 20vh)' }}
        >${formatTime(phase === 'running' ? elapsedMs : 0, timeFormat)}</span>
      `}

      ${phase === 'result' && finalMs !== null && html`
        <div class="flex flex-col items-center gap-6 px-6">
          <span class="tabular-digits font-bold leading-none text-white" style=${{ fontSize: 'min(18vw, 16vh)' }}>
            ${formatTime(finalMs, timeFormat)}
          </span>

          ${improvementMs === null
            ? html`<span class="text-good text-xl sm:text-2xl font-semibold tracking-wide">Neue Bestzeit!<//>`
            : html`<span class=${`text-xl sm:text-2xl font-semibold tracking-wide ${improvementMs >= 0 ? 'text-good' : 'text-bad'}`}>${formatDelta(improvementMs)} Sekunden<//>`}

          <div class="flex gap-4 mt-2">
            <button
              onClick=${(e) => { e.stopPropagation(); onConfirm(finalMs); reset(); }}
              class="px-6 py-3 rounded-xl bg-accent text-black font-semibold tracking-wide hover:opacity-90 active:scale-95 transition"
            >Bestätigen<//>
            <button
              onClick=${(e) => { e.stopPropagation(); reset(); }}
              class="px-6 py-3 rounded-xl bg-panel border border-panelBorder text-muted font-semibold tracking-wide hover:text-white active:scale-95 transition"
            >Verwerfen<//>
          </div>
        </div>
      `}
    </div>
  `;
}

function App() {
  const { auth, login, logout, setNameStyle, isLoggedIn, isAdmin } = useAuth();
  const { settings, setTimeFormat } = useSettings();
  const { addSolve, stats, clearBest } = useStats();
  const { entries, loading, error, submitScore, removeOwnScore, adminRemoveEntry, adminBanUsername, adminResetAll } = useLeaderboard();
  const { strikes, addStrike, isLocked } = useStrikes();

  const [modal, setModal] = useState('none');
  const [timerPhase, setTimerPhase] = useState('idle');
  const [submitNotice, setSubmitNotice] = useState(null);
  const [cheatDialog, setCheatDialog] = useState('none'); // none | warning | contact
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const handleAdminTimeout = useCallback(() => logout(), [logout]);
  const { showCheck: showAdminStillThere, secondsLeft: adminSecondsLeft, confirmStillThere } =
    useAdminIdleCheck(isAdmin, handleAdminTimeout);

  const closeModal = useCallback(() => setModal('none'), []);

  const handleConfirm = useCallback(async (ms) => {
    addSolve(ms);
    if (!isLoggedIn || !auth || isAdmin) return;

    // Cheat-Verdacht: eingereichte Zeit liegt zwischen 0 und 55 Sekunden.
    // Diese Zeit wird NICHT an die Bestenliste übermittelt, es zählt stattdessen
    // ein Strike und der Warn-Dialog erscheint.
    if (ms > 0 && ms < CHEAT_TIME_THRESHOLD_MS) {
      addStrike();
      setCheatDialog('warning');
      return;
    }

    const result = await submitScore(auth.username, auth.nameStyle, ms);
    if (!result.ok && result.message) {
      setSubmitNotice(result.message);
      setTimeout(() => setSubmitNotice(null), 4000);
    }
  }, [addSolve, addStrike, auth, isLoggedIn, isAdmin, submitScore]);

  // Löscht die lokale Bestzeit und – falls für den eingeloggten Nutzer ein
  // Eintrag in der Online-Bestenliste existiert – auch diesen.
  const handleClearBest = useCallback(async () => {
    clearBest();
    if (!isLoggedIn || !auth || isAdmin) return;
    const hasLeaderboardEntry = entries.some((e) => e.username === auth.username);
    if (!hasLeaderboardEntry) return;
    const result = await removeOwnScore(auth.username);
    if (!result.ok && result.message) {
      setSubmitNotice(result.message);
      setTimeout(() => setSubmitNotice(null), 4000);
    }
  }, [clearBest, isLoggedIn, auth, isAdmin, entries, removeOwnScore]);

  const chromeHidden = timerPhase === 'holding' || timerPhase === 'running';

  if (isLocked) {
    return html`
      <div class="h-full min-h-screen flex flex-col bg-base">
        <${LockedScreen} onContactDeveloper=${() => setCheatDialog('contact')} onLogout=${() => setConfirmLogout(true)} />
        ${cheatDialog === 'contact' && html`
          <${ContactDeveloperDialog}
            strikeCount=${strikes.count}
            username=${auth?.username ?? null}
            onClose=${() => setCheatDialog('none')}
          />
        `}
        ${confirmLogout && html`
          <${ConfirmLogoutModal}
            onConfirm=${() => { logout(); setConfirmLogout(false); }}
            onCancel=${() => setConfirmLogout(false)}
          />
        `}
      </div>
    `;
  }

  return html`
    <div class="h-full min-h-screen flex flex-col bg-base">
      ${!chromeHidden && html`
        <${Header}
          personalBest=${stats.best}
          timeFormat=${settings.timeFormat}
          username=${auth?.username ?? null}
          nameStyle=${auth?.nameStyle ?? 'default'}
          isAdmin=${isAdmin}
          onOpenLeaderboard=${() => setModal('leaderboard')}
          onOpenSettings=${() => setModal('settings')}
          onOpenLogin=${() => setModal('login')}
          onOpenLogout=${() => setConfirmLogout(true)}
          onOpenTutorial=${() => setShowTutorial(true)}
        />
      `}

      <${TimerScreen}
        timeFormat=${settings.timeFormat}
        personalBest=${stats.best}
        onPhaseChange=${setTimerPhase}
        onConfirm=${handleConfirm}
      />

      ${submitNotice && html`
        <div class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-panel border border-panelBorder text-bad text-xs px-4 py-2 rounded-full">
          ${submitNotice}
        </div>
      `}

      ${cheatDialog === 'warning' && html`
        <${CheatWarningModal}
          strikeCount=${strikes.count}
          onOk=${() => setCheatDialog('none')}
          onContactDeveloper=${() => setCheatDialog('contact')}
        />
      `}

      ${cheatDialog === 'contact' && html`
        <${ContactDeveloperDialog}
          strikeCount=${strikes.count}
          username=${auth?.username ?? null}
          onClose=${() => setCheatDialog('none')}
        />
      `}

      ${confirmLogout && html`
        <${ConfirmLogoutModal}
          onConfirm=${() => { logout(); setConfirmLogout(false); }}
          onCancel=${() => setConfirmLogout(false)}
        />
      `}

      ${modal === 'login' && html`<${LoginDialog} onClose=${closeModal} onSubmit=${login} />`}

      ${modal === 'settings' && html`
        <${SettingsPanel}
          onClose=${closeModal}
          timeFormat=${settings.timeFormat}
          onTimeFormatChange=${setTimeFormat}
          isLoggedIn=${isLoggedIn}
          isAdmin=${isAdmin}
          nameStyle=${auth?.nameStyle ?? 'default'}
          onNameStyleChange=${setNameStyle}
          onLogout=${() => setConfirmLogout(true)}
        />
      `}

      ${modal === 'leaderboard' && html`
        <${LeaderboardPanel}
          onClose=${closeModal}
          timeFormat=${settings.timeFormat}
          entries=${entries}
          loading=${loading}
          error=${error}
          stats=${stats}
          currentUsername=${auth?.username ?? null}
          isAdmin=${isAdmin}
          onBanUser=${adminBanUsername}
          onResetUser=${adminRemoveEntry}
          onResetAll=${adminResetAll}
          onClearBest=${handleClearBest}
        />
      `}

      ${showTutorial && html`<${TutorialOverlay} onClose=${() => setShowTutorial(false)} />`}

      ${showAdminStillThere && html`
        <${AdminStillThereModal} secondsLeft=${adminSecondsLeft} onConfirm=${confirmStillThere} />
      `}
    </div>
  `;
}

/* ============================================================================
 * Mount
 * ==========================================================================*/
const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
