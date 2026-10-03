/* ============================================================
   Klinischer Verlauf – Timeline Builder
   Reines Client-seitiges Tool: Datenmodell -> Layout -> SVG / PPTX
   ============================================================ */

/* ---------- Utilities ---------- */
let uidCounter = 1;
const uid = (p) => p + (uidCounter++);

/* ---------- Oberflaechensprache (Englisch/Deutsch, Standard Englisch) ----------
   Die Oberflaeche ist im Quellcode deutsch; tr() uebersetzt zur Laufzeit mit dem Woerterbuch
   aus i18n.js (I18N_EN / I18N_EN_PATTERNS). Nicht uebersetzt werden die Inhalte der Diagramme
   (Titel, Beschriftungen, Daten) - nur die Bedienoberflaeche. */
let UI_LANG = 'en';
try { const l = localStorage.getItem('clinicalTimeline.lang'); if (l === 'de' || l === 'en') UI_LANG = l; } catch (e) { /* kein localStorage: Standard */ }
function setUILang(l) {
  UI_LANG = l === 'de' ? 'de' : 'en';
  try { localStorage.setItem('clinicalTimeline.lang', UI_LANG); } catch (e) { /* ignorieren */ }
}
const I18N_MISSES = [];   // Diagnose: nicht uebersetzte Texte (nur Entwicklung)
function tr(s) {
  if (UI_LANG === 'de' || typeof s !== 'string' || s === '') return s;
  if (typeof I18N_EN === 'undefined') return s;
  if (Object.prototype.hasOwnProperty.call(I18N_EN, s)) return I18N_EN[s];
  if (typeof I18N_EN_PATTERNS !== 'undefined') {
    for (let i = 0; i < I18N_EN_PATTERNS.length; i++) {
      const p = I18N_EN_PATTERNS[i];
      if (p[0].test(s)) return s.replace(p[0], p[1]);
    }
  }
  if (I18N_MISSES.length < 2000 && !I18N_MISSES.includes(s)) I18N_MISSES.push(s);
  return s;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const SYMBOLS = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'doublecross', 'plus'];
const SYMBOL_LABELS = {
  circle: 'Kreis', square: 'Quadrat', triangle: 'Dreieck', diamond: 'Raute',
  star: 'Stern', cross: 'Kreuz (X)', doublecross: 'Doppelkreuz (XX)', plus: 'Plus (+)'
};
const FONT_CHOICES = [
  'Arial', 'Helvetica', 'IBM Plex Sans', 'Calibri', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Georgia', 'Times New Roman', 'IBM Plex Mono', 'Courier New'
];
const AXIS_STYLE_CHOICES = [
  { value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Kursiv' },
  { value: 'bold', label: 'Fett' }, { value: 'bolditalic', label: 'Fett Kursiv' }
];

const PALETTE = ['#2B6E5E', '#C1461F', '#3B5BA5', '#B08900', '#7A4FA3', '#1F8A8A', '#A54B6B', '#5B6A62'];
// Standard-Praefixe fuer die vier Export-Arten (werden in den Feldern unter Stil
// angezeigt und genutzt, solange der Nutzer sie nicht selbst aendert).
const DEFAULT_FOOTER_TEXT = 'Diese Grafik wurde mit der Timeline-App (https://fkling-dev.github.io/clinical-timeline) erstellt.';
const DEFAULT_EXPORT_PREFIXES = {
  exportPrefixImage: 'TIMELINE-GRAFIK # ',
  exportPrefixPptx: 'TIMELINE-GRAFIK # ',
  exportPrefixData: 'TIMELINE-DATEN # ',
  exportPrefixStyle: 'TIMELINE-STIL # '
};
function nextColor(existingCount) {
  return PALETTE[existingCount % PALETTE.length];
}

/* ---------- Markierungsvorlagen (Darstellung + Beschriftung von Messpunkten) ----------
   Eine Vorlage legt Fuellfarbe, Randfarbe/-dicke und optional einen Beschriftungstext
   fest. Messpunkte verweisen per p.styleId auf eine Vorlage. Hat die Vorlage einen
   Text, erscheint sie (Quadrat in Vorlagenfarben + Text) in der Markierungsliste
   unterhalb der Ereignis-/Zustands-Zeilen - aber nur, wenn sie tatsaechlich an
   mindestens einem sichtbaren Messpunkt verwendet wird.
   IDs mit Zufallsanteil, damit sie auch nach Laden/Import eindeutig bleiben. */
function markStyleUid() {
  return 'ms' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function newMarkStyle(i) {
  return { id: markStyleUid(), name: tr('Vorlage') + ' ' + ((i || 0) + 1), fill: '#FFFFFF', border: '#C1461F', borderWidth: 2.5, label: '' };
}
/* Basisvorlagen: vier moderne Farbvorlagen (Füllung + dunklerer Rand derselben Farbfamilie).
   Sie liegen wie alle Vorlagen in state.markStyles (und damit in der Projektdatei) und sind
   über das Flag base:true als „Basisvorlagen“ erkennbar. Herkunft importierter Vorlagen:
   Feld source = Dateiname der JSON-Datei; ohne base/source = eigene Vorlage. */
const BASE_MARK_STYLE_DEFS = [
  { key: 'blue', name: 'Blau',  fill: '#5AA9E6', border: '#2B6CA3', borderWidth: 2.5, label: 'Markierung blau' },
  { key: 'green', name: 'Grün',  fill: '#4CC38A', border: '#22805A', borderWidth: 2.5, label: 'Markierung grün' },
  { key: 'red', name: 'Rot',   fill: '#F26B6B', border: '#B23A3A', borderWidth: 2.5, label: 'Markierung rot' },
  { key: 'purple', name: 'Lila',  fill: '#9B7EDE', border: '#6446A8', borderWidth: 2.5, label: 'Markierung lila' }
];
function baseMarkStyles() {
  return BASE_MARK_STYLE_DEFS.map(d => Object.assign({ id: markStyleUid(), base: true, baseKey: d.key, labelInit: true }, d));
}
/* Gekuerzte Zustands-Boxen: gemeinsame Geometrie fuer SVG und PowerPoint.
   mode: triangles (zwei Dreiecke INNERHALB der Box) | trianglesOut (AUSSERHALB in der Luecke; ohne
   Platz bzw. am Plotrand ersatzweise innen) | whisker (Strich bis zum echten Ende + Querstrich) |
   arrow (Pfeil bis zum echten Ende + senkrechter Strich).
   Liefert Primitive: {t:'line',x1,y1,x2,y2,w} und {t:'tri',tip,cy,len,base,dir}. */
function stateEdgePrimitives(it, cy, bh, mode) {
  const out = [];
  if (!it.edges || !mode || mode === 'none') return out;
  [[it.edges.left, -1], [it.edges.right, 1]].forEach(([e, dir]) => {
    if (!e) return;
    const capH = bh * 0.32;
    const cap = xe => out.push({ t: 'line', x1: xe, y1: cy - capH, x2: xe, y2: cy + capH, w: 1.4 });
    if (mode === 'whisker' || mode === 'arrow') {
      let xe = e.xe;
      const minLen = mode === 'arrow' ? 11 : 3;
      if ((xe - e.x) * dir < minLen) xe = e.x + dir * minLen;
      if (mode === 'whisker') {
        out.push({ t: 'line', x1: e.x, y1: cy, x2: xe, y2: cy, w: 1.4 });
      } else {
        const hl = Math.min(8, Math.abs(xe - e.x) * 0.6);
        out.push({ t: 'line', x1: e.x, y1: cy, x2: xe - dir * hl, y2: cy, w: 1.4 });
        out.push({ t: 'tri', tip: xe, cy, len: hl, base: hl * 1.2, dir });
      }
      cap(xe);
      return;
    }
    // Dreiecke
    const th0 = Math.min(10, bh * 0.34), tw0 = th0 * 0.6, pad0 = 3.5, gap0 = 1.5;
    const need = pad0 + 2 * tw0 + gap0;
    let outside = mode === 'trianglesOut' && e.room > 0;
    let sc = 1;
    if (outside) { sc = Math.min(1, (e.room - 2) / need); if (sc < 0.6) outside = false; }
    if (!outside) sc = Math.min(1, (e.w / (e.shared ? 2 : 1) - 2) / need);
    if (sc < 0.45) return;
    const th = th0 * sc, tw = tw0 * sc, pad = pad0 * sc, gp = gap0 * sc;
    [0, 1].forEach(k => {
      const tip = outside ? e.x + dir * (pad + tw + k * (tw + gp)) : e.x - dir * (pad + k * (tw + gp));
      out.push({ t: 'tri', tip, cy, len: tw, base: th, dir });
    });
  });
  return out;
}

/* ---------- Therapiezyklen ----------
   Zyklusvorlagen (state.cycleTemplates) beschreiben ein Ablaufschema (Tage x Medikamente/
   Interventionen). Eine Zeile vom Typ "cycle" ordnet Zyklen (Vorlage + Starttag im Diagramm
   + optional Datum) auf der Zeitachse an; im Diagramm erscheinen sie wie Zustandsboxen
   (layoutRowsOf wandelt sie dafuer in Zustands-Zeilen um). Optional wird je Zyklus eine
   Zyklustabelle unterhalb des Ereignis-/Zustandsbereichs gezeichnet. */
const CYCLE_EMPTY_MODES = [
  { value: 'show', label: 'Alle Tage anzeigen' },
  { value: 'hide', label: 'Leere Tage ausblenden' },
  { value: 'gap', label: 'Leere Tage als „//“ zusammenfassen' }
];
// Komplette Tabellenstile (Kopf, Rahmen, Datumszeile, Zebra, Schriftfarben)
const CYCLE_SCHEMES = {
  neutral: { label: 'Neutral (grau)', hdr: '#EBEBEB', hdrText: '#222222', border: '#B8B8B8', bodyBorder: '#D6D6D6', date: '#F5F5F5', zebra: '#F8F8F8', text: '#222222', soft: '#666666', title: '#222222' },
  blue:    { label: 'Blau', hdr: '#D6E6F5', hdrText: '#17406B', border: '#8FB4D6', bodyBorder: '#C3D8EA', date: '#EAF2FA', zebra: '#F4F9FD', text: '#1E2A24', soft: '#4F6F8F', title: '#17406B' },
  red:     { label: 'Rot', hdr: '#F6D9D6', hdrText: '#7F241D', border: '#DB9F99', bodyBorder: '#EBC4C0', date: '#FBEDEC', zebra: '#FDF6F5', text: '#1E2A24', soft: '#8F5A55', title: '#7F241D' },
  green:   { label: 'Grün', hdr: '#D7EBDD', hdrText: '#1B5E36', border: '#93C4A3', bodyBorder: '#C2DFCB', date: '#EDF7F0', zebra: '#F5FAF7', text: '#1E2A24', soft: '#4F7F61', title: '#1B5E36' }
};
const CYCLE_SCHEME_CHOICES = Object.keys(CYCLE_SCHEMES).map(k => ({ value: k, label: CYCLE_SCHEMES[k].label }));
function cycleScheme(key) { return CYCLE_SCHEMES[key] || CYCLE_SCHEMES.neutral; }
function newCycleTemplate(n) {
  return { id: uid('cyc'), name: tr('Zyklus') + ' ' + n, length: 28, startDay: 1, wrapEvery: 7, emptyMode: 'show', hiddenDays: [], color: nextColor(n), tableStyle: 'blue', rows: [] };
}
function newCycleRow(n) {
  return { id: uid('cyr'), name: tr('Medikament') + ' ' + n, symbol: 'cross', color: '#000000', days: [] };
}
function normalizeCycleTemplate(t) {
  if (!t.id) t.id = uid('cyc');
  if (t.name == null) t.name = 'Zyklus';
  if (!isFinite(Number(t.length))) t.length = 28;
  if (!isFinite(Number(t.startDay))) t.startDay = 1;
  if (!isFinite(Number(t.wrapEvery))) t.wrapEvery = 0;
  if (!['show', 'hide', 'gap'].includes(t.emptyMode)) t.emptyMode = 'show';
  if (!Array.isArray(t.hiddenDays)) t.hiddenDays = [];
  t.hiddenDays = t.hiddenDays.map(Number).filter(isFinite);
  if (!t.color) t.color = '#3B5BA5';
  if (!CYCLE_SCHEMES[t.tableStyle]) t.tableStyle = 'neutral';
  if (!Array.isArray(t.rows)) t.rows = [];
  t.rows.forEach(r => {
    if (!r.id) r.id = uid('cyr');
    if (r.name == null) r.name = '';
    if (!r.symbol) r.symbol = 'cross';
    if (!r.color) r.color = '#000000';
    if (!Array.isArray(r.days)) r.days = [];
    r.days = r.days.map(Number).filter(isFinite);
  });
  return t;
}
function findCycleTemplate(s, id) { return (s.cycleTemplates || []).find(t => t.id === id) || null; }
function cycleLength(t) { const v = Math.round(Number(t.length)); return isFinite(v) ? Math.max(1, Math.min(366, v)) : 1; }
// Tatsaechliche Dauer in Tagen: abgewaehlte Tage (z. B. Tag 0 bei -2, -1, 1, 2) gibt es im Protokoll
// nicht - sie zaehlen weder fuer die Datumsberechnung noch fuer die Boxlaenge im Diagramm.
function cycleDuration(t) { return Math.max(1, cycleDayList(t).length); }
function cycleStartDay(t) { const v = Math.round(Number(t.startDay)); return isFinite(v) ? v : 1; }
// Alle Tage des Zyklus (Starttag ... Starttag + Laenge - 1) ohne abgewaehlte Tage.
function cycleDayList(t) {
  const len = cycleLength(t), start = cycleStartDay(t);
  const hidden = new Set((t.hiddenDays || []).map(Number));
  const out = [];
  for (let i = 0; i < len; i++) { const d = start + i; if (!hidden.has(d)) out.push(d); }
  return out;
}
// Daten (ISO yyyy-mm-dd) -> UTC-Zeitstempel; Rechnen in UTC vermeidet Sommerzeit-Fehler.
function parseISODate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return isFinite(t) ? t : null;
}
// Master-Datum: ordnet einem Tag der X-Achse (Standard: Beginn der X-Achse) ein Datum zu.
function masterDayOf(s) {
  if (s.masterDay != null && s.masterDay !== '' && isFinite(Number(s.masterDay))) return Math.round(Number(s.masterDay));
  const act = (s.segments || []).filter(g => g.enabled !== false);
  return act.length ? Math.min.apply(null, act.map(g => Number(g.start) || 0)) : 0;
}
function masterDateTs(s) { return parseISODate(s.masterDate); }
// Datum des ersten Zyklustages: aus dem Master-Datum berechnet, sonst das Startdatum des Zyklus.
function cycleItemDateTs(s, it) {
  const m = masterDateTs(s);
  if (m != null) return m + ((Number(it.start) || 0) - masterDayOf(s)) * 86400000;
  return parseISODate(it.date);
}
function isoFromTs(t) { return new Date(t).toISOString().slice(0, 10); }
function noteLetter(i) {
  const A = n => String.fromCharCode(65 + n);
  return i < 26 ? A(i) : A(Math.floor(i / 26) - 1) + A(i % 26);
}
function fmtCycleDate(t, withYear) {
  const d = new Date(t), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + (withYear ? d.getUTCFullYear() : '');
}

// Zyklus-Zeilen -> Zustands-Zeilen (nur fuer Layout/Darstellung; die Daten bleiben unveraendert).
function layoutRowsOf(s) {
  return (s.rows || []).map(r => {
    if (r.kind !== 'cycle') return r;
    const items = [];
    const asMarker = r.display === 'marker';
    (r.items || []).forEach(ci => {
      const tpl = findCycleTemplate(s, ci.templateId);
      if (!tpl) return;
      const start = Number(ci.start) || 0;
      const color = ci.color || tpl.color || '#3B5BA5';
      const label = ci.label || tpl.name || '';
      // "Datum als Markierung anzeigen": Start-/Tag-X-/Enddatum wie Zustandsmarkierungen (Nummer, Linie, Listeneintrag)
      const marks = [];
      const base = cycleItemDateTs(s, ci);
      if (base != null) {
        const dayList = cycleDayList(tpl), dur = Math.max(1, dayList.length);
        const mc = darken(color, 0.25);
        const addMark = (key, idx) => marks.push({ id: ci.id + '_' + key, pos: 'day', day: start + idx, label: fmtCycleDate(base + idx * 86400000, true), color: mc, active: true });
        if (ci.dateMarkStart) addMark('s', 0);
        if (ci.dateMarkDayOn) { const idx = dayList.indexOf(Number(ci.dateMarkDay)); if (idx >= 0) addMark('d', idx); }
        if (ci.dateMarkEnd) addMark('e', dur - 1);
      }
      if (asMarker) items.push({ id: ci.id, day: start, label, hl: false, hlColor: color, hlLabel: '', colorOverride: color, marks });
      else items.push({ id: ci.id, color, start, end: start + cycleDuration(tpl) - 1, label, hatch: false, marks, pause: !!ci.showPause });
    });
    // Darstellung "Markierungssymbol": Symbol am Starttag wie in einer Ereignis-Zeile
    if (asMarker) return { id: r.id, kind: 'event', isCycle: true, name: r.name, visible: r.visible, symbol: r.symbol || 'triangle', color: '#1E2A24', textSize: Number(r.textSize) || 13, symbolSize: Number(r.symbolSize) || 14, items };
    return { id: r.id, kind: 'state', isCycle: true, name: r.name, visible: r.visible, items };
  });
}

// Tabellenmodell eines Zyklus: Bloecke (Umbruch alle X Tage) mit Spalten (Tag / "//"-Luecke).
// opts.forceShow: alle Tage zeigen (Bearbeitungsansicht, sonst waeren leere Tage nicht anklickbar).
function buildCycleModel(s, tpl, item, opts) {
  opts = opts || {};
  const days = cycleDayList(tpl);
  const rows = (tpl.rows || []).map(r => ({ id: r.id, name: r.name || '', symbol: r.symbol || 'cross', color: r.color || '#000000', days: new Set((r.days || []).map(Number)) }));
  const noteDays = new Set(((item && item.dayNotes) || []).filter(n => n && String(n.text || '').trim()).map(n => Number(n.day)));
  const marked = d => rows.some(r => r.days.has(d)) || noteDays.has(d);   // Tage mit Kommentar bleiben sichtbar
  const wrap = Math.max(0, Math.round(Number(tpl.wrapEvery) || 0));
  const mode = opts.forceShow ? 'show' : (tpl.emptyMode || 'show');
  const chunks = [];
  if (wrap > 0) { for (let i = 0; i < days.length; i += wrap) chunks.push(days.slice(i, i + wrap)); }
  else chunks.push(days);
  const date0 = item ? cycleItemDateTs(s, item) : null;
  const showDates = !!(item && item.showDates && date0 != null);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const blocks = [];
  chunks.forEach(ch => {
    let cols = [];
    if (mode === 'hide') cols = ch.filter(marked).map(d => ({ day: d }));
    else if (mode === 'gap') {
      let pending = false;
      ch.forEach(d => {
        if (marked(d)) { if (pending) { cols.push({ gap: true }); pending = false; } cols.push({ day: d }); }
        else pending = true;
      });
      if (pending && cols.length) cols.push({ gap: true });
    } else cols = ch.map(d => ({ day: d }));
    if (!cols.some(c => !c.gap)) return;
    if (showDates) cols.forEach(c => { if (!c.gap) c.date = fmtCycleDate(date0 + dayIndex.get(c.day) * 86400000, false); });
    blocks.push({ cols });
  });
  let title = (item && item.label) || tpl.name || '';
  if (showDates) title += ' – ab ' + fmtCycleDate(date0, true);
  // Kommentare zu einzelnen Tagen: Buchstabe im Kreis unter dem Tag, Text darunter (A, B, C ... nach Tag sortiert)
  const present = d => blocks.some(b => b.cols.some(c => c.day === d));
  const notes = ((item && item.dayNotes) || [])
    .filter(n => n && String(n.text || '').trim() && present(Number(n.day)))
    .map(n => ({ id: n.id, day: Number(n.day), text: String(n.text) }))
    .sort((p, q) => p.day - q.day);
  notes.forEach((n, i) => { n.letter = noteLetter(i); });
  blocks.forEach(b => { b.notes = notes.filter(n => b.cols.some(c => c.day === n.day)); });
  return { title, blocks, rows, showDates, notes, scheme: cycleScheme(tpl.tableStyle) };
}

function collectCycleTables(s) {
  const out = [];
  (s.rows || []).forEach(r => {
    if (r.kind !== 'cycle' || r.visible === false) return;
    (r.items || []).forEach(it => {
      if (!it.showTable) return;
      const tpl = findCycleTemplate(s, it.templateId);
      if (!tpl) return;
      const model = buildCycleModel(s, tpl, it, {});
      if (!model.blocks.length || !model.rows.length) return;
      out.push({ item: it, rowId: r.id, tpl, model, start: Number(it.start) || 0 });
    });
  });
  out.sort((a, b) => a.start - b.start);
  return out;
}
function cycleTableMetrics(s, FS) {
  const fp = Math.max(6, (Number(s.cycleTableSize) || 12) * FS);
  return {
    fp, rowH: Math.round(fp * 1.9), hdrH: Math.round(fp * 1.9), dateH: Math.round(fp * 1.6),
    titleH: Math.round(fp * 1.9), blockGap: Math.round(fp * 0.9), gap: Math.max(0, Number(s.cycleTableGap) || 0),
    badgeR: Math.max(5, Math.round(Math.min(fp * 0.55, fp * 1.9 * 0.34))), noteLineH: Math.round(fp * 1.4), noteGap: Math.round(fp * 0.5)
  };
}
function cycleModelHeight(model, m) {
  let h = model.title ? m.titleH : 0;
  model.blocks.forEach((b, i) => {
    if (i > 0) h += m.blockGap;
    h += m.hdrH + (model.showDates ? m.dateH : 0) + model.rows.length * m.rowH;
  });
  if (model.notes && model.notes.length) {
    h += m.noteGap;
    model.notes.forEach(n => { h += parseRichText(n.text).length * m.noteLineH; });
  }
  return h;
}
function fitFontPx(text, fp, maxW, fam) {
  const w = measureTextWidth(String(text), fp, fam);
  if (!(maxW > 0) || w <= maxW) return fp;
  return Math.max(fp * 0.6, fp * maxW / w);
}

/* Gemeinsame Geometrie fuer SVG, PowerPoint und Bearbeitungsansicht: liefert Primitive
   {t:'rect',x,y,w,h,fill,stroke,sw[,hit]} | {t:'text',x,y(Grundlinie),s,anchor,fontPx,bold,italic,color}
   | {t:'mark',type,cx,cy,size,color}. g: x0, y0, cw, fontPx, rowH, hdrH, dateH, titleH, blockGap,
   labelRight, labelMaxW, fontFamily[, hits:{tpl}] */
function cycleTablePrimitives(model, g) {
  const P = [];
  const fp = g.fontPx;
  const SC = model.scheme || CYCLE_SCHEMES.neutral;
  const BORDER_H = SC.border, BORDER_B = SC.bodyBorder, HDR = SC.hdr, DATE = SC.date, INK = SC.text, SOFT = SC.soft;
  const baseOf = (cy, f) => cy + f * 0.35;
  let y = g.y0;
  if (model.title) {
    P.push({ t: 'text', x: g.x0, y: y + g.titleH * 0.68, s: model.title, anchor: 'start', fontPx: fp * 1.05, bold: true, color: SC.title });
    y += g.titleH;
  }
  model.blocks.forEach((bk, bi) => {
    if (bi > 0) y += g.blockGap;
    const widths = bk.cols.map(c => c.gap ? g.cw * 0.5 : g.cw);
    const xs = []; let x = g.x0;
    widths.forEach(w => { xs.push(x); x += w; });
    // Kopfzeile: Tage
    P.push({ t: 'text', x: g.labelRight, y: baseOf(y + g.hdrH / 2, fp * 0.9), s: 'Tag', anchor: 'end', fontPx: fp * 0.9, color: SOFT, italic: true });
    bk.cols.forEach((c, i) => {
      const hrect = { t: 'rect', x: xs[i], y, w: widths[i], h: g.hdrH, fill: HDR, stroke: BORDER_H, sw: 1 };
      if (g.dayHit && !c.gap) hrect.hit = { type: 'day', rowId: g.dayHit.rowId, itemId: g.dayHit.itemId, day: c.day, label: tr('Tag ' + c.day + ' – Klicken für Kommentar') };
      P.push(hrect);
      const dayLabel = c.gap ? '//' : String(c.day);
      const note = (!c.gap && bk.notes) ? bk.notes.find(n => n.day === c.day) : null;
      if (note) {
        // Tageszahl + Kreis mit Buchstaben direkt rechts daneben, als Gruppe mittig in der Zelle.
        // Der Kreis ist durch die Kopfzeilenhoehe begrenzt und wird bei schmalen Zellen verkleinert.
        const wTxt = measureTextWidth(dayLabel, fp * 1.06, g.fontFamily);
        const spacing = 3;
        let br = Math.min(g.badgeR || 8, g.hdrH * 0.36);
        const avail = widths[i] - 3;
        if (wTxt + spacing + 2 * br > avail) br = Math.max(3.5, (avail - wTxt - spacing) / 2);
        const total = wTxt + spacing + 2 * br;
        const sx = xs[i] + widths[i] / 2 - total / 2;
        P.push({ t: 'text', x: sx, y: baseOf(y + g.hdrH / 2, fp), s: dayLabel, anchor: 'start', fontPx: fp, bold: true, color: SC.hdrText });
        P.push({ t: 'badge', cx: sx + wTxt + spacing + br, cy: y + g.hdrH / 2, r: br, s: note.letter });
      } else {
        P.push({ t: 'text', x: xs[i] + widths[i] / 2, y: baseOf(y + g.hdrH / 2, fp), s: dayLabel, anchor: 'middle', fontPx: fp, bold: !c.gap, color: SC.hdrText });
      }
    });
    y += g.hdrH;
    if (model.showDates) {
      P.push({ t: 'text', x: g.labelRight, y: baseOf(y + g.dateH / 2, fp * 0.8), s: 'Datum', anchor: 'end', fontPx: fp * 0.8, color: SOFT, italic: true });
      bk.cols.forEach((c, i) => {
        P.push({ t: 'rect', x: xs[i], y, w: widths[i], h: g.dateH, fill: DATE, stroke: BORDER_B, sw: 1 });
        if (!c.gap && c.date) P.push({ t: 'text', x: xs[i] + widths[i] / 2, y: baseOf(y + g.dateH / 2, fp * 0.78), s: c.date, anchor: 'middle', fontPx: fp * 0.78, color: SOFT });
      });
      y += g.dateH;
    }
    // Zeilen: Medikamente / Interventionen
    model.rows.forEach((r, rIdx) => {
      const lf = fitFontPx(r.name, fp, g.labelMaxW, g.fontFamily);
      if (r.name) P.push({ t: 'text', x: g.labelRight, y: baseOf(y + g.rowH / 2, lf), s: r.name, anchor: 'end', fontPx: lf, color: INK });
      bk.cols.forEach((c, i) => {
        const rect = { t: 'rect', x: xs[i], y, w: widths[i], h: g.rowH, fill: rIdx % 2 ? SC.zebra : '#FFFFFF', stroke: BORDER_B, sw: 1 };
        if (g.hits && !c.gap) rect.hit = { type: 'cell', tpl: g.hits.tpl, row: r.id, day: c.day, label: tr(r.name + ' – Tag ' + c.day) };
        P.push(rect);
        if (!c.gap && r.days.has(c.day)) {
          let size = Math.max(6, Math.min(14, Math.min(widths[i], g.rowH) * 0.45));
          // Optisch gleich grosse Symbole: gefuellte Formen wirken kleiner als Kreuz/Plus
          size *= ({ star: 1.35, diamond: 1.25, triangle: 1.15, square: 0.92 })[r.symbol] || 1;
          if (r.symbol === 'doublecross') size = Math.min(size, widths[i] / 2.6);
          P.push({ t: 'mark', type: r.symbol, cx: xs[i] + widths[i] / 2, cy: y + g.rowH / 2, size, color: r.color });
        }
      });
      y += g.rowH;
    });
  });
  if (model.notes && model.notes.length) {
    const br = g.badgeR || 8, lh = g.noteLineH || fp * 1.4;
    y += g.noteGap || 0;
    model.notes.forEach(n => {
      const nl = parseRichText(n.text).length;
      P.push({ t: 'badge', cx: g.x0 + br, cy: y + lh / 2, r: br, s: n.letter });
      P.push({ t: 'rich', x: g.x0 + 2 * br + 7, y: y + lh / 2 + fp * 0.35, s: n.text, fontPx: fp, color: INK, lineH: lh });
      y += nl * lh;
    });
  }
  return P;
}
function cyclePrimsSVG(prims) {
  const out = [];
  prims.forEach(p => {
    if (p.t === 'rect') {
      let hit = '';
      if (p.hit && p.hit.type === 'cell') hit = ` data-kind="cycle-cell" data-tpl="${esc(p.hit.tpl)}" data-row="${esc(p.hit.row)}" data-day="${p.hit.day}" class="clickable-item cycle-cell"`;
      else if (p.hit && p.hit.type === 'day') hit = ` data-kind="cycle-day" data-row-id="${esc(p.hit.rowId)}" data-item-id="${esc(p.hit.itemId)}" data-day="${p.hit.day}" class="clickable-item cycle-day"`;
      out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}"${hit}>${p.hit ? `<title>${esc(p.hit.label)} – Tag ${p.hit.day}</title>` : ''}</rect>`);
    } else if (p.t === 'text') {
      out.push(`<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor}" font-size="${Math.round(p.fontPx * 10) / 10}" font-weight="${p.bold ? 700 : 400}"${p.italic ? ' font-style="italic"' : ''} fill="${p.color}" style="pointer-events:none;">${esc(p.s)}</text>`);
    } else if (p.t === 'mark') {
      out.push(`<g style="pointer-events:none;">${symbolSVG(p.type, p.cx, p.cy, p.size, p.color)}</g>`);
    } else if (p.t === 'badge') {
      out.push(`<g style="pointer-events:none;">${numberBadgeSVG(p.cx, p.cy, esc(p.s), p.r)}</g>`);
    } else if (p.t === 'rich') {
      out.push(richTextSVG(p.s, p.x, p.y, { anchor: 'start', fontSize: Math.round(p.fontPx * 10) / 10, fill: p.color, lineH: p.lineH, extraAttrs: 'style="pointer-events:none;"' }));
    }
  });
  return out;
}
// Vorschau im Tab "Therapiezyklen": die gewaehlte Vorlage als anklickbare Tabelle (statt des Diagramms).
function renderCycleEditorSVG(s, tplId) {
  const fam = escFont(s.fontFamily);
  const wrapSVG = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${fam}"><rect width="${w}" height="${h}" fill="#FFFFFF"/>${body}</svg>`;
  const msg = txt => wrapSVG(900, 140, `<text x="36" y="76" font-size="18" fill="#5B6A62">${esc(tr(txt))}</text>`);
  const tpl = findCycleTemplate(s, tplId);
  if (!tpl) return msg('Noch keine Zyklusvorlage – lege links eine an („+ Zyklusvorlage“).');
  const model = buildCycleModel(s, tpl, null, { forceShow: true });
  if (!model.blocks.length) return msg('Diese Vorlage hat keine Tage (alle Tage abgewählt oder Länge 0).');
  if (!model.rows.length) return msg('Füge links Zeilen (Medikamente/Interventionen) hinzu, dann kannst du hier Zellen anklicken.');
  const fp = 15, cw = 46;
  const m = { fp, rowH: 34, hdrH: 34, dateH: 0, titleH: 44, blockGap: 22, gap: 0 };
  const labelW = Math.max(60, Math.max.apply(null, model.rows.map(r => measureTextWidth(r.name || '', fp, s.fontFamily))) + 8);
  const x0 = 30 + labelW + 14;
  let maxUnits = 1;
  model.blocks.forEach(b => { const u = b.cols.reduce((a, c) => a + (c.gap ? 0.5 : 1), 0); if (u > maxUnits) maxUnits = u; });
  model.title = tr(tpl.name + '  ·  ' + cycleDuration(tpl) + ' Tage, ab Tag ' + cycleStartDay(tpl));
  const g = { x0, y0: 26, cw, fontPx: fp, rowH: m.rowH, hdrH: m.hdrH, dateH: 0, titleH: m.titleH, blockGap: m.blockGap, labelRight: x0 - 12, labelMaxW: labelW + 4, fontFamily: s.fontFamily, hits: { tpl: tpl.id } };
  const prims = cycleTablePrimitives(model, g);
  const h = 26 + cycleModelHeight(model, m) + 52;
  const w = x0 + maxUnits * cw + 30;
  const caption = `<text x="${x0}" y="${h - 18}" font-size="12.5" fill="#8A948D" style="pointer-events:none;">${esc(tr('Zelle anklicken: Gabe setzen oder wieder entfernen.'))}</text>`;
  return wrapSVG(w, h, cyclePrimsSVG(prims).join('\n') + caption);
}

