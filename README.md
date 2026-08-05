# Cube Timer – Einrichtung komplett über das iPhone

Diese Version braucht **keinen Computer, kein Terminal und kein npm**. React, Tailwind,
Supabase und EmailJS werden direkt im Browser geladen. Alles läuft über die normalen
Webseiten von GitHub, Supabase, EmailJS und Cloudflare – geöffnet in Safari auf dem iPhone.

Die App besteht bewusst nur aus **12 einzelnen Dateien ohne Unterordner**, damit du
sie bequem in einem Rutsch hochladen kannst.

> **Hinweis zu diesem Paket:** `config.js` ist in diesem Download bereits vollständig
> mit echten Zugangsdaten ausgefüllt (Supabase + EmailJS) – du musst dort nichts mehr
> eintragen. Die Schritte 6 und 7 unten sind trotzdem drin, falls du das Projekt später
> auf ein neues Supabase- oder EmailJS-Konto umziehen willst.

> **Wichtig, falls du dein bestehendes Supabase-Projekt weiterverwendest:** `schema.sql`
> wurde um den Admin-Modus erweitert (neue Tabelle `banned_usernames` sowie die Funktionen
> `admin_remove_entry`, `admin_ban_username`, `admin_reset_leaderboard`). Öffne die Datei
> auf github.com in der „Raw“-Ansicht, kopiere den **gesamten Inhalt** erneut und führe ihn
> im Supabase SQL-Editor aus (siehe Schritt 5) – bestehende Daten bleiben dabei erhalten.

---

## Überblick über die Schritte

1. Dateien in der Dateien-App entpacken
2. GitHub-Konto erstellen
3. Neues Repository erstellen und alle Dateien hochladen
4. Supabase-Projekt erstellen *(bereits erledigt, falls du die mitgelieferte `config.js` unverändert nutzt)*
5. Datenbank importieren *(bereits erledigt, falls dein Supabase-Projekt aus diesem Paket stammt)*
6. `config.js` mit Supabase-Zugangsdaten füllen *(in diesem Paket bereits ausgefüllt)*
7. EmailJS-Konto erstellen und mit `config.js` verbinden *(in diesem Paket bereits ausgefüllt)*
8. Cloudflare-Konto erstellen und Pages mit dem GitHub-Repository verbinden
9. Domain verbinden (optional)
10. Als App auf dem iPhone-Homescreen installieren
11. Prüfen, dass die globale Bestenliste funktioniert
12. Prüfen, dass Cheat-Erkennung, Sperre und Kontakt-E-Mail funktionieren
13. Admin-Modus prüfen

---

## 1. Dateien entpacken

1. Lade die Datei `cube-timer.zip` herunter (Safari fragt, wo gespeichert werden soll → „Auf meinem iPhone“ oder „iCloud Drive“).
2. Öffne die **Dateien-App**, tippe auf `cube-timer.zip` — iOS entpackt das Archiv automatisch in einen Ordner `cube-timer` mit allen 12 Dateien.

---

## 2. GitHub-Konto erstellen

1. Öffne in Safari **github.com** und tippe auf **„Sign up“**.
2. Lege ein kostenloses Konto an (E-Mail, Benutzername, Passwort).

---

## 3. Repository erstellen und Dateien hochladen

1. Tippe oben rechts auf das **„+“** → **„New repository“**.
2. Vergib einen Namen, z. B. `cube-timer`. Sichtbarkeit: **Public**. Tippe auf **„Create repository“**.
3. Auf der Repository-Seite: tippe auf **„Add file“** → **„Upload files“**.
4. Tippe auf den Upload-Bereich, wähle im Dateien-Picker den Ordner `cube-timer` und **markiere alle 12 Dateien auf einmal** (langes Antippen einer Datei → „Auswählen“ → alle antippen). Da es keine Unterordner gibt, funktioniert die Mehrfachauswahl zuverlässig.
5. Scrolle runter, tippe auf **„Commit changes“**.

Alle Dateien liegen jetzt im Repository — sichtbar und bearbeitbar direkt im Browser.

> Aktualisierst du ein bestehendes Repository: lade nur die geänderten Dateien hoch und
> bestätige, dass die gleichnamigen Dateien überschrieben werden sollen.

---

## 4. Supabase-Projekt erstellen

*(Überspringen, wenn du die mitgelieferte `config.js` unverändert nutzt — das Projekt dahinter existiert bereits.)*

