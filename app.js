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
 * lib: Cheat-Erkennung (DevTools) & Strike-System
 * ----------------------------------------------------------------------------
 * Erkennungsmethode: Vergleich von window.outerWidth/Height mit innerWidth/Height.
 * Sind Entwicklertools angedockt geöffnet, ist die Differenz deutlich größer als
 * bei einem normalen Browserfenster. Das ist eine Heuristik (kein 100%-sicherer
 * Nachweis) – losgelöste DevTools-Fenster oder Remote-Debugging werden dadurch
 * nicht erkannt. Ausgelöst wird der Strike erst, wenn die Differenz 55 Sekunden
 * lang UNUNTERBROCHEN bestehen bleibt, um Fehlalarme durch kurzes Öffnen oder
 * Fenster-Größenänderungen zu vermeiden.
 * ==========================================================================*/
const CHEAT_DEVTOOLS_THRESHOLD_MS = 55000;
const CHEAT_CHECK_INTERVAL_MS = 1000;
const CHEAT_SIZE_DIFF_PX = 160;

function isDevToolsLikelyOpen() {
  const widthDiff = window.outerWidth - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;
  return widthDiff > CHEAT_SIZE_DIFF_PX || heightDiff > CHEAT_SIZE_DIFF_PX;
}

function useDevToolsGuard(onThresholdReached, enabled) {
  const openSinceRef = useRef(null);
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const openNow = isDevToolsLikelyOpen();

      if (!openNow) {
        openSinceRef.current = null;
        triggeredRef.current = false;
        return;
      }

      if (openSinceRef.current === null) {
        openSinceRef.current = Date.now();
      }

      const openForMs = Date.now() - openSinceRef.current;
      if (openForMs >= CHEAT_DEVTOOLS_THRESHOLD_MS && !triggeredRef.current) {
        triggeredRef.current = true;
        onThresholdReached();
      }
    }, CHEAT_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled, onThresholdReached]);
}

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
 * Hooks
 * ==========================================================================*/