/* ---------- Diagrammvorlagen (Menue oben rechts) ----------
   "Klinische Verlaufsgrafik" = die Beispieldaten, "Therapieplan Verlauf" = APL-Konsolidierung. */
const THERAPY_PLAN_TEMPLATE = {
  "title": "Konsolidierungstherapie APL",
  "xAxisLabel": "Tage nach Start Konsolidierung",
  "yAxisLabel": "",
  "y2AxisLabel": "",
  "aspectW": 16,
  "aspectH": 9,
  "canvasWidth": 2000,
  "footerText": "Diese Grafik wurde mit der Timeline-App (https://fkling-dev.github.io/clinical-timeline) erstellt.",
  "fileBaseName": "APL-Konsolidierung",
  "exportPrefixImage": "TIMELINE-GRAFIK # ",
  "exportPrefixPptx": "TIMELINE-GRAFIK # ",
  "exportPrefixData": "TIMELINE-DATEN # ",
  "exportPrefixStyle": "TIMELINE-STIL # ",
  "y1Mode": "auto",
  "y1Min": 0,
  "y1Max": 10,
  "y2Mode": "auto",
  "y2Min": 0,
  "y2Max": 100,
  "segments": [
    {
      "id": "seg1",
      "label": "Abschnitt 1",
      "start": 0,
      "end": 224,
      "weight": 1,
      "tickStep": 28,
      "enabled": true
    }
  ],
  "series": [],
  "rows": [
    {
      "id": "cy5",
      "kind": "cycle",
      "name": "Zyklus",
      "display": "box",
      "symbol": "triangle",
      "symbolSize": 14,
      "textSize": 13,
      "items": [
        {
          "id": "cyi6",
          "templateId": "cyc2",
          "start": 0,
          "date": "2026-10-01",
          "label": "Konsolidierung",
          "color": "",
          "showTable": true,
          "showDates": true,
          "showPause": true,
          "dayNotes": [
            {
              "id": "cyn21",
              "day": 1,
              "text": "Start (für jeden Zyklus) bei Neutrophilen > 1000/µl und Thrombozyten > 100 Mrd./l"
            },
            {
              "id": "cyn22",
              "day": 3,
              "text": "Mindestens einmal pro Woche Blutbildkontrolle, EKG, Vorstellung Leukämiesprechstunde"
            }
          ],
          "dateMarkStart": true,
          "dateMarkEnd": false,
          "dateMarkDayOn": false,
          "dateMarkDay": 1
        },
        {
          "id": "cyi7",
          "templateId": "cyc2",
          "start": 56,
          "date": "",
          "label": "",
          "color": "",
          "showTable": false,
          "showDates": false,
          "showPause": true,
          "dayNotes": [],
          "dateMarkStart": true,
          "dateMarkEnd": false,
          "dateMarkDayOn": false,
          "dateMarkDay": 7
        },
        {
          "id": "cyi8",
          "templateId": "cyc2",
          "start": 112,
          "date": "",
          "label": "",
          "color": "",
          "showTable": false,
          "showDates": false,
          "showPause": true,
          "dayNotes": [],
          "dateMarkStart": true,
          "dateMarkEnd": false,
          "dateMarkDayOn": false,
          "dateMarkDay": 1
        },
        {
          "id": "cyi9",
          "templateId": "cyc2",
          "start": 168,
          "date": "",
          "label": "",
          "color": "",
          "showTable": false,
          "showDates": false,
          "showPause": false,
          "dayNotes": [],
          "dateMarkStart": true,
          "dateMarkEnd": false,
          "dateMarkDayOn": false,
          "dateMarkDay": 1
        }
      ],
      "visible": true
    },
    {
      "id": "et10",
      "kind": "event",
      "name": "Remissionskontrolle",
      "symbol": "triangle",
      "color": "#000000",
      "textSize": 13,
      "symbolSize": 13,
      "items": [
        {
          "id": "evi11",
          "day": 224,
          "label": "KMP",
          "hl": true,
          "hlColor": "#000000",
          "hlLabel": "Abschluss-KMP nach erfolgter Blutbildregeneration"
        }
      ]
    }
  ],
  "markStyles": [
    {
      "id": "msmurhmo9epo8ud",
      "base": true,
      "baseKey": "blue",
      "labelInit": true,
      "key": "blue",
      "name": "Blau",
      "fill": "#5AA9E6",
      "border": "#2B6CA3",
      "borderWidth": 2.5,
      "label": "Markierung blau"
    },
    {
      "id": "msmurhmo9ektlhb",
      "base": true,
      "baseKey": "green",
      "labelInit": true,
      "key": "green",
      "name": "Grün",
      "fill": "#4CC38A",
      "border": "#22805A",
      "borderWidth": 2.5,
      "label": "Markierung grün"
    },
    {
      "id": "msmurhmo9eqybey",
      "base": true,
      "baseKey": "red",
      "labelInit": true,
      "key": "red",
      "name": "Rot",
      "fill": "#F26B6B",
      "border": "#B23A3A",
      "borderWidth": 2.5,
      "label": "Markierung rot"
    },
    {
      "id": "msmurhmo9el1c5t",
      "base": true,
      "baseKey": "purple",
      "labelInit": true,
      "key": "purple",
      "name": "Lila",
      "fill": "#9B7EDE",
      "border": "#6446A8",
      "borderWidth": 2.5,
      "label": "Markierung lila"
    }
  ],
  "cycleTemplates": [
    {
      "id": "cyc2",
      "name": "Konsolidierung (Start nur montags)",
      "length": 42,
      "startDay": 1,
      "wrapEvery": 28,
      "emptyMode": "show",
      "hiddenDays": [],
      "color": "#000000",
      "tableStyle": "blue",
      "rows": [
        {
          "id": "cyr4",
          "name": "ATO (i.v.)",
          "symbol": "square",
          "color": "#000000",
          "days": [
            1,
            2,
            3,
            4,
            5,
            8,
            9,
            10,
            11,
            12,
            15,
            16,
            17,
            18,
            19,
            22,
            23,
            24,
            26,
            25
          ]
        },
        {
          "id": "cyr3",
          "name": "ATRA (p.o.)",
          "symbol": "cross",
          "color": "#000000",
          "days": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            29,
            30,
            31,
            32,
            33,
            34,
            35,
            36,
            37,
            38,
            39,
            40,
            41,
            42
          ]
        }
      ]
    }
  ],
  "yRefLines": [],
  "titleAlign": "left",
  "fontFamily": "Arial",
  "fontScale": 1.15,
  "rowLabelSize": 16,
  "rowLabelStyle": "normal",
  "rowLabelGap": 17,
  "groupHeaderSize": 18,
  "groupHeaderBold": true,
  "groupHeaderUnderline": true,
  "showLegend": true,
  "showGrid": false,
  "rowGridVertical": false,
  "rowGridHorizontal": "events",
  "plotPadding": 51,
  "segmentGap": 69,
  "axisLineWidth": 3.3,
  "axisColor": "#000000",
  "xTickLabelSize": 15,
  "yTickLabelSize": 15,
  "segmentLabelSize": 16,
  "axisLabelSize": 17,
  "axisLabelStyle": "normal",
  "segmentLabelGap": 14,
  "xAxisLabelGap": 15,
  "axisToRowsGap": 35,
  "bottomAxisGap": 5,
  "showCycleSection": true,
  "cycleTableSize": 12,
  "cycleTableGap": 12,
  "showSegmentLabels": false,
  "showBottomAxis": false,
  "rowKindGap": 20,
  "stateRowGap": 11,
  "headerGapBefore": 10,
  "headerGapAfter": 10,
  "stateLabelSize": 13,
  "stateArrowGap": 4,
  "stateEdgeMode": "triangles",
  "markerLineWidth": 2,
  "markerBadgeSize": 13,
  "markerListLayout": "inline",
  "markerListFontSize": 13,
  "markerListGapTop": 35,
  "markerListGapBottom": 30,
  "footerSize": 10,
  "footerColor": "#acaaaa",
  "footerGapNoMarkers": 30,
  "footerAlign": "left",
  "leftEdgeMode": "yAxis",
  "alignAxisMin": true,
  "showChartSection": false,
  "showRowsSection": true,
  "showMarkersSection": true,
  "showFooterSection": true,
  "watermarkEnabled": true,
  "masterDate": "2026-09-01",
  "masterDay": null
};
const CLINICAL_COURSE_TEMPLATE = {
  "title": "Klinischer Verlauf",
  "xAxisLabel": "Tage nach Therapiestart",
  "yAxisLabel": "Laborwert 1",
  "y2AxisLabel": "Laborwert 2",
  "aspectW": 4,
  "aspectH": 3,
  "canvasWidth": 2000,
  "footerText": "",
  "y1Mode": "auto",
  "y1Min": 0,
  "y1Max": 10,
  "y2Mode": "auto",
  "y2Min": 0,
  "y2Max": 100,
  "segments": [
    {
      "id": "seg1",
      "label": "Induktion",
      "start": 0,
      "end": 14,
      "weight": 1,
      "tickStep": 14,
      "enabled": true
    },
    {
      "id": "seg1",
      "label": "Induktion ",
      "start": 18,
      "end": 76,
      "weight": 16,
      "tickStep": 7,
      "enabled": true
    },
    {
      "id": "seg21",
      "label": "Konsolidierung",
      "start": 60,
      "end": 80,
      "weight": 3,
      "tickStep": 100,
      "enabled": false
    },
    {
      "id": "seg7",
      "label": "Neuer Abschnitt",
      "start": 130,
      "end": 143,
      "weight": 1,
      "tickStep": 100,
      "enabled": true
    }
  ],
  "series": [
    {
      "id": "ser3",
      "name": "Laborwert 1",
      "color": "#575756",
      "width": 5,
      "smooth": false,
      "axis": "y1",
      "markerType": "circle",
      "markerSize": 11,
      "points": [
        {
          "day": 0,
          "value": 2.6
        },
        {
          "day": 1,
          "value": 2.9
        },
        {
          "day": 3,
          "value": 2.4
        },
        {
          "day": 4,
          "value": 2.8
        },
        {
          "day": 5,
          "value": 2.8
        },
        {
          "day": 6,
          "value": 2.9
        },
        {
          "day": 7,
          "value": 2.8
        },
        {
          "day": 7,
          "value": 2.7
        },
        {
          "day": 9,
          "value": 2.7
        },
        {
          "day": 10,
          "value": 2.8
        },
        {
          "day": 11,
          "value": 2.9
        },
        {
          "day": 12,
          "value": 2.5
        },
        {
          "day": 13,
          "value": 3.2
        },
        {
          "day": 14,
          "value": 3.2
        },
        {
          "day": 15,
          "value": 2.7
        },
        {
          "day": 17,
          "value": 2.5
        },
        {
          "day": 18,
          "value": 2.7
        },
        {
          "day": 19,
          "value": 3.5
        },
        {
          "day": 20,
          "value": 3.7
        },
        {
          "day": 21,
          "value": 4.8
        },
        {
          "day": 22,
          "value": 5.6
        },
        {
          "day": 23,
          "value": 6.9
        },
        {
          "day": 24,
          "value": 7.7
        },
        {
          "day": 25,
          "value": 9.8
        },
        {
          "day": 26,
          "value": 11.0
        },
        {
          "day": 27,
          "value": 11.5
        },
        {
          "day": 28,
          "value": 13.6
        },
        {
          "day": 29,
          "value": 13.3
        },
        {
          "day": 30,
          "value": 14.0,
          "showValue": true,
          "styleId": "msmuso2sbt9k3mk"
        },
        {
          "day": 31,
          "value": 12.7
        },
        {
          "day": 32,
          "value": 13.4
        },
        {
          "day": 33,
          "value": 12.1
        },
        {
          "day": 34,
          "value": 10.6
        },
        {
          "day": 35,
          "value": 10.0
        },
        {
          "day": 35,
          "value": 9.4
        },
        {
          "day": 36,
          "value": 8.9
        },
        {
          "day": 37,
          "value": 6.9
        },
        {
          "day": 38,
          "value": 5.7,
          "showValue": true
        },
        {
          "day": 39,
          "value": 4.9
        },
        {
          "day": 40,
          "value": 4.1
        },
        {
          "day": 41,
          "value": 3.2
        },
        {
          "day": 42,
          "value": 2.5
        },
        {
          "day": 43,
          "value": 2.7
        },
        {
          "day": 44,
          "value": 2.5
        },
        {
          "day": 45,
          "value": 2.3
        },
        {
          "day": 46,
          "value": 2.2
        },
        {
          "day": 47,
          "value": 2.8
        },
        {
          "day": 48,
          "value": 3.2
        },
        {
          "day": 49,
          "value": 3.9
        },
        {
          "day": 50,
          "value": 4.1
        },
        {
          "day": 51,
          "value": 4.3
        },
        {
          "day": 52,
          "value": 5.0
        },
        {
          "day": 53,
          "value": 5.1
        },
        {
          "day": 54,
          "value": 5.3
        },
        {
          "day": 55,
          "value": 4.2
        },
        {
          "day": 56,
          "value": 3.9
        },
        {
          "day": 57,
          "value": 3.4
        },
        {
          "day": 58,
          "value": 2.9
        },
        {
          "day": 59,
          "value": 2.1
        },
        {
          "day": 60,
          "value": 2.4
        },
        {
          "day": 61,
          "value": 1.9
        },
        {
          "day": 62,
          "value": 1.7
        },
        {
          "day": 63,
          "value": 1.9
        },
        {
          "day": 64,
          "value": 1.7
        },
        {
          "day": 65,
          "value": 1.4
        },
        {
          "day": 66,
          "value": 1.7
        },
        {
          "day": 68,
          "value": 1.6
        },
        {
          "day": 70,
          "value": 1.4
        },
        {
          "day": 71,
          "value": 1.5
        },
        {
          "day": 72,
          "value": 1.8
        },
        {
          "day": 73,
          "value": 1.3
        },
        {
          "day": 74,
          "value": 1.8
        },
        {
          "day": 79,
          "value": 1.8
        },
        {
          "day": 101,
          "value": 3.0
        },
        {
          "day": 102,
          "value": 3.2
        },
        {
          "day": 103,
          "value": 2.7
        },
        {
          "day": 130,
          "value": 3.1
        },
        {
          "day": 134,
          "value": 2.8
        }
      ],
      "displayMode": "lineMarkers",
      "aucFill": "#575756",
      "aucOpacity": 35,
      "aucLineWidth": 5.5
    },
    {
      "id": "ser4",
      "name": "Laborwert 2",
      "color": "#fac400",
      "width": 3.5,
      "smooth": true,
      "axis": "y2",
      "markerType": "circle",
      "markerSize": 7.5,
      "points": [
        {
          "day": 21,
          "value": 72
        },
        {
          "day": 22,
          "value": 80
        },
        {
          "day": 23,
          "value": 78
        },
        {
          "day": 24,
          "value": 88
        },
        {
          "day": 25,
          "value": 94
        },
        {
          "day": 26,
          "value": 101
        },
        {
          "day": 27,
          "value": 111
        },
        {
          "day": 28,
          "value": 119
        },
        {
          "day": 29,
          "value": 144,
          "showValue": true,
          "styleId": "msmuso2sbtfah9u"
        },
        {
          "day": 30,
          "value": 151
        },
        {
          "day": 31,
          "value": 170
        },
        {
          "day": 32,
          "value": 172
        },
        {
          "day": 33,
          "value": 195,
          "showValue": false
        },
        {
          "day": 34,
          "value": 209
        },
        {
          "day": 35,
          "value": 221
        },
        {
          "day": 37,
          "value": 256
        },
        {
          "day": 38,
          "value": 271
        },
        {
          "day": 41,
          "value": 274
        },
        {
          "day": 42,
          "value": 288
        },
        {
          "day": 46,
          "value": 248
        },
        {
          "day": 50,
          "value": 186
        },
        {
          "day": 59,
          "value": 313
        },
        {
          "day": 60,
          "value": 363
        },
        {
          "day": 61,
          "value": 407
        },
        {
          "day": 62,
          "value": 418
        },
        {
          "day": 64,
          "value": 496
        },
        {
          "day": 65,
          "value": 494
        },
        {
          "day": 71,
          "value": 500
        },
        {
          "day": 73,
          "value": 500
        },
        {
          "day": 101,
          "value": 263
        }
      ],
      "displayMode": "auc",
      "aucFill": "#fac400",
      "aucOpacity": 20,
      "aucLineWidth": 5.5
    }
  ],
  "rows": [
    {
      "id": "et17",
      "kind": "event",
      "name": "Remission (MRD)",
      "symbol": "diamond",
      "color": "#000000",
      "textSize": 13,
      "symbolSize": 13,
      "items": [
        {
          "id": "evi18",
          "day": 0,
          "label": "ED",
          "hl": false,
          "hlColor": "",
          "hlLabel": ""
        },
        {
          "id": "evi19",
          "day": 28,
          "label": "MolFail",
          "hl": true,
          "hlColor": "#ff4013",
          "hlLabel": "Beschreibung des genauen Ansprechens"
        },
        {
          "id": "evi20",
          "day": 76,
          "label": "MolFail",
          "hl": true,
          "hlColor": "#ff4013",
          "hlLabel": ""
        }
      ]
    },
    {
      "id": "st9",
      "kind": "state",
      "name": "Zyklus",
      "items": [
        {
          "id": "sti10",
          "color": "#006d8f",
          "start": 0,
          "end": 5,
          "label": "VP",
          "hatch": false,
          "marks": []
        },
        {
          "id": "sti11",
          "color": "#006d8f",
          "start": 6,
          "end": 19,
          "label": "I1",
          "hatch": false,
          "marks": []
        },
        {
          "id": "sti12",
          "color": "#006d8f",
          "start": 37,
          "end": 76,
          "label": "Ind. 2",
          "hatch": false,
          "marks": [
            {
              "id": "mk31",
              "pos": "start",
              "active": false,
              "label": "",
              "color": "#919191"
            }
          ]
        },
        {
          "id": "sti13",
          "color": "#606060",
          "start": 20,
          "end": 36,
          "label": "Pause",
          "hatch": true,
          "marks": []
        },
        {
          "id": "sti1",
          "color": "#1F8A8A",
          "start": 105,
          "end": 134,
          "label": "K1",
          "hatch": false,
          "marks": []
        }
      ]
    },
    {
      "id": "et5",
      "kind": "event",
      "name": "Enzym",
      "symbol": "triangle",
      "color": "#000000",
      "textSize": 13,
      "symbolSize": 13,
      "items": [
        {
          "id": "evi6",
          "day": 19,
          "label": "500 U/m^{2} (Dosisreduktion)",
          "hl": true,
          "hlColor": "#000000",
          "hlLabel": ""
        },
        {
          "id": "evi16",
          "day": 35,
          "label": "20 U/l",
          "hl": true,
          "hlColor": "#000000",
          "hlLabel": ""
        },
        {
          "id": "evi1",
          "day": 28,
          "label": "100 U/l",
          "hl": false,
          "hlColor": "#000000",
          "hlLabel": ""
        }
      ]
    },
    {
      "id": "et2",
      "kind": "event",
      "name": "Medikamentengaben",
      "symbol": "plus",
      "color": "#e21818",
      "textSize": 13,
      "symbolSize": 13,
      "items": [
        {
          "id": "evi3",
          "day": 21,
          "label": "",
          "hl": false,
          "hlColor": "",
          "hlLabel": ""
        },
        {
          "id": "evi4",
          "day": 23,
          "label": "",
          "hl": false,
          "hlColor": "#e21818",
          "hlLabel": ""
        },
        {
          "id": "evi5",
          "day": 25,
          "label": "",
          "hl": false,
          "hlColor": "#e21818",
          "hlLabel": ""
        },
        {
          "id": "evi6",
          "day": 28,
          "label": "",
          "hl": false,
          "hlColor": "#e21818",
          "hlLabel": ""
        }
      ]
    },
    {
      "id": "st25",
      "kind": "state",
      "name": "Medikament 2",
      "items": [
        {
          "id": "sti26",
          "color": "#aa7942",
          "start": 36,
          "end": 70,
          "label": "Einnahme",
          "hatch": false,
          "marks": []
        }
      ]
    },
    {
      "id": "st29",
      "kind": "state",
      "name": "Medikament 3",
      "items": [
        {
          "id": "sti30",
          "color": "#ffaa00",
          "start": 25,
          "end": 133,
          "label": "Einnahme",
          "hatch": false,
          "marks": []
        }
      ]
    }
  ],
  "titleAlign": "left",
  "fontFamily": "Arial",
  "fontScale": 1.25,
  "rowLabelSize": 16,
  "rowLabelStyle": "normal",
  "rowLabelGap": 17,
  "groupHeaderSize": 18,
  "groupHeaderBold": true,
  "groupHeaderUnderline": true,
  "showLegend": true,
  "showGrid": false,
  "plotPadding": 51,
  "segmentGap": 60,
  "axisLineWidth": 3.3,
  "axisColor": "#000000",
  "xTickLabelSize": 17.5,
  "yTickLabelSize": 15,
  "segmentLabelSize": 16,
  "axisLabelSize": 17,
  "axisLabelStyle": "normal",
  "segmentLabelGap": 14,
  "xAxisLabelGap": 10,
  "axisToRowsGap": 26,
  "rowKindGap": 20,
  "stateRowGap": 7,
  "stateLabelSize": 15,
  "stateArrowGap": 4,
  "markerLineWidth": 2,
  "markerBadgeSize": 13,
  "markerListLayout": "inline",
  "markerListFontSize": 13,
  "markerListGapTop": 30,
  "markerListGapBottom": 30,
  "footerSize": 10,
  "footerColor": "#000000",
  "footerAlign": "left",
  "leftEdgeMode": "yAxis",
  "alignAxisMin": true,
  "showChartSection": true,
  "showRowsSection": true,
  "showMarkersSection": true,
  "showFooterSection": true,
  "watermarkEnabled": true,
  "exportPrefixImage": "TIMELINE-GRAFIK # ",
  "exportPrefixPptx": "TIMELINE-GRAFIK # ",
  "exportPrefixData": "TIMELINE-DATEN # ",
  "exportPrefixStyle": "TIMELINE-STIL # ",
  "fileBaseName": "Klinischer Verlauf - Beispiel",
  "rowGridVertical": false,
  "rowGridHorizontal": "events",
  "showSegmentLabels": false,
  "showBottomAxis": true,
  "headerGapBefore": 10,
  "headerGapAfter": 10,
  "markStyles": [
    {
      "id": "msmuso2sbt9k3mk",
      "base": true,
      "baseKey": "blue",
      "labelInit": true,
      "key": "blue",
      "name": "Blau",
      "fill": "#5AA9E6",
      "border": "#2B6CA3",
      "borderWidth": 2.5,
      "label": "Markierung blau"
    },
    {
      "id": "msmuso2sbtbkh3x",
      "base": true,
      "baseKey": "green",
      "labelInit": true,
      "key": "green",
      "name": "Grün",
      "fill": "#4CC38A",
      "border": "#22805A",
      "borderWidth": 2.5,
      "label": "Markierung grün"
    },
    {
      "id": "msmuso2sbtfah9u",
      "base": true,
      "baseKey": "red",
      "labelInit": true,
      "key": "red",
      "name": "Rot",
      "fill": "#F26B6B",
      "border": "#B23A3A",
      "borderWidth": 2.5,
      "label": "Markierung rot"
    },
    {
      "id": "msmuso2sbt4xkb5",
      "base": true,
      "baseKey": "purple",
      "labelInit": true,
      "key": "purple",
      "name": "Lila",
      "fill": "#9B7EDE",
      "border": "#6446A8",
      "borderWidth": 2.5,
      "label": "Markierung lila"
    }
  ],
  "yRefLines": [],
  "bottomAxisGap": 26,
  "stateEdgeMode": "arrow",
  "footerGapNoMarkers": 30,
  "masterDate": "",
  "masterDay": null,
  "cycleTemplates": [],
  "showCycleSection": true,
  "cycleTableSize": 12,
  "cycleTableGap": 18
};
const CHART_TEMPLATES = [
  { id: 'clinical', name: 'Klinische Verlaufsgrafik', build: () => migrateState(JSON.parse(JSON.stringify(CLINICAL_COURSE_TEMPLATE))) },
  { id: 'therapy', name: 'Therapieplan Verlauf', build: () => migrateState(JSON.parse(JSON.stringify(THERAPY_PLAN_TEMPLATE))) }
];