1. Öffne **supabase.com**, erstelle ein kostenloses Konto.
2. Tippe auf **„New Project“**.
3. Vergib einen Projektnamen (z. B. `cube-timer`), ein Datenbank-Passwort und wähle eine Region in deiner Nähe.
4. Warte, bis das Projekt eingerichtet ist (ca. 1–2 Minuten).

---

## 5. Datenbank importieren

*(Bei einem neuen Supabase-Projekt: einmal komplett ausführen. Bei einem bestehenden Projekt
aus einem älteren Paket: trotzdem erneut ausführen, damit der Admin-Modus funktioniert —
bestehende Bestenlisten-Daten gehen dabei nicht verloren.)*

1. Öffne auf github.com in deinem Repository die Datei **`schema.sql`**, tippe auf das Stift-/Bearbeiten-Symbol **nicht** — stattdessen auf die Rohdaten-Ansicht („Raw“) und markiere/kopiere den **gesamten Inhalt**.
2. Wechsle zu Supabase → linkes Menü **„SQL Editor“** → **„New query“**.
3. Füge den kopierten Inhalt ein und tippe auf **„Run“**. Es sollte „Success“ erscheinen.

Damit sind angelegt: die Tabelle `leaderboard`, die Tabelle `banned_usernames`, die
Sicherheitsregeln (RLS) sowie die Funktionen `submit_score`, `admin_remove_entry`,
`admin_ban_username` und `admin_reset_leaderboard`.

---

## 6. `config.js` mit deinen Supabase-Zugangsdaten füllen

*(Überspringen, wenn du die mitgelieferte `config.js` unverändert nutzt.)*

1. In Supabase: **„Project Settings“ → „API“**. Kopiere die **„Project URL“**.
2. Kopiere ebenso den **„anon public“**-Key.
3. Wechsle zu github.com in dein Repository, öffne die Datei **`config.js`**.
4. Tippe oben rechts auf das **Stift-Symbol** (Bearbeiten).
5. Ersetze `supabaseUrl` und `supabaseAnonKey` durch deine eigenen Werte.
6. Tippe unten auf **„Commit changes“**.

Der `anon`-Key ist bewusst öffentlich nutzbar (so ist Supabase konzipiert) — schreibender
Zugriff läuft ausschließlich über die geschützten Funktionen aus Schritt 5.

---

## 7. EmailJS-Konto erstellen und mit `config.js` verbinden

*(Überspringen, wenn du die mitgelieferte `config.js` unverändert nutzt.)*

Damit der „Entwickler kontaktieren“-Button bei der Cheat-Warnung eine echte E-Mail an
**robtiel@mail.de** verschickt, brauchst du ein kostenloses EmailJS-Konto. EmailJS
versendet die Mail **direkt aus dem Browser** heraus — es ist kein eigener Mailserver
und kein Backend nötig, alles läuft über die EmailJS-Webseite in Safari.

1. Öffne **emailjs.com** in Safari, tippe auf **„Sign Up“** und lege ein kostenloses Konto an (Free-Plan reicht für den Anfang, 200 Mails/Monat).
2. Bestätige deine E-Mail-Adresse über den Link, den EmailJS dir schickt.
3. Im EmailJS-Dashboard: **„Email Services“** → **„Add New Service“**. Wähle z. B. **Gmail** (oder einen anderen Anbieter) und verbinde das E-Mail-Konto, über das die Nachrichten verschickt werden sollen (Login/Erlaubnis erteilen). Merke dir die angezeigte **Service ID**.
4. Wechsle zu **„Email Templates“** → **„Create New Template“**.
   - Trage im Feld **„To Email“** fest **robtiel@mail.de** ein (nicht als Variable — so landet jede Nachricht garantiert bei dir).
   - Trage im Feld **„From Name“** z. B. `Cube Timer` ein.
   - Trage im Feld **„Reply To“** die Variable `{{user_email}}` ein — damit du direkt auf die Mail antworten kannst.
   - Betreff z. B.: `Cube Timer – Kontaktanfrage (Strike {{strike_count}}/3)`.
   - Inhalt z. B.: Zeilen mit `Nutzername: {{username}}`, `Strike-Stand: {{strike_count}} / 3`, `Zeitpunkt: {{sent_at}}`, `Seite: {{page_url}}` und darunter `Nachricht: {{message}}`.
   - Speichere das Template und merke dir die **Template ID**.
5. Wechsle zu **„Account“ → „General“**. Kopiere deinen **Public Key**.
6. Trage in `config.js` `emailjsPublicKey`, `emailjsServiceId` und `emailjsTemplateId` ein und committe.

