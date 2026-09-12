/* ============================================================
   Klinischer Verlauf – Timeline Builder
   Reines Client-seitiges Tool: Datenmodell -> Layout -> SVG / PPTX
   ============================================================ */

/* ---------- Utilities ---------- */
let uidCounter = 1;
const uid = (p) => p + (uidCounter++);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const SYMBOLS = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'plus'];
const SYMBOL_LABELS = {
  circle: 'Kreis', square: 'Quadrat', triangle: 'Dreieck', diamond: 'Raute',
  star: 'Stern', cross: 'Kreuz (X)', plus: 'Plus (+)'
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
const DEFAULT_EXPORT_PREFIXES = {
  exportPrefixImage: 'TIMELINE-GRAFIK # ',
  exportPrefixPptx: 'TIMELINE-GRAFIK # ',
  exportPrefixData: 'TIMELINE-DATEN # ',
  exportPrefixStyle: 'TIMELINE-STIL # '
};
function nextColor(existingCount) {
  return PALETTE[existingCount % PALETTE.length];
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
    xTickLabelSize: 17.5,
    yTickLabelSize: 15,
    segmentLabelSize: 16,
    axisLabelSize: 17,
    axisLabelStyle: 'normal',
    segmentLabelGap: 14,
    xAxisLabelGap: 10,
    axisToRowsGap: 26,
    showSegmentLabels: true,
    showBottomAxis: false,
    rowKindGap: 20,
    stateRowGap: 11,
    headerGapBefore: 10,
    headerGapAfter: 10,
    stateLabelSize: 13,
    stateArrowGap: 4,
    markerLineWidth: 2,
    markerBadgeSize: 13,
    markerListLayout: 'inline',
    markerListFontSize: 13,
    markerListGapTop: 30,
    markerListGapBottom: 30,
    footerSize: 10,
    footerColor: '#000000',
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
    footerText: '',
    fileBaseName: '',
    exportPrefixImage: DEFAULT_EXPORT_PREFIXES.exportPrefixImage,
    exportPrefixPptx: DEFAULT_EXPORT_PREFIXES.exportPrefixPptx,
    exportPrefixData: DEFAULT_EXPORT_PREFIXES.exportPrefixData,
    exportPrefixStyle: DEFAULT_EXPORT_PREFIXES.exportPrefixStyle,
    y1Mode: 'auto', y1Min: 0, y1Max: 10,
    y2Mode: 'auto', y2Min: 0, y2Max: 100,
    segments: [],
    series: [],
    rows: []
  }, styleDefaults());
}