function findMarkStyle(s, id) {
  if (!id) return null;
  return (s.markStyles || []).find(ms => ms.id === id) || null;
}
function markStyleStroke(ms) {
  if (!ms) return null;
  const w = Number(ms.borderWidth);
  return { color: ms.border || '#1E2A24', width: isFinite(w) ? Math.max(0, w) : 2 };
}

// Eingebettetes Wasserzeichen-Icon (rechts unten in Exporten, abwaehlbar).
const WATERMARK_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAwUlEQVR4AeyWwQ2AIAxF1QWczEGcyEGczAn0YDiQkJCGlg/tN0GDKS28x6HbMvnDA6AF0gANNBLgFWoE2Lzcr4H9OF/EkCrxa0BKAhVPAyjyqS4NJBKor18Dz32tiCE16deAlAQqPpKBnPEofVJcA7kP3IwGcOz/yjTwc8C94xoYpU+KawB36/PKfg1o9zo5N72ZXwN6jGwz0YAt33p2Gqgzso3wa0C717HyYGPAareFvDxAAUrXXzTQFXeh2PQGPgAAAP//NtpOkQAAAAZJREFUAwBM5jxw6TkoOgAAAABJRU5ErkJggg==";

/* ---------- Color utilities ---------- */
function hexToRgb(hex) {
  hex = String(hex || '#888888').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16) || 0x888888;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function mixColor(hex, target, amount) {
  const c = hexToRgb(hex), t = hexToRgb(target);
  return rgbToHex(c.r + (t.r - c.r) * amount, c.g + (t.g - c.g) * amount, c.b + (t.b - c.b) * amount);
}
function lighten(hex, amount) { return mixColor(hex, '#FFFFFF', amount); }
function darken(hex, amount) { return mixColor(hex, '#000000', amount); }

/* ---------- Font-Stack (mit Web-Fallback z.B. fuer Calibri) ---------- */
function escFont(f) {
  f = f || 'Arial';
  const stack = {
    'IBM Plex Sans': "'IBM Plex Sans', Arial, sans-serif",
    'IBM Plex Mono': "'IBM Plex Mono', monospace",
    'Calibri': "Calibri, 'Carlito', Arial, sans-serif"
  };
  return stack[f] || (f + ', Arial, sans-serif');
}
function axisStyleAttrs(style) {
  return {
    fontStyle: (style === 'italic' || style === 'bolditalic') ? 'italic' : 'normal',
    fontWeight: (style === 'bold' || style === 'bolditalic') ? 700 : 400
  };
}

/* ---------- Stil-Standardwerte (aus vom Nutzer bereitgestelltem Stil-Preset) ---------- */
function styleDefaults() {
  return {
    titleAlign: 'left',
    fontFamily: 'Arial',
    fontScale: 1.15,
    rowLabelSize: 16,
    rowLabelStyle: 'normal',
    rowLabelGap: 17,
    groupHeaderSize: 18,
    groupHeaderBold: true,
    groupHeaderUnderline: true,
    showLegend: true,
    showGrid: false,
    rowGridVertical: false,
    rowGridHorizontal: 'events',
    plotPadding: 51,
    segmentGap: 76,
    axisLineWidth: 3.3,
    axisColor: '#000000',
    xTickLabelSize: 15,
    yTickLabelSize: 15,
    segmentLabelSize: 16,
    axisLabelSize: 17,
    axisLabelStyle: 'normal',
    segmentLabelGap: 14,
    xAxisLabelGap: 15,
    axisToRowsGap: 2,
    bottomAxisGap: 2,
    showCycleSection: true,
    cycleTableSize: 12,
    cycleTableGap: 18,
    showSegmentLabels: true,
    showBottomAxis: false,
    rowKindGap: 20,
    stateRowGap: 11,
    headerGapBefore: 10,
    headerGapAfter: 10,
    stateLabelSize: 13,
    stateArrowGap: 4,
    stateEdgeMode: 'triangles', // none | triangles | trianglesOut | whisker | arrow
    markerLineWidth: 2,
    markerBadgeSize: 13,
    markerListLayout: 'inline',
    markerListFontSize: 13,
    markerListGapTop: 35,
    markerListGapBottom: 30,
    footerSize: 10,
    footerColor: '#acaaaa',
    footerGapNoMarkers: 30,
    footerAlign: 'left',
    leftEdgeMode: 'yAxis',
    alignAxisMin: true,
    showChartSection: true,
    showRowsSection: true,
    showMarkersSection: true,
    showFooterSection: true,
    watermarkEnabled: true
  };
}

/* ---------- Leerer Start-Zustand (Willkommens-Bildschirm) ---------- */
function blankState() {
  return Object.assign({
    title: '',
    xAxisLabel: '',
    yAxisLabel: '',
    y2AxisLabel: '',
    aspectW: 16,
    aspectH: 9,
    canvasWidth: 2000,
    footerText: DEFAULT_FOOTER_TEXT,
    fileBaseName: '',
    exportPrefixImage: DEFAULT_EXPORT_PREFIXES.exportPrefixImage,
    exportPrefixPptx: DEFAULT_EXPORT_PREFIXES.exportPrefixPptx,
    exportPrefixData: DEFAULT_EXPORT_PREFIXES.exportPrefixData,
    exportPrefixStyle: DEFAULT_EXPORT_PREFIXES.exportPrefixStyle,
    y1Mode: 'auto', y1Min: 0, y1Max: 10,
    y2Mode: 'auto', y2Min: 0, y2Max: 100,
    segments: [],
    series: [],
    rows: [],
    markStyles: baseMarkStyles(),
    cycleTemplates: [],
    masterDate: '',
    masterDay: null,
    yRefLines: []
  }, styleDefaults());
}

/* ---------- Default State (Beispieldaten) ---------- */
// Beispieldaten der App (Willkommensbildschirm, "Zurücksetzen"): die Vorlage "Klinische Verlaufsgrafik"
function exampleState() { return CHART_TEMPLATES[0].build(); }
function defaultState() {
  return Object.assign({
    title: 'Klinischer Verlauf',
    xAxisLabel: 'Tag',
    yAxisLabel: 'Leukozyten (G/l)',
    y2AxisLabel: 'CRP (mg/l)',
    aspectW: 16,
    aspectH: 9,
    canvasWidth: 2000,
    footerText: DEFAULT_FOOTER_TEXT,
    fileBaseName: '',
    exportPrefixImage: DEFAULT_EXPORT_PREFIXES.exportPrefixImage,
    exportPrefixPptx: DEFAULT_EXPORT_PREFIXES.exportPrefixPptx,
    exportPrefixData: DEFAULT_EXPORT_PREFIXES.exportPrefixData,
    exportPrefixStyle: DEFAULT_EXPORT_PREFIXES.exportPrefixStyle,

    y1Mode: 'auto', y1Min: 0, y1Max: 10,
    y2Mode: 'auto', y2Min: 0, y2Max: 100,

    segments: [
      { id: uid('seg'), label: 'Induktion', start: 0, end: 28, weight: 1.4, tickStep: 7, enabled: true },
      { id: uid('seg'), label: 'Konsolidierung / Follow-up', start: 29, end: 180, weight: 1, tickStep: 28, enabled: true },
      { id: uid('seg'), label: 'Weiteres Follow-up', start: 181, end: 980, weight: 0.8, tickStep: 200, enabled: true }
    ],
    series: [
      {
        id: uid('ser'), name: 'Leukozyten', color: '#008cb4', width: 4.5, smooth: true,
        axis: 'y1', markerType: 'circle', markerSize: 14,
        points: [
          { day: 0, value: 2.1 }, { day: 3, value: 0.4 }, { day: 7, value: 0.1 },
          { day: 14, value: 0.3 }, { day: 21, value: 3.2 }, { day: 28, value: 6.5 },
          { day: 60, value: 5.8 }, { day: 120, value: 6.1 }, { day: 180, value: 6.4 },
          { day: 625, value: 6.5 }
        ]
      },
      {
        id: uid('ser'), name: 'CRP', color: '#669c35', width: 4.5, smooth: true,
        axis: 'y2', markerType: 'cross', markerSize: 14,
        points: [
          { day: 0, value: 8 }, { day: 3, value: 65 }, { day: 7, value: 120 },
          { day: 14, value: 40 }, { day: 21, value: 12 }, { day: 28, value: 6 }
        ]
      }
    ],
    rows: [
      { id: uid('hd'), kind: 'header', text: 'Diagnostik' },
      {
        id: uid('et'), kind: 'event', name: 'CT', symbol: 'diamond', color: '#C1461F', textSize: 13, symbolSize: 15,
        items: [
          { id: uid('evi'), day: 21, label: 'Remission', hl: false, hlColor: '#C1461F', hlLabel: '' },
          { id: uid('evi'), day: 625, label: 'PET: positiv', hl: false, hlColor: '#C1461F', hlLabel: '' }
        ]
      },
      {
        id: uid('et'), kind: 'event', name: 'KM', symbol: 'circle', color: '#3B5BA5', textSize: 13, symbolSize: 13,
        items: [
          { id: uid('evi'), day: 1, label: 'Diagnose', hl: false, hlColor: '#3B5BA5', hlLabel: '' },
          { id: uid('evi'), day: 28, label: 'MRD neg.', hl: false, hlColor: '#3B5BA5', hlLabel: '' }
        ]
      },
      { id: uid('hd'), kind: 'header', text: 'Verlauf' },
      {
        id: uid('st'), kind: 'state', name: 'Ort',
        items: [
          { id: uid('sti'), color: '#A54B6B', start: 0, end: 7, label: 'Intensivstation', hatch: false, marks: [] },
          { id: uid('sti'), color: '#2B6E5E', start: 8, end: 28, label: 'Normalstation', hatch: false, marks: [] },
          { id: uid('sti'), color: '#B08900', start: 180, end: 980, label: 'Zu Hause', hatch: false, marks: [] }
        ]
      }
    ],
    markStyles: baseMarkStyles(),
    masterDate: '',
    masterDay: null,
    cycleTemplates: [{
      id: uid('cyc'), name: '7+3 (Beispiel)', length: 7, startDay: 1, wrapEvery: 0, emptyMode: 'show', hiddenDays: [], color: '#3B5BA5', tableStyle: 'blue',
      rows: [
        { id: uid('cyr'), name: 'Cytarabin', symbol: 'cross', color: '#000000', days: [1, 2, 3, 4, 5, 6, 7] },
        { id: uid('cyr'), name: 'Daunorubicin', symbol: 'cross', color: '#000000', days: [1, 2, 3] }
      ]
    }],
    yRefLines: []
  }, styleDefaults());
}

let state = blankState();
// Handle der aktuell geoeffneten Projektdatei (File System Access API), falls der
// Browser das unterstuetzt und der Nutzer eine Datei ueber den nativen Dialog
// geoeffnet/gespeichert hat. Ermoeglicht direktes Speichern "in" diese Datei
// sowie Exporte, die standardmaessig im selben Ordner landen.
let currentProjectHandle = null;
// Der "Dateiname"-Wert, der zum aktuellen currentProjectHandle gehoert (Snapshot
// vom letzten Oeffnen/Speichern). Weicht state.fileBaseName davon ab, bedeutet
// das: der Nutzer moechte unter einem NEUEN Namen speichern - ein bestehendes
// Handle kann eine Datei aber technisch nicht umbenennen, also wird in diesem
// Fall automatisch "Speichern unter" (neuer Dialog) statt direktem Ueberschreiben
// ausgeloest.
let currentProjectHandleName = null;

/* ---------- Migration alter Projektdateien ---------- */
// Nach dem Laden von Daten (Projekt, Vorlage) den ID-Zaehler hinter die hoechste vorhandene ID setzen,
// damit neue Elemente nie eine bereits vergebene ID bekommen.
function syncUidCounter(data) {
  let max = 0;
  const re = /"id":"[A-Za-z_]*?(\d+)"/g;
  let m;
  const json = JSON.stringify(data);
  while ((m = re.exec(json))) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  if (max + 1 > uidCounter) uidCounter = max + 1;
}
// Doppelte IDs (z. B. aus kopierten Elementen in alten Dateien) werden beim Laden eindeutig gemacht:
// das erste Vorkommen behaelt seine ID, weitere bekommen eine neue.
function dedupeIds(data) {
  const seen = new Set();
  const walk = o => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    if (typeof o.id === 'string') {
      if (seen.has(o.id)) {
        const pref = (o.id.match(/^[A-Za-z_]*/) || [''])[0] || 'id';
        o.id = uid(pref);
      }
      seen.add(o.id);
    }
    Object.keys(o).forEach(k => walk(o[k]));
  };
  walk(data);
}
function migrateState(data) {
  if (!data.rows) {
    const rows = [];
    if (Array.isArray(data.eventTypes)) {
      data.eventTypes.forEach(et => rows.push(Object.assign({ kind: 'event' }, et)));
    } else if (Array.isArray(data.events)) {
      const byType = {}; const order = [];
      data.events.forEach(ev => {
        if (!byType[ev.type]) { byType[ev.type] = { id: uid('et'), kind: 'event', name: ev.type, symbol: ev.symbol || 'circle', color: ev.color || '#2B6E5E', textSize: (ev.textSize || 9) * 1.4, symbolSize: (ev.textSize || 9) * 1.5, items: [] }; order.push(ev.type); }
        byType[ev.type].items.push({ id: uid('evi'), day: ev.day, label: ev.label });
      });
      order.forEach(t => rows.push(byType[t]));
    }
    if (Array.isArray(data.stateTypes)) {
      data.stateTypes.forEach(st => rows.push(Object.assign({ kind: 'state' }, st)));
    } else if (Array.isArray(data.states)) {
      const byType = {}; const order = [];
      data.states.forEach(st => {
        if (!byType[st.type]) { byType[st.type] = { id: uid('st'), kind: 'state', name: st.type, items: [] }; order.push(st.type); }
        byType[st.type].items.push({ id: uid('sti'), color: st.color, start: st.start, end: st.end, label: st.label });
      });
      order.forEach(t => rows.push(byType[t]));
    }
    data.rows = rows;
    delete data.eventTypes; delete data.stateTypes; delete data.events; delete data.states;
  }
  // Zentralisierte Beschriftungsgroessen: alte, pro Zeile gespeicherte Werte
  // werden als globaler Startwert uebernommen (nur falls im Preset selbst nicht
  // gesetzt), danach entfernt.
  if (data.rowLabelSize == null) {
    const found = data.rows.find(r => r.labelSize != null);
    if (found) data.rowLabelSize = found.labelSize;
  }
  if (data.groupHeaderSize == null) {
    const found = data.rows.find(r => r.kind === 'header' && r.fontSize != null);
    if (found) data.groupHeaderSize = found.fontSize;
  }
  data.rows.forEach(r => {
    delete r.labelSize; delete r.fontSize;
    if (r.kind === 'event') {
      r.items.forEach(it => {
        if (it.hl == null) it.hl = false;
        if (it.hlColor == null) it.hlColor = r.color || '#C1461F';
        if (it.hlLabel == null) it.hlLabel = '';
      });
    }
    if (r.kind === 'values') {
      if (!Array.isArray(r.points)) r.points = [];
      if (r.color == null) r.color = '#1E2A24';
      if (r.textSize == null) r.textSize = 13;
      if (r.bold == null) r.bold = false;
      if (r.decimals == null) r.decimals = 'auto';
      if (r.stagger == null) r.stagger = false;
      if (r.unit == null) r.unit = '';
      ensureValueIds(r);
    }
    if (r.kind === 'state') {
      r.items.forEach(it => {
        if (it.hatch == null) it.hatch = false;
        if (!Array.isArray(it.marks)) it.marks = [];
        it.marks.forEach(m => { if (m.active == null) m.active = true; if (m.label == null) m.label = ''; if (m.color == null) m.color = '#1E2A24'; });
      });
    }
  });
  if (data.masterDate == null) data.masterDate = '';
  if (data.masterDay === undefined) data.masterDay = null;
  if (!Array.isArray(data.cycleTemplates)) data.cycleTemplates = [];
  data.cycleTemplates.forEach(normalizeCycleTemplate);
  data.rows.forEach(r => {
    if (r.kind !== 'cycle') return;
    if (!Array.isArray(r.items)) r.items = [];
    if (r.name == null) r.name = 'Zyklus';
    if (r.display !== 'marker') r.display = 'box';
    if (!r.symbol) r.symbol = 'triangle';
    if (r.symbolSize == null) r.symbolSize = 14;
    if (r.textSize == null) r.textSize = 13;
    r.items.forEach(it => {
      if (!it.id) it.id = uid('cyi');
      if (it.start == null || !isFinite(Number(it.start))) it.start = 0;
      if (it.date == null) it.date = '';
      if (it.label == null) it.label = '';
      if (it.color == null) it.color = '';
      if (it.showTable == null) it.showTable = false;
      if (it.showDates == null) it.showDates = false;
      if (it.showPause == null) it.showPause = false;
      if (!Array.isArray(it.dayNotes)) it.dayNotes = [];
      it.dayNotes.forEach(n => { if (!n.id) n.id = uid('cyn'); n.day = Number(n.day); if (n.text == null) n.text = ''; });
      if (it.dateMarkStart == null) it.dateMarkStart = false;
      if (it.dateMarkEnd == null) it.dateMarkEnd = false;
      if (it.dateMarkDayOn == null) it.dateMarkDayOn = false;
      if (it.dateMarkDay == null || !isFinite(Number(it.dateMarkDay))) it.dateMarkDay = 1;
    });
  });
  (data.segments || []).forEach(sg => { if (sg.enabled == null) sg.enabled = true; });
  if (!Array.isArray(data.markStyles)) data.markStyles = [];
  if (!Array.isArray(data.yRefLines)) data.yRefLines = [];
  data.yRefLines.forEach(l => {
    if (!l.id) l.id = uid('yl');
    if (l.enabled == null) l.enabled = true;
    if (l.axis == null) l.axis = 'y1';
    if (l.color == null) l.color = '#C1461F';
    if (l.style == null) l.style = 'dashed';
    if (l.width == null) l.width = 1.5;
    if (l.label == null) l.label = '';
    if (l.labelSize == null) l.labelSize = 11;
  });
  data.markStyles.forEach((ms, i) => {
    if (!ms.id) ms.id = markStyleUid();
    if (ms.name == null) ms.name = 'Vorlage ' + (i + 1);
    if (ms.fill == null) ms.fill = '#FFFFFF';
    if (ms.border == null) ms.border = '#1E2A24';
    if (ms.borderWidth == null) ms.borderWidth = 2.5;
    if (ms.label == null) ms.label = '';
    // Einmalig: Basisvorlagen aus älteren Projektdateien erhalten die Standardbeschriftung,
    // damit sie im Markierungsbereich erscheinen (danach gilt, was der Nutzer einstellt).
    if (ms.base && !ms.baseKey) {
      const d0 = BASE_MARK_STYLE_DEFS.find(d => d.name === ms.name);
      if (d0) ms.baseKey = d0.key;
    }
    if (ms.base && !ms.labelInit) {
      const def = BASE_MARK_STYLE_DEFS.find(d => d.name === ms.name);
      if (def && ms.label === '') ms.label = def.label;
      ms.labelInit = true;
    }
  });
  // Verweise auf nicht (mehr) existierende Vorlagen entfernen.
  const msIds = new Set(data.markStyles.map(ms => ms.id));
  (data.series || []).forEach(sr => (sr.points || []).forEach(pt => { if (pt.styleId && !msIds.has(pt.styleId)) delete pt.styleId; }));
  (data.series || []).forEach(sr => {
    if (!SERIES_MODES.some(m => m.value === sr.displayMode)) sr.displayMode = 'lineMarkers';
    if (!sr.aucFill) sr.aucFill = sr.color || '#1F6FB2';
    if (sr.aucOpacity == null) sr.aucOpacity = 35;
    if (sr.aucLineWidth == null) sr.aucLineWidth = 5.5;
  });
  // Alle uebrigen Stil-Felder: fehlende Werte werden aus den aktuellen
  // Stil-Standardwerten ergaenzt (ein einziger gepflegter Satz statt vieler
  // einzeln dupliziert gepflegter Fallbacks).
  const styleDef = styleDefaults();
  // Ältere Projekte: die zweite X-Achse nutzte bisher denselben Abstand wie die obere.
  if (data.bottomAxisGap == null && data.axisToRowsGap != null) data.bottomAxisGap = data.axisToRowsGap;
  if (data.xTickLabelSize == null && data.tickLabelSize != null) data.xTickLabelSize = data.tickLabelSize;
  if (data.yTickLabelSize == null && data.tickLabelSize != null) data.yTickLabelSize = data.tickLabelSize;
  if (data.segmentLabelSize == null && data.tickLabelSize != null) data.segmentLabelSize = data.tickLabelSize;
  delete data.tickLabelSize;
  Object.keys(styleDef).forEach(k => { if (data[k] == null) data[k] = styleDef[k]; });
  if (data.plotPadding == null) data.plotPadding = styleDef.plotPadding;
  if (data.footerText == null) data.footerText = '';
  if (data.canvasWidth == null) data.canvasWidth = 2000;
  if (data.aspectW == null) data.aspectW = 16;
  if (data.aspectH == null) data.aspectH = 9;
  // Praefix-Felder: fehlende ODER leere Werte (aus einer frueheren Zwischenversion)
  // bekommen die neuen Standard-Praefixe.
  if (!data.exportPrefixImage) data.exportPrefixImage = DEFAULT_EXPORT_PREFIXES.exportPrefixImage;
  if (!data.exportPrefixPptx) data.exportPrefixPptx = DEFAULT_EXPORT_PREFIXES.exportPrefixPptx;
  if (!data.exportPrefixData) data.exportPrefixData = DEFAULT_EXPORT_PREFIXES.exportPrefixData;
  if (!data.exportPrefixStyle) data.exportPrefixStyle = DEFAULT_EXPORT_PREFIXES.exportPrefixStyle;
  // "Dateiname": alter, frueherer "exportFileName" wird als Startwert uebernommen.
  if (data.fileBaseName == null) data.fileBaseName = data.exportFileName || '';
  delete data.exportFileName;
  if (data.y1Mode == null) data.y1Mode = 'auto';
  if (data.y2Mode == null) data.y2Mode = 'auto';
  if (data.y1Min == null) data.y1Min = 0;
  if (data.y1Max == null) data.y1Max = 10;
  if (data.y2Min == null) data.y2Min = 0;
  if (data.y2Max == null) data.y2Max = 100;
  delete data.showY2;
  syncUidCounter(data);
  dedupeIds(data);
  return data;
}

/* ---------- Wertedarstellung (Zeilenart 'values') ----------
   Wertepaare (Tag / Wert) wie bei einer Kurve, aber nur als Zahlen in einer eigenen
   Zeile im Bereich "Ereignisse & Zustände" dargestellt. */
