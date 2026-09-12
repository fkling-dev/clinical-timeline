/* ============================================================
   UI-Bindung: Formulare <-> state
   Prinzip gegen Fokus-Verlust: Wert-Felder loesen NUR rerender()
   aus (SVG neu zeichnen). Nur Hinzufuegen/Entfernen/Verschieben
   von Eintraegen loest refreshAll() aus (kompletter Neuaufbau).
   ============================================================ */
let activeTab = 'general';
let expandedRows = new Set(); // welche Zeilenkarten im Tab "Ereignisse & Zustände" aufgeklappt sind

function elx(tag, attrs, children) {
  const e = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(k => {
    if (attrs[k] == null || attrs[k] === false) return;
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  });
  (children || []).forEach(c => { if (c != null) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c); });
  return e;
}
const el = elx;

function field(labelText, inputEl, opts) {
  opts = opts || {};
  const wrap = el('label', { class: 'field' + (opts.narrow ? ' narrow' : '') });
  const labelRow = el('span', { class: 'field-label-row' });
  if (opts.icon) labelRow.appendChild(el('span', { class: 'field-icon field-icon-' + opts.icon }, [opts.icon === 'gap' ? '↔' : opts.icon === 'size' ? 'Aa' : opts.icon === 'color' ? '🎨' : '']));
  labelRow.appendChild(el('span', { class: 'field-label' }, [labelText]));
  wrap.appendChild(labelRow);
  wrap.appendChild(inputEl);
  return wrap;
}
// Kurzformen fuer die haeufigsten Feldtypen im Stil-Tab: macht auf einen Blick
// erkennbar, ob ein Feld einen Abstand (↔) oder eine Schriftgröße (Aa) einstellt.
function gapField(labelText, inputEl, opts) { return field(labelText, inputEl, Object.assign({ icon: 'gap' }, opts)); }
function sizeField(labelText, inputEl, opts) { return field(labelText, inputEl, Object.assign({ icon: 'size' }, opts)); }
function colorField(labelText, inputEl, opts) { return field(labelText, inputEl, Object.assign({ icon: 'color' }, opts)); }

function bigSectionTitle(text, toggleValue, onToggle) {
  if (onToggle) {
    const wrap = el('div', { class: 'style-section-title with-toggle' });
    wrap.appendChild(el('span', {}, [text]));
    wrap.appendChild(toggleSwitch(toggleValue, onToggle, 'Gesamten Bereich ein-/ausblenden'));
    return wrap;
  }
  return el('div', { class: 'style-section-title' }, [text]);
}

function numInput(value, onChange, step) {
  const i = el('input', { type: 'number', value: value, step: step || 'any' });
  i.addEventListener('input', () => { const v = parseFloat(i.value); if (!isNaN(v)) onChange(v); });
  return i;
}
// Wie numInput, aber loest zusaetzlich beim Verlassen des Feldes (blur/Enter statt
// bei jedem Tastendruck) eine "Commit"-Aktion aus - z.B. zum sortieren einer Liste,
// ohne waehrend des Tippens staendig den Fokus zu verlieren.
function numInputCommit(value, onChange, onCommit, step) {
  const i = numInput(value, onChange, step);
  i.addEventListener('change', () => onCommit());
  return i;
}
function textInput(value, onChange) {
  const i = el('input', { type: 'text', value: value == null ? '' : value });
  i.addEventListener('input', () => onChange(i.value));
  return i;
}
// Mehrzeiliges Eingabefeld fuer Ereignis-/Zustandsbeschriftungen: Enter erzeugt
// einen echten Zeilenumbruch; "^{...}" wird beim Rendern hochgestellt (z.B. "10^{-4}").
function textAreaInput(value, onChange) {
  const i = el('textarea', { rows: '2', class: 'label-textarea' });
  i.value = value == null ? '' : value;
  i.addEventListener('input', () => onChange(i.value));
  return i;
}
function colorInput(value, onChange) {
  const i = el('input', { type: 'color', value: value || '#2B6E5E' });
  i.addEventListener('input', () => onChange(i.value));
  return i;
}
function checkInput(value, onChange) {
  const i = el('input', { type: 'checkbox' });
  i.checked = !!value;
  i.addEventListener('change', () => onChange(i.checked));
  return i;
}
// iOS-artiger Ein/Aus-Schalter (z.B. Kurve oder Ereignis-/Zustands-Zeile ein-/ausblenden,
// ohne die Daten zu loeschen).
function toggleSwitch(value, onChange, title) {
  const wrap = el('label', { class: 'ios-toggle', title: title || '' });
  const input = el('input', { type: 'checkbox' });
  input.checked = value !== false;
  input.addEventListener('change', () => onChange(input.checked));
  wrap.appendChild(input);
  wrap.appendChild(el('span', { class: 'slider' }));
  return wrap;
}
function selectInput(value, options, onChange) {
  const s = el('select', {});
  options.forEach(o => {
    const opt = el('option', { value: o.value }, [o.label]);
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener('change', () => onChange(s.value));
  return s;
}
function rangeInput(value, min, max, step, onChange) {
  const i = el('input', { type: 'range', min: min, max: max, step: step, value: value });
  i.addEventListener('input', () => onChange(parseFloat(i.value)));
  return i;
}

/* ---------- Rendering (SVG-only, erhaelt Fokus) ---------- */
function isDiagramEmpty() {
  return state.segments.length === 0 && state.series.length === 0 && state.rows.length === 0;
}
function rerender() {
  markDirty();
  const host = document.getElementById('preview');
  if (isDiagramEmpty()) {
    host.innerHTML = '';
    host.appendChild(renderWelcomeScreen());
    renderWarnings();
    return;
  }
  const { svg } = renderSVG(state);
  host.innerHTML = svg;
  renderWarnings();
  updateConflictUI();
  wireItemClicks();
}
function renderWelcomeScreen() {
  const box = el('div', { class: 'welcome' });
  box.appendChild(el('div', { class: 'welcome-title' }, ['Willkommen bei Felix\' Timeline-App']));
  box.appendChild(el('div', { class: 'welcome-text' }, [
    'Erstelle klinische Verlaufsdiagramme mit Kurven, Ereignissen und Zuständen auf einer abschnittsweise skalierten Zeitachse. Leg direkt los oder starte mit einem Beispiel.'
  ]));
  const btnRow = el('div', { class: 'welcome-actions' });
  btnRow.appendChild(el('button', {
    class: 'btn', onclick: () => { activeTab = 'segments'; state.segments.push({ id: uid('seg'), label: 'Abschnitt 1', start: 0, end: 30, weight: 1, tickStep: 5, enabled: true }); refreshAll(); }
  }, ['Eigenes Diagramm beginnen']));
  btnRow.appendChild(el('button', {
    class: 'btn secondary', onclick: () => { state = defaultState(); refreshAll(); }
  }, ['Beispieldaten laden']));
  btnRow.appendChild(el('button', {
    class: 'btn secondary', onclick: () => document.getElementById('loadInput').click()
  }, ['Projekt laden']));
  box.appendChild(btnRow);
  return box;
}
function renderWarnings() {
  const box = document.getElementById('warnings');
  box.innerHTML = '';
  const conflicts = findStateConflicts(state);
  const segConflicts = findSegmentConflicts(state);
  const L = computeLayout(state);
  const msgs = [];
  if (segConflicts.size) msgs.push(`${segConflicts.size} Abschnitte überlappen sich oder sind ungültig – bitte in „Abschnitte“ prüfen (rot markiert). Sie werden im Diagramm nicht dargestellt.`);
  if (conflicts.size) msgs.push(`${conflicts.size} Zustands-Einträge überlappen sich innerhalb derselben Zeile – bitte in „Ereignisse & Zustände“ prüfen (rot markiert).`);
  if (L.hiddenCount) msgs.push(`${L.hiddenCount} Werte/Ereignisse/Zustände liegen außerhalb der sichtbaren (aktiven) Abschnitte und wurden ausgeblendet.`);
  msgs.forEach(m => box.appendChild(el('div', { class: 'warning' }, [m])));
}
function updateConflictUI() {
  const idSet = findStateConflicts(state);
  document.querySelectorAll('[data-item-id]').forEach(node => {
    node.classList.toggle('conflict', idSet.has(node.getAttribute('data-item-id')));
  });
}
function refreshAll() {
  renderTabs();
  rerender();
  syncHeaderInputs();
}
function syncHeaderInputs() {
  const cw = document.getElementById('canvasWidth');
  if (cw && document.activeElement !== cw) cw.value = state.canvasWidth;
}

/* ---------- Klick-Interaktivität im Diagramm ---------- */
function findRow(rowId) { return state.rows.find(r => r.id === rowId); }
function findItem(row, itemId) { return row ? row.items.find(it => it.id === itemId) : null; }

function wireItemClicks() {
  const preview = document.getElementById('preview');
  preview.querySelectorAll('[data-kind]').forEach(node => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      const kind = node.getAttribute('data-kind');
      if (kind === 'point') {
        const seriesId = node.getAttribute('data-series-id');
        const day = Number(node.getAttribute('data-point-day'));
        const sr = state.series.find(s => s.id === seriesId);
        const pt = sr && sr.points.find(p => Number(p.day) === day);
        if (pt) { pt.showValue = !pt.showValue; rerender(); }
        return;
      }
      const rowId = node.getAttribute('data-row-id');
      const itemId = node.getAttribute('data-item-id');
      const rect = node.getBoundingClientRect();
      const anchorX = rect.left + rect.width / 2;
      const anchorY = rect.top;
      if (kind === 'event') onEventClick(rowId, itemId, anchorX, anchorY);
      else if (kind === 'state') onStateClick(rowId, itemId, anchorX, anchorY);
    });
  });
}