> Der Public Key ist – wie der Supabase-anon-Key – bewusst öffentlich nutzbar. In den
> EmailJS-Einstellungen kannst du unter **„Security“** optional die erlaubten Domains
> einschränken (z. B. auf deine `*.pages.dev`-Adresse), damit der Key nicht von fremden
> Seiten missbraucht wird.

---

## 8. Cloudflare Pages einrichten

1. Öffne **dash.cloudflare.com**, erstelle ein kostenloses Konto.
2. Tippe links auf **„Workers & Pages“** → **„Create“** → Tab **„Pages“** → **„Connect to Git“**.
3. Melde dich bei GitHub an und erlaube Cloudflare Zugriff auf dein `cube-timer`-Repository.
4. Wähle das Repository aus. Bei den Build-Einstellungen:
   - **Framework preset:** None
   - **Build command:** *leer lassen*
   - **Build output directory:** `/`
5. Tippe auf **„Save and Deploy“**.

Nach ein bis zwei Minuten ist die App unter einer Adresse wie `cube-timer.pages.dev` live.
Jede spätere Änderung an einer Datei auf github.com löst automatisch ein neues Deployment
aus — auch das läuft komplett ohne Computer. Der Service Worker (`sw.js`) lädt App-Dateien
inzwischen **Network-First** nach, d. h. Änderungen wirken direkt beim nächsten Öffnen,
ohne dass du manuell Caches löschen musst.

---

## 9. Domain verbinden (optional)

1. Öffne im Cloudflare-Pages-Projekt den Tab **„Custom domains“**.
2. Tippe auf **„Set up a custom domain“**, gib deine eigene Domain ein und folge den Anweisungen.

---

## 10. Als App auf dem iPhone installieren

1. Öffne die `*.pages.dev`-Adresse (oder deine eigene Domain) in **Safari**.
2. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Wähle **„Zum Home-Bildschirm“** → **„Hinzufügen“**.

Die App erscheint mit eigenem Icon auf dem Homescreen und startet im Vollbildmodus,
ganz ohne Safari-Oberfläche drumherum.

---

## 11. Prüfen, dass die globale Bestenliste funktioniert

1. Öffne die App, tippe rechts oben auf **„Einloggen“** und vergib einen Spielernamen.
2. Löse einen Timer-Durchlauf (Bildschirm halten → loslassen → erneut tippen zum Stoppen), stoppe eine Zeit **von 55 Sekunden oder mehr** und tippe auf **„Bestätigen“** (Zeiten unter 55 Sekunden lösen die Cheat-Erkennung aus, siehe Schritt 12).
3. Öffne links oben 🏆 → Tab **„Top 10“**. Deine Zeit sollte erscheinen.
4. Öffne die Adresse zusätzlich in einem **privaten Safari-Tab** (oder auf einem anderen Gerät) — die Zeit sollte dort ebenfalls sichtbar sein, da sie zentral in Supabase gespeichert ist.

---

## 12. Prüfen, dass Cheat-Erkennung, Sperre und Kontakt-E-Mail funktionieren