const CONTENT_ROW_KINDS = ['event', 'state', 'values'];
function formatRowValue(v, decimals) {
  v = Number(v);
  if (!isFinite(v)) return '';
  if (decimals === 'auto' || decimals == null || decimals === '') return formatPointValue(v);
  const d = clamp(parseInt(decimals, 10) || 0, 0, 6);
  return v.toFixed(d);
}
function valuesRowLineH(r, FS) { return (Number(r.textSize) || 13) * FS * 1.35; }

// Messwerte einer Werte-Zeile brauchen eine stabile ID (Klick -> Markierung).
function ensureValueIds(r) {
  (r.points || []).forEach(p => {
    if (!p.id) p.id = 'vp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    if (p.hl == null) p.hl = false;
    if (p.hlColor == null || p.hlColor === '') p.hlColor = r.color && r.color !== '#1E2A24' ? r.color : '#C1461F';
    if (p.hlLabel == null) p.hlLabel = '';
  });
}

/* ---------- Kurvendarstellung ----------
   lineMarkers = Linie + Symbole (bisher), markers = nur Symbole, line = nur Linie,
   auc = Flaeche bis y = 0 + duenne Linie, ohne Symbole, ganz hinten gezeichnet. */
const SERIES_MODES = [
  { value: 'lineMarkers', label: 'Linie + Markierungen' },
  { value: 'markers', label: 'Nur Markierungen' },
  { value: 'line', label: 'Nur Linie' },
  { value: 'auc', label: 'AUC-Kurve (Fläche)' }
];
function aucOpacity(sr) { const v = Number(sr.aucOpacity); return (sr.aucOpacity === '' || sr.aucOpacity == null || !isFinite(v)) ? 0.35 : clamp(v, 0, 100) / 100; }
function aucLineW(sr) { const v = Number(sr.aucLineWidth); return (sr.aucLineWidth === '' || sr.aucLineWidth == null || !isFinite(v)) ? 5.5 : Math.max(0.25, v); }
function seriesMode(sr) { return SERIES_MODES.some(m => m.value === sr.displayMode) ? sr.displayMode : 'lineMarkers'; }

/* ---------- Markierungen Y-Achse (waagerechte Referenzlinien auf Y-Wert) ---------- */
const REF_LINE_STYLES = [
  { value: 'solid', label: 'Durchgezogen' },
  { value: 'dashed', label: 'Gestrichelt' },
  { value: 'dotted', label: 'Gepunktet' },
  { value: 'dashdot', label: 'Strich-Punkt' }
];
function newRefLine(i) {
  return { id: uid('yl'), enabled: true, axis: 'y1', value: 0, color: '#C1461F', style: 'dashed', width: 1.5, label: '', labelSize: 11 };
}
function refLineDashArray(style, w) {
  w = Math.max(0.5, Number(w) || 1);
  if (style === 'dashed') return `${w * 5} ${w * 3}`;
  if (style === 'dotted') return `0.1 ${w * 2.6}`;
  if (style === 'dashdot') return `${w * 5} ${w * 2.5} 0.1 ${w * 2.5}`;
  return '';
}
function refLinePptxDash(style) {
  return style === 'dashed' ? 'dash' : style === 'dotted' ? 'sysDot' : style === 'dashdot' ? 'dashDot' : null;
}
function activeRefLines(s, axis) {
  return (s.yRefLines || []).filter(l => l.enabled !== false && (l.axis || 'y1') === axis && isFinite(Number(l.value)) && String(l.value) !== '');
}
function refLabelPlain(str) {
  return String(str || '').split(/\r\n|\r|\n/).map(l => l.replace(/\^\{([^}]*)\}/g, '$1'));
}

/* ---------- Layout Engine ---------- */
function rowHeightFor(r, FS) {
  if (r.kind === 'header') return Math.round(30 * Math.max(1, FS * 0.8));
  if (r.kind === 'event') {
    const base = Math.round(58 * Math.max(1, FS * 0.95));
    const maxLines = (r.items || []).reduce((m, it) => Math.max(m, richTextLineCount(it.label)), 1);
    const lineH = (Number(r.textSize) || 13) * FS * 1.25;
    return Math.round(base + (maxLines - 1) * lineH);
  }
  if (r.kind === 'values') {
    const lines = r.stagger ? 2 : 1;
    return Math.round(Math.max(34 * Math.max(1, FS * 0.9), lines * valuesRowLineH(r, FS) + 14));
  }
  return Math.round(34 * Math.max(1, FS * 0.9)); // state
}

// Rowhöhen-Summe inkl. Zwischenraum beim Wechsel zwischen Ereignis- und Zustands-Zeilen
// sowie zusaetzlichem Padding zwischen direkt aufeinanderfolgenden Zustands-Zeilen
// (nicht bei Ueberschriften-Zeilen).
function totalRowsHeight(rows, FS, rowKindGap, stateRowGap, headerGapBefore, headerGapAfter) {
  let total = 0, prevKind = null;
  rows.forEach((r, i) => {
    if (r.kind === 'header') {
      if (i > 0) total += headerGapBefore;
    } else if (prevKind === 'header') {
      total += headerGapAfter;
    } else if (prevKind === 'state' && r.kind === 'state') {
      total += stateRowGap;
    } else if (prevKind && r.kind !== prevKind && CONTENT_ROW_KINDS.includes(r.kind) && CONTENT_ROW_KINDS.includes(prevKind)) {
      total += rowKindGap;
    }
    total += rowHeightFor(r, FS);
    prevKind = r.kind;
  });
  return total;
}

// Echte Textbreiten-Messung (Canvas) fuer ein sauberes Fliesstext-Layout der
// Markierungsliste; ohne Browser-DOM (z.B. in Tests) faellt dies auf eine grobe
// Zeichenbreiten-Schaetzung zurueck.
let _measureCanvas = null;
function measureTextWidth(text, fontPx, fontFamily) {
  text = String(text == null ? '' : text);
  if (typeof document === 'undefined') return text.length * fontPx * 0.56;
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const ctx = _measureCanvas.getContext('2d');
  ctx.font = `${fontPx}px ${fontFamily || 'Arial'}`;
  return ctx.measureText(text).width;
}

// Layoutet die Liste beschrifteter Markierungslinien: entweder "block" (eine Zeile
// je Markierung) oder "inline" (echter Fliesstext, nur bei Bedarf umgebrochen).
// Wird sowohl in einer fruehen Vorab-Berechnung (nur fuer die benoetigte Gesamthoehe,
// bevor die eigentlichen X-Positionen im Diagramm feststehen) als auch beim finalen
// Rendern mit identischen Eingaben aufgerufen, damit beide konsistent bleiben.
// Zusatzfelder fuer Eintraege der Markierungsliste: 'number' = nummerierter Kreis
// (Markierungslinie), 'style' = Quadrat in den Farben einer Markierungsvorlage.
function annotationExtras(it) {
  return { kind: it.kind || 'number', fill: it.fill, border: it.border, borderWidth: it.borderWidth };
}
// Sammelt die Markierungsvorlagen mit Beschriftungstext, die an mindestens einem
// sichtbaren Messpunkt verwendet werden (Reihenfolge wie im Vorlagen-Reiter).
function collectStyleLegend(s, series, dayVisible) {
  const used = new Set();
  series.forEach(sr => (sr.points || []).forEach(p => {
    if (p.styleId && isFinite(p.day) && isFinite(p.value) && dayVisible(Number(p.day))) used.add(p.styleId);
  }));
  return (s.markStyles || [])
    .filter(ms => used.has(ms.id) && String(ms.label || '').trim())
    .map(ms => ({ kind: 'style', label: ms.label, fill: ms.fill, border: ms.border, borderWidth: ms.borderWidth }));
}

function layoutAnnotationList(items, opts) {
  const fontPx = opts.fontSizePx;
  const badgeR = Math.max(6, fontPx * 0.62);
  const lineH = Math.round(fontPx * 1.9);
  const itemGap = Math.round(fontPx * 1.1) + 8; // Abstand zwischen zwei Markierungen im Fliesstext
  if (opts.mode === 'inline') {
    let lineIdx = 0, curX = 0;
    const positions = items.map(it => {
      const measureLabel = String(it.label || '').replace(/\r\n|\r|\n/g, ' ');
      const w = badgeR * 2 + 6 + measureTextWidth(measureLabel, fontPx, opts.fontFamily) + itemGap;
      if (curX > 0 && curX + w > opts.plotWidth) { lineIdx++; curX = 0; }
      const nLines = richTextLineCount(it.label);
      const pos = Object.assign(annotationExtras(it), { number: it.number, label: it.label, badgeR, line: lineIdx, xOffset: curX, nLines });
      curX += w;
      return pos;
    });
    // Zeilenhoehe je umgebrochener Fliesstext-Zeile richtet sich nach dem
    // Eintrag mit den meisten Textzeilen darin (falls eine Markierung selbst
    // mehrzeilig ist).
    const rowLineCounts = {};
    positions.forEach(p => { rowLineCounts[p.line] = Math.max(rowLineCounts[p.line] || 1, p.nLines); });
    const maxLine = positions.reduce((m, p) => Math.max(m, p.line), 0);
    let cumY = 0;
    const rowYOffsets = {};
    for (let li = 0; li <= maxLine; li++) { rowYOffsets[li] = cumY; cumY += lineH * (rowLineCounts[li] || 1); }
    positions.forEach(p => { p.yOffset = rowYOffsets[p.line]; });
    return { lineH, totalHeight: cumY, positions, badgeR, mode: 'inline' };
  }
  // Block-Modus: jede Markierung bekommt so viele Zeilen wie ihr Text (inkl.
  // erzwungener Zeilenumbrueche) tatsaechlich braucht.
  let cumY = 0;
  const positions = items.map(it => {
    const nLines = richTextLineCount(it.label);
    const pos = Object.assign(annotationExtras(it), { number: it.number, label: it.label, badgeR, line: 0, xOffset: 0, yOffset: cumY, nLines });
    cumY += lineH * nLines;
    return pos;
  });
  return { lineH, totalHeight: cumY, positions, badgeR, mode: 'block' };
}

// Legenden-Layout: echte Textmessung + Zeilenumbruch, damit sich Eintraege bei
// langen Kurvennamen oder vielen Kurven nicht ueberlappen (analog Markierungsliste).
function layoutLegend(items, opts) {
  const fontPx = opts.fontSizePx;
  const lineH = Math.round(fontPx * 1.9);
  const swatchW = 30;
  const gapAfter = 26;
  let lineIdx = 0, curX = 0;
  const positions = items.map(it => {
    const w = swatchW + 6 + measureTextWidth(it.label, fontPx, opts.fontFamily) + gapAfter;
    if (curX > 0 && curX + w > opts.plotWidth) { lineIdx++; curX = 0; }
    const pos = { sr: it.sr, label: it.label, line: lineIdx, xOffset: curX, swatchW };
    curX += w;
    return pos;
  });
  return { lineH, totalHeight: (lineIdx + 1) * lineH, positions };
}

/* Das gewaehlte Seitenverhaeltnis gilt immer exakt (Seite = Folie/PNG). Das Diagramm wird zuerst in
   seiner natuerlichen Groesse (Referenzbreite 1600) berechnet. Braucht der Inhalt dabei mehr Hoehe, als das
   Seitenverhaeltnis hergibt, bleibt das Diagramm UNVERAENDERT (gleiche Proportionen, Schriften,
   Kurvenhoehe) und wird als Ganzes verkleinert auf die Seite gesetzt: die Seite wird so breit wie
   noetig und das Diagramm waagerecht zentriert (weisse Raender links/rechts). */