/* ----- Popover-Infrastruktur ----- */
let currentPopover = null;
function closePopover() {
  if (currentPopover) { currentPopover.remove(); currentPopover = null; }
  document.removeEventListener('mousedown', popoverOutsideHandler, true);
}
function popoverOutsideHandler(e) {
  if (currentPopover && !currentPopover.contains(e.target)) closePopover();
}
function openPopover(anchorX, anchorY, contentEl, opts) {
  closePopover();
  const pop = el('div', { class: 'popover' + (opts && opts.extraClass ? ' ' + opts.extraClass : '') });
  pop.appendChild(contentEl);
  document.body.appendChild(pop);
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = clamp(anchorX - w / 2, 8, window.innerWidth - w - 8);
  let top = anchorY - h - 12;
  if (top < 8) top = anchorY + 20;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  currentPopover = pop;
  setTimeout(() => document.addEventListener('mousedown', popoverOutsideHandler, true), 0);
}

/* ----- Ereignis-Highlight (Klick zum Hervorheben) ----- */
function onEventClick(rowId, itemId, ax, ay) {
  const row = findRow(rowId); const it = findItem(row, itemId);
  if (!row || !it) return;
  if (!it.hl) {
    it.hl = true;
    if (!it.hlColor) it.hlColor = row.color;
    rerender();
    openEventPopover(row, it, ax, ay);
  } else {
    it.hl = false;
    closePopover();
    rerender();
  }
}
function openEventPopover(row, it, ax, ay) {
  const box = el('div', { class: 'popover-body' });
  box.appendChild(el('div', { class: 'popover-title' }, [it.label || 'Ereignis']));
  box.appendChild(field('Symbolfarbe (nur dieses Ereignis)', colorInput(it.hlColor, v => { it.hlColor = v; rerender(); })));
  box.appendChild(field('Beschriftung der Markierungslinie', textAreaInput(it.hlLabel, v => { it.hlLabel = v; rerender(); })));
  box.appendChild(el('div', { class: 'hint small' }, ['Hochstellung: „10^{-4}“ → 10⁻⁴. Zeilenumbruch: Enter.']));
  box.appendChild(el('button', {
    class: 'btn ghost small', onclick: () => { it.hl = false; closePopover(); rerender(); }
  }, ['Hervorhebung entfernen']));
  openPopover(ax, ay, box);
}

/* ----- Zustands-Editor (Schraffur + Markierungslinien) ----- */
function onStateClick(rowId, itemId, ax, ay) {
  const row = findRow(rowId); const it = findItem(row, itemId);
  if (!row || !it) return;
  // Erneuter Klick auf dieselbe, bereits geoeffnete Box schliesst das Menue.
  if (currentPopover && currentPopover.dataset.itemId === itemId) { closePopover(); return; }
  openStatePopover(row, it, ax, ay);
}
function openStatePopover(row, it, ax, ay) {
  const box = el('div', { class: 'popover-body wide' });
  box.appendChild(el('div', { class: 'popover-title' }, [it.label || 'Zustand']));
  box.appendChild(field('Schraffiert darstellen', checkInput(it.hatch, v => { it.hatch = v; rerender(); })));

  box.appendChild(el('div', { class: 'popover-subtitle' }, ['Markierungslinien (bis zum Diagramm-Oberrand)']));
  const list = el('div', { class: 'marks-list' });
  function renderMarks() {
    list.innerHTML = '';
    (it.marks || []).forEach((m) => {
      const row2 = el('div', { class: 'mark-row' + (m.active === false ? ' inactive' : '') });
      row2.appendChild(checkInput(m.active !== false, v => { m.active = v; rerender(); }));
      const posLabel = m.pos === 'start' ? 'Start' : m.pos === 'end' ? 'Ende' : `Tag ${m.day}`;
      row2.appendChild(el('span', { class: 'mark-pos' }, [posLabel]));
      row2.appendChild(colorInput(m.color || '#1E2A24', v => { m.color = v; rerender(); }));
      const labelInput = textAreaInput(m.label, v => { m.label = v; rerender(); });
      labelInput.placeholder = 'Beschriftung';
      labelInput.rows = 1;
      row2.appendChild(labelInput);
      row2.appendChild(el('button', {
        class: 'icon-btn danger small', title: 'Löschen',
        onclick: () => { it.marks = it.marks.filter(x => x.id !== m.id); renderMarks(); rerender(); }
      }, ['✕']));
      list.appendChild(row2);
    });
  }
  renderMarks();
  box.appendChild(list);
  box.appendChild(el('div', { class: 'hint small' }, ['Hochstellung: „10^{-4}“ → 10⁻⁴. Zeilenumbruch: Enter im Beschriftungsfeld.']));

  const addRow = el('div', { class: 'row' });
  addRow.appendChild(el('button', {
    class: 'btn secondary small', onclick: () => {
      it.marks = it.marks || [];
      it.marks.push({ id: uid('mk'), pos: 'start', active: true, label: '', color: '#1E2A24' });
      renderMarks(); rerender();
    }
  }, ['+ Am Anfang']));
  addRow.appendChild(el('button', {
    class: 'btn secondary small', onclick: () => {
      it.marks = it.marks || [];
      it.marks.push({ id: uid('mk'), pos: 'end', active: true, label: '', color: '#1E2A24' });
      renderMarks(); rerender();
    }
  }, ['+ Am Ende']));
  box.appendChild(addRow);

  const customRow = el('div', { class: 'row' });
  const dayInput = el('input', { type: 'number', min: it.start, max: it.end, placeholder: `${it.start}–${it.end}` });
  customRow.appendChild(dayInput);
  customRow.appendChild(el('button', {
    class: 'btn secondary small', onclick: () => {
      let d = parseFloat(dayInput.value);
      if (isNaN(d)) return;
      d = clamp(d, Math.min(it.start, it.end), Math.max(it.start, it.end));
      it.marks = it.marks || [];
      it.marks.push({ id: uid('mk'), pos: 'custom', day: d, active: true, label: '', color: '#1E2A24' });
      dayInput.value = '';
      renderMarks(); rerender();
    }
  }, ['+ Bei Tag …']));
  box.appendChild(customRow);
  box.appendChild(el('div', { class: 'hint small' }, [`Nur Werte zwischen ${Math.min(it.start, it.end)} und ${Math.max(it.start, it.end)} (innerhalb der Box) sind zulässig.`]));

  box.appendChild(el('button', { class: 'btn ghost small', onclick: closePopover }, ['Schließen']));
  openPopover(ax, ay, box);
  if (currentPopover) currentPopover.dataset.itemId = it.id;
}

/* ---------- Tabs ---------- */
const TABS = [
  { id: 'general', label: 'Allgemein' },
  { id: 'style', label: 'Stil' },
  { id: 'segments', label: 'Abschnitte' },
  { id: 'series', label: 'Kurven' },
  { id: 'rows', label: 'Ereignisse & Zustände' }
];