1. Eingeloggt einen Timer-Durchlauf machen, der **unter 55 Sekunden** liegt, und auf „Bestätigen“ tippen.
2. Es sollte sofort der Warn-Dialog „⚠️ Ungewöhnliche Aktivität erkannt“ mit „Strike 1 von 3“ erscheinen. Diese Zeit wird **nicht** an die Bestenliste übermittelt.
3. Tippe auf **„Entwickler kontaktieren“**, trage eine Test-E-Mail-Adresse ein und sende die Nachricht. Prüfe, ob die Mail bei **robtiel@mail.de** ankommt (im EmailJS-Dashboard unter „Email Logs“ lässt sich der Versand ebenfalls nachvollziehen).
4. Wiederhole Schritt 1–2 zwei weitere Male (insgesamt 3 Strikes) — beim dritten Strike wechselt die App in den Zustand „🔒 Zugriff gesperrt“, der Timer ist nicht mehr nutzbar.
5. Prüfe auf dem Sperrbildschirm oben rechts den Button **„Ausloggen“**: Klick öffnet den Dialog „Möchten Sie sich wirklich ausloggen?“ mit **Ja**/**Nein**. Dieser Button ist ab dem Login **immer** an dieser Stelle sichtbar (nicht nur im gesperrten Zustand).
6. Zum Zurücksetzen für weitere Tests: In den Browser-Entwicklertools unter „Application“ → „Local Storage“ den Eintrag `cubetimer.strikes` löschen (oder die Website-Daten der Seite komplett löschen).

---

## 13. Admin-Modus prüfen

1. Tippe auf **„Einloggen“** und gib statt eines Spielernamens exakt `Adminregelt` ein, dann „Bestätigen“.
2. Im Header erscheint jetzt „🛡 Admin-Modus“ statt eines Spielernamens.
3. Öffne 🏆 → Tab **„Top 10“**. Tippe auf einen Eintrag → es öffnet sich ein Fenster mit der Statistik dieses Nutzers und den Buttons **„Ban“** (rot/giftgrün) und **„Reset Stats“**.
   - **„Reset Stats“** entfernt nur den aktuellen Bestenlisten-Eintrag — der Nutzer kann sich später erneut eintragen.
   - **„Ban“** entfernt den Eintrag zusätzlich dauerhaft und verhindert, dass dieser Benutzername erneut eine Zeit einreichen kann.
4. Tippe stattdessen **3× schnell hintereinander** auf einen Eintrag — er wird sofort ohne Zwischenfenster aus der Bestenliste entfernt (identisch zu „Reset Stats“).
5. Unterhalb der Liste steht der Button **„Bestenliste komplett zurücksetzen“** — er fragt vorher noch einmal nach und entfernt danach alle Einträge.
6. Warte im Admin-Modus 3 Minuten (zum Testen kannst du in `app.js` `ADMIN_IDLE_INTERVAL_MS` kurzzeitig verkleinern) — es erscheint das Fenster „Noch da?“ mit einem 15-Sekunden-Countdown und dem Button „Ja“. Drückst du ihn, läuft der 3-Minuten-Zyklus erneut. Reagierst du nicht, wirst du automatisch aus dem Admin-Modus ausgeloggt.
7. Der Admin-Modus wird jederzeit auch ganz normal über „Ausloggen“ verlassen.

> **Sicherheitshinweis:** Da die App komplett ohne eigenes Backend läuft, steckt der Admin-
> Auslöser `Adminregelt` zwangsläufig im öffentlich einsehbaren Frontend-Code (`app.js`).
> Das ist eine einfache Hürde gegen zufällige Besucher, aber **kein echter Schutz** gegen
> jemanden, der gezielt den Quelltext ausliest — passend zum restlichen „kein Passwort-
> System“-Ansatz dieses Projekts. Für einen echten Schutz wäre ein richtiges Backend mit
> Authentifizierung nötig.

---

## Fehler überprüfen

- Erscheint in der Bestenliste „Keine Datenbankverbindung konfiguriert“? Prüfe, ob `config.js`
  korrekt gespeichert wurde und ob Cloudflare danach automatisch neu deployt hat
  (im Cloudflare-Dashboard unter „Deployments“ sichtbar).
- Kommt keine E-Mail an? Prüfe im EmailJS-Dashboard unter **„Email Logs“**, ob der Versand
  überhaupt ausgelöst wurde, und ob `emailjsPublicKey`, `emailjsServiceId` und `emailjsTemplateId`
  in `config.js` korrekt und ohne Anführungszeichen-Fehler eingetragen sind.
- Admin-Buttons zeigen einen Fehler wie „Nicht autorisiert“? Meist bedeutet das, dass
  `schema.sql` noch nicht (erneut) im Supabase SQL-Editor ausgeführt wurde — siehe Schritt 5.
- Ändert sich nach einem Deploy nichts an der App, obwohl du Dateien aktualisiert hast? Auf dem
  Testgerät einmalig App vom Homescreen entfernen, Safari-Website-Daten für die Domain löschen,
  neu laden. Danach sollten alle weiteren Updates automatisch ankommen (Network-First-Strategie
  in `sw.js`).
- Bleibt die Seite leer? Öffne in Safari **„Einstellungen“ → „Safari“ → „Erweitert“ → „Web-Inspector“**
  einschalten, und prüfe die Konsole über einen Mac in der Nähe — oder kontrolliere einfach,
  ob alle 12 Dateien tatsächlich im GitHub-Repository liegen (Schritt 3).

---

## Projektdateien

- `index.html` — Einstiegspunkt, lädt Tailwind/React/EmailJS per CDN
- `config.js` — Supabase- und EmailJS-Zugangsdaten (bereits ausgefüllt)
- `app.js` — komplette App-Logik (Timer, Login, Bestenliste, Statistik, Cheat-Erkennung, Admin-Modus)
- `style.css` — Basisstyles, Namens-Farbverläufe
- `manifest.webmanifest` — PWA-Manifest (Installierbarkeit)
- `sw.js` — Service Worker (Offline-Unterstützung, Network-First-Updates)
- `icon-192.png` — App-Icon
- `icon-512.png` — App-Icon (groß, auch als maskable-Icon verwendet)
- `apple-touch-icon.png` — Icon für den iPhone-Homescreen
- `favicon-32.png` — Favicon
- `schema.sql` — Supabase-Datenbank (Tabellen, Sicherheitsregeln, Funktionen)
- `README.md` — diese Anleitung

## Funktionsweise des Timers

- **Halten:** Bildschirm berühren → Fläche färbt sich gelb.
- **Loslassen:** Timer startet, große Ziffern füllen den Bildschirm, Kopfbereich verschwindet.
- **Erneutes Antippen:** Timer stoppt, Zeit sowie Abstand zur persönlichen Bestzeit werden angezeigt (grün = schneller, rot = langsamer).
- **Bestätigen:** Zeit wird lokal in der persönlichen Statistik gespeichert; bei eingeloggten Nutzern zusätzlich an die öffentliche Bestenliste übermittelt (nur falls neue persönliche Bestzeit und Zeit 55 Sekunden oder mehr, siehe Cheat-Erkennung unten).
- **Verwerfen:** Zeit wird verworfen, ohne gespeichert zu werden.

## Hinweis zu „Login“

Es handelt sich bewusst um kein echtes Passwort-System, sondern nur um einen frei wählbaren
Spielernamen zur Kennzeichnung in der Bestenliste. Der Name wird dauerhaft im Browser
gespeichert (localStorage) — auf einem anderen Gerät musst du dich erneut mit einem
Namen „einloggen“. Solange man eingeloggt ist, steht oben rechts im Header immer der
Benutzername mit einem „Ausloggen“-Button (mit Bestätigungsdialog „Ja“/„Nein“) daneben.

## Hinweis zur Cheat-Erkennung und dem Strike-System

- **Erkennung:** Jede für die Bestenliste eingereichte Zeit, die **zwischen 0 und 55 Sekunden**
  liegt, gilt als Cheat-Verdacht. Solche Zeiten werden nicht an die öffentliche Bestenliste
  übermittelt (lokal in der persönlichen Statistik werden sie trotzdem gespeichert).
- **Strike-System:** Jeder erkannte Verstoß zählt als ein Strike (gespeichert lokal im Browser
  unter `cubetimer.strikes`). Bei Strike 1 und 2 erscheint ein Warn-Dialog mit den Optionen
  „OK“ und „Entwickler kontaktieren“. Beim 3. Strike wird der Timer auf diesem Gerät/Browser
  dauerhaft gesperrt; einzige verbleibende Aktionen sind „Entwickler kontaktieren“ und „Ausloggen“.
- **Kontakt-E-Mail:** Über „Entwickler kontaktieren“ trägt der Nutzer seine E-Mail-Adresse
  und optional eine Nachricht ein. Der Versand läuft über EmailJS direkt im Browser an
  **robtiel@mail.de** (siehe Einrichtung in Schritt 7).
- **Gerätebindung:** Da alles im `localStorage` des jeweiligen Browsers gespeichert wird,
  gilt eine Sperre nur für dieses Gerät/diesen Browser — es gibt (bewusst, da kein Backend
  genutzt wird) keine geräteübergreifende Sperre. Aus- und wieder Einloggen (auch mit einem
  anderen Namen) hebt die Sperre nicht auf.

## Hinweis zum Admin-Modus

- **Zugang:** Beim Einloggen statt eines Spielernamens exakt `Adminregelt` eingeben.
- **Rechte:** Im Admin-Modus können einzelne oder alle Einträge der öffentlichen Bestenliste
  entfernt/zurückgesetzt werden, und Benutzernamen können dauerhaft gesperrt werden.
- **Bedienung:** Ein Antippen eines Eintrags in der Bestenliste öffnet die Nutzer-Statistik mit
  den Buttons „Ban“ und „Reset Stats“. Dreimaliges schnelles Antippen entfernt den Eintrag direkt.
- **Auto-Logout:** Alle 3 Minuten erscheint „Noch da?“ mit einem 15-Sekunden-Countdown; ohne
  Bestätigung wird der Admin-Modus automatisch verlassen.
- **Kein echter Zugriffsschutz:** Wie beim übrigen „Login“ handelt es sich nicht um echte
  Authentifizierung — der Auslöser-Text steckt im öffentlichen Frontend-Code.