function computeLayout(s) {
  const REF_W = 1600;
  const aw = Math.max(0.01, Number(s.aspectW) || 16), ah = Math.max(0.01, Number(s.aspectH) || 9);
  const L0 = computeLayoutAtWidth(s, REF_W, 0);
  if (L0.H <= Math.round(REF_W * ah / aw) + 1) return L0;      // Inhalt passt in das gewaehlte Format
  const pageW = Math.min(12000, Math.round(L0.H * aw / ah));
  if (pageW <= REF_W) return L0;
  return computeLayoutAtWidth(s, pageW, (pageW - REF_W) / 2);
}
// extraX: zusaetzlicher waagerechter Rand links und rechts (Diagramm zentriert auf breiterer Seite)
function computeLayoutAtWidth(s, W, extraX) {
  const FS = 1 * (s.fontScale || 1);
  const padV = Math.max(0, Number(s.plotPadding) || 0);   // oberer Rand
  const pad = padV + (extraX || 0);                       // waagerechter Rand

  // Bereichs-Master-Schalter: blenden einen kompletten Bereich inkl. seines
  // Platzbedarfs aus, unabhaengig von den feineren Einzel-Schaltern darunter
  // (z.B. einzelne Kurven/Zeilen bleiben dabei in ihrem eigenen Zustand erhalten).
  const showChartSection = s.showChartSection !== false;
  const showRowsSection = s.showRowsSection !== false;
  const showMarkersSection = s.showMarkersSection !== false;
  const showFooterSection = s.showFooterSection !== false;

  // Sichtbare Serien/Zeilen (per iOS-Toggle ein-/ausgeblendet, ohne die Daten zu
  // loeschen). Ausgeblendete Serien zaehlen auch nicht zur Y-Achsen-Skalierung,
  // ausgeblendete Zeilen nehmen keinen Platz mehr ein.
  const visibleSeries = showChartSection ? s.series.filter(sr => sr.visible !== false) : [];
  const visibleRows = showRowsSection ? layoutRowsOf(s).filter(r => r.kind === 'header' || r.visible !== false) : [];
  const showCycleSection = s.showCycleSection !== false;
  const cycleListPre = showCycleSection ? collectCycleTables(s) : [];
  const showY2 = visibleSeries.some(sr => sr.axis === 'y2');

  // Internes Koordinatensystem: Breite ist bewusst FEST (unabhaengig von
  // "Diagrammbreite"/Export-Aufloesung), damit alle Abstaende/Schriftgroessen
  // ihre Proportionen behalten. Die Hoehe wird weiter unten final festgelegt,
  // NACHDEM feststeht wie viel Platz Titel/Legende/Zeilen/Markierungen/Fußzeile
  // tatsaechlich benoetigen - so kann die Canvas-Hoehe bei sehr vielen Inhalten
  // automatisch ueber die gewaehlte Seitenverhaeltnis-Hoehe hinaus wachsen, statt
  // dass sich Markierungsliste und Fußzeile ueberlappen.
  const REF_W = 1600;
  const titleH = s.title ? Math.round(44 * Math.max(1, FS * 0.85)) : 0;

  // Linker Rand: Y-Achsenbeschriftung sitzt direkt links neben den Tickmark-Zahlen
  // (nicht mehr aussen am Rand), die Zeilen-Bezeichnungen (Ort, CT, ...) teilen sich
  // denselben reservierten Bereich unabhaengig davon, je nachdem was mehr Platz braucht.
  const yTickFontPx = s.yTickLabelSize * FS;
  // Beschriftungen der Y-Achsen-Markierungen stehen im Bereich der Tick-Zahlen -
  // bei laengeren Texten wird dieser Bereich automatisch verbreitert.
  const refLabelW = (axis) => activeRefLines(s, axis).reduce((m, l) => {
    const fpx = (Number(l.labelSize) || 11) * FS;
    return Math.max(m, ...refLabelPlain(l.label).map(t => t ? measureTextWidth(t, fpx, s.fontFamily) + 16 : 0));
  }, 0);
  const yTicksW = showChartSection ? Math.round(Math.max(20 + yTickFontPx * 2.0, refLabelW('y1'))) : 0;
  const axisLabelFontPx = s.axisLabelSize * FS;
  const labelColW = (showChartSection && s.yAxisLabel) ? Math.round(axisLabelFontPx * 1.4 + 8) : 0;
  const rowLabelFontPx = s.rowLabelSize * FS;
  const groupHeaderFontPx = s.groupHeaderSize * FS;
  const rowLabelGapPx = Math.max(0, Number(s.rowLabelGap) || 0);
  // Automatische Breiten-Reservierung: misst die tatsaechliche Textbreite der
  // laengsten Zeilen-/Ueberschriften-Beschriftung, statt einer groben, festen
  // Schaetzformel - so passt sich der linke Rand automatisch an lange
  // Beschriftungen an. Der manuell eingestellte Innenabstand (pad) wird davon
  // unabhaengig weiterhin ZUSAETZLICH aufaddiert (siehe plotLeft unten).
  let maxRowLabelW = 0;
  visibleRows.forEach(r => {
    if (r.kind === 'header') {
      const w = measureTextWidth(r.text || '', groupHeaderFontPx, s.fontFamily);
      if (w > maxRowLabelW) maxRowLabelW = w;
    } else {
      const w = measureTextWidth(r.name || '', rowLabelFontPx, s.fontFamily);
      if (w > maxRowLabelW) maxRowLabelW = w;
    }
  });
  // Beschriftungen der Zyklustabellen (Medikamente/Interventionen) teilen sich denselben linken Bereich.
  const cyFontPre = Math.max(6, (Number(s.cycleTableSize) || 12) * FS);
  cycleListPre.forEach(c => c.model.rows.forEach(r => {
    const w = measureTextWidth(r.name || '', cyFontPre, s.fontFamily);
    if (w > maxRowLabelW) maxRowLabelW = w;
  }));
  const rowLabelReserved = maxRowLabelW > 0 ? Math.round(maxRowLabelW + rowLabelGapPx + 2) : 0;
  const plotLeft = pad + Math.max(labelColW + yTicksW, rowLabelReserved);

  // Linke Startposition fuer Markierungsliste + Fußzeile: entweder am Seitenrand
  // (wie bisher) oder buendig mit der linken Kante der Y-Achsenbeschriftung.
  const yAxisLabelLeftX = plotLeft - yTicksW - labelColW;
  const contentLeftX = s.leftEdgeMode === 'yAxisLabel' && labelColW > 0 ? yAxisLabelLeftX
    : s.leftEdgeMode === 'yAxis' ? plotLeft
    : pad;

  const y2TicksW = showY2 ? Math.round(Math.max(20 + yTickFontPx * 2.0, refLabelW('y2'))) : 0;
  const y2LabelColW = (showY2 && s.y2AxisLabel) ? Math.round(axisLabelFontPx * 1.4 + 8) : 0;
  const rightAxisW = showY2 ? (y2TicksW + y2LabelColW) : 14;
  const plotRight = W - pad - rightAxisW;
  const plotWidth = Math.max(40, plotRight - plotLeft);

  // Legende: echte Textmessung + Zeilenumbruch (wie die Markierungsliste), damit
  // sich Eintraege bei langen Namen oder vielen Kurven nicht mehr ueberlappen.
  const legendFontPx = 11.5 * FS;
  const legendItems = visibleSeries.map(sr => ({ sr, label: sr.name + (sr.axis === 'y2' ? ' (sek.)' : '') }));
  const legendLayout = (showChartSection && s.showLegend && legendItems.length) ? layoutLegend(legendItems, { fontSizePx: legendFontPx, fontFamily: s.fontFamily, plotWidth }) : null;
  const legendH = legendLayout ? legendLayout.totalHeight + 12 : 0;

  // X-Achsen-Bereich: Tickmark-Zahlen und Abschnittsbeschriftung erhalten je nach
  // eingestellter Schriftgroesse automatisch genug vertikalen Abstand zur Achse.
  // Ist die Abschnittsbeschriftung ausgeblendet, wird ihr Platzbedarf komplett
  // eingespart (wirkt fuer BEIDE Achsen, da xAxisH fuer die primaere UND die
  // optionale untere X-Achse gemeinsam genutzt wird).
  const showSegLabels = s.showSegmentLabels !== false;
  const tickMarkLen = 8;
  const xTickFontPx = s.xTickLabelSize * FS;
  const segFontPx = s.segmentLabelSize * FS;
  const tickLabelYOffset = tickMarkLen + xTickFontPx * 0.85 + 4;
  const segLabelYOffset = showSegLabels
    ? tickLabelYOffset + xTickFontPx * 0.3 + Math.max(0, s.segmentLabelGap || 0) + segFontPx * 0.8
    : tickLabelYOffset;
  const xAxisLabelGap = Math.max(0, Number(s.xAxisLabelGap) || 0);
  const xAxisLabelFontPx = s.axisLabelSize * FS;
  const xAxisLabelYOffset = showSegLabels
    ? segLabelYOffset + segFontPx * 0.35 + xAxisLabelGap + xAxisLabelFontPx * 0.8
    : segLabelYOffset + xTickFontPx * 0.3 + xAxisLabelGap + xAxisLabelFontPx * 0.8;
  const xAxisH = Math.round(xAxisLabelYOffset + xAxisLabelFontPx * 0.3 + 6);
  const axisToRowsGap = Math.max(0, Number(s.axisToRowsGap) || 0);
  // Abstand zwischen den Zeilen und der zweiten (unteren) X-Achse; eigene Einstellung.
  const bottomAxisGap = Math.max(0, Number(s.bottomAxisGap) || 0);
  const bottomPad = 18;

  // Vorab-Erfassung beschrifteter Markierungslinien (Tag+Text reichen fuer die
  // Hoehen-Vorausberechnung, die tatsaechlichen X-Positionen werden erst spaeter
  // benoetigt sobald dayToX bereitsteht - aber die Zeilenumbrueche der Liste haengen
  // nur von Text/Anzahl/plotWidth ab, nicht von den X-Positionen im Chart selbst).
  const activeSegsRaw = s.segments.filter(sg => sg.enabled !== false);
  const sortedActive = [...activeSegsRaw].sort((a, b) => Number(a.start) - Number(b.start));
  const activeSegs = [];
  let skippedSegmentCount = 0;
  sortedActive.forEach(sg => {
    if (Number(sg.end) <= Number(sg.start)) { skippedSegmentCount++; return; }
    const prev = activeSegs[activeSegs.length - 1];
    if (prev && Number(sg.start) <= Number(prev.end)) { skippedSegmentCount++; return; }
    activeSegs.push(sg);
  });
  const preDayVisible = (d) => activeSegs.some(sg => d >= Number(sg.start) && d <= Number(sg.end));
  // Legendeneintraege der Markierungsvorlagen (Quadrat + Text) - stehen in der Liste
  // hinter den nummerierten Markierungslinien.
  const styleLegend = showMarkersSection ? collectStyleLegend(s, visibleSeries, preDayVisible) : [];

  const labeledPre = [];
  if (showMarkersSection) {
    visibleRows.forEach(r => {
      if (r.kind === 'event') r.items.forEach(it => {
        if (it.hl && it.hlLabel) labeledPre.push({ day: it.day, label: it.hlLabel });
        (it.marks || []).forEach(m => { if (m.active !== false && m.label) labeledPre.push({ day: Number(m.day), label: m.label }); });
      });
      if (r.kind === 'values') (r.points || []).forEach(p => { if (p.hl && p.hlLabel && preDayVisible(Number(p.day))) labeledPre.push({ day: Number(p.day), label: p.hlLabel }); });
      if (r.kind === 'state') r.items.forEach(it => (it.marks || []).forEach(m => {
        if (m.active === false || !m.label) return;
        const day = m.pos === 'start' ? it.start : m.pos === 'end' ? it.end : Number(m.day);
        labeledPre.push({ day, label: m.label });
      }));
    });
  }
  labeledPre.sort((a, b) => a.day - b.day);
  styleLegend.forEach(e => labeledPre.push(e));
  const listFontPx = s.markerListFontSize * FS;
  const preList = layoutAnnotationList(labeledPre, { mode: s.markerListLayout, fontSizePx: listFontPx, plotWidth, fontFamily: s.fontFamily });
  const markerListGapTop = Math.max(0, Number(s.markerListGapTop) || 0);
  const markerListGapBottom = Math.max(0, Number(s.markerListGapBottom) || 0);
  const annotationsH = labeledPre.length ? markerListGapTop + preList.totalHeight + markerListGapBottom : 0;

  const footerFontPx = (showFooterSection && s.footerText) ? (Number(s.footerSize) || 10) * FS : 0;
  const footerH = (showFooterSection && s.footerText) ? Math.round(footerFontPx * 1.7 + 10) : 0;
  // Ohne Markierungsliste gibt es keinen Markierungs-Abstand: dann steuert footerGapNoMarkers den
  // Abstand zwischen den Zeilen und Fußzeile bzw. Icon (nur wenn unten überhaupt etwas steht).
  const noMarkerGap = (!labeledPre.length && (footerH > 0 || s.watermarkEnabled !== false))
    ? Math.max(0, Number(s.footerGapNoMarkers) || 0) : 0;

  const rowKindGap = Math.max(0, Number(s.rowKindGap) || 0);
  const stateRowGap = Math.max(0, Number(s.stateRowGap) || 0);
  const headerGapBefore = Math.max(0, Number(s.headerGapBefore) || 0);
  const headerGapAfter = Math.max(0, Number(s.headerGapAfter) || 0);
  const rowsH = totalRowsHeight(visibleRows, FS, rowKindGap, stateRowGap, headerGapBefore, headerGapAfter);
  // Zyklustabellen: zwischen Zeilen-/Achsenbereich und Markierungsliste
  const cyM = cycleTableMetrics(s, FS);
  const cycleTablesH = cycleListPre.reduce((sum, c) => sum + cyM.gap + cycleModelHeight(c.model, cyM), 0);
  let y = padV;
  const titleY = y + Math.round(22 * Math.max(1, FS * 0.85)); y += titleH;
  const legendY = y + 12; y += legendH;
  const chartTop = y;
  // Reihenfolge (von oben nach unten): Titel/Legende -> Kurven-/Y-Achsen-Bereich ->
  // X-Achse (Tag-Ticks/Abschnittsbeschriftung) -> Ereignis-/Zustandszeilen ->
  // optionale ZWEITE X-Achse (Duplikat, an/abschaltbar) -> Markierungsliste ->
  // Fußzeile.
  const showBottomAxis = !!s.showBottomAxis;
  const usedBottom = xAxisH + axisToRowsGap + rowsH + (showBottomAxis ? bottomAxisGap + xAxisH : 0) + cycleTablesH + annotationsH + noMarkerGap + bottomPad + footerH;
  const minChartH = showChartSection ? 60 : 0;

  // Canvas-Hoehe: normalerweise aus dem gewaehlten Seitenverhaeltnis, aber niemals
  // kleiner als das, was Titel/Legende/Chart(min. 60px)/Achse(n)/Zeilen/Markierungen/
  // Fußzeile tatsaechlich benoetigen - so kann bei sehr vielen Inhalten die
  // Canvas-Hoehe automatisch wachsen, statt dass sich unten alles ueberlappt.
  const aspectH = Math.round(W * s.aspectH / s.aspectW);
  const neededH = chartTop + minChartH + usedBottom;
  const H = Math.max(aspectH, neededH);
  const outputW = Math.max(200, Math.round(Number(s.canvasWidth) || REF_W));
  const outputH = Math.round(outputW * H / W);

  let chartBottom = showChartSection ? (H - usedBottom) : chartTop;
  const xAxisTop = chartBottom;
  const xAxisBottom = xAxisTop + xAxisH;
  const tickLabelY = xAxisTop + tickLabelYOffset;
  const segLabelY = xAxisTop + segLabelYOffset;
  const xAxisLabelY = xAxisTop + xAxisLabelYOffset;

  let rowY = xAxisBottom + axisToRowsGap;
  const rowsTop = rowY;
  let prevRowKind = null;
  const rowFrames = visibleRows.map((r, i) => {
    if (r.kind === 'header') {
      if (i > 0) rowY += headerGapBefore;
    } else if (prevRowKind === 'header') {
      rowY += headerGapAfter;
    } else if (prevRowKind === 'state' && r.kind === 'state') {
      rowY += stateRowGap;
    } else if (prevRowKind && r.kind !== prevRowKind && CONTENT_ROW_KINDS.includes(r.kind) && CONTENT_ROW_KINDS.includes(prevRowKind)) {
      rowY += rowKindGap;
    }
    const h = rowHeightFor(r, FS);
    const frame = { row: r, kind: r.kind, y0: rowY, y1: rowY + h, center: rowY + h / 2 };
    if (r.kind === 'event') frame.center = rowY + h * 0.4;
    rowY += h;
    prevRowKind = r.kind;
    return frame;
  });
  const rowsBottom = rowY;

  // Optionale zweite (untere) X-Achse: exaktes Duplikat der oberen, direkt
  // unterhalb der Zeilen - nuetzlich bei langen Ereignis-/Zustandsbereichen, damit
  // man den Tagesbezug nicht staendig nach oben scrollen/schauen muss.
  let bottomAxisTop = null, bottomAxisBottom = null;
  if (showBottomAxis) {
    bottomAxisTop = rowsBottom + bottomAxisGap;
    bottomAxisBottom = bottomAxisTop + xAxisH;
  }
  const bottomTickLabelY = showBottomAxis ? bottomAxisTop + tickLabelYOffset : null;
  const bottomSegLabelY = showBottomAxis ? bottomAxisTop + segLabelYOffset : null;
  const bottomAxisLabelY = showBottomAxis ? bottomAxisTop + xAxisLabelYOffset : null;

  // Positionen der Zyklustabellen (Spaltenbreite einheitlich, passend zur Plotbreite)
  let cyUnits = 1;
  cycleListPre.forEach(c => c.model.blocks.forEach(b => { const u = b.cols.reduce((x, col) => x + (col.gap ? 0.5 : 1), 0); if (u > cyUnits) cyUnits = u; }));
  const cyCw = Math.max(16, Math.min(58, plotWidth / cyUnits));
  let cyY = showBottomAxis ? bottomAxisBottom : rowsBottom;
  const cycleTables = cycleListPre.map(c => {
    cyY += cyM.gap;
    const y0 = cyY, height = cycleModelHeight(c.model, cyM);
    cyY += height;
    return {
      item: c.item, model: c.model, height,
      geom: { x0: plotLeft, y0, cw: cyCw, fontPx: cyM.fp, rowH: cyM.rowH, hdrH: cyM.hdrH, dateH: cyM.dateH, titleH: cyM.titleH, blockGap: cyM.blockGap,
        badgeR: cyM.badgeR, noteLineH: cyM.noteLineH, noteGap: cyM.noteGap, dayHit: { rowId: c.rowId, itemId: c.item.id },
        labelRight: plotLeft - rowLabelGapPx, labelMaxW: Math.max(20, plotLeft - rowLabelGapPx - pad), fontFamily: s.fontFamily }
    };
  });
  const annotationsY = (showBottomAxis ? bottomAxisBottom : rowsBottom) + cycleTablesH;
  // Fusszeile wird relativ zum tatsaechlichen Ende des Inhalts (Zeilen/untere Achse +
  // Markierungsliste) positioniert statt ueber eine von H abgeleitete Formel - so
  // bleibt sie immer exakt unterhalb der Markierungsliste, unabhaengig von
  // plotPadding/Zeilenanzahl/Schriftgroesse.
  const footerY = s.footerText ? (annotationsY + annotationsH + noMarkerGap + footerFontPx * 0.85) : 0;


  // Segmente -> Pixelbereiche. Deaktivierte Abschnitte werden ausgeblendet; die
  // verbleibenden werden IMMER defensiv nach Starttag sortiert (unabhaengig von der
  // Reihenfolge im gespeicherten Array - wichtig falls z.B. eine JSON-Datei mit
  // unsortierten oder ueberlappenden Abschnitten geladen wurde). Ueberlappende bzw.
  // sich beruehrende Abschnitte (Start <= Ende eines bereits uebernommenen Abschnitts)
  // sowie entartete Abschnitte (Ende <= Start) werden von der Darstellung ausgeschlossen,
  // damit die Tag->Pixel-Zuordnung immer eindeutig bleibt.
  // (Filterung der aktiven Abschnitte erfolgt bereits weiter oben, siehe activeSegs.)
  const gap = Math.max(0, Number(s.segmentGap) || 0);
  const nSeg = activeSegs.length;
  const totalGap = gap * Math.max(0, nSeg - 1);
  const availWidth = Math.max(20, plotWidth - totalGap);
  const totalWeight = activeSegs.reduce((a, sg) => a + (Number(sg.weight) || 0), 0) || 1;
  let cx = plotLeft;
  const segs = activeSegs.map((sg, i) => {
    const w = availWidth * ((Number(sg.weight) || 0) / totalWeight);
    const rec = Object.assign({}, sg, { px0: cx, px1: cx + w });
    cx += w;
    if (i < nSeg - 1) cx += gap;
    return rec;
  });

  function segmentIndexForDay(day) {
    for (let i = 0; i < segs.length; i++) {
      if (day >= segs[i].start && day <= segs[i].end) return i;
    }
    return -1;
  }

  let outOfRangeCount = 0;
  function dayToX(day) {
    if (!segs.length) return plotLeft;
    const idx = segmentIndexForDay(day);
    if (idx >= 0) {
      const sg = segs[idx];
      const f = sg.end === sg.start ? 0 : (day - sg.start) / (sg.end - sg.start);
      return sg.px0 + f * (sg.px1 - sg.px0);
    }
    if (day < segs[0].start) { outOfRangeCount++; return segs[0].px0; }
    if (day > segs[segs.length - 1].end) { outOfRangeCount++; return segs[segs.length - 1].px1; }
    for (let i = 0; i < segs.length - 1; i++) {
      if (day > segs[i].end && day < segs[i + 1].start) return (segs[i].px1 + segs[i + 1].px0) / 2;
    }
    return plotLeft;
  }

  // Ticks pro Segment: Start & Ende IMMER sichtbar, segment-LOKAL berechnet (siehe
  // Kommentar unten) statt ueber dayToX, da ein Tag der gleichzeitig Ende eines
  // Nachbarsegments ist sonst faelschlich dem vorherigen Segment zugeordnet wuerde.
  segs.forEach(sg => {
    sg.ticks = [];
    const localX = (d) => sg.px0 + (sg.end === sg.start ? 0 : (d - sg.start) / (sg.end - sg.start)) * (sg.px1 - sg.px0);
    const step = Number(sg.tickStep) || 0;
    if (step > 0) {
      for (let d = sg.start; d < sg.end - 1e-9; d += step) {
        sg.ticks.push({ day: Math.round(d * 100) / 100, x: localX(d) });
      }
      const nearThreshold = step * 0.3;
      while (sg.ticks.length && (sg.end - sg.ticks[sg.ticks.length - 1].day) < nearThreshold) sg.ticks.pop();
      sg.ticks.push({ day: sg.end, x: sg.px1 });
      if (!sg.ticks.length || sg.ticks[0].day !== sg.start) sg.ticks.unshift({ day: sg.start, x: sg.px0 });
    } else {
      sg.ticks.push({ day: sg.start, x: sg.px0 }, { day: sg.end, x: sg.px1 });
    }
    sg.ticks.forEach((t, i) => { t.edge = (i === 0 || i === sg.ticks.length - 1); });
  });

  function yRangeFor(axis) {
    const manual = axis === 'y1' ? s.y1Mode === 'manual' : s.y2Mode === 'manual';
    if (manual) {
      const mn = Number(axis === 'y1' ? s.y1Min : s.y2Min);
      const mx = Number(axis === 'y1' ? s.y1Max : s.y2Max);
      if (isFinite(mn) && isFinite(mx) && mx > mn) return { min: mn, max: mx };
    }
    const vals = [];
    visibleSeries.filter(sr => (sr.axis || 'y1') === axis).forEach(sr => sr.points.forEach(p => {
      if (isFinite(p.value)) vals.push(Number(p.value));
    }));
    // Aktive Y-Achsen-Markierungen sollen im automatischen Bereich immer sichtbar sein.
    if (vals.length) activeRefLines(s, axis).forEach(l => vals.push(Number(l.value)));
    // AUC-Flaechen reichen bis y = 0 - die 0 muss daher im Bereich liegen.
    if (vals.length && visibleSeries.some(sr => (sr.axis || 'y1') === axis && seriesMode(sr) === 'auc')) vals.push(0);
    if (!vals.length) return { min: 0, max: 1 };
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad2 = (mx - mn) * 0.14;
    return { min: mn - pad2, max: mx + pad2 };
  }
  const y1r = yRangeFor('y1');
  const y2r = showY2 ? yRangeFor('y2') : null;

  // Optional: Nulllinie beider Y-Achsen angleichen, damit "0" (bzw. der jeweils
  // niedrigste Punkt) auf gleicher Bildschirmhoehe liegt. Ohne diese Option kann
  // jede Achse eine unterschiedliche untere Polsterung haben, wodurch z.B. "0"
  // links und rechts auf unterschiedlicher Hoehe erscheint.
  if (s.alignAxisMin && y2r) {
    const frac = (r) => (r.max === r.min) ? 0 : (0 - r.min) / (r.max - r.min);
    const f1 = frac(y1r), f2 = frac(y2r);
    const F = Math.max(f1, f2);
    if (F > 0 && F < 1) {
      if (f1 < F) y1r.min = (F * y1r.max) / (F - 1);
      if (f2 < F) y2r.min = (F * y2r.max) / (F - 1);
    }
  }

  const yToPx = (v, range) => chartBottom - (v - range.min) / (range.max - range.min) * (chartBottom - chartTop);

  function niceTicks(range, n) {
    const span = range.max - range.min;
    const rawStep = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const norm = rawStep / mag;
    let step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    step *= mag;
    const start = Math.ceil(range.min / step) * step;
    const out = [];
    for (let v = start; v <= range.max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }
  const y1Ticks = niceTicks(y1r, 5);
  const y2Ticks = y2r ? niceTicks(y2r, 5) : [];

  // Y-Achsen-Markierungen: nur zeichnen, wenn die Achse existiert und der Wert im
  // (ggf. manuell festgelegten) Bereich liegt. Tick-Zahlen, die von einer
  // Beschriftung ueberdeckt wuerden, werden ausgeblendet.
  const refLines = [];
  let refLinesSkipped = 0;
  if (showChartSection) {
    ['y1', 'y2'].forEach(axis => {
      const range = axis === 'y1' ? y1r : y2r;
      activeRefLines(s, axis).forEach(l => {
        const v = Number(l.value);
        if (!range || v < range.min || v > range.max) { refLinesSkipped++; return; }
        refLines.push({ id: l.id, axis, value: v, y: yToPx(v, range), color: l.color || '#C1461F', style: l.style || 'solid', width: Math.max(0.3, Number(l.width) || 1), label: l.label || '', labelFontPx: (Number(l.labelSize) || 11) * FS });
      });
    });
  }
  function tickHiddenByRefLabel(axis, tickY) {
    return refLines.some(rl => rl.axis === axis && rl.label && Math.abs(rl.y - tickY) < Math.max(rl.labelFontPx * refLabelPlain(rl.label).length * 0.62, yTickFontPx) + 2);
  }

  function catmullRom(pts) {
    if (pts.length < 2) return [];
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const xLo = Math.min(p1.x, p2.x), xHi = Math.max(p1.x, p2.x);
      const c1x = clamp(p1.x + (p2.x - p0.x) / 6, xLo, xHi);
      const c2x = clamp(p2.x - (p3.x - p1.x) / 6, xLo, xHi);
      out.push({
        x0: p1.x, y0: p1.y,
        x1: c1x, y1: p1.y + (p2.y - p0.y) / 6,
        x2: c2x, y2: p2.y - (p3.y - p1.y) / 6,
        x3: p2.x, y3: p2.y
      });
    }
    return out;
  }
  function straight(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      out.push({ x0: p1.x, y0: p1.y, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x3: p2.x, y3: p2.y });
    }
    return out;
  }

  // Ermittelt, welche(r) Teil(e) eines Zeitintervalls [startDay,endDay] innerhalb der
  // AKTIVEN (angezeigten) Abschnitte liegen - segment-lokal berechnet, damit auch bei
  // deaktivierten Abschnitten in der Mitte korrekt in mehrere sichtbare Teilstuecke
  // zerlegt wird statt an den Rand geklemmt zu werden. Liegt gar kein Teil in einem
  // sichtbaren Abschnitt, wird ein leeres Array zurueckgegeben (=> nicht zeichnen).
  function segmentPieces(startDay, endDay) {
    const pieces = [];
    segs.forEach((sg, segIdx) => {
      const ov0 = Math.max(startDay, sg.start);
      const ov1 = Math.min(endDay, sg.end);
      if (ov1 > ov0) {
        const f0 = (sg.end === sg.start) ? 0 : (ov0 - sg.start) / (sg.end - sg.start);
        const f1 = (sg.end === sg.start) ? 0 : (ov1 - sg.start) / (sg.end - sg.start);
        pieces.push({ x0: sg.px0 + f0 * (sg.px1 - sg.px0), x1: sg.px0 + f1 * (sg.px1 - sg.px0), day0: ov0, day1: ov1, segIdx });
      } else if (startDay === endDay && startDay >= sg.start && startDay <= sg.end) {
        const f = (sg.end === sg.start) ? 0 : (startDay - sg.start) / (sg.end - sg.start);
        const x = sg.px0 + f * (sg.px1 - sg.px0);
        pieces.push({ x0: x, x1: x, day0: startDay, day1: endDay, segIdx });
      }
    });
    return pieces;
  }
  // Reicht ein Zustand ueber den sichtbaren Abschnitt hinaus (er beginnt frueher / endet spaeter),
  // ohne dass der vorherige/naechste Abschnitt erreicht wird (=> kein Verbindungspfeil), wird das
  // Box-Ende als "gekuerzt" markiert. xe = tatsaechliche Position von Beginn/Ende, anteilig in die
  // Luecke zwischen den Abschnitten abgebildet (am Rand ohne Nachbarabschnitt: kurzer Stummel).
  function stateEdgeMarks(it) {
    const P = it.pieces;
    if (!P.length || it.start === it.end) return { left: null, right: null };
    const first = P[0], last = P[P.length - 1];
    const EPS = 1e-9, STUB = 6;
    let left = null, right = null;
    if (first.day0 > it.start + EPS) {
      const seg = segs[first.segIdx], prev = segs[first.segIdx - 1];
      let xe;
      if (prev) {
        const span = seg.start - prev.end;
        const f = span > 0 ? Math.min(1, Math.max(0, (it.start - prev.end) / span)) : 1;
        xe = prev.px1 + f * (seg.px0 - prev.px1);
      } else xe = first.x0 - STUB;
      left = { x: first.x0, xe, w: first.x1 - first.x0, room: prev ? Math.max(0, first.x0 - prev.px1) : 0 };
    }
    if (last.day1 < it.end - EPS) {
      const seg = segs[last.segIdx], next = segs[last.segIdx + 1];
      let xe;
      if (next) {
        const span = next.start - seg.end;
        const f = span > 0 ? Math.min(1, Math.max(0, (it.end - seg.end) / span)) : 1;
        xe = seg.px1 + f * (next.px0 - seg.px1);
      } else xe = last.x1 + STUB;
      right = { x: last.x1, xe, w: last.x1 - last.x0, room: next ? Math.max(0, next.px0 - last.x1) : 0 };
    }
    if (left && right && P.length === 1) { left.shared = true; right.shared = true; }
    return { left, right };
  }
  const isDayVisible = (day) => segmentIndexForDay(day) >= 0;
  let hiddenCount = 0;

  const seriesLayout = visibleSeries.map((sr, si) => {
    const axis = sr.axis === 'y2' && y2r ? 'y2' : 'y1';
    const range = axis === 'y2' ? y2r : y1r;
    // Werte, deren Tag in keinem sichtbaren (aktiven) Abschnitt liegt, werden komplett
    // weggelassen statt an den Rand geklemmt zu werden.
    const rawPts = sr.points.filter(p => isFinite(p.day) && isFinite(p.value));
    const sorted = rawPts.filter(p => isDayVisible(p.day)).sort((a, b) => a.day - b.day);
    hiddenCount += rawPts.length - sorted.length;
    const pts = sorted.map(p => ({ day: p.day, value: p.value, x: dayToX(p.day), y: yToPx(p.value, range), showValue: !!p.showValue, styleId: p.styleId || null }));
    const groups = [];
    let curIdx = null, curGroup = null;
    pts.forEach(p => {
      const idx = segmentIndexForDay(p.day);
      if (idx !== curIdx || !curGroup) { curGroup = []; groups.push(curGroup); curIdx = idx; }
      curGroup.push(p);
    });
    const bezGroups = groups.map(g => (sr.smooth ? catmullRom(g) : straight(g)));
    const mode = seriesMode(sr);
    // Grundlinie der AUC-Flaeche: y = 0, bei manuellem Bereich ohne 0 an den Rand geklemmt.
    const baseY = clamp(yToPx(0, range), Math.min(chartTop, chartBottom), Math.max(chartTop, chartBottom));
    // Glaettung darf bei AUC nicht unter die Nulllinie ueberschwingen (Kontrollpunkte
    // begrenzen -> Kurve bleibt in der konvexen Huelle oberhalb von y = 0).
    if (mode === 'auc' && sr.smooth) bezGroups.forEach(bez => bez.forEach(b => {
      if (b.y0 <= baseY && b.y3 <= baseY) { b.y1 = Math.min(b.y1, baseY); b.y2 = Math.min(b.y2, baseY); }
    }));
    return Object.assign({}, sr, { axis, pts, groups, bezGroups, colorIdx: si, mode, baseY });
  });

  // Kollisionspruefung fuer angeklickte, sichtbare Kurvenwerte: liegen zwei
  // Beschriftungen (z.B. bei nahe beieinander liegenden Kurven oder einer steilen
  // Kurve) zu dicht beieinander, wird die Beschriftung nach oben versetzt - aber
  // nur begrenzt (max. 3 Zeilenhoehen), damit sie nie "wegfliegt" und dabei in
  // einen voellig anderen Kurvenbereich rutscht. Wird eine Beschriftung dabei
  // spuerbar versetzt, bekommt sie zusaetzlich eine duenne Verbindungslinie zu
  // ihrem Punkt, damit die Zuordnung immer eindeutig bleibt.
  // (sr.markerSize wird beim eigentlichen Zeichnen der Marker OHNE FS-Skalierung
  // verwendet - hier bewusst genauso, damit der Startabstand zum echten Marker passt.)
  {
    const labelFontPx = 11 * FS;
    const items = [];
    seriesLayout.forEach(sr => {
      sr.pts.forEach(p => {
        if (p.showValue) {
          const text = formatPointValue(p.value);
          const w = measureTextWidth(text, labelFontPx, s.fontFamily) + 8;
          p.naturalLabelY = p.y - sr.markerSize * 0.7 - 8;
          p.labelY = p.naturalLabelY;
          p.labelHalfW = w / 2;
          p.labelLeader = false;
          items.push(p);
        }
      });
    });
    items.sort((a, b) => a.x - b.x);
    const lineStep = Math.round(labelFontPx * 1.5);
    const maxPush = lineStep * 3;
    const placed = [];
    items.forEach(cur => {
      const minY = cur.naturalLabelY - maxPush; // absolute Obergrenze - egal wie lang die Kollisionskette ist
      let y = cur.naturalLabelY;
      let changed = true, iterations = 0;
      while (changed && iterations < 15) {
        changed = false;
        iterations++;
        for (const other of placed) {
          const overlapX = Math.abs(cur.x - other.x) < (cur.labelHalfW + other.labelHalfW + 4);
          if (!overlapX) continue;
          if (Math.abs(y - other.labelY) < lineStep) {
            const wanted = Math.max(minY, other.labelY - lineStep);
            if (wanted < y) { y = wanted; changed = true; }
          }
        }
      }
      cur.labelY = y;
      cur.labelLeader = Math.abs(y - cur.naturalLabelY) > lineStep * 0.6;
      placed.push(cur);
    });
  }

  // Zeilen (Ereignis / Zustand / Ueberschrift) in benutzerdefinierter Reihenfolge
  const contentRows = rowFrames.map(frame => {
    const r = frame.row;
    if (r.kind === 'header') {
      return Object.assign({}, frame, { text: r.text });
    }
    if (r.kind === 'event') {
      // Ereignisse in nicht sichtbaren Abschnitten (deaktiviert oder ausserhalb aller
      // Abschnitte) werden nicht dargestellt.
      const visibleItems = r.items.filter(it => isDayVisible(it.day));
      hiddenCount += r.items.length - visibleItems.length;
      const items = visibleItems.map(it => Object.assign({}, it, {
        x: dayToX(it.day), symbol: r.symbol, color: it.colorOverride || r.color, textSize: r.textSize, symbolSize: r.symbolSize
      }));
      return Object.assign({}, frame, { type: r.name, rowId: r.id, items, isCycle: !!r.isCycle });
    }
    if (r.kind === 'values') {
      ensureValueIds(r);
      // Werte in nicht sichtbaren Abschnitten werden (wie bei Kurven) weggelassen.
      const raw = (r.points || []).filter(p => isFinite(p.day) && isFinite(p.value) && String(p.value) !== '');
      const vis = raw.filter(p => isDayVisible(Number(p.day))).sort((a, b) => a.day - b.day);
      hiddenCount += raw.length - vis.length;
      const fontPx = (Number(r.textSize) || 13) * FS;
      const lineH = valuesRowLineH(r, FS);
      // Optional zweizeilig versetzt: kollidiert ein Wert mit seinem Vorgaenger in
      // der oberen Reihe, wandert er in die untere (und umgekehrt).
      const lastRight = [-Infinity, -Infinity];
      const items = vis.map(p => {
        const text = formatRowValue(p.value, r.decimals) + (r.unit ? ' ' + r.unit : '');
        const halfW = measureTextWidth(text, fontPx, s.fontFamily) / 2 + 3;
        // Randwerte (z.B. Tag 0) nicht in die Zeilen-Bezeichnung links bzw. ueber den
        // rechten Seitenrand ragen lassen: Text wird dann leicht nach innen geschoben.
        const leftLimit = plotLeft - Math.max(0, Number(s.rowLabelGap) || 0) * 0.5 + halfW;
        const rightLimit = W - pad - halfW;
        const x = clamp(dayToX(Number(p.day)), leftLimit, Math.max(leftLimit, rightLimit));
        let level = 0;
        if (r.stagger) {
          const left = x - halfW;
          // Kollidiert mit oberer Reihe -> untere; kollidieren beide, die mit weniger Ueberlappung.
          if (left < lastRight[0]) level = (left < lastRight[1] && lastRight[1] > lastRight[0]) ? 0 : 1;
        }
        lastRight[level] = x + halfW;
        const cy = r.stagger ? frame.center + (level === 0 ? -lineH / 2 : lineH / 2) : frame.center;
        return { id: p.id, day: p.day, value: p.value, text, x, dayX: dayToX(Number(p.day)), y: cy, halfW, fontPx, hl: !!p.hl, hlColor: p.hlColor, hlLabel: p.hlLabel || '' };
      });
      return Object.assign({}, frame, { type: r.name, rowId: r.id, items, color: r.color || '#1E2A24', bold: !!r.bold, textSize: Number(r.textSize) || 13 });
    }
    // state: Jeder Eintrag wird auf die mit aktiven Abschnitten ueberlappenden
    // Teilstuecke reduziert (koennen auch mehrere sein, falls ein deaktivierter
    // Abschnitt mitten im Intervall liegt); Teile in nicht sichtbaren Bereichen
    // werden nicht gezeichnet. Luecken zwischen unmittelbar angrenzenden Eintraegen
    // (z.B. Ende Tag 19 -> Start Tag 20) werden optisch geschlossen: Zustand A wird
    // bis zum tatsaechlichen Beginn von Zustand B verlaengert (nicht in der Mitte
    // getroffen) - formal nicht ganz exakt, sieht aber deutlich sauberer aus als
    // eine sichtbare Luecke oder ein Treffpunkt "auf halbem Tag".
    const withPieces = r.items.map(it => Object.assign({}, it, { pieces: segmentPieces(it.start, it.end) }));
    hiddenCount += withPieces.filter(it => it.pieces.length === 0).length;
    const sorted = [...withPieces].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (!a.pieces.length || !b.pieces.length) continue;
      const lastPiece = a.pieces[a.pieces.length - 1];
      const firstPiece = b.pieces[0];
      const gapDays = b.start - a.end;
      if (gapDays > 0 && gapDays <= 1.001 && lastPiece.segIdx === firstPiece.segIdx) {
        lastPiece.x1 = firstPiece.x0;
      }
    }
    const items = withPieces.filter(it => it.pieces.length > 0);
    items.forEach(it => { it.edges = stateEdgeMarks(it); });
    // Zyklus-Zeilen: Pause bis zum naechsten Zyklus (Linie von Boxende bis Beginn des naechsten + "XX d")
    if (r.isCycle) {
      const ordered = [...withPieces].sort((p, q) => p.start - q.start);
      ordered.forEach((it, i) => {
        if (!it.pause) return;
        const nx = ordered[i + 1];
        if (!nx) return;
        const days = Math.round(nx.start - it.end - 1);   // Tage zwischen letztem Zyklustag und Start des naechsten
        if (days < 1 || !it.pieces.length || !nx.pieces.length) return;
        const x0 = it.pieces[it.pieces.length - 1].x1, x1 = nx.pieces[0].x0;
        if (x1 - x0 < 2) return;
        it.pauseLine = { x0, x1, days };
      });
    }
    return Object.assign({}, frame, { type: r.name, rowId: r.id, items, isCycle: !!r.isCycle });
  });

  // Markierungslinien (hervorgehobene Ereignisse + aktive Zustands-Marken) sammeln,
  // nach X-Wert (Tag) sortieren und durchnummerieren. Die Zahlen-Symbolgroesse wird
  // separat gefuehrt (eigene Ebene) und beeinflusst NICHT die Zeilenhoehen (rowHeightFor
  // oben ist davon komplett unabhaengig) - nur der kleine Abstand zum Ereignis-Symbol
  // wird mitskaliert, damit sich Badge und Symbol nicht ueberlappen.
  const badgeR = Math.max(3, s.markerBadgeSize * FS);
  const annotations = [];
  if (showMarkersSection) {
    contentRows.forEach(row => {
      if (row.kind === 'event') {
        row.items.forEach(it => {
          if (it.hl) {
            const topGap = it.symbolSize * FS / 2 + badgeR + 4;
            annotations.push({
              itemId: it.id, x: it.x, day: it.day, color: it.hlColor || it.color, label: it.hlLabel || '',
              fromY: row.center - topGap
            });
          }
          // Datums-Markierungen eines Zyklus-Symbols (Start / Tag X / Ende)
          (it.marks || []).filter(m => m.active !== false).forEach(m => {
            const day = Number(m.day);
            if (!isDayVisible(day)) return;
            annotations.push({ itemId: it.id, markId: m.id, x: dayToX(day), day, color: m.color || '#1E2A24', label: m.label || '', fromY: row.center - (it.symbolSize * FS / 2 + badgeR + 4) });
          });
        });
      } else if (row.kind === 'values') {
        row.items.forEach(it => {
          if (!it.hl) return;
          // Linie startet am echten Tag (auch wenn der Text am Rand eingerueckt wurde).
          annotations.push({
            itemId: it.id, x: it.dayX, day: Number(it.day), color: it.hlColor || row.color, label: it.hlLabel || '',
            fromY: it.y - it.fontPx * 0.62 - badgeR - 3
          });
        });
      } else if (row.kind === 'state') {
        row.items.forEach(it => {
          (it.marks || []).filter(m => m.active !== false).forEach(m => {
            let day;
            if (m.pos === 'start') day = it.start;
            else if (m.pos === 'end') day = it.end;
            else day = clamp(Number(m.day), Math.min(it.start, it.end), Math.max(it.start, it.end));
            if (!isDayVisible(day)) return; // Markierung liegt in nicht sichtbarem Bereich
            const x = dayToX(day);
            annotations.push({ itemId: it.id, markId: m.id, x, day, color: m.color || '#1E2A24', label: m.label || '', fromY: row.y0 + 4 });
          });
        });
      }
    });
  }
  annotations.sort((a, b) => (a.day - b.day) || (a.x - b.x));
  annotations.forEach((a, i) => { a.number = i + 1; });
  const labeledFinal = annotations.filter(a => a.label).map(a => ({ number: a.number, label: a.label })).concat(styleLegend);
  const annotationList = layoutAnnotationList(labeledFinal, { mode: s.markerListLayout, fontSizePx: listFontPx, plotWidth, fontFamily: s.fontFamily });

  const breaks = [];
  for (let i = 0; i < segs.length - 1; i++) {
    breaks.push({ x: (segs[i].px1 + segs[i + 1].px0) / 2, y0: chartTop, y1: xAxisBottom });
  }

  return {
    W, H, outputW, outputH, pad, titleY, legendY, chartTop, chartBottom, plotLeft, plotRight, plotWidth,
    xAxisTop, xAxisBottom, rowsTop, rowsBottom, segs, y1r, y2r, y1Ticks, y2Ticks, yToPx, showY2, FS,
    showBottomAxis, bottomAxisTop, bottomAxisBottom, bottomTickLabelY, bottomSegLabelY, bottomAxisLabelY,
    refLines, refLinesSkipped, tickHiddenByRefLabel,
    labelColW, y2LabelColW, yTicksW, y2TicksW, tickLabelY, segLabelY, xAxisLabelY, contentLeftX,
    contentRows, breaks, seriesLayout, annotations, annotationsY, cycleTables, cycleTablesH, annotationList, badgeR, footerY, legendLayout,
    bottomY: rowY, outOfRangeCount, hiddenCount, skippedSegmentCount
  };
}