// Felder, die den "Stil" (wiederverwendbares Erscheinungsbild, unabhaengig von den
// konkreten Diagrammdaten) ausmachen. Wird fuer Stil-Export/Import verwendet, damit
// mehrere Diagramme gleich aussehen koennen, ohne Titel/Achsentexte/Daten zu teilen.
const STYLE_FIELDS = [
  'titleAlign', 'fontFamily', 'fontScale',
  'rowLabelSize', 'rowLabelStyle', 'rowLabelGap', 'groupHeaderSize', 'groupHeaderBold', 'groupHeaderUnderline',
  'headerGapBefore', 'headerGapAfter',
  'showLegend', 'showGrid', 'rowGridVertical', 'rowGridHorizontal',
  'plotPadding', 'segmentGap',
  'axisLineWidth', 'axisColor', 'xTickLabelSize', 'yTickLabelSize', 'segmentLabelSize', 'showSegmentLabels', 'axisLabelSize', 'axisLabelStyle',
  'segmentLabelGap', 'xAxisLabelGap', 'axisToRowsGap', 'showBottomAxis', 'rowKindGap', 'stateRowGap', 'stateLabelSize', 'stateArrowGap',
  'markerLineWidth', 'markerBadgeSize', 'markerListLayout', 'markerListFontSize', 'markerListGapTop', 'markerListGapBottom',
  'footerSize', 'footerColor', 'footerAlign', 'leftEdgeMode',
  'alignAxisMin', 'watermarkEnabled'
];
function exportStylePreset() {
  const styleObj = {};
  STYLE_FIELDS.forEach(k => { styleObj[k] = state[k]; });
  // Datenreihen-Farben separat mitgeben (an den Kurven-Namen gebunden, siehe Import-Logik).
  styleObj.seriesColors = state.series.map(sr => ({ name: sr.name, color: sr.color }));
  saveBlobSmart(new Blob([JSON.stringify(styleObj, null, 2)], { type: 'application/json' }), buildFileName('style', 'json'), 'Stil-Preset (JSON)', { 'application/json': ['.json'] });
}
function importStylePresetFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      STYLE_FIELDS.forEach(k => { if (data[k] !== undefined) state[k] = data[k]; });
      // Farben je Kurve zuordnen: zuerst per Namensabgleich (z.B. "CRP" -> "CRP"),
      // damit gleich benannte Kurven in anderen Diagrammen dieselbe Farbe erhalten.
      // Falls kein Name uebereinstimmt, ersatzweise nach Reihenfolge zuordnen.
      if (Array.isArray(data.seriesColors) && data.seriesColors.length) {
        let matched = 0;
        data.seriesColors.forEach(entry => {
          if (!entry || !entry.color) return;
          const target = state.series.find(sr => sr.name && entry.name &&
            sr.name.trim().toLowerCase() === String(entry.name).trim().toLowerCase());
          if (target) { target.color = entry.color; matched++; }
        });
        if (matched === 0) {
          data.seriesColors.forEach((entry, i) => {
            if (entry && entry.color && state.series[i]) state.series[i].color = entry.color;
          });
        }
      }
      refreshAll();
    } catch (e) { alert('Stil-Datei konnte nicht gelesen werden: ' + e.message); }
  };
  reader.readAsText(file);
}

function renderTabs() {
  const nav = document.getElementById('tabnav');
  nav.innerHTML = '';
  TABS.forEach(t => {
    const b = el('button', {
      class: 'tabbtn' + (activeTab === t.id ? ' active' : ''),
      onclick: () => { activeTab = t.id; refreshAll(); }
    }, [t.label]);
    nav.appendChild(b);
  });
  const panel = document.getElementById('tabpanel');
  panel.innerHTML = '';
  panel.appendChild(
    activeTab === 'general' ? renderGeneralPanel() :
    activeTab === 'style' ? renderStylePanel() :
    activeTab === 'segments' ? renderSegmentsPanel() :
    activeTab === 'series' ? renderSeriesPanel() :
    renderRowsPanel()
  );
}

/* ---------- Allgemein (Inhalte: Titel/Texte/Daten-Ein-Aus, nicht Stil) ---------- */
function renderGeneralPanel() {
  const c = el('div', { class: 'panel-body' });
  c.appendChild(field('Diagrammtitel', textInput(state.title, v => { state.title = v; rerender(); })));
  c.appendChild(field('X-Achsen-Beschriftung', textInput(state.xAxisLabel, v => { state.xAxisLabel = v; rerender(); })));
  c.appendChild(field('Y-Achsen-Beschriftung (primär)', textInput(state.yAxisLabel, v => { state.yAxisLabel = v; rerender(); })));
  c.appendChild(field('Y-Achsen-Beschriftung (sekundär)', textInput(state.y2AxisLabel, v => { state.y2AxisLabel = v; rerender(); })));
  c.appendChild(el('div', { class: 'hint' }, ['Die sekundäre Achse wird automatisch nur angezeigt, wenn mindestens eine Kurve im Tab „Kurven“ auf die sekundäre Achse gelegt wird.']));

  c.appendChild(el('div', { class: 'divider' }));
  c.appendChild(el('div', { class: 'section-title' }, ['Dateiname']));
  c.appendChild(field('Dateiname (für Speichern & alle Exporte)', textInput(state.fileBaseName, v => { state.fileBaseName = v; markDirty(); })));
  c.appendChild(el('div', { class: 'hint' }, ['Wird beim Öffnen einer bestehenden Projektdatei automatisch aus deren Dateinamen übernommen. Die Präfixe je Export-Art stellst du im Tab „Stil“ ein. Beim Speichern der Projektdatei wird kein Datum/Uhrzeit angehängt (damit direktes Überschreiben funktioniert); bei SVG-, PNG-, PowerPoint- und Stil-Exporten schon.']));

  c.appendChild(el('div', { class: 'section-title' }, ['Seitenverhältnis']));
  const arRow = el('div', { class: 'row' });
  arRow.appendChild(field('Breite', numInput(state.aspectW, v => { state.aspectW = v || 1; rerender(); }), { narrow: true }));
  arRow.appendChild(field('Höhe', numInput(state.aspectH, v => { state.aspectH = v || 1; rerender(); }), { narrow: true }));
  c.appendChild(arRow);
  const presets = el('div', { class: 'chipbar' });
  [[16, 9, '16:9'], [4, 3, '4:3'], [1, 1, '1:1'], [21, 9, '21:9'], [3, 4, 'Hochformat 3:4']].forEach(p => {
    presets.appendChild(el('button', { class: 'chip', onclick: () => { state.aspectW = p[0]; state.aspectH = p[1]; rerender(); } }, [p[2]]));
  });
  c.appendChild(presets);

  c.appendChild(el('div', { class: 'divider' }));
  c.appendChild(el('div', { class: 'section-title' }, ['Fußzeile']));
  c.appendChild(field('Text (leer = keine Fußzeile)', textInput(state.footerText, v => { state.footerText = v; rerender(); })));
  c.appendChild(el('div', { class: 'hint' }, ['Größe, Farbe und Ausrichtung der Fußzeile stellst du im Tab „Stil“ ein.']));

  c.appendChild(el('div', { class: 'divider' }));
  c.appendChild(el('div', { class: 'hint' }, ['„Speichern“ und „Öffnen“ findest du jetzt oben in der Kopfleiste neben den Export-Buttons.']));
  c.appendChild(el('button', { class: 'btn ghost', onclick: () => { if (confirm('Alle Daten zurücksetzen?')) { state = defaultState(); currentProjectHandle = null; currentProjectHandleName = null; refreshAll(); } } }, ['Zurücksetzen auf Beispieldaten']));
  return c;
}

// Erkennt, ob der Browser tatsaechlich "in die Datei zurueckschreiben" kann
// (File System Access API, aktuell nur Chrome/Edge). Ohne Unterstuetzung
// (Safari/Firefox) kann technisch immer nur eine neue Datei heruntergeladen
// werden - der Knopf zeigt dann konsequent "Exportieren" statt "Speichern".
const SUPPORTS_FILE_SAVE = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
function saveButtonLabel() { return SUPPORTS_FILE_SAVE ? '💾 Speichern' : '💾 Exportieren'; }

// Verfolgt, ob es seit dem letzten erfolgreichen Speichern/Exportieren bzw.
// Öffnen/Zurücksetzen Aenderungen gab - faerbt den Speichern/Exportieren-Knopf
// rot ein, solange das der Fall ist.
let hasUnsavedChanges = false;
function markDirty() { hasUnsavedChanges = true; updateSaveButtonState(); }
function markClean() { hasUnsavedChanges = false; updateSaveButtonState(); }
function updateSaveButtonState() {
  ['btnFileMenu', 'btnSaveProject'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('has-changes', hasUnsavedChanges);
  });
}

