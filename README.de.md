# ClinicalTimeline

**Klinische Verlaufsgrafiken und Therapiepläne im Browser – von den Daten zur präsentationsfertigen Abbildung.**
Von Felix Klingler (unterstützt von Claude Sonnet 5.5) · [English version](README.md)

ClinicalTimeline macht aus einem Patienten- oder Therapieverlauf eine saubere Abbildung im Stil einer Publikation: Laborkurven, Ereignisse, Zustände (z. B. Behandlungsphasen), Medikamentengaben und Zyklustabellen für Chemotherapien auf einer gemeinsamen Zeitachse. Alles läuft lokal im Browser – kein Server, kein Konto, keine Installation.

**Live-App:** <https://fkling-dev.github.io/clinical-timeline>

| Beispiel direkt öffnen | Link |
|---|---|
| Klinische Verlaufsgrafik (Kurven, Ereignisse, Zustände) | [`?preview=1`](https://fkling-dev.github.io/clinical-timeline/?preview=1) |
| Therapieplan Verlauf (Zyklen + Zyklustabelle) | [`?preview=2`](https://fkling-dev.github.io/clinical-timeline/?preview=2) |

![Klinische Verlaufsgrafik in der App](docs/screenshot-app-clinical.png)

*(Die Bildschirmfotos zeigen die englische Oberfläche; in der App kann oben rechts auf Deutsch umgeschaltet werden.)*

---

## Inhalt

- [Highlights](#highlights)
- [Schnellstart](#schnellstart)
- [Die Oberfläche im Überblick](#die-oberfläche-im-überblick)
- [Referenz der Reiter](#referenz-der-reiter)
- [Direkt im Diagramm arbeiten](#direkt-im-diagramm-arbeiten)
- [Therapiezyklen im Detail](#therapiezyklen-im-detail)
- [Export, Speichern und Dateien](#export-speichern-und-dateien)
- [Vorlagen, Beispiele und Links](#vorlagen-beispiele-und-links)
- [Sprache der Oberfläche](#sprache-der-oberfläche)
- [Datenschutz und Daten](#datenschutz-und-daten)
- [Browser-Unterstützung](#browser-unterstützung)
- [Projektstruktur und Veröffentlichung](#projektstruktur-und-veröffentlichung)
- [Anpassen und Erweitern](#anpassen-und-erweitern)
- [Fehlersuche](#fehlersuche)
- [Hinweis und Lizenz](#hinweis-und-lizenz)

---

## Highlights

- **Eine Zeitachse aus Abschnitten.** Die X-Achse wird in Abschnitte geteilt (z. B. Induktion / Konsolidierung / Nachbeobachtung) mit eigener Tick-Schrittweite und relativer Breite. Lücken zwischen den Abschnitten zeigt ein Bruchsymbol (`//`), lange Nachbeobachtungszeiten bleiben lesbar.
- **Kurven mit zwei Y-Achsen.** Linien, Markierungen, Linie + Markierungen oder Fläche unter der Kurve (AUC, area under the curve); Glättung; Wertbeschriftung und eigene Markierungsdarstellung je Messpunkt.
- **Zeilen für alles andere.** Überschriften, Ereignis-Zeilen (Symbole mit Beschriftung), Zustands-Zeilen (farbige Boxen, optional schraffiert), Werte-Zeilen (Zahlen wie Wirkstoffspiegel) und Zyklus-Zeilen.
- **Nummerierte Markierungen.** Ein Ereignis, eine Zustandsgrenze oder ein Datum lässt sich hervorheben: Die App zeichnet einen nummerierten Kreis, eine gestrichelte Hilfslinie bis zum Diagramm und einen Eintrag in der Markierungsliste darunter.
- **Therapiezyklen und Zyklustabellen.** Zyklusvorlagen (Tage × Medikamente/Interventionen) anlegen, Zellen anklicken, um Gaben zu setzen, Zyklen auf der Zeitachse platzieren und den Ablauf als Tabelle unter dem Diagramm zeigen – mit Umbruch, ausgeblendeten Tagen, absoluten Daten und Tageskommentaren.
- **Exaktes Seitenformat.** Das gewählte Seitenverhältnis (16:9, 4:3 …) wird immer eingehalten. Ist der Inhalt zu hoch, wird die Abbildung als Ganzes verkleinert, statt das Format zu verändern.
- **Export zum Weiterverwenden.** SVG (Scalable Vector Graphics), PNG (Portable Network Graphics) und **bearbeitbares PowerPoint** (echte Formen und Textfelder, kein flaches Bild).
- **Wiederverwendbare Stile und Vorlagen.** Stil, Markierungsvorlagen und Zyklusvorlagen lassen sich als JSON-Dateien (JavaScript Object Notation) exportieren und importieren.
- **Oberfläche auf Englisch und Deutsch.**

## Schnellstart

1. Die [Live-App](https://fkling-dev.github.io/clinical-timeline) öffnen (oder ein [Beispiel](https://fkling-dev.github.io/clinical-timeline/?preview=1)).
2. Mit **Beispieldaten laden** oder **Eigenes Diagramm beginnen** starten.
3. Die Reiter von links nach rechts durcharbeiten: **Allgemein** → **X: Abschnitte** → **Kurven** → **Ereignisse & Zustände** → optional **Therapiezyklen**.
4. Das Aussehen unter **Stil** feinjustieren.
5. Das Projekt speichern (**Speichern**) und die Abbildung über **Datei ▾ → Export …** ausgeben.

Tipp: Die Vorschau rechts ist die echte Abbildung. Vieles lässt sich **direkt darin per Klick** ändern (siehe [Direkt im Diagramm arbeiten](#direkt-im-diagramm-arbeiten)).

## Die Oberfläche im Überblick

- **Kopfzeile:** App-Name, Reiterleiste, **Vorlagen & weitere Projekte ▾**, **Datei ▾**, **Speichern** und die Sprachauswahl.
- **Linkes Feld:** die Einstellungen des gewählten Reiters. Die meisten Einstellungen stehen in einer Zeile (Beschriftung links, Steuerelement rechts). Hinzufügen-Schaltflächen (`+ …`) stehen oben oder unten in einer Liste.
- **Rechtes Feld:** die Live-Vorschau der Abbildung. Im Reiter **Therapiezyklen** zeigt die Vorschau stattdessen die gewählte Zyklusvorlage als anklickbare Tabelle.

![Editor für Zyklusvorlagen](docs/screenshot-cycle-editor.png)

## Referenz der Reiter

### Allgemein
Diagrammtitel, X-Achsen-Beschriftung, Y-Achsen-Beschriftungen (primär/sekundär), Dateiname für Speichern und Exporte, **Seitenverhältnis** (Breite × Höhe mit Voreinstellungen 16:9, 4:3, 1:1, 21:9, Hochformat 3:4), Fußzeilentext und **Zurücksetzen auf Beispieldaten**.

### X: Abschnitte
- **Datum der X-Achse (Master-Option):** ordnet einem Tag der Achse (Standard: Beginn der X-Achse) ein Kalenderdatum zu. Ist sie gesetzt, werden die Startdaten aller Therapiezyklen daraus berechnet, und deren eigenes Datumsfeld ist ausgegraut.
- **Abschnitte:** Bezeichnung, von Tag, bis Tag, Tick-Schritt und relative Breite. Abschnitte lassen sich ausschalten. Überlappende oder ungültige Abschnitte werden rot markiert und nicht gezeichnet, bis der Konflikt behoben ist. Werte, Ereignisse oder Zustände außerhalb aller sichtbaren Abschnitte werden ausgeblendet (eine Warnung nennt die Anzahl).

### Kurven
- Darstellung: *Linie + Markierungen*, *Nur Markierungen*, *Nur Linie*, *AUC-Kurve (Fläche)*.
- Farbe, Liniendicke, Flächenfarbe und Deckkraft, Symbol und Größe, glatte Kurve, primäre/sekundäre Achse.
- Messwerte als Tabelle (Tag/Wert). **Aus Excel einfügen** ersetzt alle Werte durch zwei kopierte Spalten.
- Symbole: Kreis, Quadrat, Dreieck, Raute, Stern, Kreuz (X), Doppelkreuz (XX), Plus.

### Ereignisse & Zustände
Zeilen werden mit `+ Überschrift`, `+ Ereignis-Zeile`, `+ Zustands-Zeile`, `+ Werte-Zeile` und `+ Zyklus-Zeile` hinzugefügt; sie lassen sich sortieren (▲▼), ausblenden (Schalter) oder löschen.

| Zeilentyp | Was er zeigt |
|---|---|
| **Überschrift** | Ein Gruppentitel (standardmäßig fett und unterstrichen). |
| **Ereignis** | Ein Symbol pro Tag mit Beschriftung darunter. Ein Eintrag kann *hervorgehoben* werden: Er bekommt dann eine nummerierte Markierung (Kreis, Hilfslinie, Eintrag in der Markierungsliste). |
| **Zustand** | Farbige Boxen von Start bis Ende (z. B. Station, Medikamenteneinnahme), optional schraffiert, mit Beschriftung. Eine Box über eine Lücke zwischen Abschnitten wird mit einem Pfeil verbunden. Boxen können Markierungen am Anfang, am Ende oder an einem beliebigen Tag tragen. Überlappende Zustände in derselben Zeile werden markiert. |
| **Werte** | Zahlen an Tagen (z. B. Enzymwerte) mit Einheit, Nachkommastellen, Fett/Farbe; überlappende Texte lassen sich versetzen. |
| **Zyklus** | Therapiezyklen auf der Zeitachse – siehe [unten](#therapiezyklen-im-detail). |

**Box über Abschnitt hinaus:** Beginnt ein Zustand früher oder endet später als der sichtbare Abschnitt, ohne den Nachbarabschnitt zu erreichen, lässt sich das gekürzte Ende kennzeichnen: *Keine Darstellung*, *Zwei Dreiecke innen*, *Zwei Dreiecke außen*, *Whisker* (Linie bis zum echten Ende in der Lücke) oder *Pfeil mit Strich*.

### Therapiezyklen
Zyklusvorlagen anlegen und als anklickbare Tabelle bearbeiten. Siehe [Therapiezyklen im Detail](#therapiezyklen-im-detail).

### Stil
Einstellungen, die nur das Aussehen betreffen (nicht die Daten):

- Titel-Ausrichtung, Legende, Gitterlinien, Skalierung der Schriftgröße.
- Achsentexte und Stil der Achsenbeschriftung, Abstände zwischen Achse, Abschnittsbeschriftung und Zeilen; zweite X-Achse unten; Angleichen der Nulllinien beider Y-Achsen; automatischer oder manueller Wertebereich beider Y-Achsen.
- Zeilenbezeichnungen, Gruppenüberschriften, Ereignis-/Zustandszeilen, Gitter im Zeilenbereich, Zustandsboxen, *Box über Abschnitt hinaus*.
- **Zyklustabellen:** Textgröße und Abstand.
- **Markierungen:** Linienstärke, Größe des Zahlen-Symbols, Layout der Liste (jede Markierung in neuer Zeile oder fortlaufend), Abstände, linke Ausrichtung.
- **Fußnote:** Größe, Farbe, Ausrichtung, Abstände.
- Jeder der großen Bereiche (**Diagramm, Ereignisse und Zustände, Zyklustabellen, Markierungen, Fußnote**) lässt sich als Ganzes ein- oder ausschalten.
- **Stil exportieren / Stil importieren:** das komplette Aussehen als JSON-Datei sichern und auf andere Diagramme anwenden. Kurvenfarben werden über den Kurvennamen übertragen (ersatzweise nach Reihenfolge).

### Werte: Markierungsdarstellung
Markierungsvorlagen ändern das Aussehen einzelner Messpunkte (Füllung, Rand, Randdicke) und können eine Beschriftung tragen, die in der Markierungsliste erscheint.

- Vier **Basisvorlagen** (blau, grün, rot, lila) sind vorhanden; eigene Vorlagen lassen sich anlegen.
- Vorlagen werden im Projekt gespeichert. Sie lassen sich als JSON **exportieren und importieren**; importierte Vorlagen erscheinen unter dem Dateinamen, und jede Gruppe lässt sich einklappen.
- Eine Vorlage wird per Klick auf einen Messpunkt im Diagramm zugewiesen.

### Y: vertikale Linien
Referenzlinien bei festen Y-Werten (waagerecht durch das Diagramm gezogen), z. B. Grenz- oder Zielwerte: Y-Wert, primäre/sekundäre Achse, Farbe, Linienart (durchgezogen, gestrichelt, gepunktet, Strich-Punkt), Dicke, Beschriftung und Beschriftungsgröße.

### Experteneinstellungen
Selten benötigte Feinabstimmung: **Export-Auflösung** (Breite in px für SVG/PNG), Dateinamen-Präfixe, Wasserzeichen-Icon sowie detaillierte Abstands- und Größeneinstellungen. Bis auf die Dateinamen-Präfixe und die Export-Auflösung gehören sie zum Stil und werden mit *Stil exportieren* übernommen.

## Direkt im Diagramm arbeiten

Elemente in der Vorschau anklicken, um sie an Ort und Stelle zu bearbeiten:

| Klick auf … | Möglichkeiten |
|---|---|
| einen Kurvenpunkt | Wert anzeigen; Markierungsvorlage wählen |
| ein Ereignis | Symbolfarbe oder Beschriftung ändern; hervorheben (nummerierte Markierung) |
| eine Zustandsbox | Schraffur ein-/ausschalten; Markierungslinien (mit Beschriftung) am Anfang, am Ende oder an einem beliebigen Tag hinzufügen oder entfernen |
| einen Wert | hervorheben, Farbe oder Beschriftung ändern |
| eine Zyklus-Box / ein Zyklus-Symbol | *Pause bis zum nächsten Zyklus einblenden*, *Zyklustabelle unterhalb anzeigen*, Startdatum bearbeiten, absolute Daten zeigen und **Start-/Tag-X-/Enddatum als Markierung** anzeigen |
| einen Tag in einer Zyklustabelle | Kommentar hinzufügen (als Buchstabe im Kreis neben dem Tag und als Text unter der Tabelle) |

## Therapiezyklen im Detail

### 1. Zyklusvorlagen (Reiter *Therapiezyklen*)
Eine Vorlage ist ein Ablaufplan aus Tagen × Zeilen (Medikamente oder Interventionen):

- **Name, Länge (Tage), „Zyklus beginnt an Tag“** (z. B. 1, oder −2 bei Protokollen mit Vorphase).
- **Umbruch alle … Tage:** lange Zyklen werden in Blöcke geteilt (z. B. alle 7 oder 14 Tage); jeder Block wiederholt Kopf und Zeilen.
- **Leere Tage:** alle Tage zeigen, leere Tage ausblenden oder leere Tage zu einer `//`-Spalte zusammenfassen.
- **Tage ein-/ausblenden:** einzelne Tage abwählen (z. B. ein Protokoll mit den Tagen −2, −1, 1, 2, aber ohne Tag 0). Abgewählte Tage existieren nicht – sie werden bei den Daten und der Zyklusdauer übersprungen.
- **Farbe** (Zyklus-Box im Diagramm) und **Tabellenstil** (Neutral grau, Blau, Rot, Grün – ein komplettes Farbschema der Tabelle).
- **Zeilen:** Name, Symbol (z. B. Kreuz X, Quadrat, Doppelkreuz XX für zweimal tägliche Gabe), Farbe (Standard Schwarz); sortieren, hinzufügen, löschen.
- **Zelle in der Vorschau anklicken:** setzt oder entfernt eine Gabe.
- Vorlagen lassen sich duplizieren, sortieren und als JSON **exportieren/importieren** (alle Vorlagen oder einzeln).

### 2. Zyklus-Zeilen (Reiter *Ereignisse & Zustände* → `+ Zyklus-Zeile`)
Eine Zyklus-Zeile ordnet mehrere Zyklen auf der Zeitachse an. Jeder Zyklus hat: Vorlage, **Starttag im Diagramm**, optional **Startdatum** (ausgegraut, wenn das Master-Datum der X-Achse gesetzt ist), Beschriftung, Farbe sowie:

- **Darstellung der Zeile:** *Box über die Zyklusdauer* oder *Markierungssymbol am Start*.
- **Pause bis zum nächsten Zyklus einblenden:** eine Linie vom Ende des Zyklus bis zum Beginn des nächsten mit der Anzahl der Tage dazwischen (z. B. „14 d“, d = Tage).
- **Tabelle unterhalb anzeigen:** zeichnet die Zyklustabelle unter dem Zeilenbereich (über der Markierungsliste). Mit Datum lassen sich **absolute Daten** unter den Tagesnummern anzeigen.
- **Datum als Markierung anzeigen:** Startdatum, ein gewählter Tag oder Enddatum als nummerierte Markierung.

### 3. Tageskommentare
Die Tagesnummer in einer Zyklustabelle anklicken und einen Kommentar eintragen, z. B. eine Startbedingung. Der Tag zeigt dann einen Buchstaben im Kreis (A, B, C …) neben der Nummer, und der Kommentar steht mit demselben Kreis unter der Tabelle.

![Therapieplan mit Zyklustabelle](docs/chart-treatment.png)

## Export, Speichern und Dateien

Menü **Datei ▾**:

| Aktion | Ergebnis |
|---|---|
| Öffnen | Eine Projektdatei (`.json`) laden. |
| Speichern unter … | Das Projekt unter neuem Namen speichern. |
| SVG exportieren | Vektorgrafik. |
| PNG exportieren | Rasterbild in doppelter Export-Breite (Standard 2000 px → 4000 px). |
| PowerPoint exportieren | Eine Folie mit 13,33 Zoll Breite; die Höhe folgt dem gewählten Seitenverhältnis. Kurven, Boxen, Texte, Tabellen und Markierungen sind **echte, bearbeitbare PowerPoint-Objekte**. |

**Speichern** schreibt direkt in die geöffnete Projektdatei, wenn der Browser das unterstützt (Chrome/Edge); sonst wird das Projekt als Datei heruntergeladen.

Dateinamen bestehen aus einem Präfix, dem Dateinamen (**Allgemein**) und einem Zeitstempel, z. B. `TIMELINE-GRAFIK # Mein Verlauf # 2026-10-03 # 14-30.png`. Die Präfixe lassen sich in den **Experteneinstellungen** ändern.

![Exportierte Abbildung der klinischen Verlaufsgrafik](docs/chart-clinical.png)

Weitere speicher- und ladbare Dateien (JSON): **Stil** (Reiter Stil), **Markierungsvorlagen** (Werte: Markierungsdarstellung), **Zyklusvorlagen** (Therapiezyklen).

**Formathinweis:** Das gewählte Seitenverhältnis gilt immer exakt. Braucht der Inhalt bei der Standardbreite mehr Höhe, als das Verhältnis erlaubt, wird die gesamte Abbildung verkleinert und zentriert, statt die Seite zu strecken.

## Vorlagen, Beispiele und Links

- **Vorlagen & weitere Projekte ▾** (oben rechts) lädt die eingebauten Diagrammvorlagen *Klinische Verlaufsgrafik* und *Therapieplan Verlauf*. Das Laden ersetzt das aktuelle Diagramm (bei ungespeicherten Änderungen wird vorher nachgefragt).
- **Links auf Beispiele** ohne Server-Komponente: einen Parameter an die Adresse hängen.

  | Adresse | Öffnet |
  |---|---|
  | `…/clinical-timeline/` | die Startseite |
  | `…/clinical-timeline/?preview=1` | Klinische Verlaufsgrafik |
  | `…/clinical-timeline/?preview=2` | Therapieplan Verlauf |

  Fehlt der Wert oder ist er unbekannt, erscheint einfach die Startseite.
- **Weitere Projekte:** Dasselbe Menü kann Links zu anderen Projekten enthalten. Sie stehen in [`menu-links.js`](menu-links.js) (Name + Link, öffnet in einem neuen Tab); siehe [Anpassen](#anpassen-und-erweitern).

## Sprache der Oberfläche

Oben rechts **English** oder **Deutsch** wählen. Standard ist Englisch; die Wahl wird im Browser gemerkt. Übersetzt wird nur die Oberfläche – die Inhalte deiner Abbildung (Titel, Beschriftungen, Daten) sowie einige feste Wörter in der Abbildung (z. B. „Markierungen“, „Tag“, „Datum“) bleiben unverändert.

## Datenschutz und Daten

- Die gesamte Verarbeitung findet **im Browser** statt. Diagramme und Daten werden nirgends hochgeladen; es gibt kein Tracking und kein Konto.
- Als einziger Wert wird die Oberflächensprache im Browser gespeichert (Local Storage). Projekte werden nur dort gespeichert, wo du sie speicherst.
- Die Seite lädt zwei externe Ressourcen: Web-Schriften von Google Fonts (IBM Plex Sans, IBM Plex Mono, Carlito) und die Bibliothek PptxGenJS vom Content Delivery Network (CDN) jsDelivr für den PowerPoint-Export. Ohne Internetzugang funktioniert die App weiter, aber der PowerPoint-Export steht nicht zur Verfügung, und die Schriften fallen auf Systemschriften zurück. Für ein vollständig offlinefähiges oder streng in sich geschlossenes Setup können diese Dateien selbst gehostet werden.

## Browser-Unterstützung

Entwickelt und getestet mit Chromium-basierten Browsern (Chrome, Edge). Andere aktuelle Browser (Firefox, Safari) sollten ebenfalls funktionieren, wurden aber nicht im selben Umfang getestet. Das Speichern direkt in die geöffnete Datei benötigt die File System Access API (Programmierschnittstelle), die nur Chrome und Edge bieten; in anderen Browsern lädt *Speichern* die Datei herunter.

## Projektstruktur und Veröffentlichung

ClinicalTimeline ist eine statische Web-App – kein Build-Schritt, keine Abhängigkeiten zum Installieren.

| Datei | Zweck |
|---|---|
| `index.html` | Seite, Stile, Kopfzeile; lädt die Skripte. |
| `app.js` | Datenmodell, Layout-Engine, Export (SVG/PNG/PowerPoint), eingebaute Vorlagen. |
| `ui.js` | Oberfläche: Reiter, Panels, Popover, Dateiverwaltung. |
| `i18n.js` | Englische Übersetzungen der Oberfläche. |
| `menu-links.js` | Optionale weitere Menüeinträge (Name + Link). |
| `docs/` | Bilder dieser Dokumentation. |

**Veröffentlichung (GitHub Pages):** alle Dateien in das Hauptverzeichnis des Repositorys (oder einen Ordner) legen, unter *Settings → Pages* aktivieren und die veröffentlichte Adresse öffnen. Die App lässt sich auch direkt aus dem Dateisystem öffnen (`index.html`); alles funktioniert auch dort.

## Anpassen und Erweitern

**Menülinks hinzufügen** – `menu-links.js` bearbeiten:

```js
const EXTRA_MENU_LINKS = [
  { name: 'Mein anderes Projekt', url: 'https://example.com/' },
];
```

Nur `http://`- und `https://`-Links werden akzeptiert; sie öffnen sich in einem neuen Tab. Ist die Liste leer (oder fehlt die Datei), erscheint kein Abschnitt.

**Diagrammvorlage hinzufügen** – in `app.js`:

1. In der App ein Diagramm erstellen und speichern (**Speichern**), dann den Inhalt der Datei als neue Konstante einfügen (wie `THERAPY_PLAN_TEMPLATE`).
2. Einen Eintrag zu `CHART_TEMPLATES` hinzufügen (`id`, `name`, `build`). Er erscheint im Menü *Vorlagen* und ist als `?preview=N` erreichbar (N = Position in der Liste, ab 1).
3. Für eine englische Bezeichnung einen Eintrag in `i18n.js` ergänzen.

**Übersetzungen ergänzen oder ändern** – `i18n.js` ordnet dem deutschen Quelltext der Oberfläche die englische Fassung zu. Texte mit Zahlen oder Namen behandelt die Musterliste am Dateiende. Fehlende Einträge bleiben deutsch.

**Projektdateiformat** – Projekte sind schlichtes JSON. Die wichtigsten Schlüssel sind `title`, Achsenbeschriftungen, `aspectW`/`aspectH`, `segments`, `series` (mit `points`), `rows` (Arten `header`, `event`, `state`, `values`, `cycle`), `markStyles`, `cycleTemplates`, `yRefLines`, `masterDate`/`masterDay` und die Stileinstellungen. Fehlende Schlüssel werden beim Öffnen mit Standardwerten ergänzt, ältere Dateien funktionieren also weiter.

## Fehlersuche

| Problem | Lösung |
|---|---|
| PowerPoint-Export startet nicht | Die Bibliothek PptxGenJS konnte nicht geladen werden (kein Internet oder blockiert). PNG-/SVG-Export ist nicht betroffen. |
| Eine Warnung meldet ausgeblendete Werte | Einige Daten liegen außerhalb aller aktiven Abschnitte (**X: Abschnitte** prüfen). |
| Ein Abschnitt ist rot | Er überlappt einen anderen Abschnitt, oder sein Ende liegt nicht nach dem Start. |
| *Speichern* lädt eine Datei herunter, statt zu überschreiben | Der Browser unterstützt kein direktes Speichern (Chrome/Edge verwenden). |
| Alles ist auf Deutsch/Englisch | Die Sprachauswahl oben rechts umstellen. |
| Die Abbildung wirkt in PowerPoint winzig | Viel Inhalt bei flachem Format (z. B. 16:9) wird verkleinert. Ein höheres Format oder weniger/schmalere Zyklustabellen verwenden. |

## Hinweis und Lizenz

ClinicalTimeline ist ein Visualisierungswerkzeug und **kein Medizinprodukt**. Alle Daten und Abbildungen vor der Verwendung in klinischen, wissenschaftlichen oder patientenbezogenen Zusammenhängen prüfen.

© Felix Klingler