/* ---------- Rich Text: Zeilenumbrueche + Hochstellung (^{...}) fuer
   Ereignis-/Zustandsbeschriftungen, z.B. "10^{-4}" oder ein echter Zeilenumbruch
   aus dem mehrzeiligen Eingabefeld. ---------- */
function parseRichText(str) {
  const lines = String(str == null ? '' : str).split(/\r\n|\r|\n/);
  return lines.map(line => {
    const segs = [];
    const re = /\^\{([^}]*)\}/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) segs.push({ text: line.slice(last, m.index), sup: false });
      segs.push({ text: m[1], sup: true });
      last = re.lastIndex;
    }
    if (last < line.length || !segs.length) segs.push({ text: line.slice(last), sup: false });
    return segs;
  });
}
function richTextLineCount(str) { return parseRichText(str).length; }

function richTextSVG(str, x, y, opts) {
  opts = opts || {};
  if (str == null || str === '') return '';
  const anchor = opts.anchor || 'middle';
  const fill = opts.fill || '#1E2A24';
  const fontSize = opts.fontSize;
  const fontWeight = opts.fontWeight || 400;
  const fontStyle = opts.fontStyle || 'normal';
  const lineH = opts.lineH || fontSize * 1.25;
  const lines = parseRichText(str);
  const totalH = (lines.length - 1) * lineH;
  const startY = opts.valign === 'center' ? y - totalH / 2 : y;
  const extra = opts.extraAttrs || '';
  let out = `<text x="${x}" y="${startY}" text-anchor="${anchor}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" fill="${fill}" ${extra}>`;
  lines.forEach((segs, li) => {
    out += `<tspan x="${x}"${li > 0 ? ` dy="${lineH}"` : ''}>`;
    segs.forEach(seg => {
      out += seg.sup ? `<tspan baseline-shift="super" font-size="70%">${esc(seg.text)}</tspan>` : esc(seg.text);
    });
    out += `</tspan>`;
  });
  out += `</text>`;
  return out;
}

/* ---------- Symbol Path Helpers (SVG) ---------- */
// Formatiert einen Kurvenwert fuer die anklickbare Wert-Anzeige: max. 2
// Nachkommastellen, ohne ueberfluessige Nullen.
function formatPointValue(v) {
  if (!isFinite(v)) return '';
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

// Optionaler 'stroke' ({color,width}) = Rand aus einer Markierungsvorlage. Bei reinen
// Linien-Symbolen (Kreuz/Plus) wird der Rand als breitere Linie darunter gezeichnet.
function symbolSVG(type, cx, cy, size, color, stroke) {
  // Doppelkreuz: zwei kleine Kreuze nebeneinander (z. B. fuer 2 x taegliche Anwendung)
  if (type === 'doublecross') {
    const s2 = size * 0.9, off = size * 0.64;
    return symbolSVG('cross', cx - off, cy, s2, color, stroke) + symbolSVG('cross', cx + off, cy, s2, color, stroke);
  }
  const r = size / 2;
  if (stroke && stroke.width > 0) {
    if (type === 'cross' || type === 'plus') {
      const lw = Math.max(1.6, size * 0.28);
      const under = type === 'cross'
        ? `<line x1="${cx - r}" y1="${cy - r}" x2="${cx + r}" y2="${cy + r}"/><line x1="${cx - r}" y1="${cy + r}" x2="${cx + r}" y2="${cy - r}"/>`
        : `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/>`;
      return `<g stroke="${stroke.color}" stroke-width="${lw + stroke.width * 2}" stroke-linecap="round">${under}</g>` + symbolSVG(type, cx, cy, size, color);
    }
    const base = symbolSVG(type, cx, cy, size, color);
    const attrs = ` stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linejoin="round"`;
    return base.replace(/\/>$/, attrs + '/>');
  }
  switch (type) {
    case 'square':
      return `<rect x="${cx - r}" y="${cy - r}" width="${size}" height="${size}" fill="${color}"/>`;
    case 'triangle': {
      const h = size * 0.9;
      return `<polygon points="${cx},${cy - h * 0.6} ${cx - r},${cy + h * 0.4} ${cx + r},${cy + h * 0.4}" fill="${color}"/>`;
    }
    case 'diamond':
      return `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${color}"/>`;
    case 'star': {
      let pts = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 === 0 ? r : r * 0.42;
        pts.push(`${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
    }
    case 'cross': {
      return `<g stroke="${color}" stroke-width="${Math.max(1.6, size * 0.28)}" stroke-linecap="round">
        <line x1="${cx - r}" y1="${cy - r}" x2="${cx + r}" y2="${cy + r}"/>
        <line x1="${cx - r}" y1="${cy + r}" x2="${cx + r}" y2="${cy - r}"/></g>`;
    }
    case 'plus': {
      return `<g stroke="${color}" stroke-width="${Math.max(1.6, size * 0.28)}" stroke-linecap="round">
        <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
        <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/></g>`;
    }
    case 'circle':
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
  }
}

function numberBadgeSVG(cx, cy, number, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="#1E2A24" stroke-width="1"/>` +
    `<text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-size="${r * 1.15}" fill="#1E2A24">${number}</text>`;
}

/* ---------- SVG Renderer ---------- */
function renderSVG(s) {
  const L = computeLayout(s);
  const FS = L.FS;
  const F = (px) => Math.round(px * FS * 10) / 10;
  const axAttrs = axisStyleAttrs(s.axisLabelStyle);
  const rlAttrs = axisStyleAttrs(s.rowLabelStyle);
  let g = [];
  let defs = [];

  g.push(`<rect x="0" y="0" width="${L.W}" height="${L.H}" fill="#FFFFFF"/>`);

  if (s.title) {
    const tx = s.titleAlign === 'left' ? L.plotLeft : L.W / 2;
    const anchor = s.titleAlign === 'left' ? 'start' : 'middle';
    g.push(`<text x="${tx}" y="${L.titleY}" text-anchor="${anchor}" font-size="${F(20)}" font-weight="700" fill="#1E2A24">${esc(s.title)}</text>`);
  }

  const showChart = s.showChartSection !== false;
  if (showChart) {
  // AUC-Flaechen ganz hinten (noch unter dem Gitter).
  L.seriesLayout.filter(sr => sr.mode === 'auc').forEach(sr => {
    const op = aucOpacity(sr);
    sr.bezGroups.forEach(bez => {
      if (!bez.length) return;
      let d = `M ${bez[0].x0} ${sr.baseY} L ${bez[0].x0} ${bez[0].y0} `;
      bez.forEach(b => { d += `C ${b.x1} ${b.y1}, ${b.x2} ${b.y2}, ${b.x3} ${b.y3} `; });
      d += `L ${bez[bez.length - 1].x3} ${sr.baseY} Z`;
      g.push(`<path d="${d}" fill="${sr.aucFill || sr.color}" fill-opacity="${op}" stroke="none" style="pointer-events:none;"/>`);
    });
  });
  if (s.showGrid) {
    L.y1Ticks.forEach(v => {
      const y = L.yToPx(v, L.y1r);
      L.segs.forEach(sg => {
        g.push(`<line x1="${sg.px0}" y1="${y}" x2="${sg.px1}" y2="${y}" stroke="#E7EAE7" stroke-width="1"/>`);
      });
    });
  }

  const axW = s.axisLineWidth;
  g.push(`<line x1="${L.plotLeft}" y1="${L.chartTop}" x2="${L.plotLeft}" y2="${L.chartBottom}" stroke="${s.axisColor}" stroke-width="${axW}"/>`);
  if (L.showY2) g.push(`<line x1="${L.plotRight}" y1="${L.chartTop}" x2="${L.plotRight}" y2="${L.chartBottom}" stroke="${s.axisColor}" stroke-width="${axW}"/>`);

  L.y1Ticks.forEach(v => {
    const y = L.yToPx(v, L.y1r);
    g.push(`<line x1="${L.plotLeft - 5}" y1="${y}" x2="${L.plotLeft}" y2="${y}" stroke="${s.axisColor}" stroke-width="${axW}"/>`);
    if (!L.tickHiddenByRefLabel('y1', y)) g.push(`<text x="${L.plotLeft - 9}" y="${y + 4}" text-anchor="end" font-size="${F(s.yTickLabelSize)}" fill="#1E2A24">${v}</text>`);
  });
  if (s.yAxisLabel && L.labelColW > 0) {
    const axisLx = L.plotLeft - L.yTicksW - L.labelColW / 2;
    const ly = (L.chartTop + L.chartBottom) / 2;
    g.push(`<text x="${axisLx}" y="${ly}" text-anchor="middle" font-size="${F(s.axisLabelSize)}" font-style="${axAttrs.fontStyle}" font-weight="${axAttrs.fontWeight}" fill="#1E2A24" transform="rotate(-90 ${axisLx} ${ly})">${esc(s.yAxisLabel)}</text>`);
  }
  if (L.showY2) {
    L.y2Ticks.forEach(v => {
      const y = L.yToPx(v, L.y2r);
      g.push(`<line x1="${L.plotRight}" y1="${y}" x2="${L.plotRight + 5}" y2="${y}" stroke="${s.axisColor}" stroke-width="${axW}"/>`);
      if (!L.tickHiddenByRefLabel('y2', y)) g.push(`<text x="${L.plotRight + 9}" y="${y + 4}" text-anchor="start" font-size="${F(s.yTickLabelSize)}" fill="#1E2A24">${v}</text>`);
    });
    if (s.y2AxisLabel && L.y2LabelColW > 0) {
      const lx = L.W - L.pad - L.y2LabelColW / 2;
      const ly = (L.chartTop + L.chartBottom) / 2;
      g.push(`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="${F(s.axisLabelSize)}" font-style="${axAttrs.fontStyle}" font-weight="${axAttrs.fontWeight}" fill="#1E2A24" transform="rotate(90 ${lx} ${ly})">${esc(s.y2AxisLabel)}</text>`);
    }
  }

  // Duenne AUC-Linien ebenfalls hinter allen anderen Kurven.
  // Die Linie wird auf die Breite der Flaeche beschnitten, damit eine dicke Linie
  // an den Enden (erster/letzter Wert, Abschnittsgrenzen) nicht seitlich uebersteht.
  L.seriesLayout.filter(sr => sr.mode === 'auc').forEach(sr => {
    sr.bezGroups.forEach((bez, gi) => {
      if (!bez.length) return;
      const x0 = bez[0].x0, x1 = bez[bez.length - 1].x3;
      const clipId = `aucclip-${sr.id}-${gi}`.replace(/[^A-Za-z0-9_-]/g, '');
      g.push(`<clipPath id="${clipId}"><rect x="${Math.min(x0, x1)}" y="0" width="${Math.abs(x1 - x0)}" height="${L.H}"/></clipPath>`);
      let d = `M ${bez[0].x0} ${bez[0].y0} `;
      bez.forEach(b => { d += `C ${b.x1} ${b.y1}, ${b.x2} ${b.y2}, ${b.x3} ${b.y3} `; });
      g.push(`<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${aucLineW(sr)}" stroke-linecap="butt" stroke-linejoin="round" clip-path="url(#${clipId})" style="pointer-events:none;"/>`);
    });
  });

  // Y-Achsen-Markierungen: waagerecht ueber die gesamte Diagrammbreite (unter den
  // Kurven), Beschriftung links (primaer) bzw. rechts (sekundaer) neben der Achse.
  L.refLines.forEach(rl => {
    const da = refLineDashArray(rl.style, rl.width);
    g.push(`<line x1="${L.plotLeft}" y1="${rl.y}" x2="${L.plotRight}" y2="${rl.y}" stroke="${rl.color}" stroke-width="${rl.width}"${da ? ` stroke-dasharray="${da}"` : ''}${rl.style === 'dotted' || rl.style === 'dashdot' ? ' stroke-linecap="round"' : ''} style="pointer-events:none;"/>`);
    if (rl.label) {
      const left = rl.axis === 'y1';
      const fpx = Math.round(rl.labelFontPx * 10) / 10;
      g.push(richTextSVG(rl.label, left ? L.plotLeft - 9 : L.plotRight + 9, rl.y + fpx * 0.35, {
        anchor: left ? 'end' : 'start', fontSize: fpx, fill: rl.color, valign: 'center', lineH: fpx * 1.15, extraAttrs: 'style="pointer-events:none;"'
      }));
    }
  });

  L.seriesLayout.forEach(sr => {
    if (sr.mode === 'lineMarkers' || sr.mode === 'line') sr.bezGroups.forEach(bez => {
      if (!bez.length) return;
      let d = `M ${bez[0].x0} ${bez[0].y0} `;
      bez.forEach(b => { d += `C ${b.x1} ${b.y1}, ${b.x2} ${b.y2}, ${b.x3} ${b.y3} `; });
      g.push(`<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${sr.width}" stroke-linecap="round" stroke-linejoin="round"/>`);
    });
    sr.pts.forEach(p => {
      g.push(`<g data-kind="point" data-series-id="${sr.id}" data-point-day="${p.day}" class="clickable-item">`);
      g.push(`<circle cx="${p.x}" cy="${p.y}" r="${Math.max(9, sr.markerSize * 0.9)}" fill="transparent" style="cursor:pointer;"/>`);
      const pms = findMarkStyle(s, p.styleId);
      // AUC / Nur Linie: keine Symbole - ausser der Punkt hat explizit eine Markierungsvorlage.
      if ((sr.mode !== 'auc' && sr.mode !== 'line') || pms) g.push(symbolSVG(sr.markerType, p.x, p.y, sr.markerSize, pms ? (pms.fill || sr.color) : sr.color, markStyleStroke(pms)));
      if (p.showValue) {
        const lfPx = Math.round(11 * FS * 10) / 10;
        if (p.labelLeader) {
          g.push(`<line x1="${p.x}" y1="${p.y - Math.max(6, sr.markerSize * 0.6)}" x2="${p.x}" y2="${p.labelY + lfPx * 0.45}" stroke="${sr.color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.6" style="pointer-events:none;"/>`);
        }
        g.push(`<rect x="${p.x - p.labelHalfW}" y="${p.labelY - lfPx * 0.82}" width="${p.labelHalfW * 2}" height="${lfPx * 1.15}" rx="2" fill="#FFFFFF" fill-opacity="0.85" style="pointer-events:none;"/>`);
        g.push(`<text x="${p.x}" y="${p.labelY}" text-anchor="middle" font-size="${lfPx}" font-weight="700" fill="${sr.color}" style="pointer-events:none;">${esc(formatPointValue(p.value))}</text>`);
      }
      g.push(`</g>`);
    });
  });
  } // showChart

  // X-Achse (Ticks, Abschnittsbeschriftung, Bruch-Symbole) bleibt auch ohne
  // sichtbaren Kurven-/Achsen-Bereich stehen - Zeilen und Markierungen orientieren
  // sich weiterhin daran. Wiederverwendbar, da optional eine zweite (untere)
  // X-Achse unterhalb der Zeilen dasselbe zeichnet.
  const axWx = s.axisLineWidth;
  function drawXAxisSVG(axisTop, tickY, segY, axisLabelY) {
    L.segs.forEach(sg => {
      g.push(`<line x1="${sg.px0}" y1="${axisTop}" x2="${sg.px1}" y2="${axisTop}" stroke="${s.axisColor}" stroke-width="${axWx}" stroke-linecap="square"/>`);
      sg.ticks.forEach(t => {
        g.push(`<line x1="${t.x}" y1="${axisTop}" x2="${t.x}" y2="${axisTop + (t.edge ? 8 : 5)}" stroke="${s.axisColor}" stroke-width="${t.edge ? axWx + 0.4 : axWx}"/>`);
        g.push(`<text x="${t.x}" y="${tickY}" text-anchor="middle" font-size="${F(s.xTickLabelSize)}" font-weight="${t.edge ? 700 : 400}" fill="#1E2A24">${t.day}</text>`);
      });
      if (s.showSegmentLabels !== false) {
        g.push(`<text x="${(sg.px0 + sg.px1) / 2}" y="${segY}" text-anchor="middle" font-size="${F(s.segmentLabelSize)}" font-style="italic" fill="#5B6A62">${esc(sg.label || '')}</text>`);
      }
    });
    if (s.xAxisLabel) {
      g.push(`<text x="${(L.plotLeft + L.plotRight) / 2}" y="${axisLabelY}" text-anchor="middle" font-size="${F(s.axisLabelSize)}" font-style="${axAttrs.fontStyle}" font-weight="${axAttrs.fontWeight}" fill="#1E2A24">${esc(s.xAxisLabel)}</text>`);
    }
    L.breaks.forEach(b => {
      g.push(`<g stroke="#1E2A24" stroke-width="2" stroke-linecap="round">
        <line x1="${b.x - 8}" y1="${axisTop + 7}" x2="${b.x - 1}" y2="${axisTop - 7}"/>
        <line x1="${b.x - 2}" y1="${axisTop + 7}" x2="${b.x + 5}" y2="${axisTop - 7}"/>
      </g>`);
    });
  }
  drawXAxisSVG(L.xAxisTop, L.tickLabelY, L.segLabelY, L.xAxisLabelY);
  if (L.showBottomAxis) {
    drawXAxisSVG(L.bottomAxisTop, L.bottomTickLabelY, L.bottomSegLabelY, L.bottomAxisLabelY);
  }

  // Vertikales Gitter im Zeilenbereich (unterhalb des Diagramms): eine Linie je
  // X-Achsen-Tickmark, damit sich Ereignisse/Zustaende leichter einem Tag zuordnen
  // lassen.
  if (s.rowGridVertical && L.contentRows.some(r => r.kind !== 'header')) {
    L.segs.forEach(sg => {
      sg.ticks.forEach(t => {
        g.push(`<line x1="${t.x}" y1="${L.rowsTop}" x2="${t.x}" y2="${L.rowsBottom}" stroke="#E7EAE7" stroke-width="1"/>`);
      });
    });
  }
  const rowGridH = s.rowGridHorizontal || 'off';
  const showRowLine = (kind) => rowGridH === 'all' || rowGridH === (kind === 'event' ? 'events' : kind === 'values' ? 'values' : 'states');

  // Zeilen: Ereignis / Zustand / Werte / Ueberschrift
  L.contentRows.forEach(row => {
    if (row.kind === 'header') {
      const fw = s.groupHeaderBold ? 700 : 400;
      const td = s.groupHeaderUnderline ? 'underline' : 'none';
      g.push(`<text x="${L.plotLeft - s.rowLabelGap}" y="${row.center + 4}" text-anchor="end" font-size="${F(s.groupHeaderSize)}" font-weight="${fw}" text-decoration="${td}" fill="#1E2A24">${esc(row.text)}</text>`);
      return;
    }
    if (row.kind === 'values') {
      g.push(`<text x="${L.plotLeft - s.rowLabelGap}" y="${row.center + 4}" text-anchor="end" font-size="${F(s.rowLabelSize)}" font-style="${rlAttrs.fontStyle}" font-weight="${rlAttrs.fontWeight}" fill="#1E2A24">${esc(row.type)}</text>`);
      const lineOn = showRowLine('values');
      if (lineOn) g.push(`<line x1="${L.plotLeft}" y1="${row.center}" x2="${L.plotRight}" y2="${row.center}" stroke="#E7EAE7" stroke-width="1"/>`);
      const needBg = lineOn || s.rowGridVertical;
      row.items.forEach(it => {
        const fpx = Math.round(it.fontPx * 10) / 10;
        const col = it.hl ? (it.hlColor || row.color) : row.color;
        const bold = row.bold || it.hl;
        g.push(`<g data-kind="value" data-row-id="${row.rowId}" data-item-id="${it.id}" class="clickable-item">`);
        g.push(`<rect x="${it.x - it.halfW}" y="${it.y - fpx * 0.62}" width="${it.halfW * 2}" height="${fpx * 1.24}" fill="${needBg ? '#FFFFFF' : 'transparent'}"/>`);
        g.push(`<text x="${it.x}" y="${it.y + fpx * 0.35}" text-anchor="middle" font-size="${fpx}" font-weight="${bold ? 700 : 400}" fill="${col}">${esc(it.text)}</text>`);
        g.push(`</g>`);
      });
      return;
    }
    if (row.kind === 'event') {
      g.push(`<text x="${L.plotLeft - s.rowLabelGap}" y="${row.center + 4}" text-anchor="end" font-size="${F(s.rowLabelSize)}" font-style="${rlAttrs.fontStyle}" font-weight="${rlAttrs.fontWeight}" fill="#1E2A24">${esc(row.type)}</text>`);
      if (showRowLine('event')) g.push(`<line x1="${L.plotLeft}" y1="${row.center}" x2="${L.plotRight}" y2="${row.center}" stroke="#E7EAE7" stroke-width="1"/>`);
      row.items.forEach(it => {
        const col = it.hl ? (it.hlColor || it.color) : it.color;
        g.push(`<g data-kind="${row.isCycle ? 'cycle' : 'event'}" data-row-id="${row.rowId}" data-item-id="${it.id}" class="clickable-item">`);
        g.push(symbolSVG(it.symbol, it.x, row.center, it.symbolSize * FS, col));
        g.push(richTextSVG(it.label, it.x, row.center + it.symbolSize * FS * 0.6 + it.textSize * FS * 0.9 + 4, {
          anchor: 'middle', fontSize: F(it.textSize), fontWeight: it.hl ? 700 : 400, fill: '#1E2A24', lineH: it.textSize * FS * 1.25
        }));
        g.push(`</g>`);
      });
      return;
    }
    // state
    g.push(`<text x="${L.plotLeft - s.rowLabelGap}" y="${row.center + 4}" text-anchor="end" font-size="${F(s.rowLabelSize)}" font-style="${rlAttrs.fontStyle}" font-weight="${rlAttrs.fontWeight}" fill="#1E2A24">${esc(row.type)}</text>`);
    if (showRowLine('state')) g.push(`<line x1="${L.plotLeft}" y1="${row.center}" x2="${L.plotRight}" y2="${row.center}" stroke="#E7EAE7" stroke-width="1"/>`);
    row.items.forEach(it => {
      const stroke = it.color;
      const textColor = darken(it.color, 0.45);
      let fillAttr;
      if (it.hatch) {
        const pid = 'hatch-' + it.id;
        defs.push(`<pattern id="${pid}" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="${lighten(it.color, 0.87)}"/>
          <line x1="0" y1="0" x2="0" y2="9" stroke="${it.color}" stroke-width="2.4"/>
        </pattern>`);
        fillAttr = `url(#${pid})`;
      } else {
        fillAttr = lighten(it.color, 0.82);
      }
      // Ein Eintrag kann mehrere sichtbare Teilstuecke haben (z.B. wenn ein
      // deaktivierter Abschnitt mittendrin liegt) - jedes wird als eigenes Rechteck
      // gezeichnet; die Beschriftung erscheint im breitesten Teilstueck.
      const widest = it.pieces.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), it.pieces[0]);
      it.pieces.forEach(piece => {
        const w = Math.max(2, piece.x1 - piece.x0);
        g.push(`<rect data-kind="${row.isCycle ? 'cycle' : 'state'}" data-row-id="${row.rowId}" data-item-id="${it.id}" class="clickable-item state-rect" x="${piece.x0}" y="${row.y0 + 4}" width="${w}" height="${row.y1 - row.y0 - 8}" fill="${fillAttr}" stroke="${stroke}" stroke-width="1.2"/>`);
        if (piece === widest && w > 34) {
          // Grundlinie skaliert mit der Schriftgröße (0,235 em; bei der Standardgröße = die früheren 3,5 px),
          // damit der Text bei jeder Textgröße vertikal in der Box zentriert bleibt.
          const stateFontPx = F(s.stateLabelSize);
          g.push(richTextSVG(it.label, piece.x0 + w / 2, row.center + stateFontPx * 0.235, {
            anchor: 'middle', fontSize: stateFontPx, fill: textColor, valign: 'center', lineH: s.stateLabelSize * FS * 1.2,
            extraAttrs: 'style="pointer-events:none;"'
          }));
        }
      });
      // Setzt sich derselbe Eintrag ueber eine Luecke zwischen zwei Abschnitten
      // fort (mehrere Teilstuecke), wird das optisch mit einem Pfeil in der
      // Randfarbe der Box verbunden statt einer bloss leeren Luecke.
      const arrowGap = Math.max(0, Number(s.stateArrowGap) || 0);
      for (let i = 0; i < it.pieces.length - 1; i++) {
        const x1 = it.pieces[i].x1 + arrowGap;
        const x2 = it.pieces[i + 1].x0 - arrowGap;
        if (x2 - x1 < 6) continue;
        const ay = row.center;
        const headLen = Math.min(9, (x2 - x1) * 0.35);
        g.push(`<g style="pointer-events:none;">
          <line x1="${x1}" y1="${ay}" x2="${x2 - headLen}" y2="${ay}" stroke="${it.color}" stroke-width="1.6"/>
          <polygon points="${x2},${ay} ${x2 - headLen},${ay - headLen * 0.6} ${x2 - headLen},${ay + headLen * 0.6}" fill="${it.color}"/>
        </g>`);
      }
      if (it.pauseLine) {
        const pl = it.pauseLine, pfpx = F(s.stateLabelSize * 0.85);
        g.push(`<line x1="${pl.x0}" y1="${row.center}" x2="${pl.x1}" y2="${row.center}" stroke="${it.color}" stroke-width="1.4" style="pointer-events:none;"/>`);
        g.push(`<text x="${(pl.x0 + pl.x1) / 2}" y="${row.center - Math.max(3, pfpx * 0.28)}" text-anchor="middle" font-size="${pfpx}" fill="${textColor}" style="pointer-events:none;">${pl.days} d</text>`);
      }
      // Gekuerzte Box-Enden (Zustand reicht ueber den Abschnitt hinaus, ohne Nachbarabschnitt zu erreichen)
      stateEdgePrimitives(it, row.center, row.y1 - row.y0 - 8, s.stateEdgeMode).forEach(p => {
        if (p.t === 'line') g.push(`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${it.color}" stroke-width="${p.w}" style="pointer-events:none;"/>`);
        else g.push(`<polygon points="${p.tip},${p.cy} ${p.tip - p.dir * p.len},${p.cy - p.base / 2} ${p.tip - p.dir * p.len},${p.cy + p.base / 2}" fill="${it.color}" style="pointer-events:none;"/>`);
      });
    });
  });

  // Markierungslinien: gestrichelt vom Ereignis/Zustand bis zum Diagramm-Oberrand,
  // mit nummeriertem Kreis am unteren Ende. Eigene Ebene: Liniendicke und
  // Zahlen-Symbolgroesse sind global einstellbar und wirken sich nie auf die
  // Zeilenhoehen der Ereignis-/Zustands-Zeilen aus.
 // Zyklustabellen (unterhalb von Ereignissen & Zuständen, oberhalb der Markierungsliste)
  (L.cycleTables || []).forEach(t => { cyclePrimsSVG(cycleTablePrimitives(t.model, t.geom)).forEach(x => g.push(x)); });

  L.annotations.forEach(a => {
    g.push(`<line x1="${a.x}" y1="${a.fromY}" x2="${a.x}" y2="${L.chartTop}" stroke="${a.color}" stroke-width="${s.markerLineWidth}" stroke-dasharray="4 3" style="pointer-events:none;"/>`);
    g.push(numberBadgeSVG(a.x, a.fromY, a.number, L.badgeR));
  });

  if (L.legendLayout) {
    L.legendLayout.positions.forEach(p => {
      const lx = L.plotLeft + p.xOffset;
      const ly = L.legendY + p.line * L.legendLayout.lineH;
      const lm = seriesMode(p.sr);
      if (lm === 'auc') {
        const hh = Math.max(8, 11.5 * FS * 0.9);
        g.push(`<rect x="${lx}" y="${ly - hh / 2}" width="22" height="${hh}" fill="${p.sr.aucFill || p.sr.color}" fill-opacity="${aucOpacity(p.sr)}"/>`);
        g.push(`<line x1="${lx}" y1="${ly - hh / 2}" x2="${lx + 22}" y2="${ly - hh / 2}" stroke="${p.sr.color}" stroke-width="${aucLineW(p.sr)}"/>`);
      } else {
        if (lm === 'lineMarkers' || lm === 'line') g.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 22}" y2="${ly}" stroke="${p.sr.color}" stroke-width="${p.sr.width}"/>`);
        if (lm !== 'line') g.push(symbolSVG(p.sr.markerType, lx + 11, ly, Math.max(6, p.sr.markerSize), p.sr.color));
      }
      g.push(`<text x="${lx + p.swatchW}" y="${ly + 4}" font-size="${Math.round(11.5 * FS * 10) / 10}" fill="#1E2A24">${esc(p.label)}</text>`);
    });
  }

  // Liste beschrifteter Markierungen unterhalb der Zeilen (Block- oder Inline-Layout,
  // Textgroesse + Zahlen-Symbolgroesse dieser Liste sind zentral im Tab "Markierungen" steuerbar)
  if (L.annotationList.positions.length) {
    let listTop = L.annotationsY + Math.max(0, Number(s.markerListGapTop) || 0);
    const listFontPx = s.markerListFontSize * FS;
    g.push(`<text x="${L.contentLeftX}" y="${listTop}" font-size="${Math.round(listFontPx * 1.05 * 10) / 10}" font-weight="700" fill="#1E2A24">Markierungen</text>`);
    const baseY = listTop + Math.round(L.annotationList.lineH * 0.9);
    L.annotationList.positions.forEach(p => {
      const ly = baseY + p.yOffset;
      const lx = L.contentLeftX + p.xOffset;
      if (p.kind === 'style') {
        const side = p.badgeR * 1.8;
        const bw = Math.min(Math.max(0, Number(p.borderWidth) || 0), side * 0.3);
        const cxs = lx + p.badgeR, cys = ly - p.badgeR * 0.65;
        g.push(`<rect x="${cxs - side / 2}" y="${cys - side / 2}" width="${side}" height="${side}" fill="${p.fill || '#FFFFFF'}"${bw > 0 ? ` stroke="${p.border || '#1E2A24'}" stroke-width="${bw}"` : ''}/>`);
      } else {
        g.push(numberBadgeSVG(lx + p.badgeR, ly - p.badgeR * 0.65, p.number, p.badgeR));
      }
      g.push(richTextSVG(p.label, lx + p.badgeR * 2 + 8, ly, {
        anchor: 'start', fontSize: Math.round(listFontPx * 10) / 10, fill: '#1E2A24', lineH: L.annotationList.lineH
      }));
    });
  }

  if (s.showFooterSection !== false && s.footerText) {
    const fx = s.footerAlign === 'center' ? L.W / 2 : s.footerAlign === 'right' ? L.plotRight : L.contentLeftX;
    const fanchor = s.footerAlign === 'center' ? 'middle' : s.footerAlign === 'right' ? 'end' : 'start';
    g.push(`<text x="${fx}" y="${L.footerY}" text-anchor="${fanchor}" font-size="${Math.round(s.footerSize * FS * 10) / 10}" fill="${s.footerColor}">${esc(s.footerText)}</text>`);
  }

  // Wasserzeichen (klein, unten; rechte Kante buendig mit der (sekundaeren) Y-Achse) - unabhaengig von allen anderen
  // Bereichs-Schaltern, damit es auch bei ausgeblendetem Diagramm/Fußnote etc.
  // erscheint, solange es selbst aktiviert ist.
  if (s.watermarkEnabled !== false) {
    const wmSize = 30;
    const wmMargin = 14;
    g.push(`<image href="${WATERMARK_DATA_URI}" x="${Math.max(0, L.plotRight - wmSize)}" y="${L.H - wmMargin - wmSize}" width="${wmSize}" height="${wmSize}" opacity="0.85"/>`);
  }

  const fam = escFont(s.fontFamily);
  const defsStr = defs.length ? `<defs>${defs.join('')}</defs>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="${L.outputW}" height="${L.outputH}" font-family="${fam}">${defsStr}${g.join('\n')}</svg>`;
  return { svg, layout: L };
}

/* ---------- Validation: Zustands-Überlappungen ---------- */
function findStateConflicts(s) {
  const conflictIds = new Set();
  s.rows.filter(r => r.kind === 'state').forEach(st => {
    const arr = [...st.items].sort((a, b) => a.start - b.start);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i].end > arr[i + 1].start) { conflictIds.add(arr[i].id); conflictIds.add(arr[i + 1].id); }
    }
  });
  return conflictIds;
}