/* ---------- Default State (Beispieldaten) ---------- */
function defaultState() {
  return Object.assign({
    title: 'Klinischer Verlauf',
    xAxisLabel: 'Tag',
    yAxisLabel: 'Leukozyten (G/l)',
    y2AxisLabel: 'CRP (mg/l)',
    aspectW: 16,
    aspectH: 9,
    canvasWidth: 2000,
    footerText: '',
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
    ]
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
    if (r.kind === 'state') {
      r.items.forEach(it => {
        if (it.hatch == null) it.hatch = false;
        if (!Array.isArray(it.marks)) it.marks = [];
        it.marks.forEach(m => { if (m.active == null) m.active = true; if (m.label == null) m.label = ''; if (m.color == null) m.color = '#1E2A24'; });
      });
    }
  });
  (data.segments || []).forEach(sg => { if (sg.enabled == null) sg.enabled = true; });
  // Alle uebrigen Stil-Felder: fehlende Werte werden aus den aktuellen
  // Stil-Standardwerten ergaenzt (ein einziger gepflegter Satz statt vieler
  // einzeln dupliziert gepflegter Fallbacks).
  const styleDef = styleDefaults();
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
  return data;
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
    } else if (prevKind && r.kind !== prevKind && (r.kind === 'event' || r.kind === 'state') && (prevKind === 'event' || prevKind === 'state')) {
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
      const pos = { number: it.number, label: it.label, badgeR, line: lineIdx, xOffset: curX, nLines };
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
    const pos = { number: it.number, label: it.label, badgeR, line: 0, xOffset: 0, yOffset: cumY, nLines };
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

function computeLayout(s) {
  const FS = 1 * (s.fontScale || 1);
  const pad = Math.max(0, Number(s.plotPadding) || 0);

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
  const visibleRows = showRowsSection ? s.rows.filter(r => r.kind === 'header' || r.visible !== false) : [];
  const showY2 = visibleSeries.some(sr => sr.axis === 'y2');

  // Internes Koordinatensystem: Breite ist bewusst FEST (unabhaengig von
  // "Diagrammbreite"/Export-Aufloesung), damit alle Abstaende/Schriftgroessen
  // ihre Proportionen behalten. Die Hoehe wird weiter unten final festgelegt,
  // NACHDEM feststeht wie viel Platz Titel/Legende/Zeilen/Markierungen/Fußzeile
  // tatsaechlich benoetigen - so kann die Canvas-Hoehe bei sehr vielen Inhalten
  // automatisch ueber die gewaehlte Seitenverhaeltnis-Hoehe hinaus wachsen, statt
  // dass sich Markierungsliste und Fußzeile ueberlappen.
  const REF_W = 1600;
  const W = REF_W;
  const titleH = s.title ? Math.round(44 * Math.max(1, FS * 0.85)) : 0;

  // Linker Rand: Y-Achsenbeschriftung sitzt direkt links neben den Tickmark-Zahlen
  // (nicht mehr aussen am Rand), die Zeilen-Bezeichnungen (Ort, CT, ...) teilen sich
  // denselben reservierten Bereich unabhaengig davon, je nachdem was mehr Platz braucht.
  const yTickFontPx = s.yTickLabelSize * FS;
  const yTicksW = showChartSection ? Math.round(20 + yTickFontPx * 2.0) : 0;
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
  const rowLabelReserved = maxRowLabelW > 0 ? Math.round(maxRowLabelW + rowLabelGapPx + 2) : 0;
  const plotLeft = pad + Math.max(labelColW + yTicksW, rowLabelReserved);

  // Linke Startposition fuer Markierungsliste + Fußzeile: entweder am Seitenrand
  // (wie bisher) oder buendig mit der linken Kante der Y-Achsenbeschriftung.
  const yAxisLabelLeftX = plotLeft - yTicksW - labelColW;
  const contentLeftX = s.leftEdgeMode === 'yAxisLabel' && labelColW > 0 ? yAxisLabelLeftX
    : s.leftEdgeMode === 'yAxis' ? plotLeft
    : pad;

  const y2TicksW = showY2 ? Math.round(20 + yTickFontPx * 2.0) : 0;
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
  const bottomPad = 18;

  // Vorab-Erfassung beschrifteter Markierungslinien (Tag+Text reichen fuer die
  // Hoehen-Vorausberechnung, die tatsaechlichen X-Positionen werden erst spaeter
  // benoetigt sobald dayToX bereitsteht - aber die Zeilenumbrueche der Liste haengen
  // nur von Text/Anzahl/plotWidth ab, nicht von den X-Positionen im Chart selbst).
  const labeledPre = [];
  if (showMarkersSection) {
    visibleRows.forEach(r => {
      if (r.kind === 'event') r.items.forEach(it => { if (it.hl && it.hlLabel) labeledPre.push({ day: it.day, label: it.hlLabel }); });
      if (r.kind === 'state') r.items.forEach(it => (it.marks || []).forEach(m => {
        if (m.active === false || !m.label) return;
        const day = m.pos === 'start' ? it.start : m.pos === 'end' ? it.end : Number(m.day);
        labeledPre.push({ day, label: m.label });
      }));
    });
  }
  labeledPre.sort((a, b) => a.day - b.day);
  const listFontPx = s.markerListFontSize * FS;
  const preList = layoutAnnotationList(labeledPre, { mode: s.markerListLayout, fontSizePx: listFontPx, plotWidth, fontFamily: s.fontFamily });
  const markerListGapTop = Math.max(0, Number(s.markerListGapTop) || 0);
  const markerListGapBottom = Math.max(0, Number(s.markerListGapBottom) || 0);
  const annotationsH = labeledPre.length ? markerListGapTop + preList.totalHeight + markerListGapBottom : 0;

  const footerFontPx = (showFooterSection && s.footerText) ? (Number(s.footerSize) || 10) * FS : 0;
  const footerH = (showFooterSection && s.footerText) ? Math.round(footerFontPx * 1.7 + 10) : 0;

  const rowKindGap = Math.max(0, Number(s.rowKindGap) || 0);
  const stateRowGap = Math.max(0, Number(s.stateRowGap) || 0);
  const headerGapBefore = Math.max(0, Number(s.headerGapBefore) || 0);
  const headerGapAfter = Math.max(0, Number(s.headerGapAfter) || 0);
  const rowsH = totalRowsHeight(visibleRows, FS, rowKindGap, stateRowGap, headerGapBefore, headerGapAfter);
  let y = pad;
  const titleY = y + Math.round(22 * Math.max(1, FS * 0.85)); y += titleH;
  const legendY = y + 12; y += legendH;
  const chartTop = y;
  // Reihenfolge (von oben nach unten): Titel/Legende -> Kurven-/Y-Achsen-Bereich ->
  // X-Achse (Tag-Ticks/Abschnittsbeschriftung) -> Ereignis-/Zustandszeilen ->
  // optionale ZWEITE X-Achse (Duplikat, an/abschaltbar) -> Markierungsliste ->
  // Fußzeile.
  const showBottomAxis = !!s.showBottomAxis;
  const usedBottom = xAxisH + axisToRowsGap + rowsH + (showBottomAxis ? axisToRowsGap + xAxisH : 0) + annotationsH + bottomPad + footerH;
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
    } else if (prevRowKind && r.kind !== prevRowKind && (r.kind === 'event' || r.kind === 'state') && (prevRowKind === 'event' || prevRowKind === 'state')) {
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
    bottomAxisTop = rowsBottom + axisToRowsGap;
    bottomAxisBottom = bottomAxisTop + xAxisH;
  }
  const bottomTickLabelY = showBottomAxis ? bottomAxisTop + tickLabelYOffset : null;
  const bottomSegLabelY = showBottomAxis ? bottomAxisTop + segLabelYOffset : null;
  const bottomAxisLabelY = showBottomAxis ? bottomAxisTop + xAxisLabelYOffset : null;

  const annotationsY = showBottomAxis ? bottomAxisBottom : rowsBottom;
  // Fusszeile wird relativ zum tatsaechlichen Ende des Inhalts (Zeilen/untere Achse +
  // Markierungsliste) positioniert statt ueber eine von H abgeleitete Formel - so
  // bleibt sie immer exakt unterhalb der Markierungsliste, unabhaengig von
  // plotPadding/Zeilenanzahl/Schriftgroesse.
  const footerY = s.footerText ? (annotationsY + annotationsH + footerFontPx * 0.85) : 0;


  // Segmente -> Pixelbereiche. Deaktivierte Abschnitte werden ausgeblendet; die
  // verbleibenden werden IMMER defensiv nach Starttag sortiert (unabhaengig von der
  // Reihenfolge im gespeicherten Array - wichtig falls z.B. eine JSON-Datei mit
  // unsortierten oder ueberlappenden Abschnitten geladen wurde). Ueberlappende bzw.
  // sich beruehrende Abschnitte (Start <= Ende eines bereits uebernommenen Abschnitts)
  // sowie entartete Abschnitte (Ende <= Start) werden von der Darstellung ausgeschlossen,
  // damit die Tag->Pixel-Zuordnung immer eindeutig bleibt.
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
    const pts = sorted.map(p => ({ day: p.day, value: p.value, x: dayToX(p.day), y: yToPx(p.value, range), showValue: !!p.showValue }));
    const groups = [];
    let curIdx = null, curGroup = null;
    pts.forEach(p => {
      const idx = segmentIndexForDay(p.day);
      if (idx !== curIdx || !curGroup) { curGroup = []; groups.push(curGroup); curIdx = idx; }
      curGroup.push(p);
    });
    const bezGroups = groups.map(g => (sr.smooth ? catmullRom(g) : straight(g)));
    return Object.assign({}, sr, { axis, pts, groups, bezGroups, colorIdx: si });
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
        x: dayToX(it.day), symbol: r.symbol, color: r.color, textSize: r.textSize, symbolSize: r.symbolSize
      }));
      return Object.assign({}, frame, { type: r.name, rowId: r.id, items });
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
    return Object.assign({}, frame, { type: r.name, rowId: r.id, items });
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
  const labeledFinal = annotations.filter(a => a.label).map(a => ({ number: a.number, label: a.label }));
  const annotationList = layoutAnnotationList(labeledFinal, { mode: s.markerListLayout, fontSizePx: listFontPx, plotWidth, fontFamily: s.fontFamily });

  const breaks = [];
  for (let i = 0; i < segs.length - 1; i++) {
    breaks.push({ x: (segs[i].px1 + segs[i + 1].px0) / 2, y0: chartTop, y1: xAxisBottom });
  }

  return {
    W, H, outputW, outputH, pad, titleY, legendY, chartTop, chartBottom, plotLeft, plotRight, plotWidth,
    xAxisTop, xAxisBottom, rowsTop, rowsBottom, segs, y1r, y2r, y1Ticks, y2Ticks, yToPx, showY2, FS,
    showBottomAxis, bottomAxisTop, bottomAxisBottom, bottomTickLabelY, bottomSegLabelY, bottomAxisLabelY,
    labelColW, y2LabelColW, yTicksW, y2TicksW, tickLabelY, segLabelY, xAxisLabelY, contentLeftX,
    contentRows, breaks, seriesLayout, annotations, annotationsY, annotationList, badgeR, footerY, legendLayout,
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

function symbolSVG(type, cx, cy, size, color) {
  const r = size / 2;
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
    g.push(`<text x="${L.plotLeft - 9}" y="${y + 4}" text-anchor="end" font-size="${F(s.yTickLabelSize)}" fill="#1E2A24">${v}</text>`);
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
      g.push(`<text x="${L.plotRight + 9}" y="${y + 4}" text-anchor="start" font-size="${F(s.yTickLabelSize)}" fill="#1E2A24">${v}</text>`);
    });
    if (s.y2AxisLabel && L.y2LabelColW > 0) {
      const lx = L.W - L.pad - L.y2LabelColW / 2;
      const ly = (L.chartTop + L.chartBottom) / 2;
      g.push(`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="${F(s.axisLabelSize)}" font-style="${axAttrs.fontStyle}" font-weight="${axAttrs.fontWeight}" fill="#1E2A24" transform="rotate(90 ${lx} ${ly})">${esc(s.y2AxisLabel)}</text>`);
    }
  }

  L.seriesLayout.forEach(sr => {
    sr.bezGroups.forEach(bez => {
      if (!bez.length) return;
      let d = `M ${bez[0].x0} ${bez[0].y0} `;
      bez.forEach(b => { d += `C ${b.x1} ${b.y1}, ${b.x2} ${b.y2}, ${b.x3} ${b.y3} `; });
      g.push(`<path d="${d}" fill="none" stroke="${sr.color}" stroke-width="${sr.width}" stroke-linecap="round" stroke-linejoin="round"/>`);
    });
    sr.pts.forEach(p => {
      g.push(`<g data-kind="point" data-series-id="${sr.id}" data-point-day="${p.day}" class="clickable-item">`);
      g.push(`<circle cx="${p.x}" cy="${p.y}" r="${Math.max(9, sr.markerSize * 0.9)}" fill="transparent" style="cursor:pointer;"/>`);
      g.push(symbolSVG(sr.markerType, p.x, p.y, sr.markerSize, sr.color));
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
  const showRowLine = (kind) => rowGridH === 'all' || rowGridH === (kind === 'event' ? 'events' : 'states');

  // Zeilen: Ereignis / Zustand / Ueberschrift
  L.contentRows.forEach(row => {
    if (row.kind === 'header') {
      const fw = s.groupHeaderBold ? 700 : 400;
      const td = s.groupHeaderUnderline ? 'underline' : 'none';
      g.push(`<text x="${L.plotLeft - s.rowLabelGap}" y="${row.center + 4}" text-anchor="end" font-size="${F(s.groupHeaderSize)}" font-weight="${fw}" text-decoration="${td}" fill="#1E2A24">${esc(row.text)}</text>`);
      return;
    }
    if (row.kind === 'event') {
      g.push(`<text x="${L.plotLeft - s.rowLabelGap}" y="${row.center + 4}" text-anchor="end" font-size="${F(s.rowLabelSize)}" font-style="${rlAttrs.fontStyle}" font-weight="${rlAttrs.fontWeight}" fill="#1E2A24">${esc(row.type)}</text>`);
      if (showRowLine('event')) g.push(`<line x1="${L.plotLeft}" y1="${row.center}" x2="${L.plotRight}" y2="${row.center}" stroke="#E7EAE7" stroke-width="1"/>`);
      row.items.forEach(it => {
        const col = it.hl ? (it.hlColor || it.color) : it.color;
        g.push(`<g data-kind="event" data-row-id="${row.rowId}" data-item-id="${it.id}" class="clickable-item">`);
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
        g.push(`<rect data-kind="state" data-row-id="${row.rowId}" data-item-id="${it.id}" class="clickable-item state-rect" x="${piece.x0}" y="${row.y0 + 4}" width="${w}" height="${row.y1 - row.y0 - 8}" fill="${fillAttr}" stroke="${stroke}" stroke-width="1.2"/>`);
        if (piece === widest && w > 34) {
          g.push(richTextSVG(it.label, piece.x0 + w / 2, row.center + 3.5, {
            anchor: 'middle', fontSize: F(s.stateLabelSize), fill: textColor, valign: 'center', lineH: s.stateLabelSize * FS * 1.2,
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
    });
  });

  // Markierungslinien: gestrichelt vom Ereignis/Zustand bis zum Diagramm-Oberrand,
  // mit nummeriertem Kreis am unteren Ende. Eigene Ebene: Liniendicke und
  // Zahlen-Symbolgroesse sind global einstellbar und wirken sich nie auf die
  // Zeilenhoehen der Ereignis-/Zustands-Zeilen aus.
  L.annotations.forEach(a => {
    g.push(`<line x1="${a.x}" y1="${a.fromY}" x2="${a.x}" y2="${L.chartTop}" stroke="${a.color}" stroke-width="${s.markerLineWidth}" stroke-dasharray="4 3" style="pointer-events:none;"/>`);
    g.push(numberBadgeSVG(a.x, a.fromY, a.number, L.badgeR));
  });

  if (L.legendLayout) {
    L.legendLayout.positions.forEach(p => {
      const lx = L.plotLeft + p.xOffset;
      const ly = L.legendY + p.line * L.legendLayout.lineH;
      g.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 22}" y2="${ly}" stroke="${p.sr.color}" stroke-width="${p.sr.width}"/>`);
      g.push(symbolSVG(p.sr.markerType, lx + 11, ly, Math.max(6, p.sr.markerSize), p.sr.color));
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
      g.push(numberBadgeSVG(lx + p.badgeR, ly - p.badgeR * 0.65, p.number, p.badgeR));
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

  // Wasserzeichen (klein, rechts unten) - unabhaengig von allen anderen
  // Bereichs-Schaltern, damit es auch bei ausgeblendetem Diagramm/Fußnote etc.
  // erscheint, solange es selbst aktiviert ist.
  if (s.watermarkEnabled !== false) {
    const wmSize = 30;
    const wmMargin = 14;
    g.push(`<image href="${WATERMARK_DATA_URI}" x="${L.W - wmMargin - wmSize}" y="${L.H - wmMargin - wmSize}" width="${wmSize}" height="${wmSize}" opacity="0.85"/>`);
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
  const slideHIn = +(slideWIn * state.aspectH / state.aspectW).toFixed(3);
  pptx.defineLayout({ name: 'KV_CUSTOM', width: slideWIn, height: slideHIn });
  pptx.layout = 'KV_CUSTOM';
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  const scale = slideWIn / L.W;
  const FS = L.FS;
  const axAttrs = axisStyleAttrs(state.axisLabelStyle);
  const rlAttrs = axisStyleAttrs(state.rowLabelStyle);
  const IN = (px) => { const v = +(px * scale).toFixed(4); return isFinite(v) ? v : 0; };
  const PT = (px) => { const v = px * scale * 72 * FS; return isFinite(v) && v > 0 ? Math.max(0.5, +v.toFixed(2)) : 0.5; };
  const FSZ = (pt) => { const v = Math.round(pt * FS); return isFinite(v) ? Math.max(6, v) : 10; };
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
    if (dashed) lineOpts.dashType = 'dash';
    slide.addShape(CUSTGEOM, {
      x: IN(minX), y: IN(minY), w: IN(w), h: IN(h),
      line: lineOpts,
      fill: { type: 'none' },
      points: [{ x: IN(x1 - minX), y: IN(y1 - minY) }, { x: IN(x2 - minX), y: IN(y2 - minY) }]
    });
  }

  function addTextBox(text, x, y, w, h, opts) {
    if (!ok(x, y, w, h) || text === '' || text == null) return;
    opts = opts || {};
    slide.addText(String(text), {
      x: IN(x), y: IN(y), w: IN(Math.max(w, 4)), h: IN(Math.max(h, 4)),
      fontFace: FONTFACE, fontSize: FSZ(opts.fontSize || 10), color: hexColor(opts.color || '#1E2A24'),
      align: opts.align || 'center', valign: opts.valign || 'middle',
      bold: !!opts.bold, italic: !!opts.italic, underline: opts.underline ? { style: 'sng' } : undefined, margin: 0
    });
  }

  // Wie addTextBox, aber mit Unterstuetzung fuer Zeilenumbrueche und ^{...}-Hochstellung
  // (fuer Ereignis-/Zustandsbeschriftungen), als echte PowerPoint-Textlaeufe.
  function addRichTextBox(text, x, y, w, h, opts) {
    if (!ok(x, y, w, h) || text === '' || text == null) return;
    opts = opts || {};
    const fontSize = FSZ(opts.fontSize || 10);
    const lines = parseRichText(text);
    const runs = [];
    lines.forEach((segs, li) => {
      segs.forEach(seg => {
        const runOpts = {};
        if (seg.sup) { runOpts.superscript = true; runOpts.fontSize = Math.max(6, Math.round(fontSize * 0.7)); }
        runs.push({ text: seg.text, options: runOpts });
      });
      if (li < lines.length - 1) runs[runs.length - 1].options.breakLine = true;
    });
    slide.addText(runs, {
      x: IN(x), y: IN(y), w: IN(Math.max(w, 4)), h: IN(Math.max(h, 4)),
      fontFace: FONTFACE, fontSize, color: hexColor(opts.color || '#1E2A24'),
      align: opts.align || 'center', valign: opts.valign || 'middle',
      bold: !!opts.bold, italic: !!opts.italic, margin: 0
    });
  }

  function addNumberBadge(cx, cy, number, r) {
    slide.addShape(OVAL, { x: IN(cx - r), y: IN(cy - r), w: IN(2 * r), h: IN(2 * r), fill: { color: 'FFFFFF' }, line: { color: '1E2A24', width: 0.75 } });
    addTextBox(number, cx - r, cy - r, 2 * r, 2 * r, { fontSize: Math.max(6, r * 0.9), color: '#1E2A24' });
  }

  function addMarker(type, cx, cy, sizePx, colorHex) {
    if (!ok(cx, cy, sizePx) || sizePx <= 0) return;
    const r = sizePx / 2;
    const x = cx - r, y = cy - r, w = sizePx, h = sizePx;
    const fill = { color: hexColor(colorHex) };
    switch (type) {
      case 'square': slide.addShape(RECT, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); break;
      case 'triangle': slide.addShape(TRIANGLE, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); break;
      case 'diamond': slide.addShape(DIAMOND, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); break;
      case 'plus': slide.addShape(PLUS, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); break;
      case 'star':
        try { slide.addShape(STAR, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); }
        catch (e) { slide.addShape(OVAL, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); }
        break;
      case 'cross':
        addSegmentLine(x, y, x + w, y + h, colorHex, Math.max(1.4, sizePx * 0.22));
        addSegmentLine(x, y + h, x + w, y, colorHex, Math.max(1.4, sizePx * 0.22));
        break;
      case 'circle':
      default: slide.addShape(OVAL, { x: IN(x), y: IN(y), w: IN(w), h: IN(h), fill, line: { type: 'none' } }); break;
    }
  }

  if (state.title) {
    const alignLeft = state.titleAlign === 'left';
    addTextBox(state.title, alignLeft ? L.plotLeft : L.pad, L.pad - 6, alignLeft ? (L.W - L.plotLeft - L.pad) : (L.W - 2 * L.pad), 32,
      { fontSize: 18, bold: true, align: alignLeft ? 'left' : 'center' });
  }

  const showChart = state.showChartSection !== false;
  if (showChart) {
  if (state.showGrid) {
    L.y1Ticks.forEach(v => {
      const y = L.yToPx(v, L.y1r);
      L.segs.forEach(sg => addSegmentLine(sg.px0, y, sg.px1, y, '#E7EAE7', 0.75));
    });
  }

  addSegmentLine(L.plotLeft, L.chartTop, L.plotLeft, L.chartBottom, state.axisColor, state.axisLineWidth);
  if (L.showY2) addSegmentLine(L.plotRight, L.chartTop, L.plotRight, L.chartBottom, state.axisColor, state.axisLineWidth);

  L.y1Ticks.forEach(v => {
    const y = L.yToPx(v, L.y1r);
    addSegmentLine(L.plotLeft - 5, y, L.plotLeft, y, state.axisColor, state.axisLineWidth);
    addTextBox(v, L.plotLeft - 56, y - 8, 44, 16, { fontSize: state.yTickLabelSize, align: 'right' });
  });
  if (state.yAxisLabel && L.labelColW > 0) {
    const axisLx = L.plotLeft - L.yTicksW - L.labelColW / 2;
    slide.addText(state.yAxisLabel, {
      x: IN(axisLx) - 1.0, y: IN((L.chartTop + L.chartBottom) / 2) - 1.0, w: 2.0, h: 0.3,
      fontFace: FONTFACE, fontSize: FSZ(state.axisLabelSize), italic: axAttrs.fontStyle === 'italic', bold: axAttrs.fontWeight === 700,
      color: '1E2A24', align: 'center', rotate: 270
    });
  }
  if (L.showY2) {
    L.y2Ticks.forEach(v => {
      const y = L.yToPx(v, L.y2r);
      addSegmentLine(L.plotRight, y, L.plotRight + 5, y, state.axisColor, state.axisLineWidth);
      addTextBox(v, L.plotRight + 8, y - 8, 44, 16, { fontSize: state.yTickLabelSize, align: 'left' });
    });
    if (state.y2AxisLabel && L.y2LabelColW > 0) {
      const lx = L.W - L.pad - L.y2LabelColW / 2;
      slide.addText(state.y2AxisLabel, {
        x: IN(lx) - 1.0, y: IN((L.chartTop + L.chartBottom) / 2) - 1.0, w: 2.0, h: 0.3,
        fontFace: FONTFACE, fontSize: FSZ(state.axisLabelSize), italic: axAttrs.fontStyle === 'italic', bold: axAttrs.fontWeight === 700,
        color: '1E2A24', align: 'center', rotate: 90
      });
    }
  }

  L.seriesLayout.forEach(sr => {
    sr.bezGroups.forEach((bez, gi) => {
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
      addMarker(sr.markerType, p.x, p.y, sr.markerSize, sr.color);
      if (p.showValue) {
        if (p.labelLeader) {
          addSegmentLine(p.x, p.y - Math.max(6, sr.markerSize * 0.6), p.x, p.labelY + 6, sr.color, 0.75);
        }
        const boxW = p.labelHalfW * 2;
        const boxY = p.labelY - 10;
        if (ok(p.x - p.labelHalfW, boxY, boxW)) {
          slide.addShape(RECT, { x: IN(p.x - p.labelHalfW), y: IN(boxY), w: IN(boxW), h: IN(14), fill: { color: 'FFFFFF', transparency: 15 }, line: { type: 'none' } });
        }
        addTextBox(formatPointValue(p.value), p.x - p.labelHalfW, boxY, boxW, 14, { fontSize: 9, bold: true, color: sr.color });
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
        addTextBox(t.day, t.x - 24, tickY - 8, 48, 14, { fontSize: state.xTickLabelSize, bold: t.edge });
      });
      if (state.showSegmentLabels !== false) {
        addTextBox(sg.label || '', sg.px0, segY - 7, sg.px1 - sg.px0, 14, { fontSize: state.segmentLabelSize, italic: true, color: '#5B6A62' });
      }
    });
    if (state.xAxisLabel) addTextBox(state.xAxisLabel, L.plotLeft, axisLabelY - state.axisLabelSize * FS * 0.8, L.plotWidth, 16,
      { fontSize: state.axisLabelSize, italic: axAttrs.fontStyle === 'italic', bold: axAttrs.fontWeight === 700 });
    L.breaks.forEach(b => {
      addSegmentLine(b.x - 8, axisTop + 7, b.x - 1, axisTop - 7, '#1E2A24', 1.6);
      addSegmentLine(b.x - 2, axisTop + 7, b.x + 5, axisTop - 7, '#1E2A24', 1.6);
    });
  }
  drawXAxisPPTX(L.xAxisTop, L.tickLabelY, L.segLabelY, L.xAxisLabelY);
  if (L.showBottomAxis) {
    drawXAxisPPTX(L.bottomAxisTop, L.bottomTickLabelY, L.bottomSegLabelY, L.bottomAxisLabelY);
  }

  if (state.rowGridVertical && L.contentRows.some(r => r.kind !== 'header')) {
    L.segs.forEach(sg => {
      sg.ticks.forEach(t => addSegmentLine(t.x, L.rowsTop, t.x, L.rowsBottom, '#E7EAE7', 0.75));
    });
  }
  const rowGridH = state.rowGridHorizontal || 'off';
  const showRowLine = (kind) => rowGridH === 'all' || rowGridH === (kind === 'event' ? 'events' : 'states');

  L.contentRows.forEach(row => {
    if (row.kind === 'header') {
      addTextBox(row.text, L.pad, row.center - 10, L.plotLeft - L.pad - state.rowLabelGap, 20,
        { fontSize: state.groupHeaderSize, bold: !!state.groupHeaderBold, underline: !!state.groupHeaderUnderline, align: 'right' });
      return;
    }
    if (row.kind === 'event') {
      addTextBox(row.type, L.pad, row.center - 10, L.plotLeft - L.pad - state.rowLabelGap, 20, { fontSize: state.rowLabelSize, bold: rlAttrs.fontWeight === 700, italic: rlAttrs.fontStyle === 'italic', align: 'right' });
      if (showRowLine('event')) addSegmentLine(L.plotLeft, row.center, L.plotRight, row.center, '#E7EAE7', 0.75);
      row.items.forEach(it => {
        const col = it.hl ? (it.hlColor || it.color) : it.color;
        addMarker(it.symbol, it.x, row.center, it.symbolSize, col);
        addRichTextBox(it.label, it.x - 70, row.center + it.symbolSize * 0.5 + 2, 140, 24, { fontSize: it.textSize, bold: it.hl });
      });
      return;
    }
    addTextBox(row.type, L.pad, row.center - 10, L.plotLeft - L.pad - state.rowLabelGap, 20, { fontSize: state.rowLabelSize, bold: rlAttrs.fontWeight === 700, italic: rlAttrs.fontStyle === 'italic', align: 'right' });
    if (showRowLine('state')) addSegmentLine(L.plotLeft, row.center, L.plotRight, row.center, '#E7EAE7', 0.75);
    row.items.forEach(it => {
      const fill = lighten(it.color, 0.82);
      const y0 = row.y0 + 4, h = row.y1 - row.y0 - 8;
      const widest = it.pieces.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), it.pieces[0]);
      it.pieces.forEach(piece => {
        const w = Math.max(0.03, piece.x1 - piece.x0);
        if (ok(piece.x0, row.y0, w)) {
          slide.addShape(RECT, {
            x: IN(piece.x0), y: IN(y0), w: IN(w), h: IN(h),
            fill: { color: hexColor(fill) }, line: { color: hexColor(it.color), width: 0.9 }
          });
          if (it.hatch) {
            hatchSegmentsRect(piece.x0, y0, w, h, 9).forEach(seg => {
              addSegmentLine(seg[0][0], seg[0][1], seg[1][0], seg[1][1], it.color, 1);
            });
          }
        }
        if (piece === widest && w * (1 / scale) > 34) {
          addRichTextBox(it.label, piece.x0, row.center - 8, w, 16, { fontSize: state.stateLabelSize, color: darken(it.color, 0.45) });
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
    });
  });

  L.annotations.forEach(a => {
    addSegmentLine(a.x, a.fromY, a.x, L.chartTop, a.color, state.markerLineWidth, true);
    addNumberBadge(a.x, a.fromY, a.number, L.badgeR);
  });

  if (L.legendLayout) {
    L.legendLayout.positions.forEach(p => {
      const lx = L.plotLeft + p.xOffset;
      const ly = L.legendY + p.line * L.legendLayout.lineH;
      addSegmentLine(lx, ly, lx + 22, ly, p.sr.color, p.sr.width);
      addMarker(p.sr.markerType, lx + 11, ly, Math.max(7, p.sr.markerSize), p.sr.color);
      addTextBox(p.label, lx + p.swatchW, ly - 8, p.swatchW * 4, 16, { fontSize: 10, align: 'left' });
    });
  }

  if (L.annotationList.positions.length) {
    let listTop = L.annotationsY + Math.max(0, Number(state.markerListGapTop) || 0);
    addTextBox('Markierungen', L.contentLeftX, listTop - 14, 200, 18, { fontSize: Math.round(state.markerListFontSize * 1.05), bold: true, align: 'left' });
    const baseY = listTop + Math.round(L.annotationList.lineH * 0.9);
    L.annotationList.positions.forEach(p => {
      const ly = baseY + p.yOffset;
      const lx = L.contentLeftX + p.xOffset;
      addNumberBadge(lx + p.badgeR, ly - p.badgeR * 0.65, p.number, p.badgeR);
      addRichTextBox(p.label, lx + p.badgeR * 2 + 8, ly - 12, L.plotRight - (lx + p.badgeR * 2 + 8), 18 * p.nLines, { fontSize: state.markerListFontSize, align: 'left' });
    });
  }

  if (state.showFooterSection !== false && state.footerText) {
    const align = state.footerAlign === 'center' ? 'center' : state.footerAlign === 'right' ? 'right' : 'left';
    const footerX = state.footerAlign === 'left' ? L.contentLeftX : L.pad;
    addTextBox(state.footerText, footerX, L.footerY - state.footerSize * FS, L.W - L.pad - footerX, state.footerSize * FS * 1.6,
      { fontSize: state.footerSize, color: state.footerColor, align });
  }

  if (state.watermarkEnabled !== false) {
    const wmSize = 30;
    const wmMargin = 14;
    try {
      slide.addImage({
        data: WATERMARK_DATA_URI,
        x: IN(L.W - wmMargin - wmSize), y: IN(L.H - wmMargin - wmSize),
        w: IN(wmSize), h: IN(wmSize), transparency: 15
      });
    } catch (e) { /* Wasserzeichen ist rein dekorativ - Export soll nicht daran scheitern */ }
  }

  const pptxBlob = await pptx.write({ outputType: 'blob' });
  await saveBlobSmart(pptxBlob, buildFileName('pptx', 'pptx'), 'PowerPoint-Präsentation', { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] });
}
