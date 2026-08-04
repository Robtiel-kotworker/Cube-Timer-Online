# Cube-Timer-Online

# Cube Timer – Einrichtung komplett über das iPhone

Diese Version braucht **keinen Computer, kein Terminal und kein npm**. React, Tailwind
und Supabase werden direkt im Browser geladen. Alles läuft über die normalen
Webseiten von GitHub, Supabase und Cloudflare – geöffnet in Safari auf dem iPhone.

Die App besteht bewusst nur aus **12 einzelnen Dateien ohne Unterordner**, damit du
sie bequem in einem Rutsch hochladen kannst.

---

## Überblick über die Schritte

1. Dateien in der Dateien-App entpacken
2. GitHub-Konto erstellen
3. Neues Repository erstellen und alle Dateien hochladen
4. Supabase-Projekt erstellen
5. Datenbank importieren (SQL-Editor im Browser)
6. `config.js` direkt auf github.com mit deinen Supabase-Zugangsdaten bearbeiten
7. Cloudflare-Konto erstellen und Pages mit dem GitHub-Repository verbinden
8. Domain verbinden (optional)
9. Als App auf dem iPhone-Homescreen installieren
10. Prüfen, dass die globale Bestenliste funktioniert

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

---

## 4. Supabase-Projekt erstellen

1. Öffne **supabase.com**, erstelle ein kostenloses Konto.
2. Tippe auf **„New Project“**.
3. Vergib einen Projektnamen (z. B. `cube-timer`), ein Datenbank-Passwort und wähle eine Region in deiner Nähe.
4. Warte, bis das Projekt eingerichtet ist (ca. 1–2 Minuten).

---

## 5. Datenbank importieren

1. Öffne auf github.com in deinem Repository die Datei **`schema.sql`**, tippe auf das Stift-/Bearbeiten-Symbol **nicht** — stattdessen auf die Rohdaten-Ansicht („Raw“) und markiere/kopiere den **gesamten Inhalt**.
2. Wechsle zu Supabase → linkes Menü **„SQL Editor“** → **„New query“**.
3. Füge den kopierten Inhalt ein und tippe auf **„Run“**. Es sollte „Success“ erscheinen.

Damit sind angelegt: die Tabelle `leaderboard`, die Sicherheitsregeln (RLS) sowie die
Funktion `submit_score`, die eine neue Zeit nur speichert, wenn sie besser als die
bisherige ist.

---

## 6. `config.js` mit deinen Supabase-Zugangsdaten füllen

1. In Supabase: **„Project Settings“ → „API“**. Kopiere die **„Project URL“**.
2. Kopiere ebenso den **„anon public“**-Key.
3. Wechsle zu github.com in dein Repository, öffne die Datei **`config.js`**.
4. Tippe oben rechts auf das **Stift-Symbol** (Bearbeiten).
5. Ersetze `https://DEIN-PROJEKT.supabase.co` durch deine Project URL und `DEIN-ANON-PUBLIC-KEY` durch deinen anon key.
6. Tippe unten auf **„Commit changes“**.

Der `anon`-Key ist bewusst öffentlich nutzbar (so ist Supabase konzipiert) — schreibender
Zugriff läuft ausschließlich über die geschützte Funktion `submit_score` aus Schritt 5.

---

## 7. Cloudflare Pages einrichten

1. Öffne **dash.cloudflare.com**, erstelle ein kostenloses Konto.
2. Tippe links auf **„Workers & Pages“** → **„Create“** → Tab **„Pages“** → **„Connect to Git“**.
3. Melde dich bei GitHub an und erlaube Cloudflare Zugriff auf dein `cube-timer`-Repository.
4. Wähle das Repository aus. Bei den Build-Einstellungen:
   - **Framework preset:** None
   - **Build command:** *leer lassen*
   - **Build output directory:** `/`
5. Tippe auf **„Save and Deploy“**.

Nach ein bis zwei Minuten ist die App unter einer Adresse wie `cube-timer.pages.dev` live.
Jede spätere Änderung an einer Datei auf github.com (z. B. an `config.js`) löst automatisch
ein neues Deployment aus — auch das läuft komplett ohne Computer.