// Abschnitte (X-Achse) duerfen sich weder ueberlappen noch beruehren (ein Abschnitt
// darf nicht am selben Tag beginnen, an dem ein anderer endet) - jeder Tag muss
// eindeutig genau einem Abschnitt zuzuordnen sein. Gibt die IDs aller betroffenen
// (nur aktiven) Abschnitte zurueck, inkl. entarteter Abschnitte (Ende <= Start).
function findSegmentConflicts(s) {
  const conflictIds = new Set();
  const active = s.segments.filter(sg => sg.enabled !== false);
  active.forEach(sg => { if (Number(sg.end) <= Number(sg.start)) conflictIds.add(sg.id); });
  const arr = [...active].sort((a, b) => Number(a.start) - Number(b.start));
  for (let i = 0; i < arr.length - 1; i++) {
    if (Number(arr[i + 1].start) <= Number(arr[i].end)) { conflictIds.add(arr[i].id); conflictIds.add(arr[i + 1].id); }
  }
  return conflictIds;
}

/* ---------- Export: PNG / SVG ---------- */
function exportPNG() {
  const { svg, layout } = renderSVG(state);
  const scaleFactor = 2;
  const img = new Image();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  img.onload = function () {
    const canvas = document.createElement('canvas');
    canvas.width = layout.outputW * scaleFactor;
    canvas.height = layout.outputH * scaleFactor;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(function (b) { saveBlobSmart(b, buildFileName('image', 'png'), 'PNG-Bild', { 'image/png': ['.png'] }); });
  };
  img.onerror = function () { URL.revokeObjectURL(url); alert('PNG-Export fehlgeschlagen (Bild konnte nicht gerendert werden).'); };
  img.src = url;
}
function exportSVGFile() {
  const { svg } = renderSVG(state);
  saveBlobSmart(new Blob([svg], { type: 'image/svg+xml' }), buildFileName('image', 'svg'), 'SVG-Bild', { 'image/svg+xml': ['.svg'] });
}
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}

// Baut einen Dateinamen aus dem je Export-Art frei waehlbaren Praefix (unter
// Stil -> "Dateinamen-Präfixe" einstellbar) + Standardname + aktuellem Datum/Uhrzeit,
// z.B. "MeinPraefix klinischer-verlauf # 2026-08-23 # 08-27.png".
// Baut einen Dateinamen NUR aus dem je Export-Art frei editierbaren Praefix-Feld
// (unter Stil -> "Dateinamen-Präfixe") + aktuellem Datum/Uhrzeit, z.B.
// "TIMELINE-GRAFIK # 2026-08-23 # 08-27.png". Das Feld enthaelt bereits alles,
// was vor dem Datum stehen soll (inkl. eines eigenen Trennzeichens wie "# ").
// Baut einen Dateinamen aus Praefix (je Export-Art unter Stil einstellbar) +
// Dateiname (unter Allgemein einstellbar, wird beim Oeffnen einer Datei
// automatisch aus deren Namen befuellt). Datum/Uhrzeit werden NUR bei echten
// Exporten (Grafik/PPTX/Stil) angehaengt, NICHT beim Speichern der
// Projektdaten-Datei selbst - sonst waere ein direktes Ueberschreiben derselben
// Datei nicht mehr sinnvoll moeglich, und beim Wiederoeffnen wuerde sich der
// Dateiname bei jedem Speichern weiter aufblaehen.
function buildFileName(kind, ext) {
  const fieldMap = { image: 'exportPrefixImage', pptx: 'exportPrefixPptx', data: 'exportPrefixData', style: 'exportPrefixStyle' };
  const field = fieldMap[kind];
  const prefix = field && state[field] != null ? String(state[field]) : (DEFAULT_EXPORT_PREFIXES[field] || '');
  const base = stripTimestampSuffix(state.fileBaseName) || 'klinischer-verlauf';
  if (kind === 'data') return `${prefix}${base}.${ext}`;
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} # ${p(d.getHours())}-${p(d.getMinutes())}`;
  return `${prefix}${base} # ${stamp}.${ext}`;
}

// Leitet aus einem geoeffneten Dateinamen (inkl. Endung, ggf. inkl. Praefix)
// den reinen Basisnamen fuer das "Dateiname"-Feld ab.
// Entfernt einen evtl. vorhandenen Datums-/Uhrzeit-Anhang im bekannten Format
// ("... # 2026-08-23 # 08-27") vom Ende eines Namens. Wichtig, damit sich beim
// Wiederoeffnen einer Datei (die z.B. aus einer aelteren Version mit Datum im
// Namen stammt) kein Datum dauerhaft in den Dateinamen "einbrennt" und sich bei
// jedem weiteren Export verdoppelt.
function stripTimestampSuffix(name) {
  return String(name || '').trim().replace(/\s*#\s*\d{4}-\d{2}-\d{2}\s*#\s*\d{2}-\d{2}\s*$/, '').trim();
}

function extractBaseNameFromFileName(name) {
  let base = String(name || '').replace(/\.[^./\\]+$/, '');
  const prefix = state.exportPrefixData;
  if (prefix && base.startsWith(prefix)) base = base.slice(prefix.length);
  return stripTimestampSuffix(base);
}

// Speichert einen Blob moeglichst "in die" bereits geoeffnete Projektdatei bzw.
// deren Ordner: nutzt die File System Access API (Chrome/Edge), wenn verfuegbar,
// und bietet dort direkt den Ordner der zuletzt geoeffneten/gespeicherten
// Projektdatei als Startpunkt an. Ohne Unterstuetzung (z.B. Firefox/Safari)
// faellt es transparent auf den klassischen Download zurueck.
async function saveBlobSmart(blob, suggestedName, description, accept) {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const opts = { suggestedName, types: [{ description, accept }] };
      if (currentProjectHandle) opts.startIn = currentProjectHandle;
      const handle = await window.showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle;
    } catch (e) {
      if (e && e.name === 'AbortError') return undefined; // Nutzer hat Dialog abgebrochen
      // sonst: auf klassischen Download zurueckfallen
    }
  }
  downloadBlob(blob, suggestedName);
  return null;
}

/* ---------- Export: PPTX ---------- */
function hexColor(c) { return (c || '#000000').replace('#', '').toUpperCase(); }

// Diagonale Schraffur-Liniensegmente, geclippt auf ein Rechteck (fuer PPTX, wo keine
// nativen Pattern-Fills genutzt werden).
// Schraffur-Linien in Richtung "/" (wie das SVG-Muster, 45° gedreht): x + y = k
function hatchSegmentsSlash(x0, y0, w, h, spacing) {
  const x1 = x0 + w, y1 = y0 + h;
  const segs = [];
  for (let k = Math.ceil((x0 + y0) / spacing) * spacing; k <= x1 + y1; k += spacing) {
    const pts = [];
    let y = k - x0; if (y >= y0 && y <= y1) pts.push([x0, y]);
    y = k - x1; if (y >= y0 && y <= y1) pts.push([x1, y]);
    let x = k - y0; if (x >= x0 && x <= x1) pts.push([x, y0]);
    x = k - y1; if (x >= x0 && x <= x1) pts.push([x, y1]);
    if (pts.length >= 2) segs.push([pts[0], pts[1]]);
  }
  return segs;
}
function hatchSegmentsRect(x0, y0, w, h, spacing) {
  const x1 = x0 + w, y1 = y0 + h;
  const kMin = x0 - y1, kMax = x1 - y0;
  const segs = [];
  const start = Math.ceil(kMin / spacing) * spacing;
  for (let k = start; k <= kMax; k += spacing) {
    const pts = [];
    let y = x0 - k; if (y >= y0 && y <= y1) pts.push([x0, y]);
    y = x1 - k; if (y >= y0 && y <= y1) pts.push([x1, y]);
    let x = y0 + k; if (x >= x0 && x <= x1) pts.push([x, y0]);
    x = y1 + k; if (x >= x0 && x <= x1) pts.push([x, y1]);
    if (pts.length >= 2) segs.push([pts[0], pts[1]]);
  }
  return segs;
}