// "In die" aktuell geoeffnete Projektdatei speichern (Chrome/Edge via File System
// Access API): schreibt direkt in die Datei, ohne einen neuen Download anzulegen.
// Beim allerersten Speichern (noch keine Datei bekannt) oder in Browsern ohne
// Unterstuetzung wird wie gewohnt ein Speichern-Dialog bzw. Download genutzt -
// der dabei gewaehlte Ort wird fuer kuenftige Speicherungen gemerkt.
async function saveProjectSmart() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  // Nur direkt ueberschreiben, wenn wir bereits eine Datei offen haben UND sich
  // der gewuenschte Dateiname seitdem NICHT geaendert hat. Ein bestehendes Handle
  // kann eine Datei nicht umbenennen - bei geaendertem Namen also "Speichern unter".
  const nameUnchanged = currentProjectHandle && state.fileBaseName === currentProjectHandleName;
  if (nameUnchanged) {
    try {
      if (currentProjectHandle.queryPermission) {
        const perm = await currentProjectHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && (await currentProjectHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          throw new Error('Keine Schreibberechtigung');
        }
      }
      const writable = await currentProjectHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      markClean();
      flashSaveIndicator();
      return;
    } catch (e) { /* z.B. Datei wurde geloescht/verschoben -> unten neu waehlen lassen */ }
  }
  await saveProjectAs();
}
// Explizites "Speichern unter": fragt IMMER einen neuen Speicherort/-namen ab
// (bzw. laedt in Browsern ohne File System Access API direkt herunter), auch
// wenn bereits eine Datei offen ist und sich am Dateinamen nichts geaendert hat.
async function saveProjectAs() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const handle = await saveBlobSmart(blob, buildFileName('data', 'json'), 'Projekt (JSON)', { 'application/json': ['.json'] });
  if (handle !== undefined) { // undefined = Nutzer hat den Dialog abgebrochen -> nicht als gespeichert zaehlen
    if (handle) {
      currentProjectHandle = handle;
      currentProjectHandleName = state.fileBaseName;
    }
    markClean();
    flashSaveIndicator();
  }
}
function flashSaveIndicator() {
  const btn = document.getElementById('btnSaveProject');
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = '✓ Gespeichert';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

// Gebuendeltes Menü fuer alles rund um Oeffnen/Speichern/Exportieren.
function menuItem(icon, label, onclick) {
  return el('button', { class: 'file-menu-item', onclick: () => { closePopover(); onclick(); } }, [
    el('span', { class: 'icon' }, [icon]), el('span', {}, [label])
  ]);
}
function openFileMenu(ax, ay) {
  const box = el('div', { class: 'file-menu' });
  box.appendChild(menuItem('📂', 'Öffnen', () => {
    openProjectSmart().catch(e => { console.error(e); alert('Öffnen fehlgeschlagen: ' + e.message); });
  }));
  box.appendChild(menuItem('💾', 'Speichern unter…', () => {
    saveProjectAs().catch(e => { console.error(e); alert('Speichern fehlgeschlagen: ' + e.message); });
  }));
  box.appendChild(el('div', { class: 'file-menu-sep' }));
  box.appendChild(el('div', { class: 'file-menu-label' }, ['Export']));
  box.appendChild(menuItem('🖼️', 'SVG exportieren', exportSVGFile));
  box.appendChild(menuItem('🖼️', 'PNG exportieren', exportPNG));
  box.appendChild(menuItem('📊', 'PowerPoint exportieren', () => {
    exportPPTX().catch(e => { console.error(e); alert('PPTX-Export fehlgeschlagen:\n' + e.message); });
  }));
  openPopover(ax, ay, box, { extraClass: 'menu' });
}

// Projekt oeffnen: nutzt den nativen Datei-Dialog (mit Schreibzugriff, damit
// spaeter direkt in dieselbe Datei gespeichert werden kann); ohne Unterstuetzung
// faellt es auf das klassische <input type=file> zurueck.
async function openProjectSmart() {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const opts = { types: [{ description: 'Projekt (JSON)', accept: { 'application/json': ['.json'] } }], multiple: false };
      if (currentProjectHandle) opts.startIn = currentProjectHandle;
      const [handle] = await window.showOpenFilePicker(opts);
      const file = await handle.getFile();
      const text = await file.text();
      state = migrateState(JSON.parse(text));
      state.fileBaseName = extractBaseNameFromFileName(file.name);
      currentProjectHandle = handle;
      currentProjectHandleName = state.fileBaseName;
      refreshAll();
      markClean();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('Datei konnte nicht geöffnet werden: ' + e.message);
      return;
    }
  }
  document.getElementById('loadInput').click();
}
function loadJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = migrateState(JSON.parse(reader.result));
      state = data;
      state.fileBaseName = extractBaseNameFromFileName(file.name);
      currentProjectHandle = null; // via <input type=file> geladen -> kein direktes Speichern moeglich
      currentProjectHandleName = null;
      refreshAll();
      markClean();
    } catch (e) { alert('Datei konnte nicht gelesen werden: ' + e.message); }
  };
  reader.readAsText(file);
}