---

## 8. Domain verbinden (optional)

1. Öffne im Cloudflare-Pages-Projekt den Tab **„Custom domains“**.
2. Tippe auf **„Set up a custom domain“**, gib deine eigene Domain ein und folge den Anweisungen.

---

## 9. Als App auf dem iPhone installieren

1. Öffne die `*.pages.dev`-Adresse (oder deine eigene Domain) in **Safari**.
2. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Wähle **„Zum Home-Bildschirm“** → **„Hinzufügen“**.

Die App erscheint mit eigenem Icon auf dem Homescreen und startet im Vollbildmodus,
ganz ohne Safari-Oberfläche drumherum.

---

## 10. Prüfen, dass die globale Bestenliste funktioniert

1. Öffne die App, tippe rechts oben auf **„Einloggen“** und vergib einen Spielernamen.
2. Löse einen Timer-Durchlauf (Bildschirm halten → loslassen → erneut tippen zum Stoppen) und tippe auf **„Bestätigen“**.
3. Öffne links oben 🏆 → Tab **„Top 10“**. Deine Zeit sollte erscheinen.
4. Öffne die Adresse zusätzlich in einem **privaten Safari-Tab** (oder auf einem anderen Gerät) — die Zeit sollte dort ebenfalls sichtbar sein, da sie zentral in Supabase gespeichert ist.

---

## Fehler überprüfen

- Erscheint in der Bestenliste „Keine Datenbankverbindung konfiguriert“? Prüfe, ob `config.js`
  korrekt gespeichert wurde (Schritt 6) und ob Cloudflare danach automatisch neu deployt hat
  (im Cloudflare-Dashboard unter „Deployments“ sichtbar).
- Bleibt die Seite leer? Öffne in Safari **„Einstellungen“ → „Safari“ → „Erweitert“ → „Web-Inspector“**
  einschalten, und prüfe die Konsole über einen Mac in der Nähe — oder kontrolliere einfach,
  ob alle 12 Dateien tatsächlich im GitHub-Repository liegen (Schritt 3).

---

## Projektdateien

```
index.html            Einstiegspunkt, lädt Tailwind/React per CDN
config.js              Supabase-Zugangsdaten (hier bearbeiten)
app.js                 komplette App-Logik (Timer, Login, Bestenliste, Statistik)
style.css               Basisstyles, Namens-Farbverläufe
manifest.webmanifest    PWA-Manifest (Installierbarkeit)
sw.js                    Service Worker (Offline-Unterstützung)
icon-192.png             App-Icon
icon-512.png             App-Icon (groß)
apple-touch-icon.png     Icon für den iPhone-Homescreen
favicon-32.png           Favicon
schema.sql                Supabase-Datenbank (Tabelle, Sicherheitsregeln, Funktion)
README.md                  diese Anleitung
```

## Funktionsweise des Timers

- **Halten:** Bildschirm berühren → Fläche färbt sich gelb.
- **Loslassen:** Timer startet, große Ziffern füllen den Bildschirm, Kopfbereich verschwindet.
- **Erneutes Antippen:** Timer stoppt, Zeit sowie Abstand zur persönlichen Bestzeit werden angezeigt (grün = schneller, rot = langsamer).
- **Bestätigen:** Zeit wird lokal in der persönlichen Statistik gespeichert; bei eingeloggten Nutzern zusätzlich an die öffentliche Bestenliste übermittelt (nur falls neue persönliche Bestzeit).
- **Verwerfen:** Zeit wird verworfen, ohne gespeichert zu werden.

## Hinweis zu „Login“

Es handelt sich bewusst um kein echtes Passwort-System, sondern nur um einen frei wählbaren
Spielernamen zur Kennzeichnung in der Bestenliste. Der Name wird dauerhaft im Browser
gespeichert (localStorage) — auf einem anderen Gerät musst du dich erneut mit einem
Namen „einloggen“.