function useAuth() {
  const [auth, setAuth] = useState(() => loadAuth());

  const login = useCallback((username) => {
    const trimmed = username.trim().slice(0, 20);
    if (!trimmed) return;
    const next = { username: trimmed, nameStyle: 'ice' };
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

  return { auth, login, logout, setNameStyle, isLoggedIn: Boolean(auth) };
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

  return { solves, addSolve, stats };
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

  return { entries, loading, error, submitScore };
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
  return html`
    <${Modal} title="⚠️ Ungewöhnliche Aktivität erkannt" onClose=${onOk}>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-white leading-relaxed">
          Es wurde erkannt, dass die Entwicklertools deines Browsers länger als 55 Sekunden
          geöffnet waren. Das kann genutzt werden, um Zeiten in der Bestenliste zu manipulieren.
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

function LockedScreen({ onContactDeveloper }) {
  return html`
    <div class="h-full min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
      <span class="text-5xl leading-none">🔒</span>
      <h1 class="text-lg font-semibold text-white">Zugriff gesperrt</h1>
      <p class="text-sm text-muted max-w-xs leading-relaxed">
        Es wurden 3 von 3 Strikes wegen wiederholt erkannter Entwicklertools-Nutzung erreicht.
        Der Timer ist auf diesem Gerät gesperrt.
      </p>
      <button
        onClick=${onContactDeveloper}
        class="px-6 py-3 rounded-xl bg-accent text-black font-semibold tracking-wide active:scale-95 transition"
      >Entwickler kontaktieren<//>
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

function SettingsPanel({ onClose, timeFormat, onTimeFormatChange, isLoggedIn, nameStyle, onNameStyleChange, onLogout }) {
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

        ${isLoggedIn && html`
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

function LeaderboardPanel({ onClose, timeFormat, entries, loading, error, stats, currentUsername }) {
  const [tab, setTab] = useState('leaderboard');

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
            ${error && html`<p class="text-bad text-sm">${error}</p>`}
            ${!error && loading && html`<p class="text-muted text-sm">Lade Bestenliste…</p>`}
            ${!error && !loading && entries.length === 0 && html`<p class="text-muted text-sm">Noch keine Einträge. Sei die/der Erste!</p>`}
            ${entries.map((entry, i) => {
              const style = getNameStyle(entry.name_style);
              const isMe = entry.username === currentUsername;
              return html`
                <div key=${entry.username} class=${`flex items-center justify-between px-3 py-2.5 rounded-xl ${isMe ? 'bg-accent/10 border border-accent/40' : 'bg-base'}`}>
                  <div class="flex items-center gap-3">
                    <span class="text-muted text-sm w-5 tabular-digits">${i + 1}</span>
                    <span class=${`text-sm font-medium ${style.className ? `name-gradient ${style.className}` : 'text-white'}`}>${entry.username}</span>
                  </div>
                  <span class="tabular-digits text-sm text-white">${formatTime(entry.best_ms, timeFormat)}</span>
                </div>
              `;
            })}
          </div>
        `
        : html`
          <div class="grid grid-cols-2 gap-3">
            <${StatCard} label="Bestzeit" value=${stats.best !== null ? formatTime(stats.best, timeFormat) : '--.--'} />
            <${StatCard} label="Ø letzte 5" value=${stats.avg5 !== null ? formatTime(stats.avg5, timeFormat) : '--.--'} />
            <${StatCard} label="Ø letzte 12" value=${stats.avg12 !== null ? formatTime(stats.avg12, timeFormat) : '--.--'} />
            <${StatCard} label="Solves gesamt" value=${String(stats.totalSolves)} />
            <${StatCard} label="Gesamtspielzeit" value=${formatTotalTime(stats.totalTimeMs)} wide=${true} />
          </div>
        `}
    <//>
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

function Header({ personalBest, timeFormat, username, nameStyle, onOpenLeaderboard, onOpenSettings, onOpenLogin }) {
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

      <div class="flex items-center gap-3">
        ${username
          ? html`<span class=${`text-sm font-semibold ${style.className ? `name-gradient ${style.className}` : 'text-white'}`}>${username}</span>`
          : html`<button onClick=${onOpenLogin} class="text-sm px-3 py-1.5 rounded-lg bg-panel border border-panelBorder text-muted hover:text-white transition">Einloggen<//>`}
        <button onClick=${onOpenSettings} aria-label="Einstellungen öffnen" class="text-xl leading-none active:scale-90 transition-transform">⚙<//>
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
  const { auth, login, logout, setNameStyle, isLoggedIn } = useAuth();
  const { settings, setTimeFormat } = useSettings();
  const { addSolve, stats } = useStats();
  const { entries, loading, error, submitScore } = useLeaderboard();
  const { strikes, addStrike, isLocked } = useStrikes();

  const [modal, setModal] = useState('none');
  const [timerPhase, setTimerPhase] = useState('idle');
  const [submitNotice, setSubmitNotice] = useState(null);
  const [cheatDialog, setCheatDialog] = useState('none'); // none | warning | contact

  const closeModal = useCallback(() => setModal('none'), []);

  const handleCheatDetected = useCallback(() => {
    addStrike();
    setCheatDialog('warning');
  }, [addStrike]);

  useDevToolsGuard(handleCheatDetected, !isLocked);

  const handleConfirm = useCallback(async (ms) => {
    addSolve(ms);
    if (isLoggedIn && auth) {
      const result = await submitScore(auth.username, auth.nameStyle, ms);
      if (!result.ok && result.message) {
        setSubmitNotice(result.message);
        setTimeout(() => setSubmitNotice(null), 4000);
      }
    }
  }, [addSolve, auth, isLoggedIn, submitScore]);

  const chromeHidden = timerPhase === 'holding' || timerPhase === 'running';

  if (isLocked) {
    return html`
      <div class="h-full min-h-screen flex flex-col bg-base">
        <${LockedScreen} onContactDeveloper=${() => setCheatDialog('contact')} />
        ${cheatDialog === 'contact' && html`
          <${ContactDeveloperDialog}
            strikeCount=${strikes.count}
            username=${auth?.username ?? null}
            onClose=${() => setCheatDialog('none')}
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
          onOpenLeaderboard=${() => setModal('leaderboard')}
          onOpenSettings=${() => setModal('settings')}
          onOpenLogin=${() => setModal('login')}
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

      ${modal === 'login' && html`<${LoginDialog} onClose=${closeModal} onSubmit=${login} />`}

      ${modal === 'settings' && html`
        <${SettingsPanel}
          onClose=${closeModal}
          timeFormat=${settings.timeFormat}
          onTimeFormatChange=${setTimeFormat}
          isLoggedIn=${isLoggedIn}
          nameStyle=${auth?.nameStyle ?? 'default'}
          onNameStyleChange=${setNameStyle}
          onLogout=${logout}
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
        />
      `}
    </div>
  `;
}

/* ============================================================================
 * Mount
 * ==========================================================================*/
const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