/* ---------- Stil (alle optischen Einstellungen, exportierbar als Preset) ---------- */
function renderStylePanel() {
  const c = el('div', { class: 'panel-body' });
  c.appendChild(el('div', { class: 'hint' }, [
    'Alle Einstellungen hier betreffen nur das Erscheinungsbild (nicht die Daten) und lassen sich als Stil-Datei exportieren, um mehrere Diagramme gleich aussehen zu lassen. Die Farben der Kurven werden dabei mit übernommen und beim Import anhand des Kurvennamens zugeordnet (z. B. „CRP“ → „CRP“); gibt es keine passenden Namen, erfolgt die Zuordnung ersatzweise nach Reihenfolge.'
  ]));
  const ioRow = el('div', { class: 'row' });
  ioRow.appendChild(el('button', { class: 'btn secondary', onclick: exportStylePreset }, ['Stil exportieren']));
  ioRow.appendChild(el('button', { class: 'btn secondary', onclick: () => document.getElementById('styleLoadInput').click() }, ['Stil importieren']));
  c.appendChild(ioRow);
  const legendRow = el('div', { class: 'field-legend' });
  legendRow.appendChild(el('span', { class: 'field-icon field-icon-gap' }, ['↔']));
  legendRow.appendChild(el('span', {}, ['Abstand']));
  legendRow.appendChild(el('span', { class: 'field-icon field-icon-size' }, ['Aa']));
  legendRow.appendChild(el('span', {}, ['Schriftgröße']));
  c.appendChild(legendRow);

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Dateinamen-Präfixe']));
  c.appendChild(el('div', { class: 'hint small' }, ['Wird beim Export vor den Standardnamen sowie Datum/Uhrzeit gesetzt, z. B. „Klinik-A klinischer-verlauf # 2026-08-23 # 08-27.png“.']));
  c.appendChild(field('SVG & PNG', textInput(state.exportPrefixImage, v => { state.exportPrefixImage = v; }), { narrow: true }));
  c.appendChild(field('PowerPoint', textInput(state.exportPrefixPptx, v => { state.exportPrefixPptx = v; }), { narrow: true }));
  c.appendChild(field('Datenexport (Projekt-JSON)', textInput(state.exportPrefixData, v => { state.exportPrefixData = v; }), { narrow: true }));
  c.appendChild(field('Stil-Export', textInput(state.exportPrefixStyle, v => { state.exportPrefixStyle = v; }), { narrow: true }));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Wasserzeichen']));
  c.appendChild(field('Icon rechts unten in Exporten einfügen', checkInput(state.watermarkEnabled, v => { state.watermarkEnabled = v; rerender(); })));
  c.appendChild(el('div', { class: 'hint small' }, ['Wirkt unabhängig von den übrigen Bereichs-Schaltern (auch bei ausgeblendetem Diagramm sichtbar).']));

  /* ===================== DIAGRAMM ===================== */
  c.appendChild(bigSectionTitle('Diagramm', state.showChartSection, v => { state.showChartSection = v; refreshAll(); }));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Titel & Anzeige']));
  c.appendChild(field('Titel-Ausrichtung', selectInput(state.titleAlign, [
    { value: 'center', label: 'Zentriert' }, { value: 'left', label: 'Linksbündig (Y-Achse)' }
  ], v => { state.titleAlign = v; rerender(); })));
  const row2 = el('div', { class: 'row' });
  row2.appendChild(field('Legende anzeigen', checkInput(state.showLegend, v => { state.showLegend = v; rerender(); }), { narrow: true }));
  row2.appendChild(field('Gitterlinien anzeigen', checkInput(state.showGrid, v => { state.showGrid = v; rerender(); }), { narrow: true }));
  c.appendChild(row2);

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Schrift']));
  c.appendChild(field('Schriftart (Diagramm)', selectInput(state.fontFamily, FONT_CHOICES.map(f => ({ value: f, label: f })), v => { state.fontFamily = v; rerender(); })));
  if (state.fontFamily === 'Calibri') {
    c.appendChild(el('div', { class: 'hint' }, ['Calibri ist auf macOS/Linux meist nicht installiert. In der Vorschau hier wird ersatzweise „Carlito“ verwendet (nahezu identische Maße). Im PowerPoint-Export wird „Calibri“ eingetragen – PowerPoint ersetzt die Schrift dort selbst, falls sie auf dem jeweiligen Rechner fehlt.']));
  }
  const fsWrap = el('div', { class: 'field' });
  fsWrap.appendChild(el('span', { class: 'field-label' }, [`Schriftgröße gesamt: ${Math.round(state.fontScale * 100)}%`]));
  const fsRange = rangeInput(state.fontScale, 0.6, 3.0, 0.05, v => {
    state.fontScale = v;
    fsWrap.firstChild.textContent = `Schriftgröße gesamt: ${Math.round(v * 100)}%`;
    rerender();
  });
  fsWrap.appendChild(fsRange);
  c.appendChild(fsWrap);

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Seitenlayout']));
  c.appendChild(gapField('Innenabstand des gesamten Plots (px)', numInput(state.plotPadding, v => { state.plotPadding = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(gapField('Abstand zwischen Abschnitten auf der X-Achse (px)', numInput(state.segmentGap, v => { state.segmentGap = Math.max(0, v); rerender(); }, 1)));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Achsen']));
  c.appendChild(gapField('Achsenlinien-Dicke (px)', numInput(state.axisLineWidth, v => { state.axisLineWidth = Math.max(0.2, v); rerender(); }, 0.1)));
  c.appendChild(colorField('Achsenfarbe', colorInput(state.axisColor, v => { state.axisColor = v; rerender(); })));
  c.appendChild(sizeField('Textgröße X-Achsen-Markierungen (pt)', numInput(state.xTickLabelSize, v => { state.xTickLabelSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(sizeField('Textgröße Y-Achsen-Markierungen (pt)', numInput(state.yTickLabelSize, v => { state.yTickLabelSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(sizeField('Textgröße Abschnittsbeschriftung (pt)', numInput(state.segmentLabelSize, v => { state.segmentLabelSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(sizeField('Achsenbeschriftung Größe (pt)', numInput(state.axisLabelSize, v => { state.axisLabelSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(field('Achsenbeschriftung Stil', selectInput(state.axisLabelStyle, AXIS_STYLE_CHOICES, v => { state.axisLabelStyle = v; rerender(); })));
  c.appendChild(field('Abschnittsbeschriftung anzeigen (z.B. "Induktion")', checkInput(state.showSegmentLabels, v => { state.showSegmentLabels = v; rerender(); })));
  c.appendChild(gapField('Abstand Achse ↔ Abschnittsbeschriftung (px)', numInput(state.segmentLabelGap, v => { state.segmentLabelGap = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(gapField('Abstand Abschnittsbeschriftung ↔ X-Achsenbeschriftung (px)', numInput(state.xAxisLabelGap, v => { state.xAxisLabelGap = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(gapField('Abstand X-Achse ↔ erste/letzte Zeile (px)', numInput(state.axisToRowsGap, v => { state.axisToRowsGap = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(el('div', { class: 'hint' }, ['Der Abstand der Tickmark-Zahlen und der Abschnittsbeschriftung zur Achse passt sich automatisch an die gewählte Textgröße an.']));
  c.appendChild(field('Zweite X-Achse unterhalb der Zeilen anzeigen', checkInput(state.showBottomAxis, v => { state.showBottomAxis = v; rerender(); })));
  c.appendChild(el('div', { class: 'hint small' }, ['Zeigt ein Duplikat der X-Achse direkt unterhalb der Ereignis-/Zustandszeilen - praktisch bei vielen Zeilen, damit der Tagesbezug auch unten sichtbar bleibt. Nutzt denselben Abstand wie oben.']));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Y-Achsen-Ausrichtung']));
  c.appendChild(field('Nulllinie beider Y-Achsen angleichen', checkInput(state.alignAxisMin, v => { state.alignAxisMin = v; rerender(); })));
  c.appendChild(el('div', { class: 'hint' }, ['Sorgt dafür, dass „0“ auf primärer und sekundärer Achse auf derselben Höhe steht, statt unabhängig voneinander skaliert zu werden.']));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Y-Achse primär – Wertebereich']));
  c.appendChild(field('Modus', selectInput(state.y1Mode, [{ value: 'auto', label: 'Automatisch' }, { value: 'manual', label: 'Manuell' }], v => { state.y1Mode = v; refreshAll(); })));
  if (state.y1Mode === 'manual') {
    c.appendChild(field('Minimum', numInput(state.y1Min, v => { state.y1Min = v; rerender(); })));
    c.appendChild(field('Maximum', numInput(state.y1Max, v => { state.y1Max = v; rerender(); })));
  }

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Y-Achse sekundär – Wertebereich']));
  c.appendChild(el('div', { class: 'hint' }, ['Wirkt nur, wenn mindestens eine Kurve auf die sekundäre Achse gelegt ist.']));
  c.appendChild(field('Modus', selectInput(state.y2Mode, [{ value: 'auto', label: 'Automatisch' }, { value: 'manual', label: 'Manuell' }], v => { state.y2Mode = v; refreshAll(); })));
  if (state.y2Mode === 'manual') {
    c.appendChild(field('Minimum', numInput(state.y2Min, v => { state.y2Min = v; rerender(); })));
    c.appendChild(field('Maximum', numInput(state.y2Max, v => { state.y2Max = v; rerender(); })));
  }

  /* ============== EREIGNISSE UND ZUSTÄNDE ============== */
  c.appendChild(bigSectionTitle('Ereignisse und Zustände', state.showRowsSection, v => { state.showRowsSection = v; refreshAll(); }));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Zeilen-Bezeichnungen (Ort, CT, …)']));
  c.appendChild(sizeField('Textgröße (pt)', numInput(state.rowLabelSize, v => { state.rowLabelSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(field('Stil', selectInput(state.rowLabelStyle, AXIS_STYLE_CHOICES, v => { state.rowLabelStyle = v; rerender(); })));
  c.appendChild(gapField('Abstand zur Linie/Box (px)', numInput(state.rowLabelGap, v => { state.rowLabelGap = Math.max(0, v); rerender(); }, 1)));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Gruppen-Überschriften']));
  c.appendChild(sizeField('Textgröße (pt)', numInput(state.groupHeaderSize, v => { state.groupHeaderSize = Math.max(4, v); rerender(); }, 0.5)));
  const ghRow = el('div', { class: 'row' });
  ghRow.appendChild(field('Fett', checkInput(state.groupHeaderBold, v => { state.groupHeaderBold = v; rerender(); }), { narrow: true }));
  ghRow.appendChild(field('Unterstrichen', checkInput(state.groupHeaderUnderline, v => { state.groupHeaderUnderline = v; rerender(); }), { narrow: true }));
  c.appendChild(ghRow);
  const ghGapRow = el('div', { class: 'row' });
  ghGapRow.appendChild(gapField('Abstand davor (px)', numInput(state.headerGapBefore, v => { state.headerGapBefore = Math.max(0, v); rerender(); }, 1), { narrow: true }));
  ghGapRow.appendChild(gapField('Abstand danach (px)', numInput(state.headerGapAfter, v => { state.headerGapAfter = Math.max(0, v); rerender(); }, 1), { narrow: true }));
  c.appendChild(ghGapRow);

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Ereignis-Zeilen']));
  c.appendChild(gapField('Abstand zwischen Ereignis- und Zustands-Zeilen (px)', numInput(state.rowKindGap, v => { state.rowKindGap = Math.max(0, v); rerender(); }, 1)));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Gitter im Zeilenbereich']));
  c.appendChild(el('div', { class: 'hint small' }, ['Betrifft nur den Bereich der Ereignis-/Zustandszeilen unterhalb des Diagramms (nicht das Gitter der Kurven-Y-Achse oben, siehe Bereich „Diagramm“).']));
  c.appendChild(field('Vertikale Linien (an Tag-Markierungen)', checkInput(state.rowGridVertical, v => { state.rowGridVertical = v; rerender(); })));
  c.appendChild(field('Horizontale Linien', selectInput(state.rowGridHorizontal, [
    { value: 'off', label: 'Aus' },
    { value: 'events', label: 'Nur Ereignisse' },
    { value: 'states', label: 'Nur Zustände' },
    { value: 'all', label: 'Alle Typen an' }
  ], v => { state.rowGridHorizontal = v; rerender(); })));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Zustands-Boxen']));
  c.appendChild(sizeField('Textgröße Beschriftung in der Box (pt)', numInput(state.stateLabelSize, v => { state.stateLabelSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(gapField('Zusätzliches Padding zwischen aufeinanderfolgenden Zustands-Zeilen (px)', numInput(state.stateRowGap, v => { state.stateRowGap = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(gapField('Abstand Pfeilspitze/-ende ↔ Box bei Lücke zwischen Abschnitten (px)', numInput(state.stateArrowGap, v => { state.stateArrowGap = Math.max(0, v); rerender(); }, 1)));

  /* ===================== MARKIERUNGEN ===================== */
  c.appendChild(bigSectionTitle('Markierungen', state.showMarkersSection, v => { state.showMarkersSection = v; refreshAll(); }));
  c.appendChild(el('div', { class: 'hint' }, [
    'Betrifft hervorgehobene Ereignisse und Markierungslinien von Zuständen. Die Zahlen-Symbole liegen auf einer eigenen Ebene und beeinflussen nie den Zeilenabstand.'
  ]));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Linien im Diagramm']));
  c.appendChild(gapField('Liniendicke gestrichelte Linien (px)', numInput(state.markerLineWidth, v => { state.markerLineWidth = Math.max(0.2, v); rerender(); }, 0.1)));
  c.appendChild(sizeField('Zahlen-Symbolgröße im Diagramm (px)', numInput(state.markerBadgeSize, v => { state.markerBadgeSize = Math.max(2, v); rerender(); }, 0.5)));

  c.appendChild(el('div', { class: 'style-subsection-title' }, ['Liste unterhalb des Diagramms']));
  c.appendChild(field('Anordnung', selectInput(state.markerListLayout, [
    { value: 'block', label: 'Jede Markierung in neuer Zeile' },
    { value: 'inline', label: 'Fortlaufend, ohne festen Zeilenumbruch' }
  ], v => { state.markerListLayout = v; rerender(); })));
  c.appendChild(sizeField('Textgröße — Zahlen-Symbol & Überschrift skalieren automatisch mit (pt)', numInput(state.markerListFontSize, v => { state.markerListFontSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(gapField('Abstand Ereignis-/Zustands-Bereich ↔ Markierungsliste (px)', numInput(state.markerListGapTop, v => { state.markerListGapTop = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(gapField('Abstand Markierungsliste ↔ Fußzeile (px)', numInput(state.markerListGapBottom, v => { state.markerListGapBottom = Math.max(0, v); rerender(); }, 1)));
  c.appendChild(field('Linke Ausrichtung (Markierungsliste & Fußzeile linksbündig)', selectInput(state.leftEdgeMode, [
    { value: 'pad', label: 'Seitenrand' },
    { value: 'yAxisLabel', label: 'Bündig mit Y-Achsen-Beschriftung' },
    { value: 'yAxis', label: 'Bündig mit der Y-Achse' }
  ], v => { state.leftEdgeMode = v; rerender(); })));

  /* ===================== FUSSNOTE ===================== */
  c.appendChild(bigSectionTitle('Fußnote', state.showFooterSection, v => { state.showFooterSection = v; refreshAll(); }));
  c.appendChild(sizeField('Textgröße (pt)', numInput(state.footerSize, v => { state.footerSize = Math.max(4, v); rerender(); }, 0.5)));
  c.appendChild(colorField('Farbe', colorInput(state.footerColor, v => { state.footerColor = v; rerender(); })));
  c.appendChild(field('Ausrichtung', selectInput(state.footerAlign, [
    { value: 'left', label: 'Linksbündig' }, { value: 'center', label: 'Zentriert' }, { value: 'right', label: 'Rechtsbündig' }
  ], v => { state.footerAlign = v; rerender(); })));
  c.appendChild(el('div', { class: 'hint' }, ['Bei „Linksbündig“ gilt dieselbe linke Ausrichtung wie bei der Markierungsliste (siehe oben unter „Markierungen“).']));
  return c;
}

/* ---------- Abschnitte (Segmente) ---------- */
function sortSegmentsAndRefresh() {
  state.segments.sort((a, b) => Number(a.start) - Number(b.start));
  refreshAll();
}
function sortPointsAndRefresh(sr) {
  sr.points.sort((a, b) => Number(a.day) - Number(b.day));
  refreshAll();
}

function renderSegmentsPanel() {
  const c = el('div', { class: 'panel-body' });
  c.appendChild(el('div', { class: 'hint' }, ['Die X-Achse wird aus diesen Abschnitten zusammengesetzt. Deaktivierte Abschnitte werden komplett ausgeblendet (z.B. um den Verlauf während einer Präsentation schrittweise aufzubauen). Start- und Endtag jedes aktiven Abschnitts werden immer als Markierung angezeigt. Abschnitte werden nach dem Starttag automatisch sortiert; sie dürfen sich nicht überlappen oder berühren (ein Abschnitt darf nicht an dem Tag beginnen, an dem ein anderer endet).']));

  const conflictIds = findSegmentConflicts(state);
  if (conflictIds.size) {
    c.appendChild(el('div', { class: 'warning' }, ['Überlappende oder ungültige Abschnitte (rot markiert) werden im Diagramm nicht dargestellt, bis der Konflikt behoben ist.']));
  }

  state.segments.forEach((sg, i) => {
    const card = el('div', { class: 'card' + (sg.enabled === false ? ' inactive-card' : '') + (conflictIds.has(sg.id) ? ' conflict' : '') });
    const head = el('div', { class: 'card-head' });
    head.appendChild(toggleSwitch(sg.enabled !== false, v => { sg.enabled = v; refreshAll(); }, 'Abschnitt ein-/ausblenden'));
    head.appendChild(el('span', { class: 'card-title' }, [`Abschnitt ${i + 1}: ${sg.label || ''}`]));
    if (state.segments.length > 1) {
      head.appendChild(el('button', { class: 'icon-btn danger', title: 'Entfernen', onclick: () => { state.segments.splice(i, 1); refreshAll(); } }, ['✕']));
    }
    card.appendChild(head);
    card.appendChild(field('Bezeichnung', textInput(sg.label, v => { sg.label = v; rerender(); })));
    const r1 = el('div', { class: 'row' });
    r1.appendChild(field('Von Tag', numInputCommit(sg.start, v => { sg.start = v; rerender(); }, sortSegmentsAndRefresh), { narrow: true }));
    r1.appendChild(field('Bis Tag', numInputCommit(sg.end, v => { sg.end = v; rerender(); }, sortSegmentsAndRefresh), { narrow: true }));
    card.appendChild(r1);
    const r2 = el('div', { class: 'row' });
    r2.appendChild(field('Tick-Schritt (Tage)', numInput(sg.tickStep, v => { sg.tickStep = v; rerender(); }), { narrow: true }));
    r2.appendChild(field('Breite (relativ)', numInput(sg.weight, v => { sg.weight = v; rerender(); }), { narrow: true }));
    card.appendChild(r2);
    if (conflictIds.has(sg.id)) {
      card.appendChild(el('div', { class: 'warning small' }, ['Überlappt mit einem anderen Abschnitt oder Ende liegt nicht nach Start.']));
    }
    c.appendChild(card);
  });
  c.appendChild(el('button', {
    class: 'btn', onclick: () => {
      // Neuer Abschnitt bekommt automatisch eine Luecke NACH dem chronologisch
      // letzten bestehenden Abschnitt, damit er garantiert ueberlappungsfrei
      // hinzugefuegt wird; danach wird die Liste sortiert.
      const maxEnd = state.segments.reduce((m, sg) => Math.max(m, Number(sg.end) || 0), 0);
      const start = state.segments.length ? maxEnd + 1 : 0;
      state.segments.push({ id: uid('seg'), label: 'Neuer Abschnitt', start, end: start + 14, weight: 1, tickStep: 7, enabled: true });
      sortSegmentsAndRefresh();
    }
  }, ['+ Abschnitt hinzufügen']));
  return c;
}

/* ---------- Kurven (Serien) ---------- */
function renderSeriesPanel() {
  const c = el('div', { class: 'panel-body' });
  c.appendChild(el('div', { class: 'hint' }, ['Tipp: Ein Punkt auf einer Kurve im Diagramm lässt sich anklicken, um seinen Wert oberhalb des Punkts ein-/auszublenden.']));
  state.series.forEach((sr, i) => {
    const card = el('div', { class: 'card' + (sr.visible === false ? ' inactive-card' : '') });
    const head = el('div', { class: 'card-head' });
    head.appendChild(toggleSwitch(sr.visible !== false, v => { sr.visible = v; refreshAll(); }, 'Kurve ein-/ausblenden'));
    head.appendChild(el('span', { class: 'card-title' }, [sr.name || `Kurve ${i + 1}`]));
    head.appendChild(el('button', { class: 'icon-btn danger', title: 'Entfernen', onclick: () => { state.series.splice(i, 1); refreshAll(); } }, ['✕']));
    card.appendChild(head);

    card.appendChild(field('Name', textInput(sr.name, v => { sr.name = v; rerender(); })));
    const r1 = el('div', { class: 'row' });
    r1.appendChild(field('Farbe', colorInput(sr.color, v => { sr.color = v; rerender(); }), { narrow: true }));
    r1.appendChild(field('Liniendicke', numInput(sr.width, v => { sr.width = v; rerender(); }, 0.25), { narrow: true }));
    card.appendChild(r1);

    const r2 = el('div', { class: 'row' });
    r2.appendChild(field('Symbol', selectInput(sr.markerType, SYMBOLS.map(sy => ({ value: sy, label: SYMBOL_LABELS[sy] })), v => { sr.markerType = v; rerender(); }), { narrow: true }));
    r2.appendChild(field('Symbolgröße', numInput(sr.markerSize, v => { sr.markerSize = v; rerender(); }, 0.5), { narrow: true }));
    card.appendChild(r2);

    const r3 = el('div', { class: 'row' });
    r3.appendChild(field('Glatte Kurve', checkInput(sr.smooth, v => { sr.smooth = v; rerender(); }), { narrow: true }));
    r3.appendChild(field('Achse', selectInput(sr.axis || 'y1', [{ value: 'y1', label: 'Primär' }, { value: 'y2', label: 'Sekundär' }], v => { sr.axis = v; refreshAll(); }), { narrow: true }));
    card.appendChild(r3);

    card.appendChild(el('div', { class: 'section-title small' }, ['Messwerte (Tag / Wert)']));
    const table = el('div', { class: 'point-table' });
    sr.points.forEach((p, pi) => {
      const row = el('div', { class: 'point-row' });
      row.appendChild(numInputCommit(p.day, v => { p.day = v; rerender(); }, () => sortPointsAndRefresh(sr)));
      row.appendChild(numInput(p.value, v => { p.value = v; rerender(); }, 0.01));
      row.appendChild(el('button', { class: 'icon-btn danger small', onclick: () => { sr.points.splice(pi, 1); refreshAll(); } }, ['✕']));
      table.appendChild(row);
    });
    card.appendChild(table);
    const btnRow = el('div', { class: 'row' });
    btnRow.appendChild(el('button', {
      class: 'btn secondary small', onclick: () => {
        const lastDay = sr.points.length ? sr.points[sr.points.length - 1].day : 0;
        sr.points.push({ day: lastDay + 1, value: sr.points.length ? sr.points[sr.points.length - 1].value : 0 });
        refreshAll();
      }
    }, ['+ Messwert']));
    btnRow.appendChild(el('button', {
      class: 'btn secondary small', onclick: (e) => { const r = e.target.getBoundingClientRect(); openPastePopover(sr, r.left, r.top); }
    }, ['Aus Excel einfügen']));
    card.appendChild(btnRow);
    c.appendChild(card);
  });
  c.appendChild(el('button', {
    class: 'btn', onclick: () => {
      state.series.push({ id: uid('ser'), name: 'Neue Kurve', color: nextColor(state.series.length), width: 4.5, smooth: true, axis: 'y1', markerType: 'circle', markerSize: 14, points: [{ day: 0, value: 0 }, { day: 10, value: 1 }] });
      refreshAll();
    }
  }, ['+ Kurve hinzufügen']));
  return c;
}

/* ---------- Aus Excel einfügen (2 Spalten: Tag, Wert) ---------- */
function parsePastedPoints(text) {
  const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length);
  if (!lines.length) return { error: 'Keine Daten erkannt.' };
  const points = [];
  for (let i = 0; i < lines.length; i++) {
    let parts = lines[i].split('\t');
    if (parts.length !== 2) parts = lines[i].split(/\s{2,}|;/).filter(p => p.length);
    if (parts.length !== 2) parts = lines[i].split(/\s+/).filter(p => p.length);
    if (parts.length !== 2) return { error: `Zeile ${i + 1} hat nicht genau 2 Spalten: "${lines[i]}"` };
    const dayRaw = parts[0].trim().replace(',', '.');
    const valRaw = parts[1].trim().replace(',', '.');
    const day = parseFloat(dayRaw);
    const value = parseFloat(valRaw);
    if (!isFinite(day) || !/^-?\d+(\.\d+)?$/.test(dayRaw)) return { error: `Zeile ${i + 1}, erste Spalte ist keine Zahl (Tag): "${parts[0]}"` };
    if (!isFinite(value) || !/^-?\d+(\.\d+)?$/.test(valRaw)) return { error: `Zeile ${i + 1}, zweite Spalte ist keine Zahl (Wert): "${parts[1]}"` };
    points.push({ day, value });
  }
  points.sort((a, b) => a.day - b.day);
  return { points };
}
function openPastePopover(sr, ax, ay) {
  const box = el('div', { class: 'popover-body wide' });
  box.appendChild(el('div', { class: 'popover-title' }, [`Messwerte einfügen: ${sr.name}`]));
  box.appendChild(el('div', { class: 'hint small' }, [
    'Zwei Spalten aus Excel kopieren (Tag, Wert) und hier einfügen. Ersetzt alle vorhandenen Messwerte dieser Kurve.'
  ]));
  const ta = el('textarea', { class: 'paste-area', rows: '8', placeholder: '0\t2.1\n3\t0.4\n7\t0.1' });
  box.appendChild(ta);
  const errBox = el('div', { class: 'warning small', style: 'display:none;' });
  box.appendChild(errBox);
  const btnRow = el('div', { class: 'row' });
  btnRow.appendChild(el('button', {
    class: 'btn small', onclick: () => {
      const result = parsePastedPoints(ta.value);
      if (result.error) {
        errBox.textContent = result.error;
        errBox.style.display = '';
        return;
      }
      sr.points = result.points;
      closePopover();
      refreshAll();
    }
  }, ['Übernehmen']));
  btnRow.appendChild(el('button', { class: 'btn ghost small', onclick: closePopover }, ['Abbrechen']));
  box.appendChild(btnRow);
  openPopover(ax, ay, box);
  ta.focus();
}

/* ---------- Ereignisse & Zustände (sortierbare, einklappbare Zeilenliste) ---------- */
function moveRow(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= state.rows.length) return;
  const tmp = state.rows[i]; state.rows[i] = state.rows[j]; state.rows[j] = tmp;
  refreshAll();
}

function renderRowsPanel() {
  const c = el('div', { class: 'panel-body' });
  c.appendChild(el('div', { class: 'hint' }, [
    'Jede Zeile erscheint im Diagramm in genau dieser Reihenfolge – mit ▲▼ verschieben. Klick auf den Titel klappt die Details auf/zu, damit die Liste beim Sortieren übersichtlich bleibt. Symbole/Zustände lassen sich außerdem direkt im Diagramm anklicken (Hervorhebung, Schraffur, Markierungslinien).'
  ]));

  const addBar = el('div', { class: 'chipbar' });
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => { const r = { id: uid('hd'), kind: 'header', text: 'Neue Überschrift' }; state.rows.push(r); expandedRows.add(r.id); refreshAll(); }
  }, ['+ Überschrift']));
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const r = { id: uid('et'), kind: 'event', name: 'Neuer Typ', symbol: 'circle', color: nextColor(state.rows.length), textSize: 13, symbolSize: 13, items: [{ id: uid('evi'), day: 1, label: 'Neues Ereignis', hl: false, hlColor: '', hlLabel: '' }] };
      state.rows.push(r); expandedRows.add(r.id); refreshAll();
    }
  }, ['+ Ereignis-Zeile']));
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const r = { id: uid('st'), kind: 'state', name: 'Neue Zeile', items: [{ id: uid('sti'), color: nextColor(0), start: 0, end: 7, label: 'Neuer Zustand', hatch: false, marks: [] }] };
      state.rows.push(r); expandedRows.add(r.id); refreshAll();
    }
  }, ['+ Zustands-Zeile']));
  c.appendChild(addBar);

  state.rows.forEach((r, i) => {
    const isOpen = expandedRows.has(r.id);
    const card = el('div', { class: 'card row-card ' + r.kind + (isOpen ? '' : ' collapsed') + (r.kind !== 'header' && r.visible === false ? ' inactive-card' : '') });
    const head = el('div', { class: 'card-head' });
    const moveWrap = el('div', { class: 'move-btns' });
    moveWrap.appendChild(el('button', { class: 'icon-btn', title: 'Nach oben', disabled: i === 0 ? 'disabled' : undefined, onclick: () => moveRow(i, -1) }, ['▲']));
    moveWrap.appendChild(el('button', { class: 'icon-btn', title: 'Nach unten', disabled: i === state.rows.length - 1 ? 'disabled' : undefined, onclick: () => moveRow(i, 1) }, ['▼']));
    head.appendChild(moveWrap);
    if (r.kind !== 'header') {
      head.appendChild(toggleSwitch(r.visible !== false, v => { r.visible = v; refreshAll(); }, 'Zeile ein-/ausblenden'));
    }
    const kindLabel = r.kind === 'header' ? 'Überschrift' : r.kind === 'event' ? 'Ereignis' : 'Zustand';
    const titleBtn = el('button', {
      class: 'card-title-btn', onclick: () => { if (isOpen) expandedRows.delete(r.id); else expandedRows.add(r.id); refreshAll(); }
    }, [el('span', { class: 'expand-arrow' }, [isOpen ? '▾' : '▸']), ` ${kindLabel}: ${r.text || r.name || ''}`]);
    head.appendChild(titleBtn);
    head.appendChild(el('button', { class: 'icon-btn danger', title: 'Entfernen', onclick: () => { state.rows.splice(i, 1); expandedRows.delete(r.id); refreshAll(); } }, ['✕']));
    card.appendChild(head);

    if (isOpen) {
      if (r.kind === 'header') {
        card.appendChild(field('Überschrift-Text (fett + unterstrichen)', textInput(r.text, v => { r.text = v; rerender(); })));
        card.appendChild(el('div', { class: 'hint small' }, ['Textgröße für alle Überschriften wird zentral unter „Allgemein“ eingestellt.']));
      } else if (r.kind === 'event') {
        card.appendChild(field('Zeilen-Bezeichnung', textInput(r.name, v => { r.name = v; rerender(); })));
        const rr1 = el('div', { class: 'row' });
        rr1.appendChild(field('Symbol', selectInput(r.symbol, SYMBOLS.map(sy => ({ value: sy, label: SYMBOL_LABELS[sy] })), v => { r.symbol = v; rerender(); }), { narrow: true }));
        rr1.appendChild(field('Farbe', colorInput(r.color, v => { r.color = v; rerender(); }), { narrow: true }));
        card.appendChild(rr1);
        const rr2 = el('div', { class: 'row' });
        rr2.appendChild(field('Symbolgröße (px)', numInput(r.symbolSize, v => { r.symbolSize = v; rerender(); }, 0.5), { narrow: true }));
        rr2.appendChild(field('Textgröße Einträge (pt)', numInput(r.textSize, v => { r.textSize = v; rerender(); }, 0.5), { narrow: true }));
        card.appendChild(rr2);

        card.appendChild(el('div', { class: 'section-title small' }, ['Einträge (Tag / Beschriftung)']));
        card.appendChild(el('div', { class: 'hint small' }, ['Hochstellung: „10^{-4}“ → 10⁻⁴. Zeilenumbruch: Enter im Beschriftungsfeld.']));
        const table = el('div', { class: 'point-table events' });
        r.items.forEach((it, ii) => {
          const row = el('div', { class: 'point-row events' });
          row.appendChild(numInput(it.day, v => { it.day = v; rerender(); }));
          row.appendChild(textAreaInput(it.label, v => { it.label = v; rerender(); }));
          row.appendChild(el('button', { class: 'icon-btn danger small', onclick: () => { r.items.splice(ii, 1); refreshAll(); } }, ['✕']));
          table.appendChild(row);
        });
        card.appendChild(table);
        card.appendChild(el('div', { class: 'hint small' }, ['Tipp: Klick auf ein Ereignis im Diagramm hebt es farblich hervor und zieht eine Markierungslinie zum oberen Rand.']));
        card.appendChild(el('button', {
          class: 'btn secondary small', onclick: () => {
            const lastDay = r.items.length ? r.items[r.items.length - 1].day : 0;
            r.items.push({ id: uid('evi'), day: lastDay + 1, label: 'Neues Ereignis', hl: false, hlColor: r.color, hlLabel: '' });
            refreshAll();
          }
        }, ['+ Eintrag']));
      } else {
        card.appendChild(field('Zeilen-Bezeichnung', textInput(r.name, v => { r.name = v; rerender(); })));

        card.appendChild(el('div', { class: 'section-title small' }, ['Einträge (Farbe / Von / Bis / Beschriftung)']));
        card.appendChild(el('div', { class: 'hint small' }, ['Hochstellung: „10^{-4}“ → 10⁻⁴. Zeilenumbruch: Enter im Beschriftungsfeld.']));
        const table = el('div', { class: 'point-table states' });
        r.items.forEach((it, ii) => {
          const row = el('div', { class: 'point-row states', 'data-item-id': it.id });
          row.appendChild(colorInput(it.color, v => { it.color = v; rerender(); }));
          row.appendChild(numInput(it.start, v => { it.start = v; rerender(); }));
          row.appendChild(numInput(it.end, v => { it.end = v; rerender(); }));
          row.appendChild(textAreaInput(it.label, v => { it.label = v; rerender(); }));
          row.appendChild(el('button', { class: 'icon-btn danger small', onclick: () => { r.items.splice(ii, 1); refreshAll(); } }, ['✕']));
          table.appendChild(row);
        });
        card.appendChild(table);
        card.appendChild(el('div', { class: 'hint small' }, ['Tipp: Klick auf eine Box im Diagramm öffnet ein Menü für Schraffur und Markierungslinien.']));
        card.appendChild(el('button', {
          class: 'btn secondary small', onclick: () => {
            const lastEnd = r.items.length ? r.items[r.items.length - 1].end : 0;
            r.items.push({ id: uid('sti'), color: nextColor(r.items.length), start: lastEnd, end: lastEnd + 7, label: 'Neuer Zustand', hatch: false, marks: [] });
            refreshAll();
          }
        }, ['+ Eintrag']));
      }
    }
    c.appendChild(card);
  });
  return c;
}

// Warnt beim Schliessen/Verlassen der Seite, solange es ungespeicherte/
// unexportierte Aenderungen gibt (Browser zeigt dafuer einen eigenen,
// nicht anpassbaren Hinweistext an - das ist Standardverhalten aller Browser).
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadInput').addEventListener('change', (e) => {
    if (e.target.files[0]) loadJSONFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('styleLoadInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importStylePresetFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btnFileMenu').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openFileMenu(r.left + r.width / 2, r.bottom);
  });
  document.getElementById('btnSaveProject').addEventListener('click', () => {
    saveProjectSmart().catch(e => { console.error(e); alert('Speichern fehlgeschlagen: ' + e.message); });
  });
  document.getElementById('btnSaveProject').textContent = saveButtonLabel();
  document.getElementById('canvasWidth').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v > 0) { state.canvasWidth = v; rerender(); }
  });
  document.getElementById('canvasWidth').value = state.canvasWidth;
  refreshAll();
  markClean(); // Ausgangszustand (leer bzw. gerade erst geladen) gilt nicht als "ungespeicherte Aenderung"
});