async function exportPPTX() {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('PptxGenJS wurde nicht geladen (keine Internetverbindung zum CDN oder die Datei ist blockiert). PNG/SVG-Export funktioniert unabhängig davon.');
  }
  const L = computeLayout(state);
  const pptx = new PptxGenJS();
  const slideWIn = 13.333;
  const slideHIn = +(slideWIn * L.H / L.W).toFixed(3);
  pptx.defineLayout({ name: 'KV_CUSTOM', width: slideWIn, height: slideHIn });
  pptx.layout = 'KV_CUSTOM';
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  const scale = slideWIn / L.W;
  const FS = L.FS;
  const axAttrs = axisStyleAttrs(state.axisLabelStyle);
  const rlAttrs = axisStyleAttrs(state.rowLabelStyle);
  const IN = (px) => { const v = +(px * scale).toFixed(4); return isFinite(v) ? v : 0; };
  // Das Diagramm ist L.W px breit, die Folie 13,333 Zoll (= 960 pt): 1 px entspricht PXPT pt.
  // Linienstaerken (px) und Schriftgroessen (px) muessen mit demselben Faktor umgerechnet werden,
  // damit der Export dem SVG/PNG proportional entspricht.
  const PXPT = scale * 72;
  const PT = (px) => { const v = px * PXPT; return isFinite(v) && v > 0 ? Math.max(0.25, +v.toFixed(2)) : 0.25; };
  const FPT = (fontPx) => { const v = fontPx * PXPT; return isFinite(v) ? Math.max(4, +v.toFixed(1)) : 10; };
  // Einstellung in "pt" (z. B. Textgroesse X-Achse) -> im SVG = Einstellung * FS px -> hier Punkt auf der Folie
  const FSZ = (setting) => FPT(setting * FS);
  const F = (px) => Math.round(px * FS * 10) / 10; // wie im SVG-Renderer
  // Grundlinie einer Textzeile liegt ca. 0,34 em unterhalb der Zeilenmitte (Arial/Helvetica-artige Schriften)
  const BASE = 0.34;
  const FONTFACE = state.fontFamily || 'Arial';

  const CUSTGEOM = (pptx.ShapeType && pptx.ShapeType.custGeom) || 'custGeom';
  const RECT = (pptx.ShapeType && pptx.ShapeType.rect) || 'rect';
  const OVAL = (pptx.ShapeType && pptx.ShapeType.ellipse) || 'ellipse';
  const TRIANGLE = (pptx.ShapeType && pptx.ShapeType.triangle) || 'triangle';
  const DIAMOND = (pptx.ShapeType && pptx.ShapeType.diamond) || 'diamond';
  const PLUS = (pptx.ShapeType && pptx.ShapeType.plus) || 'plus';
  const STAR = (pptx.ShapeType && (pptx.ShapeType.star5 || pptx.ShapeType.star)) || 'star5';

  function ok() { return Array.prototype.every.call(arguments, n => isFinite(n)); }

  function addSegmentLine(x1, y1, x2, y2, colorHex, widthPx, dashed) {
    if (!ok(x1, y1, x2, y2, widthPx)) return;
    const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
    const w = Math.max(0.02, Math.abs(x2 - x1));
    const h = Math.max(0.02, Math.abs(y2 - y1));
    const lineOpts = { color: hexColor(colorHex), width: PT(widthPx) };
    if (dashed) lineOpts.dashType = typeof dashed === 'string' ? dashed : 'dash';
    slide.addShape(CUSTGEOM, {
      x: IN(minX), y: IN(minY), w: IN(w), h: IN(h),
      line: lineOpts,
      fill: { type: 'none' },
      points: [{ x: IN(x1 - minX), y: IN(y1 - minY) }, { x: IN(x2 - minX), y: IN(y2 - minY) }]
    });
  }

  // Einzeiliger Text in einer Box (Mitte vertikal), ohne Umbruch.
  function addTextBox(text, x, y, w, h, opts) {
    if (!ok(x, y, w, h) || text === '' || text == null) return;
    opts = opts || {};
    slide.addText(String(text), {
      x: IN(x), y: IN(y), w: IN(Math.max(w, 4)), h: IN(Math.max(h, 4)),
      fontFace: FONTFACE, fontSize: opts.fontPx != null ? FPT(opts.fontPx) : FSZ(opts.fontSize || 10), color: hexColor(opts.color || '#1E2A24'),
      align: opts.align || 'center', valign: opts.valign || 'middle',
      bold: !!opts.bold, italic: !!opts.italic, underline: opts.underline ? { style: 'sng' } : undefined, margin: 0, wrap: false, isTextBox: true
    });
  }

  // Einzeiliger Text, positioniert wie im SVG: x = Ankerpunkt (je nach anchor start/middle/end),
  // yBase = Grundlinie (px). Die Box wird so gelegt, dass die Grundlinie in PowerPoint an derselben
  // Stelle liegt; wrap=none, damit PowerPoint nie umbricht (Ausrichtung am Ankerpunkt bleibt erhalten).
  function addTextAt(text, x, yBase, opts) {
    if (text === '' || text == null || !ok(x, yBase)) return;
    opts = opts || {};
    const fpx = opts.fontPx != null ? opts.fontPx : (opts.fontSize || 10) * FS;
    const anchor = opts.anchor || 'middle';
    const w = Math.max(40, measureTextWidth(String(text), fpx, state.fontFamily) + 24);
    const h = fpx * 1.5;
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    slide.addText(String(text), {
      x: IN(x0), y: IN(yBase - BASE * fpx - h / 2), w: IN(w), h: IN(h),
      fontFace: FONTFACE, fontSize: FPT(fpx), color: hexColor(opts.color || '#1E2A24'),
      align: anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center', valign: 'middle',
      bold: !!opts.bold, italic: !!opts.italic, underline: opts.underline ? { style: 'sng' } : undefined,
      margin: 0, wrap: false, isTextBox: true
    });
  }

  // Mehrzeiliger Text (Zeilenumbrueche und ^{...}-Hochstellung als echte PowerPoint-Textlaeufe).
  // yBase = Grundlinie der ERSTEN Zeile (wie im SVG), opts.lineH = Zeilenabstand in px.
  function addRichAt(text, x, yBase, opts) {
    if (text === '' || text == null || !ok(x, yBase)) return;
    opts = opts || {};
    const fpx = opts.fontPx != null ? opts.fontPx : (opts.fontSize || 10) * FS;
    const anchor = opts.anchor || 'middle';
    const lines = parseRichText(text);
    const n = lines.length;
    const single = fpx * 1.15;                                   // einfacher Zeilenabstand der Schrift
    const mult = n > 1 ? Math.max(0.5, (opts.lineH || fpx * 1.25) / single) : 1;
    const widest = Math.max.apply(null, lines.map(segs => measureTextWidth(segs.map(sg => sg.text).join(''), fpx, state.fontFamily)));
    const w = Math.max(40, widest + 24);
    const h = n * mult * single + fpx * 0.4;
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    const top = yBase - (0.905 * fpx + (mult - 1) * single);     // Oberkante so, dass die erste Grundlinie bei yBase liegt
    const runs = [];
    lines.forEach((segs, li) => {
      segs.forEach(seg => {
        const runOpts = {};
        if (seg.sup) runOpts.superscript = true;
        runs.push({ text: seg.text, options: runOpts });
      });
      if (li < lines.length - 1) runs[runs.length - 1].options.breakLine = true;
    });
    const o = {
      x: IN(x0), y: IN(top), w: IN(w), h: IN(h),
      fontFace: FONTFACE, fontSize: FPT(fpx), color: hexColor(opts.color || '#1E2A24'),
      align: anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center', valign: 'top',
      bold: !!opts.bold, italic: !!opts.italic, margin: 0, wrap: false, isTextBox: true
    };
    if (n > 1) o.lineSpacingMultiple = +mult.toFixed(3);
    slide.addText(runs, o);
  }

  // Um 90 Grad gedrehte Achsenbeschriftung; (cx, cy) = Punkt auf der Grundlinie wie im SVG.
  function addRotatedLabel(text, axisX, cy, rot, opts) {
    if (!text) return;
    const fpx = opts.fontSize * FS;
    const boxW = Math.max(120, (L.chartBottom - L.chartTop) + 40), boxH = fpx * 1.5;
    // rot 270 (Text von unten nach oben): Zeilen-"unten" zeigt nach +x; rot 90: nach -x
    const centerX = rot === 270 ? axisX - BASE * fpx : axisX + BASE * fpx;
    slide.addText(String(text), {
      x: IN(centerX - boxW / 2), y: IN(cy - boxH / 2), w: IN(boxW), h: IN(boxH),
      fontFace: FONTFACE, fontSize: FPT(fpx), italic: !!opts.italic, bold: !!opts.bold,
      color: '1E2A24', align: 'center', valign: 'middle', margin: 0, wrap: false, rotate: rot, isTextBox: true
    });
  }

  function addNumberBadge(cx, cy, number, r) {
    slide.addShape(OVAL, { x: IN(cx - r), y: IN(cy - r), w: IN(2 * r), h: IN(2 * r), fill: { color: 'FFFFFF' }, line: { color: '1E2A24', width: PT(1) } });
    addTextAt(number, cx, cy + r * 0.36, { anchor: 'middle', fontPx: r * 1.15 });
  }

  // Gefuelltes Polygon (px-Koordinaten) als eine bearbeitbare Freiform-Form. Optional mit Rand.
  function addPolygon(pts, fillHex, lineOpt) {
    if (!pts.length || pts.some(p => !ok(p[0], p[1]))) return;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
    const w = Math.max(0.02, Math.max.apply(null, xs) - minX), h = Math.max(0.02, Math.max.apply(null, ys) - minY);
    const points = pts.map(p => ({ x: IN(p[0] - minX), y: IN(p[1] - minY) }));
    points.push({ close: true });
    slide.addShape(CUSTGEOM, {
      x: IN(minX), y: IN(minY), w: IN(w), h: IN(h),
      fill: { color: hexColor(fillHex) }, line: lineOpt || { type: 'none' }, points
    });
  }
  // Plus/Kreuz als gefuellte 12-Eck-Form: half = halbe Armlaenge, thick = Strichstaerke, deg = Drehung (45 = Kreuz)
  function crossPolygon(cx, cy, half, thick, deg) {
    const t = thick / 2, c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
    const base = [[-t, -half], [t, -half], [t, -t], [half, -t], [half, t], [t, t], [t, half], [-t, half], [-t, t], [-half, t], [-half, -t], [-t, -t]];
    return base.map(p => [cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c]);
  }

  // Optionaler 'stroke' ({color,width} in px) = Rand aus einer Markierungsvorlage.
  // Geometrie wie symbolSVG (SVG): gleiche Groesse, Strichstaerke und Lage.
  function addMarker(type, cx, cy, sizePx, colorHex, stroke) {
    if (!ok(cx, cy, sizePx) || sizePx <= 0) return;
    const r = sizePx / 2;
    const x = cx - r, y = cy - r, w = sizePx, h = sizePx;
    const fill = { color: hexColor(colorHex) };
    const hasStroke = stroke && stroke.width > 0;
    const line = hasStroke ? { color: hexColor(stroke.color), width: PT(stroke.width) } : { type: 'none' };
    switch (type) {
      case 'doublecross': {
        const s2 = sizePx * 0.9, off = sizePx * 0.64;
        addMarker('cross', cx - off, cy, s2, colorHex, stroke);
        addMarker('cross', cx + off, cy, s2, colorHex, stroke);
        break;
      }
      case 'square': slide.addShape(RECT, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line }); break;
      case 'triangle': {
        const th = sizePx * 0.9;
        addPolygon([[cx, cy - th * 0.6], [cx - r, cy + th * 0.4], [cx + r, cy + th * 0.4]], colorHex, hasStroke ? line : null);
        break;
      }
      case 'diamond': slide.addShape(DIAMOND, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line }); break;
      case 'star': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 === 0 ? r : r * 0.42;
          pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
        }
        addPolygon(pts, colorHex, hasStroke ? line : null);
        break;
      }
      case 'plus':
      case 'cross': {
        // SVG: zwei Linien (Strichstaerke lw, runde Enden) von -r bis +r; die runden Enden ragen lw/2 hinaus.
        const lw = Math.max(1.6, sizePx * 0.28);
        const half = (type === 'cross' ? r * Math.SQRT2 : r) + lw / 2;
        const deg = type === 'cross' ? 45 : 0;
        if (hasStroke) addPolygon(crossPolygon(cx, cy, half + stroke.width, lw + stroke.width * 2, deg), stroke.color);
        addPolygon(crossPolygon(cx, cy, half, lw, deg), colorHex);
        break;
      }
      case 'circle':
      default: slide.addShape(OVAL, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line }); break;
    }
  }

  if (state.title) {
    const alignLeft = state.titleAlign === 'left';
    addTextAt(state.title, alignLeft ? L.plotLeft : L.W / 2, L.titleY,
      { fontPx: Math.round(20 * FS * 10) / 10, bold: true, anchor: alignLeft ? 'start' : 'middle' });
  }

  const showChart = state.showChartSection !== false;
  if (showChart) {
  // Kurvenpfad (kubische Bezier) als CUSTGEOM; mit 'baseY' als geschlossene Flaeche.
  function addBezPath(group, bez, opts) {
    if (!bez.length) return;
    const allX = [group[0].x], allY = [group[0].y];
    bez.forEach(b => { allX.push(b.x1, b.x2, b.x3); allY.push(b.y1, b.y2, b.y3); });
    if (opts.baseY != null) allY.push(opts.baseY);
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const w = Math.max(0.02, maxX - minX), h = Math.max(0.02, maxY - minY);
    const points = [];
    if (opts.baseY != null) points.push({ x: IN(group[0].x - minX), y: IN(opts.baseY - minY) });
    points.push({ x: IN(group[0].x - minX), y: IN(group[0].y - minY) });
    bez.forEach(b => {
      points.push({
        x: IN(b.x3 - minX), y: IN(b.y3 - minY),
        curve: { type: 'cubic', x1: IN(b.x1 - minX), y1: IN(b.y1 - minY), x2: IN(b.x2 - minX), y2: IN(b.y2 - minY) }
      });
    });
    if (opts.baseY != null) {
      points.push({ x: IN(bez[bez.length - 1].x3 - minX), y: IN(opts.baseY - minY) });
      points.push({ close: true });
    }
    if (ok(minX, minY, w, h)) {
      slide.addShape(CUSTGEOM, { x: IN(minX), y: IN(minY), w: IN(w), h: IN(h), line: opts.line, fill: opts.fill, points });
    }
  }
  L.seriesLayout.filter(sr => sr.mode === 'auc').forEach(sr => {
    sr.bezGroups.forEach((bez, gi) => addBezPath(sr.groups[gi], bez, {
      baseY: sr.baseY, line: { type: 'none' },
      fill: { color: hexColor(sr.aucFill || sr.color), transparency: Math.round(100 - aucOpacity(sr) * 100) }
    }));
  });
  if (state.showGrid) {
    L.y1Ticks.forEach(v => {
      const y = L.yToPx(v, L.y1r);
      L.segs.forEach(sg => addSegmentLine(sg.px0, y, sg.px1, y, '#E7EAE7', 1));
    });
  }

  addSegmentLine(L.plotLeft, L.chartTop, L.plotLeft, L.chartBottom, state.axisColor, state.axisLineWidth);
  if (L.showY2) addSegmentLine(L.plotRight, L.chartTop, L.plotRight, L.chartBottom, state.axisColor, state.axisLineWidth);

  L.y1Ticks.forEach(v => {
    const y = L.yToPx(v, L.y1r);
    addSegmentLine(L.plotLeft - 5, y, L.plotLeft, y, state.axisColor, state.axisLineWidth);
    if (!L.tickHiddenByRefLabel('y1', y)) addTextAt(v, L.plotLeft - 9, y + 4, { fontSize: state.yTickLabelSize, anchor: 'end' });
  });
  if (state.yAxisLabel && L.labelColW > 0) {
    const axisLx = L.plotLeft - L.yTicksW - L.labelColW / 2;
    addRotatedLabel(state.yAxisLabel, axisLx, (L.chartTop + L.chartBottom) / 2, 270,
      { fontSize: state.axisLabelSize, italic: axAttrs.fontStyle === 'italic', bold: axAttrs.fontWeight === 700 });
  }
  if (L.showY2) {
    L.y2Ticks.forEach(v => {
      const y = L.yToPx(v, L.y2r);
      addSegmentLine(L.plotRight, y, L.plotRight + 5, y, state.axisColor, state.axisLineWidth);
      if (!L.tickHiddenByRefLabel('y2', y)) addTextAt(v, L.plotRight + 9, y + 4, { fontSize: state.yTickLabelSize, anchor: 'start' });
    });
    if (state.y2AxisLabel && L.y2LabelColW > 0) {
      const lx = L.W - L.pad - L.y2LabelColW / 2;
      addRotatedLabel(state.y2AxisLabel, lx, (L.chartTop + L.chartBottom) / 2, 90,
        { fontSize: state.axisLabelSize, italic: axAttrs.fontStyle === 'italic', bold: axAttrs.fontWeight === 700 });
    }
  }

  L.seriesLayout.filter(sr => sr.mode === 'auc').forEach(sr => {
    sr.bezGroups.forEach((bez, gi) => addBezPath(sr.groups[gi], bez, {
      // PowerPoint kennt kein Beschneiden - flache Linienenden verhindern den Ueberstand weitgehend.
      line: { color: hexColor(sr.color), width: PT(aucLineW(sr)), capType: 'flat' }, fill: { type: 'none' }
    }));
  });
  L.refLines.forEach(rl => {
    addSegmentLine(L.plotLeft, rl.y, L.plotRight, rl.y, rl.color, rl.width, refLinePptxDash(rl.style) || false);
    if (rl.label) {
      const left = rl.axis === 'y1';
      const nLines = refLabelPlain(rl.label).length;
      const fpx = Math.round(rl.labelFontPx * 10) / 10;
      const lh = fpx * 1.15;
      // wie im SVG: Block (valign center) um rl.y + 0,35 em
      addRichAt(rl.label, left ? L.plotLeft - 9 : L.plotRight + 9, rl.y + fpx * 0.35 - (nLines - 1) * lh / 2,
        { fontPx: fpx, color: rl.color, anchor: left ? 'end' : 'start', lineH: lh });
    }
  });

  L.seriesLayout.forEach(sr => {
    if (sr.mode === 'lineMarkers' || sr.mode === 'line') sr.bezGroups.forEach((bez, gi) => {
      const group = sr.groups[gi];
      if (bez.length) {
        const allX = [group[0].x], allY = [group[0].y];
        bez.forEach(b => { allX.push(b.x1, b.x2, b.x3); allY.push(b.y1, b.y2, b.y3); });
        const minX = Math.min(...allX), maxX = Math.max(...allX);
        const minY = Math.min(...allY), maxY = Math.max(...allY);
        const w = Math.max(0.02, maxX - minX), h = Math.max(0.02, maxY - minY);
        const points = [{ x: IN(group[0].x - minX), y: IN(group[0].y - minY) }];
        bez.forEach(b => {
          points.push({
            x: IN(b.x3 - minX), y: IN(b.y3 - minY),
            curve: { type: 'cubic', x1: IN(b.x1 - minX), y1: IN(b.y1 - minY), x2: IN(b.x2 - minX), y2: IN(b.y2 - minY) }
          });
        });
        if (ok(minX, minY, w, h)) {
          slide.addShape(CUSTGEOM, {
            x: IN(minX), y: IN(minY), w: IN(w), h: IN(h),
            line: { color: hexColor(sr.color), width: PT(sr.width) },
            fill: { type: 'none' },
            points
          });
        }
      }
    });
    sr.pts.forEach(p => {
      const pms = findMarkStyle(state, p.styleId);
      if ((sr.mode !== 'auc' && sr.mode !== 'line') || pms) addMarker(sr.markerType, p.x, p.y, sr.markerSize, pms ? (pms.fill || sr.color) : sr.color, markStyleStroke(pms));
      if (p.showValue) {
        const lfPx = Math.round(11 * FS * 10) / 10;
        if (p.labelLeader) {
          addSegmentLine(p.x, p.y - Math.max(6, sr.markerSize * 0.6), p.x, p.labelY + lfPx * 0.45, sr.color, 1, 'sysDot');
        }
        const boxW = p.labelHalfW * 2;
        const boxY = p.labelY - lfPx * 0.82;
        if (ok(p.x - p.labelHalfW, boxY, boxW)) {
          slide.addShape(RECT, { x: IN(p.x - p.labelHalfW), y: IN(boxY), w: IN(boxW), h: IN(lfPx * 1.15), fill: { color: 'FFFFFF', transparency: 15 }, line: { type: 'none' } });
        }
        addTextAt(formatPointValue(p.value), p.x, p.labelY, { fontPx: lfPx, bold: true, color: sr.color, anchor: 'middle' });
      }
    });
  });
  } // showChart

  // X-Achse (Ticks, Abschnittsbeschriftung, Bruch-Symbole) bleibt auch ohne
  // sichtbaren Kurven-/Achsen-Bereich stehen. Wiederverwendbar fuer eine optionale
  // zweite (untere) X-Achse unterhalb der Zeilen.
  function drawXAxisPPTX(axisTop, tickY, segY, axisLabelY) {
    L.segs.forEach(sg => {
      addSegmentLine(sg.px0, axisTop, sg.px1, axisTop, state.axisColor, state.axisLineWidth);
      sg.ticks.forEach(t => {
        addSegmentLine(t.x, axisTop, t.x, axisTop + (t.edge ? 8 : 5), state.axisColor, t.edge ? state.axisLineWidth + 0.4 : state.axisLineWidth);
        addTextAt(t.day, t.x, tickY, { fontSize: state.xTickLabelSize, bold: t.edge, anchor: 'middle' });
      });
      if (state.showSegmentLabels !== false) {
        addTextAt(sg.label || '', (sg.px0 + sg.px1) / 2, segY, { fontSize: state.segmentLabelSize, italic: true, color: '#5B6A62', anchor: 'middle' });
      }
    });
    if (state.xAxisLabel) addTextAt(state.xAxisLabel, (L.plotLeft + L.plotRight) / 2, axisLabelY,
      { fontSize: state.axisLabelSize, italic: axAttrs.fontStyle === 'italic', bold: axAttrs.fontWeight === 700, anchor: 'middle' });
    L.breaks.forEach(b => {
      addSegmentLine(b.x - 8, axisTop + 7, b.x - 1, axisTop - 7, '#1E2A24', 2);
      addSegmentLine(b.x - 2, axisTop + 7, b.x + 5, axisTop - 7, '#1E2A24', 2);
    });
  }
  drawXAxisPPTX(L.xAxisTop, L.tickLabelY, L.segLabelY, L.xAxisLabelY);
  if (L.showBottomAxis) {
    drawXAxisPPTX(L.bottomAxisTop, L.bottomTickLabelY, L.bottomSegLabelY, L.bottomAxisLabelY);
  }

  if (state.rowGridVertical && L.contentRows.some(r => r.kind !== 'header')) {
    L.segs.forEach(sg => {
      sg.ticks.forEach(t => addSegmentLine(t.x, L.rowsTop, t.x, L.rowsBottom, '#E7EAE7', 1));
    });
  }
  const rowGridH = state.rowGridHorizontal || 'off';
  const showRowLine = (kind) => rowGridH === 'all' || rowGridH === (kind === 'event' ? 'events' : kind === 'values' ? 'values' : 'states');

  L.contentRows.forEach(row => {
    if (row.kind === 'header') {
      addTextAt(row.text, L.plotLeft - state.rowLabelGap, row.center + 4,
        { fontSize: state.groupHeaderSize, bold: !!state.groupHeaderBold, underline: !!state.groupHeaderUnderline, anchor: 'end' });
      return;
    }
    if (row.kind === 'values') {
      addTextAt(row.type, L.plotLeft - state.rowLabelGap, row.center + 4, { fontSize: state.rowLabelSize, bold: rlAttrs.fontWeight === 700, italic: rlAttrs.fontStyle === 'italic', anchor: 'end' });
      const lineOn = showRowLine('values');
      if (lineOn) addSegmentLine(L.plotLeft, row.center, L.plotRight, row.center, '#E7EAE7', 1);
      row.items.forEach(it => {
        const h = it.fontPx * 1.3;
        if ((lineOn || state.rowGridVertical) && ok(it.x - it.halfW, it.y - h / 2, it.halfW)) {
          slide.addShape(RECT, { x: IN(it.x - it.halfW), y: IN(it.y - h / 2), w: IN(it.halfW * 2), h: IN(h), fill: { color: 'FFFFFF' }, line: { type: 'none' } });
        }
        const vfpx = Math.round(it.fontPx * 10) / 10;
        addTextAt(it.text, it.x, it.y + vfpx * 0.35, { fontPx: vfpx, bold: row.bold || it.hl, color: it.hl ? (it.hlColor || row.color) : row.color, anchor: 'middle' });
      });
      return;
    }
    if (row.kind === 'event') {
      addTextAt(row.type, L.plotLeft - state.rowLabelGap, row.center + 4, { fontSize: state.rowLabelSize, bold: rlAttrs.fontWeight === 700, italic: rlAttrs.fontStyle === 'italic', anchor: 'end' });
      if (showRowLine('event')) addSegmentLine(L.plotLeft, row.center, L.plotRight, row.center, '#E7EAE7', 1);
      row.items.forEach(it => {
        const col = it.hl ? (it.hlColor || it.color) : it.color;
        addMarker(it.symbol, it.x, row.center, it.symbolSize * FS, col);
        addRichAt(it.label, it.x, row.center + it.symbolSize * FS * 0.6 + it.textSize * FS * 0.9 + 4,
          { fontPx: Math.round(it.textSize * FS * 10) / 10, bold: it.hl, anchor: 'middle', lineH: it.textSize * FS * 1.25 });
      });
      return;
    }
    addTextAt(row.type, L.plotLeft - state.rowLabelGap, row.center + 4, { fontSize: state.rowLabelSize, bold: rlAttrs.fontWeight === 700, italic: rlAttrs.fontStyle === 'italic', anchor: 'end' });
    if (showRowLine('state')) addSegmentLine(L.plotLeft, row.center, L.plotRight, row.center, '#E7EAE7', 1);
    row.items.forEach(it => {
      const fill = lighten(it.color, it.hatch ? 0.87 : 0.82);
      const y0 = row.y0 + 4, h = row.y1 - row.y0 - 8;
      const widest = it.pieces.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), it.pieces[0]);
      it.pieces.forEach(piece => {
        const w = Math.max(0.03, piece.x1 - piece.x0);
        if (ok(piece.x0, row.y0, w)) {
          slide.addShape(RECT, {
            x: IN(piece.x0), y: IN(y0), w: IN(w), h: IN(h),
            fill: { color: hexColor(fill) }, line: { color: hexColor(it.color), width: PT(1.2) }
          });
          if (it.hatch) {
            // Schraffur wie im SVG: 45°-Linien "/" mit 9 px Abstand senkrecht zur Linie, Strich 2,4 px
            hatchSegmentsSlash(piece.x0, y0, w, h, 9 * Math.SQRT2).forEach(seg => {
              addSegmentLine(seg[0][0], seg[0][1], seg[1][0], seg[1][1], it.color, 2.4);
            });
          }
        }
        if (piece === widest && w > 34) {
          // wie im SVG: Grundlinie row.center + 0,235 em, Block vertikal zentriert
          const sfpx = F(state.stateLabelSize);
          const sn = richTextLineCount(it.label), slh = state.stateLabelSize * FS * 1.2;
          addRichAt(it.label, piece.x0 + w / 2, row.center + sfpx * 0.235 - (sn - 1) * slh / 2,
            { fontPx: sfpx, color: darken(it.color, 0.45), anchor: 'middle', lineH: slh });
        }
      });
      // Verbindungspfeil zwischen Teilstuecken desselben Eintrags (z.B. ueber eine
      // Luecke zwischen zwei Abschnitten hinweg), Randfarbe der Box.
      const arrowGap = Math.max(0, Number(state.stateArrowGap) || 0);
      for (let i = 0; i < it.pieces.length - 1; i++) {
        const ax1 = it.pieces[i].x1 + arrowGap;
        const ax2 = it.pieces[i + 1].x0 - arrowGap;
        if (ax2 - ax1 < 6) continue;
        const ay = row.center;
        const headLen = Math.min(9, (ax2 - ax1) * 0.35);
        addSegmentLine(ax1, ay, ax2 - headLen, ay, it.color, 1.6);
        if (ok(ax2 - headLen, ay - headLen * 0.6, headLen)) {
          slide.addShape(TRIANGLE, {
            x: IN(ax2 - headLen), y: IN(ay - headLen * 0.6), w: IN(headLen), h: IN(headLen * 1.2),
            fill: { color: hexColor(it.color) }, line: { type: 'none' }, rotate: 90
          });
        }
      }
      if (it.pauseLine) {
        const pl = it.pauseLine, pfpx = F(state.stateLabelSize * 0.85);
        addSegmentLine(pl.x0, row.center, pl.x1, row.center, it.color, 1.4);
        addTextAt(`${pl.days} d`, (pl.x0 + pl.x1) / 2, row.center - Math.max(3, pfpx * 0.28), { fontPx: pfpx, color: darken(it.color, 0.45), anchor: 'middle' });
      }
      // Gekuerzte Box-Enden (siehe SVG-Variante)
      stateEdgePrimitives(it, row.center, h, state.stateEdgeMode).forEach(p => {
        if (p.t === 'line') { addSegmentLine(p.x1, p.y1, p.x2, p.y2, it.color, p.w); return; }
        // Dreieck zeigt ungedreht nach oben; 90° = nach rechts, 270° = nach links
        const cx = p.tip - p.dir * p.len / 2;
        if (ok(cx - p.base / 2, p.cy - p.len / 2, p.base)) {
          slide.addShape(TRIANGLE, {
            x: IN(cx - p.base / 2), y: IN(p.cy - p.len / 2), w: IN(p.base), h: IN(p.len),
            fill: { color: hexColor(it.color) }, line: { type: 'none' }, rotate: p.dir > 0 ? 90 : 270
          });
        }
      });
    });
  });

  // Zyklustabellen (gleiche Geometrie wie im SVG)
  (L.cycleTables || []).forEach(t => {
    cycleTablePrimitives(t.model, t.geom).forEach(p => {
      if (p.t === 'rect') {
        if (!ok(p.x, p.y, p.w, p.h)) return;
        slide.addShape(RECT, { x: IN(p.x), y: IN(p.y), w: IN(p.w), h: IN(p.h), fill: { color: hexColor(p.fill) }, line: { color: hexColor(p.stroke), width: PT(p.sw) } });
      } else if (p.t === 'text') {
        addTextAt(p.s, p.x, p.y, { fontPx: p.fontPx, bold: !!p.bold, italic: !!p.italic, color: p.color, anchor: p.anchor });
      } else if (p.t === 'mark') {
        addMarker(p.type, p.cx, p.cy, p.size, p.color);
      } else if (p.t === 'badge') {
        addNumberBadge(p.cx, p.cy, p.s, p.r);
      } else if (p.t === 'rich') {
        addRichAt(p.s, p.x, p.y, { fontPx: p.fontPx, color: p.color, anchor: 'start', lineH: p.lineH });
      }
    });
  });

  // SVG: stroke-dasharray "4 3" (absolut, Periode 7 px). PowerPoint-Muster sind relativ zur Linienstaerke
  // (dash = 7 w, sysDash = 4 w, sysDot = 2 w) -> das Muster waehlen, dessen Periode nahe 7 px liegt.
  const mlw = Number(state.markerLineWidth) || 1;
  const markerDash = mlw <= 1.35 ? 'dash' : mlw <= 2.4 ? 'sysDash' : 'sysDot';
  L.annotations.forEach(a => {
    addSegmentLine(a.x, a.fromY, a.x, L.chartTop, a.color, mlw, markerDash);
    addNumberBadge(a.x, a.fromY, a.number, L.badgeR);
  });

  if (L.legendLayout) {
    L.legendLayout.positions.forEach(p => {
      const lx = L.plotLeft + p.xOffset;
      const ly = L.legendY + p.line * L.legendLayout.lineH;
      const lm = seriesMode(p.sr);
      if (lm === 'auc') {
        const hh = Math.max(8, 11.5 * FS * 0.9);
        if (ok(lx, ly - hh / 2, hh)) slide.addShape(RECT, { x: IN(lx), y: IN(ly - hh / 2), w: IN(22), h: IN(hh), fill: { color: hexColor(p.sr.aucFill || p.sr.color), transparency: Math.round(100 - aucOpacity(p.sr) * 100) }, line: { type: 'none' } });
        addSegmentLine(lx, ly - hh / 2, lx + 22, ly - hh / 2, p.sr.color, aucLineW(p.sr));
      } else {
        if (lm === 'lineMarkers' || lm === 'line') addSegmentLine(lx, ly, lx + 22, ly, p.sr.color, p.sr.width);
        if (lm !== 'line') addMarker(p.sr.markerType, lx + 11, ly, Math.max(6, p.sr.markerSize), p.sr.color);
      }
      addTextAt(p.label, lx + p.swatchW, ly + 4, { fontPx: Math.round(11.5 * FS * 10) / 10, anchor: 'start' });
    });
  }

  if (L.annotationList.positions.length) {
    let listTop = L.annotationsY + Math.max(0, Number(state.markerListGapTop) || 0);
    const listFontPx = state.markerListFontSize * FS;
    addTextAt('Markierungen', L.contentLeftX, listTop, { fontPx: Math.round(listFontPx * 1.05 * 10) / 10, bold: true, anchor: 'start' });
    const baseY = listTop + Math.round(L.annotationList.lineH * 0.9);
    L.annotationList.positions.forEach(p => {
      const ly = baseY + p.yOffset;
      const lx = L.contentLeftX + p.xOffset;
      if (p.kind === 'style') {
        const side = p.badgeR * 1.8;
        const bw = Math.min(Math.max(0, Number(p.borderWidth) || 0), side * 0.3);
        const cxs = lx + p.badgeR, cys = ly - p.badgeR * 0.65;
        slide.addShape(RECT, {
          x: IN(cxs - side / 2), y: IN(cys - side / 2), w: IN(side), h: IN(side),
          fill: { color: hexColor(p.fill || '#FFFFFF') },
          line: bw > 0 ? { color: hexColor(p.border || '#1E2A24'), width: PT(bw) } : { type: 'none' }
        });
      } else {
        addNumberBadge(lx + p.badgeR, ly - p.badgeR * 0.65, p.number, p.badgeR);
      }
      addRichAt(p.label, lx + p.badgeR * 2 + 8, ly,
        { fontPx: Math.round(listFontPx * 10) / 10, anchor: 'start', lineH: L.annotationList.lineH });
    });
  }

  if (state.showFooterSection !== false && state.footerText) {
    const fx = state.footerAlign === 'center' ? L.W / 2 : state.footerAlign === 'right' ? L.plotRight : L.contentLeftX;
    addTextAt(state.footerText, fx, L.footerY, {
      fontPx: Math.round(state.footerSize * FS * 10) / 10, color: state.footerColor,
      anchor: state.footerAlign === 'center' ? 'middle' : state.footerAlign === 'right' ? 'end' : 'start'
    });
  }

  if (state.watermarkEnabled !== false) {
    const wmSize = 30;
    const wmMargin = 14;
    try {
      slide.addImage({
        data: WATERMARK_DATA_URI,
        x: IN(Math.max(0, L.plotRight - wmSize)), y: IN(L.H - wmMargin - wmSize),
        w: IN(wmSize), h: IN(wmSize), transparency: 15
      });
    } catch (e) { /* Wasserzeichen ist rein dekorativ - Export soll nicht daran scheitern */ }
  }

  const pptxBlob = await pptx.write({ outputType: 'blob' });
  await saveBlobSmart(pptxBlob, buildFileName('pptx', 'pptx'), 'PowerPoint-Präsentation', { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] });
}
