/* ============================================================
   UI-Bindung: Formulare <-> state
   Prinzip gegen Fokus-Verlust: Wert-Felder loesen NUR rerender()
   aus (SVG neu zeichnen). Nur Hinzufuegen/Entfernen/Verschieben
   von Eintraegen loest refreshAll() aus (kompletter Neuaufbau).
   ============================================================ */
// Meldungsfenster in der gewaehlten Oberflaechensprache
(function () {
  const nativeAlert = window.alert ? window.alert.bind(window) : () => {};
  const nativeConfirm = window.confirm ? window.confirm.bind(window) : () => true;
  window.alert = (m) => nativeAlert(tr(String(m)));
  window.confirm = (m) => nativeConfirm(tr(String(m)));
})();
let activeTab = 'general';
let expandedSeries = new Set(); // welche Kurvenkarten im Tab "Kurven" aufgeklappt sind
let expandedRows = new Set(); // welche Zeilenkarten im Tab "Ereignisse & Zustände" aufgeklappt sind

function elx(tag, attrs, children) {
  const e = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(k => {
    if (attrs[k] == null || attrs[k] === false) return;
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'title' || k === 'placeholder' || k === 'aria-label') e.setAttribute(k, tr(String(attrs[k])));
    else e.setAttribute(k, attrs[k]);
  });
  (children || []).forEach(c => { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(tr(c)) : typeof c === 'number' ? document.createTextNode(c) : c); });
  return e;
}
const el = elx;

function field(labelText, inputEl, opts) {
  opts = opts || {};
  // Einfache Steuerelemente (Regler, Auswahl, Zahl, Farbe, Schalter) stehen in Tabs
  // „Label links – Steuerelement rechts“ in einer Zeile; Textfelder und Mehrfach-Zeilen
  // (narrow) bleiben gestapelt.
  const tn = inputEl && inputEl.tagName;
  const it = inputEl && inputEl.type;
  const inline = !opts.stack && (tn === 'SELECT' || (tn === 'INPUT' && ['number', 'color', 'checkbox', 'range', 'date'].includes(it)) || (inputEl && inputEl.classList && inputEl.classList.contains('slider-wrap')));
  const wrap = el('label', { class: 'field' + (opts.narrow ? ' narrow' : '') + (inline ? ' inline' : '') });
  const labelRow = el('span', { class: 'field-label-row' });
  if (opts.icon) labelRow.appendChild(el('span', { class: 'field-icon field-icon-' + opts.icon }, [opts.icon === 'gap' ? '↔' : opts.icon === 'size' ? 'Aa' : opts.icon === 'line' ? '—' : opts.icon === 'color' ? '🎨' : '']));
  labelRow.appendChild(el('span', { class: 'field-label' }, [labelText]));
  wrap.appendChild(labelRow);
  wrap.appendChild(inputEl);
  return wrap;
}
// Kurzformen fuer die haeufigsten Feldtypen im Stil-Tab: macht auf einen Blick
// erkennbar, ob ein Feld einen Abstand (↔), eine Schriftgröße (Aa) oder eine Linienstärke (—) einstellt.
function gapField(labelText, inputEl, opts) { return field(labelText, inputEl, Object.assign({ icon: 'gap' }, opts)); }
function sizeField(labelText, inputEl, opts) { return field(labelText, inputEl, Object.assign({ icon: 'size' }, opts)); }
function lineField(labelText, inputEl, opts) { return field(labelText, inputEl, Object.assign({ icon: 'line' }, opts)); }
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
// Schieberegler mit Wertanzeige (inkl. Einheit) statt Zahlenfeld. Liegt ein gespeicherter Wert
// außerhalb der üblichen Grenzen, wird der Bereich so erweitert, dass der Wert korrekt angezeigt wird.
// opts.unit: Einheit hinter dem Wert; opts.scale: Anzeigefaktor (z. B. 100 für Prozent).
function sliderInput(value, min, max, step, onChange, opts) {
  opts = opts || {};
  const scale = opts.scale || 1;
  let v = Number(value);
  if (!isFinite(v)) v = min;
  const lo = Math.min(min, v), hi = Math.max(max, v);
  const show = x => Number(x * scale).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + (opts.unit ? '\u00A0' + opts.unit : '');
  const wrap = el('div', { class: 'slider-wrap' });
  const input = el('input', { type: 'range', min: lo, max: hi, step: step, value: v });
  const out = el('span', { class: 'slider-val' }, [show(v)]);
  input.addEventListener('input', () => { const x = parseFloat(input.value); out.textContent = show(x); onChange(x); });
  wrap.appendChild(input);
  wrap.appendChild(out);
  return wrap;
}
function textInput(value, onChange) {
  const i = el('input', { type: 'text', value: value == null ? '' : value });
  i.addEventListener('input', () => onChange(i.value));
  return i;
}
// Mehrzeiliges Eingabefeld fuer Ereignis-/Zustandsbeschriftungen: Enter erzeugt
// einen echten Zeilenumbruch; "^{...}" wird beim Rendern hochgestellt (z.B. "10^{-4}").
function textAreaInput(value, onChange) {
  const i = el('textarea', { rows: '2', class: 'label-textarea', title: 'Hochstellung: „10^{-4}“ → 10⁻⁴ · Zeilenumbruch: Enter' });
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
  if (activeTab === 'cycles') {
    // Im Tab "Therapiezyklen" zeigt die Vorschau die gewählte Zyklusvorlage als anklickbare Tabelle.
    ensureSelectedCycle();
    host.innerHTML = renderCycleEditorSVG(state, selectedCycleId);
    renderWarnings();
    wireItemClicks();
    return;
  }
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
  box.appendChild(el('div', { class: 'welcome-title' }, ['Willkommen bei ClinicalTimeline']));
  box.appendChild(el('div', { class: 'welcome-text' }, [
    'Erstelle klinische Verlaufsdiagramme mit Kurven, Ereignissen und Zuständen auf einer abschnittsweise skalierten Zeitachse. Leg direkt los oder starte mit einem Beispiel.'
  ]));
  const btnRow = el('div', { class: 'welcome-actions' });
  btnRow.appendChild(el('button', {
    class: 'btn', onclick: () => { activeTab = 'segments'; state.segments.push({ id: uid('seg'), label: tr('Abschnitt') + ' 1', start: 0, end: 30, weight: 1, tickStep: 5, enabled: true }); refreshAll(); }
  }, ['Eigenes Diagramm beginnen']));
  btnRow.appendChild(el('button', {
    class: 'btn secondary', onclick: () => { state = exampleState(); refreshAll(); }
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
  if (segConflicts.size) msgs.push(`${segConflicts.size} Abschnitte überlappen sich oder sind ungültig – bitte in „X: Abschnitte“ prüfen (rot markiert). Sie werden im Diagramm nicht dargestellt.`);
  if (conflicts.size) msgs.push(`${conflicts.size} Zustands-Einträge überlappen sich innerhalb derselben Zeile – bitte in „Ereignisse & Zustände“ prüfen (rot markiert).`);
  if (L.refLinesSkipped) msgs.push(`${L.refLinesSkipped} Y-Achsen-Markierung(en) liegen außerhalb des Wertebereichs oder gehören zur sekundären Achse, die derzeit nicht angezeigt wird – bitte in „Y: vertikale Linien“ prüfen.`);
  if (L.hiddenCount) msgs.push(`${L.hiddenCount} Werte/Ereignisse/Zustände liegen außerhalb der sichtbaren (aktiven) Abschnitte und wurden ausgeblendet.`);
  msgs.forEach(m => box.appendChild(el('div', { class: 'warning' }, [m])));
}
function updateConflictUI() {
  const idSet = findStateConflicts(state);
  document.querySelectorAll('[data-item-id]').forEach(node => {
    node.classList.toggle('conflict', idSet.has(node.getAttribute('data-item-id')));
  });
}
// Statische Texte in index.html (data-i18n / data-i18n-title) in die gewaehlte Sprache setzen.
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(n => {
    if (n.dataset.de == null) n.dataset.de = n.textContent;
    n.textContent = tr(n.dataset.de);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(n => {
    if (n.dataset.deTitle == null) n.dataset.deTitle = n.getAttribute('title') || '';
    n.setAttribute('title', tr(n.dataset.deTitle));
  });
  const sv = document.getElementById('btnSaveProject');
  if (sv) sv.textContent = saveButtonLabel();
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = UI_LANG;
  document.documentElement.lang = UI_LANG;
  document.title = 'ClinicalTimeline ' + tr('von Felix Klingler');
}
function refreshAll() {
  renderTabs();
  rerender();
  syncHeaderInputs();
}
function syncHeaderInputs() {
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
        const r = node.getBoundingClientRect();
        onPointClick(seriesId, day, r.left + r.width / 2, r.top);
        return;
      }
      if (kind === 'cycle-day') {
        const r = node.getBoundingClientRect();
        onCycleDayClick(node.getAttribute('data-row-id'), node.getAttribute('data-item-id'), Number(node.getAttribute('data-day')), r.left + r.width / 2, r.top);
        return;
      }
      if (kind === 'cycle-cell') {
        toggleCycleCell(node.getAttribute('data-tpl'), node.getAttribute('data-row'), Number(node.getAttribute('data-day')));
        return;
      }
      const rowId = node.getAttribute('data-row-id');
      const itemId = node.getAttribute('data-item-id');
      const rect = node.getBoundingClientRect();
      const anchorX = rect.left + rect.width / 2;
      const anchorY = rect.top;
      if (kind === 'event') onEventClick(rowId, itemId, anchorX, anchorY);
      else if (kind === 'value') onValueClick(rowId, itemId, anchorX, anchorY);
      else if (kind === 'state') onStateClick(rowId, itemId, anchorX, anchorY);
      else if (kind === 'cycle') onCycleClick(rowId, itemId, anchorX, anchorY);
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
// Platziert ein Popover über (sonst unter) dem Ankerpunkt und hält es im sichtbaren Fensterbereich.
function placePopover(pop, anchorX, anchorY) {
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = clamp(anchorX - w / 2, 8, window.innerWidth - w - 8);
  let top = anchorY - h - 12;
  if (top < 8) top = anchorY + 20;
  if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}
function openPopover(anchorX, anchorY, contentEl, opts) {
  closePopover();
  const pop = el('div', { class: 'popover' + (opts && opts.extraClass ? ' ' + opts.extraClass : '') });
  pop.appendChild(contentEl);
  document.body.appendChild(pop);
  placePopover(pop, anchorX, anchorY);
  currentPopover = pop;
  setTimeout(() => document.addEventListener('mousedown', popoverOutsideHandler, true), 0);
}

/* ----- Messpunkt-Menü (Wert anzeigen + Markierungsvorlage) ----- */
function onPointClick(seriesId, day, ax, ay) {
  const sr = state.series.find(x => x.id === seriesId);
  const pt = sr && sr.points.find(p => Number(p.day) === day);
  if (!pt) return;
  const key = seriesId + '@' + day;
  // Erneuter Klick auf denselben Punkt schliesst das Menü.
  if (currentPopover && currentPopover.dataset.pointKey === key) { closePopover(); return; }
  openPointPopover(sr, pt, ax, ay);
  if (currentPopover) currentPopover.dataset.pointKey = key;
}
let collapsedPopoverGroups = new Set(); // Einklapp-Status der Gruppen im Punkt-Menü (nur Ansicht)
function openPointPopover(sr, pt, ax, ay) {
  const box = el('div', { class: 'popover-body' });
  box.appendChild(el('div', { class: 'popover-title' }, [`${sr.name || tr('Kurve')} – Tag ${pt.day}: ${formatPointValue(Number(pt.value))}`]));

  const valueRow = el('label', { class: 'popover-check' });
  valueRow.appendChild(checkInput(pt.showValue, v => { pt.showValue = v; rerender(); }));
  valueRow.appendChild(el('span', {}, ['Wert anzeigen']));
  box.appendChild(valueRow);

  box.appendChild(el('div', { class: 'popover-subtitle' }, ['Markierungsdarstellung']));
  const styles = state.markStyles || [];
  const list = el('div', { class: 'ms-choice-list' });
  const defaultOption = { id: '', name: 'Standard (Kurvenfarbe)', fill: sr.color, border: null, borderWidth: 0, label: '' };
  const makeItem = ms => {
    const isSel = (pt.styleId || '') === ms.id;
    const item = el('label', { class: 'ms-choice' + (isSel ? ' selected' : '') });
    const radio = el('input', { type: 'radio', name: 'ms-choice' });
    radio.checked = isSel;
    radio.addEventListener('change', () => {
      if (ms.id) pt.styleId = ms.id; else delete pt.styleId;
      list.querySelectorAll('.ms-choice').forEach(n => n.classList.remove('selected'));
      item.classList.add('selected');
      rerender();
      if (activeTab === 'markstyles') renderTabs(); // Verwendungszähler aktualisieren
    });
    item.appendChild(radio);
    item.appendChild(markStyleSwatch(ms, 16));
    const txt = el('span', { class: 'ms-choice-text' }, [ms.name || 'Vorlage']);
    if (ms.label) txt.appendChild(el('span', { class: 'ms-choice-label' }, [ms.label.replace(/\r\n|\r|\n/g, ' ')]));
    item.appendChild(txt);
    return item;
  };
  // Überschriften (Basisvorlagen / Eigene / Dateiname) nur, wenn es mehrere Quellen gibt.
  // Der Einklapp-Status liegt außerhalb des Menüs (collapsedPopoverGroups) und bleibt daher
  // erhalten, wenn nacheinander verschiedene Punkte angeklickt werden (jedes Öffnen baut ein neues Menü).
  const groups = markStyleGroups();
  const multi = groups.length > 1;
  const renderList = () => {
    list.innerHTML = '';
    list.appendChild(makeItem(defaultOption));
    groups.forEach(g => {
      const open = !multi || !collapsedPopoverGroups.has(g.key);
      if (multi) {
        const selected = g.items.find(m => m.id === (pt.styleId || ''));
        list.appendChild(el('button', {
          class: 'ms-group-head', title: open ? 'Einklappen' : 'Aufklappen',
          onclick: () => {
            if (open) collapsedPopoverGroups.add(g.key); else collapsedPopoverGroups.delete(g.key);
            renderList();
            if (currentPopover) placePopover(currentPopover, ax, ay);
          }
        }, [
          el('span', { class: 'expand-arrow' }, [open ? '▾' : '▸']),
          el('span', { class: 'ms-group-name' }, [g.kind === 'file' ? '📄 ' + g.label : g.label]),
          (!open && selected) ? markStyleSwatch(selected, 12) : null, // eingeklappt, aber hier ist die aktuelle Auswahl
          el('span', { class: 'ms-usage' }, [String(g.items.length)])
        ]));
      }
      if (open) g.items.forEach(ms => list.appendChild(makeItem(ms)));
    });
  };
  renderList();
  box.appendChild(list);
  if (!styles.length) {
    box.appendChild(el('div', { class: 'hint small' }, ['Noch keine Vorlagen angelegt.']));
  }
  box.appendChild(el('button', {
    class: 'btn ghost small', onclick: () => { closePopover(); activeTab = 'markstyles'; refreshAll(); }
  }, ['Vorlagen bearbeiten …']));
  openPopover(ax, ay, box);
}
// Kleines Vorschau-Quadrat in den Farben einer Vorlage (auch für die Liste im Diagramm).
function markStyleSwatch(ms, size) {
  const bw = ms.border ? Math.min(Math.max(0, Number(ms.borderWidth) || 0), size * 0.3) : 0;
  const inner = size - bw;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'ms-swatch');
  const rect = document.createElementNS(svgNs, 'rect');
  rect.setAttribute('x', bw / 2); rect.setAttribute('y', bw / 2);
  rect.setAttribute('width', inner); rect.setAttribute('height', inner);
  rect.setAttribute('fill', ms.fill || '#FFFFFF');
  if (bw > 0) { rect.setAttribute('stroke', ms.border); rect.setAttribute('stroke-width', bw); }
  svg.appendChild(rect);
  return svg;
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
  box.appendChild(field('Symbolfarbe', colorInput(it.hlColor, v => { it.hlColor = v; rerender(); })));
  box.appendChild(field('Beschriftung', textAreaInput(it.hlLabel, v => { it.hlLabel = v; rerender(); })));
  box.appendChild(el('button', {
    class: 'btn ghost small', onclick: () => { it.hl = false; closePopover(); rerender(); }
  }, ['Hervorhebung entfernen']));
  openPopover(ax, ay, box);
}

/* ----- Werte-Zeile: Klick auf einen Wert = Markierung (analog Ereignis) ----- */
function onValueClick(rowId, pointId, ax, ay) {
  const row = findRow(rowId);
  const p = row && (row.points || []).find(x => x.id === pointId);
  if (!p) return;
  if (!p.hl) {
    p.hl = true;
    if (!p.hlColor) p.hlColor = '#C1461F';
    rerender();
    openValuePopover(row, p, ax, ay);
  } else {
    p.hl = false;
    closePopover();
    rerender();
  }
}
function openValuePopover(row, p, ax, ay) {
  const box = el('div', { class: 'popover-body' });
  const valTxt = formatRowValue(p.value, row.decimals) + (row.unit ? ' ' + row.unit : '');
  box.appendChild(el('div', { class: 'popover-title' }, [`${row.name || tr('Werte')} – Tag ${p.day}: ${valTxt}`]));
  box.appendChild(field('Farbe', colorInput(p.hlColor, v => { p.hlColor = v; rerender(); })));
  box.appendChild(field('Beschriftung', textAreaInput(p.hlLabel, v => { p.hlLabel = v; rerender(); })));
  box.appendChild(el('button', {
    class: 'btn ghost small', onclick: () => { p.hl = false; closePopover(); rerender(); }
  }, ['Markierung entfernen']));
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
  box.appendChild(field('Schraffiert', checkInput(it.hatch, v => { it.hatch = v; rerender(); })));

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
      labelInput.placeholder = tr('Beschriftung');
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

  box.appendChild(el('button', { class: 'btn ghost small', onclick: closePopover }, ['Schließen']));
  openPopover(ax, ay, box);
  if (currentPopover) currentPopover.dataset.itemId = it.id;
}

/* ---------- Tabs ---------- */
const TABS = [
  { id: 'general', label: 'Allgemein' },
  { id: 'segments', label: 'X: Abschnitte' },
  { id: 'series', label: 'Kurven' },
  { id: 'rows', label: 'Ereignisse & Zustände' },
  { id: 'cycles', label: 'Therapiezyklen' },
  { id: 'style', label: 'Stil' },
  { id: 'markstyles', label: 'Werte: Markierungsdarstellung' },
  { id: 'yref', label: 'Y: vertikale Linien' },
  { id: 'expert', label: 'Experteneinstellungen' }
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
  'segmentLabelGap', 'xAxisLabelGap', 'axisToRowsGap', 'bottomAxisGap', 'showCycleSection', 'cycleTableSize', 'cycleTableGap', 'showBottomAxis', 'rowKindGap', 'stateRowGap', 'stateLabelSize', 'stateEdgeMode', 'stateArrowGap',
  'markerLineWidth', 'markerBadgeSize', 'markerListLayout', 'markerListFontSize', 'markerListGapTop', 'markerListGapBottom',
  'footerSize', 'footerColor', 'footerAlign', 'footerGapNoMarkers', 'leftEdgeMode',
  'alignAxisMin', 'watermarkEnabled'
];
function exportStylePreset() {
  const styleObj = {};
  STYLE_FIELDS.forEach(k => { styleObj[k] = state[k]; });
  // Datenreihen-Farben separat mitgeben (an den Kurven-Namen gebunden, siehe Import-Logik).
  styleObj.seriesColors = state.series.map(sr => ({ name: sr.name, color: sr.color }));
  // Markierungsvorlagen gehören zum wiederverwendbaren Erscheinungsbild.
  styleObj.markStyles = (state.markStyles || []).map(ms => ({ name: ms.name, fill: ms.fill, border: ms.border, borderWidth: ms.borderWidth, label: ms.label }));
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
      // Markierungsvorlagen per Namensabgleich übernehmen: gleichnamige Vorlagen
      // werden aktualisiert (Verweise der Messpunkte bleiben erhalten), neue ergänzt.
      if (Array.isArray(data.markStyles)) {
        state.markStyles = state.markStyles || [];
        data.markStyles.forEach(entry => {
          if (!entry) return;
          const nm = String(entry.name || '').trim().toLowerCase();
          let target = nm ? state.markStyles.find(ms => String(ms.name || '').trim().toLowerCase() === nm) : null;
          if (!target) { target = newMarkStyle(state.markStyles.length); state.markStyles.push(target); }
          ['name', 'fill', 'border', 'borderWidth', 'label'].forEach(k => { if (entry[k] !== undefined) target[k] = entry[k]; });
        });
      }
      refreshAll();
    } catch (e) { alert('Stil-Datei konnte nicht gelesen werden: ' + e.message); }
  };
  reader.readAsText(file);
}

function renderTabs() {
  const nav = document.getElementById('tabnav');
  const prevScroll = nav.scrollLeft;
  nav.innerHTML = '';
  let activeBtn = null;
  TABS.forEach(t => {
    const b = el('button', {
      class: 'tabbtn' + (activeTab === t.id ? ' active' : ''),
      onclick: () => { activeTab = t.id; refreshAll(); }
    }, [t.label]);
    if (activeTab === t.id) activeBtn = b;
    nav.appendChild(b);
  });
  // Scroll-Position der (jetzt einzeiligen) Leiste erhalten; aktiven Reiter sichtbar halten.
  nav.scrollLeft = prevScroll;
  if (activeBtn) {
    const l = activeBtn.offsetLeft, r = l + activeBtn.offsetWidth;
    if (l < nav.scrollLeft) nav.scrollLeft = Math.max(0, l - 8);
    else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = r - nav.clientWidth + 8;
  }
  const panel = document.getElementById('tabpanel');
  panel.innerHTML = '';
  panel.appendChild(
    activeTab === 'general' ? renderGeneralPanel() :
    activeTab === 'style' ? renderStylePanel() :
    activeTab === 'expert' ? renderExpertPanel() :
    activeTab === 'cycles' ? renderCyclesPanel() :
    activeTab === 'segments' ? renderSegmentsPanel() :
    activeTab === 'series' ? renderSeriesPanel() :
    activeTab === 'markstyles' ? renderMarkStylesPanel() :
    activeTab === 'yref' ? renderYRefPanel() :
    renderRowsPanel()
  );
}

/* ---------- Allgemein (Inhalte: Titel/Texte/Daten-Ein-Aus, nicht Stil) ---------- */
function renderGeneralPanel() {
  const c = el('div', { class: 'panel-body' });
  c.appendChild(field('Diagrammtitel', textInput(state.title, v => { state.title = v; rerender(); })));
  c.appendChild(field('X-Achsen-Beschriftung', textInput(state.xAxisLabel, v => { state.xAxisLabel = v; rerender(); })));
  c.appendChild(field('Y-Achsen-Beschriftung primär', textInput(state.yAxisLabel, v => { state.yAxisLabel = v; rerender(); })));
  c.appendChild(field('Y-Achsen-Beschriftung sekundär', textInput(state.y2AxisLabel, v => { state.y2AxisLabel = v; rerender(); })));

  c.appendChild(el('div', { class: 'divider' }));
  c.appendChild(el('div', { class: 'section-title' }, ['Datei']));
  c.appendChild(field('Dateiname', textInput(state.fileBaseName, v => { state.fileBaseName = v; markDirty(); })));

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
  const footerInput = textInput(state.footerText, v => { state.footerText = v; rerender(); });
  footerInput.placeholder = tr('Leer = keine Fußzeile');
  c.appendChild(field('Text', footerInput));

  c.appendChild(el('div', { class: 'divider' }));
  c.appendChild(el('button', { class: 'btn ghost', onclick: () => { if (confirm('Alle Daten zurücksetzen?')) { state = exampleState(); currentProjectHandle = null; currentProjectHandleName = null; refreshAll(); } } }, ['Zurücksetzen auf Beispieldaten']));
  return c;
}

// Erkennt, ob der Browser tatsaechlich "in die Datei zurueckschreiben" kann
// (File System Access API, aktuell nur Chrome/Edge). Ohne Unterstuetzung
// (Safari/Firefox) kann technisch immer nur eine neue Datei heruntergeladen
// werden - der Knopf zeigt dann konsequent "Exportieren" statt "Speichern".
const SUPPORTS_FILE_SAVE = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
function saveButtonLabel() { return tr(SUPPORTS_FILE_SAVE ? '💾 Speichern' : '💾 Exportieren'); }

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
  btn.textContent = tr('✓ Gespeichert');
  setTimeout(() => { btn.textContent = old; }, 1200);
}

// Gebuendeltes Menü fuer alles rund um Oeffnen/Speichern/Exportieren.
function menuItem(icon, label, onclick) {
  return el('button', { class: 'file-menu-item', onclick: () => { closePopover(); onclick(); } }, [
    el('span', { class: 'icon' }, [icon]), el('span', {}, [label])
  ]);
}
// Diagrammvorlagen (Menue oben rechts): ersetzt das aktuelle Diagramm durch die gewaehlte Vorlage
function loadChartTemplate(tpl) {
  if (!isDiagramEmpty() && hasUnsavedChanges && !confirm('Das aktuelle Diagramm wird durch die Vorlage ersetzt. Ungespeicherte Änderungen gehen verloren. Fortfahren?')) return;
  state = tpl.build();
  currentProjectHandle = null;
  currentProjectHandleName = null;
  activeTab = 'general';
  refreshAll();
  markClean();
}
function openTemplateMenu(ax, ay) {
  const box = el('div', { class: 'file-menu' });
  box.appendChild(el('div', { class: 'file-menu-label' }, ['Diagrammvorlagen']));
  CHART_TEMPLATES.forEach(t => {
    box.appendChild(menuItem(t.id === 'therapy' ? '💊' : '📈', t.name, () => loadChartTemplate(t)));
  });
  // Weitere Projekte: Name + Link aus menu-links.js (Datei ist optional); Links oeffnen in einem neuen Tab
  const links = (typeof EXTRA_MENU_LINKS !== 'undefined' && Array.isArray(EXTRA_MENU_LINKS) ? EXTRA_MENU_LINKS : [])
    .filter(l => l && typeof l.name === 'string' && l.name.trim() && typeof l.url === 'string' && /^https?:\/\//i.test(l.url.trim()));
  if (links.length) {
    box.appendChild(el('div', { class: 'file-menu-sep' }));
    box.appendChild(el('div', { class: 'file-menu-label' }, ['Weitere Projekte']));
    links.forEach(l => {
      box.appendChild(el('a', {
        class: 'file-menu-item', href: l.url.trim(), target: '_blank', rel: 'noopener noreferrer',
        onclick: () => { closePopover(); }
      }, [el('span', { class: 'icon' }, ['🔗']), el('span', {}, [l.name.trim()])]));
    });
  }
  openPopover(ax, ay, box, { extraClass: 'menu' });
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

/* ---------- Stil + Experteneinstellungen ----------
   Beide Tabs werden aus DERSELBEN Struktur aufgebaut (buildStyleTab). Jede Einstellung hat
   eine feste interne Nummer (nur zur Zuordnung, nicht sichtbar); EXPERT_NUMS legt fest, welche
   im Tab „Experteneinstellungen“ statt im Tab „Stil“ erscheinen. */
const EXPERT_NUMS = new Set([75, 10, 11, 12, 13, 14, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 35, 45, 51, 56, 62]);

function renderStylePanel() { return buildStyleTab(false); }
function renderExpertPanel() { return buildStyleTab(true); }

function buildStyleTab(expert) {
  const c = el('div', { class: 'panel-body' });
  let pendingSec = null, pendingSub = null;
  const show = n => EXPERT_NUMS.has(n) === expert;
  const flush = () => {
    if (pendingSec) { c.appendChild(pendingSec()); pendingSec = null; }
    if (pendingSub) { c.appendChild(pendingSub()); pendingSub = null; }
  };
  // Einzelne Einstellung n (nur im passenden Tab); builder(n) liefert das Element
  const S = (n, build) => { if (!show(n)) return; flush(); const node = build(n); if (node) c.appendChild(node); };
  const Sub = (text) => { pendingSub = () => el('div', { class: 'style-subsection-title' }, [text]); };
  const Big = (text, toggleNum, value, onToggle) => {
    pendingSub = null;
    if (!expert) { pendingSec = null; c.appendChild(bigSectionTitle(text, value, onToggle, toggleNum)); }
    else pendingSec = () => el('div', { class: 'style-section-title' }, [text]);
  };
  const rowOf = (...nodes) => { const r = el('div', { class: 'row' }); nodes.forEach(x => r.appendChild(x)); return r; };

  if (!expert) {
    const ioRow = el('div', { class: 'row toolbar-gap' });
    ioRow.appendChild(el('button', { class: 'btn secondary', onclick: exportStylePreset }, ['Stil exportieren']));
    ioRow.appendChild(el('button', { class: 'btn secondary', onclick: () => document.getElementById('styleLoadInput').click() }, ['Stil importieren']));
    c.appendChild(ioRow);
  }
  const legendRow = el('div', { class: 'field-legend' });
  legendRow.appendChild(el('span', { class: 'field-icon field-icon-gap' }, ['↔']));
  legendRow.appendChild(el('span', {}, ['Abstand']));
  legendRow.appendChild(el('span', { class: 'field-icon field-icon-size' }, ['Aa']));
  legendRow.appendChild(el('span', {}, ['Schriftgröße']));
  legendRow.appendChild(el('span', { class: 'field-icon field-icon-line' }, ['—']));
  legendRow.appendChild(el('span', {}, ['Linienstärke']));
  c.appendChild(legendRow);

  Sub('Export');
  S(75, () => {
    const inp = numInput(state.canvasWidth, v => { if (v > 0) { state.canvasWidth = Math.round(v); rerender(); } }, 50);
    inp.title = tr('Legt nur die Pixel-Auflösung für SVG/PNG-Export fest (Vorschaugröße). Das Layout/die Proportionen ändern sich dadurch nicht.');
    return field('Export-Auflösung, Breite (px)', inp);
  });

  Sub('Dateinamen-Präfixe');
  S(10, n => field('SVG & PNG', textInput(state.exportPrefixImage, v => { state.exportPrefixImage = v; }), { narrow: true }));
  S(11, n => field('PowerPoint', textInput(state.exportPrefixPptx, v => { state.exportPrefixPptx = v; }), { narrow: true }));
  S(12, n => field('Projektdatei', textInput(state.exportPrefixData, v => { state.exportPrefixData = v; }), { narrow: true }));
  S(13, n => field('Stil-Datei', textInput(state.exportPrefixStyle, v => { state.exportPrefixStyle = v; }), { narrow: true }));

  Sub('Wasserzeichen');
  S(14, n => field('Icon in Exporten', checkInput(state.watermarkEnabled, v => { state.watermarkEnabled = v; rerender(); })));

  /* ===================== DIAGRAMM ===================== */
  Big('Diagramm', 15, state.showChartSection, v => { state.showChartSection = v; refreshAll(); });

  Sub('Titel & Anzeige');
  S(16, n => field('Titel-Ausrichtung', selectInput(state.titleAlign, [
    { value: 'center', label: 'Zentriert' }, { value: 'left', label: 'Linksbündig (Y-Achse)' }
  ], v => { state.titleAlign = v; rerender(); })));
  S(17, () => rowOf(
    field('Legende', checkInput(state.showLegend, v => { state.showLegend = v; rerender(); }), { narrow: true }),
    field('Gitterlinien', checkInput(state.showGrid, v => { state.showGrid = v; rerender(); }), { narrow: true })
  ));

  Sub('Schrift');
  S(19, n => field('Schriftart', selectInput(state.fontFamily, FONT_CHOICES.map(f => ({ value: f, label: f })), v => { state.fontFamily = v; rerender(); })));
  S(20, () => sizeField('Skalierung', sliderInput(state.fontScale, 0.6, 3.0, 0.05, v => { state.fontScale = v; rerender(); }, { unit: '%', scale: 100 })));

  Sub('Seitenlayout');
  S(21, n => gapField('Plot-Rand', sliderInput(state.plotPadding, 0, 150, 1, v => { state.plotPadding = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(22, n => gapField('Zwischen Abschnitten', sliderInput(state.segmentGap, 0, 200, 1, v => { state.segmentGap = Math.max(0, v); rerender(); }, { unit: 'px' })));

  Sub('Achsen');
  S(23, n => lineField('Achsenlinie', sliderInput(state.axisLineWidth, 0.5, 10, 0.1, v => { state.axisLineWidth = Math.max(0.2, v); rerender(); }, { unit: 'px' })));
  S(24, n => colorField('Farbe', colorInput(state.axisColor, v => { state.axisColor = v; rerender(); })));
  S(25, n => sizeField('X-Achsen-Markierungen', sliderInput(state.xTickLabelSize, 8, 40, 0.5, v => { state.xTickLabelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(26, n => sizeField('Y-Achsen-Markierungen', sliderInput(state.yTickLabelSize, 8, 40, 0.5, v => { state.yTickLabelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(27, n => sizeField('Abschnittsbeschriftung', sliderInput(state.segmentLabelSize, 8, 40, 0.5, v => { state.segmentLabelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(28, n => sizeField('Achsenbeschriftung', sliderInput(state.axisLabelSize, 8, 40, 0.5, v => { state.axisLabelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(29, n => field('Achsenbeschriftung-Stil', selectInput(state.axisLabelStyle, AXIS_STYLE_CHOICES, v => { state.axisLabelStyle = v; rerender(); })));
  S(30, n => field('Abschnittsbeschriftung anzeigen', checkInput(state.showSegmentLabels, v => { state.showSegmentLabels = v; rerender(); })));
  S(31, n => gapField('Achse ↔ Abschnittsbeschriftung', sliderInput(state.segmentLabelGap, 0, 60, 1, v => { state.segmentLabelGap = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(32, n => gapField('Abschnittsbeschriftung ↔ X-Achsenbeschriftung', sliderInput(state.xAxisLabelGap, 0, 60, 1, v => { state.xAxisLabelGap = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(33, n => gapField('X-Achse ↔ Zeilen', sliderInput(state.axisToRowsGap, 0, 100, 1, v => { state.axisToRowsGap = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(34, n => field('Zweite X-Achse unten', checkInput(state.showBottomAxis, v => { state.showBottomAxis = v; rerender(); })));
  S(70, () => gapField('Zeilen ↔ zweite X-Achse', sliderInput(state.bottomAxisGap, 0, 100, 1, v => { state.bottomAxisGap = Math.max(0, v); rerender(); }, { unit: 'px' })));

  Sub('Y-Achsen-Ausrichtung');
  S(35, n => field('Nulllinien angleichen', checkInput(state.alignAxisMin, v => { state.alignAxisMin = v; rerender(); })));

  Sub('Y-Achse primär – Wertebereich');
  S(36, n => field('Modus', selectInput(state.y1Mode, [{ value: 'auto', label: 'Automatisch' }, { value: 'manual', label: 'Manuell' }], v => { state.y1Mode = v; refreshAll(); })));
  if (state.y1Mode === 'manual') {
    S(37, n => field('Minimum', numInput(state.y1Min, v => { state.y1Min = v; rerender(); })));
    S(38, n => field('Maximum', numInput(state.y1Max, v => { state.y1Max = v; rerender(); })));
  }

  Sub('Y-Achse sekundär – Wertebereich');
  S(39, n => field('Modus', selectInput(state.y2Mode, [{ value: 'auto', label: 'Automatisch' }, { value: 'manual', label: 'Manuell' }], v => { state.y2Mode = v; refreshAll(); })));
  if (state.y2Mode === 'manual') {
    S(40, n => field('Minimum', numInput(state.y2Min, v => { state.y2Min = v; rerender(); })));
    S(41, n => field('Maximum', numInput(state.y2Max, v => { state.y2Max = v; rerender(); })));
  }

  /* ============== EREIGNISSE UND ZUSTÄNDE ============== */
  Big('Ereignisse und Zustände', 42, state.showRowsSection, v => { state.showRowsSection = v; refreshAll(); });

  Sub('Zeilen-Bezeichnungen (Ort, CT, …)');
  S(43, n => sizeField('Größe', sliderInput(state.rowLabelSize, 8, 40, 0.5, v => { state.rowLabelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(44, n => field('Stil', selectInput(state.rowLabelStyle, AXIS_STYLE_CHOICES, v => { state.rowLabelStyle = v; rerender(); })));
  S(45, n => gapField('Zur Linie/Box', sliderInput(state.rowLabelGap, 0, 60, 1, v => { state.rowLabelGap = Math.max(0, v); rerender(); }, { unit: 'px' })));

  Sub('Gruppen-Überschriften');
  S(46, n => sizeField('Größe', sliderInput(state.groupHeaderSize, 8, 40, 0.5, v => { state.groupHeaderSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(47, () => rowOf(
    field('Fett', checkInput(state.groupHeaderBold, v => { state.groupHeaderBold = v; rerender(); }), { narrow: true }),
    field('Unterstrichen', checkInput(state.groupHeaderUnderline, v => { state.groupHeaderUnderline = v; rerender(); }), { narrow: true })
  ));
  S(49, () => rowOf(
    gapField('Davor', sliderInput(state.headerGapBefore, 0, 60, 1, v => { state.headerGapBefore = Math.max(0, v); rerender(); }, { unit: 'px' }), { narrow: true }),
    gapField('Danach', sliderInput(state.headerGapAfter, 0, 60, 1, v => { state.headerGapAfter = Math.max(0, v); rerender(); }, { unit: 'px' }), { narrow: true })
  ));

  Sub('Ereignis-Zeilen');
  S(51, n => gapField('Ereignisse ↔ Zustände', sliderInput(state.rowKindGap, 0, 80, 1, v => { state.rowKindGap = Math.max(0, v); rerender(); }, { unit: 'px' })));

  Sub('Gitter im Zeilenbereich');
  S(52, n => field('Vertikale Linien', checkInput(state.rowGridVertical, v => { state.rowGridVertical = v; rerender(); })));
  S(53, n => field('Horizontale Linien', selectInput(state.rowGridHorizontal, [
    { value: 'off', label: 'Aus' },
    { value: 'events', label: 'Nur Ereignisse' },
    { value: 'states', label: 'Nur Zustände' },
    { value: 'values', label: 'Nur Werte' },
    { value: 'all', label: 'Alle Typen an' }
  ], v => { state.rowGridHorizontal = v; rerender(); })));

  Sub('Zustands-Boxen');
  S(54, n => sizeField('Beschriftung', sliderInput(state.stateLabelSize, 8, 40, 0.5, v => { state.stateLabelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(55, n => gapField('Zwischen Zustandszeilen', sliderInput(state.stateRowGap, 0, 60, 1, v => { state.stateRowGap = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(71, () => field('Box über Abschnitt hinaus', selectInput(state.stateEdgeMode || 'none', [
    { value: 'none', label: 'Keine Darstellung' },
    { value: 'triangles', label: 'Zwei Dreiecke innen' },
    { value: 'trianglesOut', label: 'Zwei Dreiecke außen' },
    { value: 'whisker', label: 'Whisker (echtes Ende)' },
    { value: 'arrow', label: 'Pfeil mit Strich (echtes Ende)' }
  ], v => { state.stateEdgeMode = v; rerender(); })));
  S(56, n => gapField('Pfeil ↔ Box bei Lücke', sliderInput(state.stateArrowGap, 0, 30, 1, v => { state.stateArrowGap = Math.max(0, v); rerender(); }, { unit: 'px' })));

  Big('Zyklustabellen', 74, state.showCycleSection !== false, v => { state.showCycleSection = v; refreshAll(); });
  S(72, () => sizeField('Tabellentext', sliderInput(state.cycleTableSize, 8, 24, 0.5, v => { state.cycleTableSize = Math.max(6, v); rerender(); }, { unit: 'pt' })));
  S(73, () => gapField('Abstand zwischen Tabellen', sliderInput(state.cycleTableGap, 0, 80, 1, v => { state.cycleTableGap = Math.max(0, v); rerender(); }, { unit: 'px' })));

  /* ===================== MARKIERUNGEN ===================== */
  Big('Markierungen', 57, state.showMarkersSection, v => { state.showMarkersSection = v; refreshAll(); });

  Sub('Linien im Diagramm');
  S(58, n => lineField('Gestrichelte Linien', sliderInput(state.markerLineWidth, 0.5, 8, 0.1, v => { state.markerLineWidth = Math.max(0.2, v); rerender(); }, { unit: 'px' })));
  S(59, n => sizeField('Zahlen-Symbol', sliderInput(state.markerBadgeSize, 6, 40, 0.5, v => { state.markerBadgeSize = Math.max(2, v); rerender(); }, { unit: 'px' })));

  Sub('Liste unterhalb des Diagramms');
  S(60, n => field('Anordnung', selectInput(state.markerListLayout, [
    { value: 'block', label: 'Jede Markierung in neuer Zeile' },
    { value: 'inline', label: 'Fortlaufend, ohne festen Zeilenumbruch' }
  ], v => { state.markerListLayout = v; rerender(); })));
  S(61, n => sizeField('Listentext', sliderInput(state.markerListFontSize, 8, 40, 0.5, v => { state.markerListFontSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(62, n => gapField('Zeilen ↔ Markierungsliste', sliderInput(state.markerListGapTop, 0, 100, 1, v => { state.markerListGapTop = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(63, n => gapField('Markierungsliste ↔ Fußzeile', sliderInput(state.markerListGapBottom, 0, 100, 1, v => { state.markerListGapBottom = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(69, () => gapField('Zeilen ↔ Fußzeile (ohne Markierungsliste)', sliderInput(state.footerGapNoMarkers, 0, 100, 1, v => { state.footerGapNoMarkers = Math.max(0, v); rerender(); }, { unit: 'px' })));
  S(64, n => field('Linke Ausrichtung', selectInput(state.leftEdgeMode, [
    { value: 'pad', label: 'Seitenrand' },
    { value: 'yAxisLabel', label: 'Bündig mit Y-Achsen-Beschriftung' },
    { value: 'yAxis', label: 'Bündig mit der Y-Achse' }
  ], v => { state.leftEdgeMode = v; rerender(); })));

  /* ===================== FUSSNOTE ===================== */
  Big('Fußnote', 65, state.showFooterSection, v => { state.showFooterSection = v; refreshAll(); });
  S(66, n => sizeField('Größe', sliderInput(state.footerSize, 6, 30, 0.5, v => { state.footerSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
  S(67, n => colorField('Farbe', colorInput(state.footerColor, v => { state.footerColor = v; rerender(); })));
  S(68, n => field('Ausrichtung', selectInput(state.footerAlign, [
    { value: 'left', label: 'Linksbündig' }, { value: 'center', label: 'Zentriert' }, { value: 'right', label: 'Rechtsbündig' }
  ], v => { state.footerAlign = v; rerender(); })));
  return c;
}

/* ---------- Markierungsdarstellung und -beschriftung (Vorlagen für Messpunkte) ---------- */
function countMarkStyleUsage(id) {
  let n = 0;
  state.series.forEach(sr => sr.points.forEach(p => { if (p.styleId === id) n++; }));
  return n;
}

/* --- Vorlagen-Dateien (JSON) ---
   Export: alle Vorlagen des Diagramms. Import: FÜGT Vorlagen hinzu (bestehende bleiben),
   nachdem geprüft wurde, dass die Datei wirklich Markierungsvorlagen enthält. Die Vorlagen
   selbst werden – wie bisher – mit dem Diagramm in der Projektdatei gespeichert; der Dateiname
   der Importdatei dient nur als Gruppen-Überschrift (Feld source). */
const MARKSTYLE_FILE_FORMAT = 'timeline-markstyles';
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function normHex(v) {
  let h = String(v).trim();
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h.toUpperCase();
}
function validateMarkStyleFile(data) {
  let list = null;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    if (data.format !== undefined && data.format !== MARKSTYLE_FILE_FORMAT) {
      return { error: `Die Datei hat ein anderes Format („${String(data.format).slice(0, 40)}“) und enthält keine Markierungsvorlagen.` };
    }
    if (Array.isArray(data.markStyles)) list = data.markStyles;
  }
  if (!list) return { error: 'Die Datei enthält keine Liste mit Markierungsvorlagen („markStyles“).' };
  if (!list.length) return { error: 'Die Datei enthält keine einzige Markierungsvorlage.' };
  const styles = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { error: `Eintrag ${i + 1} ist keine Markierungsvorlage.` };
    // Erkennungsmerkmal einer Markierungsvorlage: eine gültige Füllfarbe. Alles andere ist optional
    // und wird bei Bedarf durch Standardwerte ersetzt.
    if (typeof e.fill !== 'string' || !HEX_COLOR_RE.test(e.fill.trim())) return { error: `Eintrag ${i + 1}: „fill“ (Füllfarbe) fehlt oder ist keine gültige Hex-Farbe.` };
    const bw = parseFloat(e.borderWidth);
    styles.push({
      name: (e.name != null ? String(e.name) : '').trim() || `Vorlage ${i + 1}`,
      fill: normHex(e.fill),
      border: (typeof e.border === 'string' && HEX_COLOR_RE.test(e.border.trim())) ? normHex(e.border) : '#1E2A24',
      borderWidth: isFinite(bw) && bw >= 0 ? bw : 2.5,
      label: e.label != null ? String(e.label) : ''
    });
  }
  return { styles };
}
let collapsedMarkGroups = new Set(); // eingeklappte Vorlagen-Gruppen (nur Ansicht, wird nicht gespeichert)
let markStyleNote = ''; // einmalige Rückmeldung nach einem Import (wird beim nächsten Rendern angezeigt)
function exportMarkStyles() {
  const list = state.markStyles || [];
  if (!list.length) { alert('Es gibt keine Markierungsvorlagen zum Exportieren.'); return; }
  const obj = {
    format: MARKSTYLE_FILE_FORMAT, version: 1,
    markStyles: list.map(ms => ({ name: ms.name, fill: ms.fill, border: ms.border, borderWidth: ms.borderWidth, label: ms.label || '' }))
  };
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const name = `TIMELINE-MARKIERUNGSVORLAGEN # ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} # ${p(d.getHours())}-${p(d.getMinutes())}.json`;
  saveBlobSmart(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), name, 'Markierungsvorlagen (JSON)', { 'application/json': ['.json'] });
}
function importMarkStyleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch (e) { alert(`„${file.name}“ konnte nicht importiert werden: Die Datei ist kein gültiges JSON.`); return; }
    const res = validateMarkStyleFile(data);
    if (res.error) { alert(`„${file.name}“ konnte nicht importiert werden:\n${res.error}`); return; }
    state.markStyles = state.markStyles || [];
    // Alle Vorlagen der Datei werden als neue Vorlagen unter der Überschrift des Dateinamens angelegt.
    res.styles.forEach(e => state.markStyles.push(Object.assign({ id: markStyleUid(), source: file.name }, e)));
    collapsedMarkGroups.delete('file:' + file.name);
    markStyleNote = `„${file.name}“: ${res.styles.length} ${res.styles.length === 1 ? 'Vorlage' : 'Vorlagen'} importiert.`;
    activeTab = 'markstyles';
    refreshAll();
  };
  reader.readAsText(file);
}
function markStyleGroups() {
  const groups = [];
  (state.markStyles || []).forEach(ms => {
    const kind = ms.base ? 'base' : ms.source ? 'file' : 'own';
    const key = kind === 'file' ? 'file:' + ms.source : kind;
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, kind, label: kind === 'base' ? 'Basisvorlagen' : kind === 'own' ? 'Eigene Vorlagen' : ms.source, items: [] }; groups.push(g); }
    g.items.push(ms);
  });
  const order = { base: 0, own: 1, file: 2 };
  return groups.map((g, i) => ({ g, i })).sort((a, b) => order[a.g.kind] - order[b.g.kind] || a.i - b.i).map(x => x.g);
}
function missingBaseMarkStyles() {
  return BASE_MARK_STYLE_DEFS.filter(d => !(state.markStyles || []).some(ms => ms.base && (ms.baseKey ? ms.baseKey === d.key : ms.name === d.name)));
}

function buildMarkStyleCard(ms) {
  const used = countMarkStyleUsage(ms.id);
  const idx = () => state.markStyles.indexOf(ms);
  const card = el('div', { class: 'card' });
  const head = el('div', { class: 'card-head' });
  const preview = el('span', { class: 'ms-card-preview' });
  const refreshPreview = () => { preview.innerHTML = ''; preview.appendChild(markStyleSwatch(ms, 22)); };
  refreshPreview();
  head.appendChild(preview);
  const title = el('span', { class: 'card-title' }, [ms.name || `Vorlage ${idx() + 1}`]);
  head.appendChild(title);
  head.appendChild(el('span', { class: 'ms-usage' }, [used === 1 ? '1 Punkt' : `${used} Punkte`]));
  head.appendChild(el('button', {
    class: 'icon-btn danger', title: 'Vorlage löschen', onclick: () => {
      if (used && !confirm(`Diese Vorlage wird an ${used} Messpunkt(en) verwendet. Trotzdem löschen? Die Punkte erhalten wieder die Standarddarstellung.`)) return;
      state.series.forEach(sr => sr.points.forEach(p => { if (p.styleId === ms.id) delete p.styleId; }));
      state.markStyles.splice(idx(), 1);
      refreshAll();
    }
  }, ['✕']));
  card.appendChild(head);

  card.appendChild(field('Name', textInput(ms.name, v => { ms.name = v; title.textContent = v || tr(`Vorlage ${idx() + 1}`); markDirty(); })));
  const r1 = el('div', { class: 'row' });
  r1.appendChild(colorField('Füllung', colorInput(ms.fill, v => { ms.fill = v; refreshPreview(); rerender(); }), { narrow: true }));
  r1.appendChild(colorField('Rand', colorInput(ms.border, v => { ms.border = v; refreshPreview(); rerender(); }), { narrow: true }));
  r1.appendChild(lineField('Dicke', sliderInput(ms.borderWidth, 0, 8, 0.5, v => { ms.borderWidth = Math.max(0, v); refreshPreview(); rerender(); }, { unit: 'px' }), { narrow: true }));
  card.appendChild(r1);
  const lbl = textAreaInput(ms.label, v => { ms.label = v; rerender(); });
  lbl.placeholder = tr('Leer = kein Eintrag unter „Markierungen“');
  card.appendChild(field('Beschriftung', lbl));
  return card;
}

function renderMarkStylesPanel() {
  const c = el('div', { class: 'panel-body' });
  state.markStyles = state.markStyles || [];
  const ioRow = el('div', { class: 'row toolbar-gap' });
  ioRow.appendChild(el('button', { class: 'btn secondary small', onclick: exportMarkStyles }, ['Vorlagen exportieren']));
  ioRow.appendChild(el('button', { class: 'btn secondary small', onclick: () => document.getElementById('markStyleLoadInput').click() }, ['Vorlagen importieren']));
  c.appendChild(ioRow);
  const missing = missingBaseMarkStyles();
  if (missing.length) {
    c.appendChild(el('button', {
      class: 'btn ghost small toolbar-gap', title: 'Fehlende Basisvorlagen: ' + missing.map(d => d.name).join(', '), onclick: () => {
        missing.forEach(d => state.markStyles.push(Object.assign({ id: markStyleUid(), base: true, baseKey: d.key, labelInit: true }, d)));
        refreshAll();
      }
    }, [`Basisvorlagen ergänzen (${missing.length} fehlend)`]));
  }
  if (markStyleNote) { c.appendChild(el('div', { class: 'hint small' }, [markStyleNote])); markStyleNote = ''; }

  const groups = markStyleGroups();
  if (groups.length > 1) {
    const allCollapsed = groups.every(g => collapsedMarkGroups.has(g.key));
    c.appendChild(el('button', {
      class: 'btn ghost small', onclick: () => {
        if (allCollapsed) collapsedMarkGroups.clear(); else groups.forEach(g => collapsedMarkGroups.add(g.key));
        refreshAll();
      }
    }, [allCollapsed ? 'Alle aufklappen' : 'Alle einklappen']));
  }
  groups.forEach(g => {
    const open = !collapsedMarkGroups.has(g.key);
    c.appendChild(el('button', {
      class: 'group-toggle', title: open ? 'Einklappen' : 'Aufklappen',
      onclick: () => { if (open) collapsedMarkGroups.add(g.key); else collapsedMarkGroups.delete(g.key); refreshAll(); }
    }, [
      el('span', { class: 'expand-arrow' }, [open ? '▾' : '▸']),
      el('span', { class: 'group-toggle-label' }, [g.kind === 'file' ? '📄 ' + g.label : g.label]),
      el('span', { class: 'ms-usage' }, [String(g.items.length)])
    ]));
    if (open) g.items.forEach(ms => c.appendChild(buildMarkStyleCard(ms)));
  });

  c.appendChild(el('button', {
    class: 'btn', onclick: () => { state.markStyles.push(newMarkStyle(state.markStyles.length)); collapsedMarkGroups.delete('own'); refreshAll(); }
  }, ['+ Vorlage hinzufügen']));
  return c;
}

/* ---------- Markierungen Y-Achse (waagerechte Referenzlinien) ---------- */
function renderYRefPanel() {
  const c = el('div', { class: 'panel-body' });
  state.yRefLines = state.yRefLines || [];
  state.yRefLines.forEach((l, i) => {
    const card = el('div', { class: 'card' + (l.enabled === false ? ' inactive-card' : '') });
    const head = el('div', { class: 'card-head' });
    head.appendChild(toggleSwitch(l.enabled !== false, v => { l.enabled = v; refreshAll(); }, 'Linie ein-/ausblenden'));
    const title = el('span', { class: 'card-title' }, [yRefTitle(l, i)]);
    head.appendChild(title);
    head.appendChild(el('button', { class: 'icon-btn danger', title: 'Entfernen', onclick: () => { state.yRefLines.splice(i, 1); refreshAll(); } }, ['✕']));
    card.appendChild(head);
    const upd = () => { title.textContent = tr(yRefTitle(l, i)); };

    const r1 = el('div', { class: 'row' });
    r1.appendChild(field('Y-Wert', numInput(l.value, v => { l.value = v; upd(); rerender(); }), { narrow: true }));
    r1.appendChild(field('Achse', selectInput(l.axis || 'y1', [{ value: 'y1', label: 'Primär (links)' }, { value: 'y2', label: 'Sekundär (rechts)' }], v => { l.axis = v; upd(); rerender(); }), { narrow: true }));
    card.appendChild(r1);
    const r2 = el('div', { class: 'row' });
    r2.appendChild(colorField('Farbe', colorInput(l.color, v => { l.color = v; rerender(); }), { narrow: true }));
    r2.appendChild(field('Linienart', selectInput(l.style || 'solid', REF_LINE_STYLES, v => { l.style = v; rerender(); }), { narrow: true }));
    r2.appendChild(lineField('Dicke', sliderInput(l.width, 0.5, 8, 0.5, v => { l.width = Math.max(0.3, v); rerender(); }, { unit: 'px' }), { narrow: true }));
    card.appendChild(r2);
    const lbl = textAreaInput(l.label, v => { l.label = v; upd(); rerender(); });
    lbl.placeholder = tr('Leer = keine Beschriftung');
    lbl.rows = 1;
    card.appendChild(field('Beschriftung', lbl));
    card.appendChild(sizeField('Text', sliderInput(l.labelSize, 8, 30, 0.5, v => { l.labelSize = Math.max(4, v); rerender(); }, { unit: 'pt' })));
    c.appendChild(card);
  });
  c.appendChild(el('button', {
    class: 'btn', onclick: () => { state.yRefLines.push(newRefLine(state.yRefLines.length)); refreshAll(); }
  }, ['+ Linie hinzufügen']));
  return c;
}
function yRefTitle(l, i) {
  const ax = (l.axis || 'y1') === 'y2' ? 'sek.' : 'prim.';
  const txt = String(l.label || '').split(/\r\n|\r|\n/)[0];
  return `Linie ${i + 1}: y = ${l.value} (${ax})${txt ? ' – ' + txt : ''}`;
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

  // Master-Option: ordnet einem Tag der X-Achse (Standard: Beginn der X-Achse) ein Datum zu.
  // Ist sie gesetzt, werden die Startdaten der Zyklen daraus berechnet (eigene Eingabe ausgegraut).
  c.appendChild(el('div', { class: 'section-title' }, ['Datum der X-Achse']));
  c.appendChild(field('Tag auf der X-Achse', numInput(masterDayOf(state), v => { state.masterDay = Math.round(v); refreshAll(); }, 1)));
  c.appendChild(field('Datum an diesem Tag', dateInput(state.masterDate || '', v => { state.masterDate = v; refreshAll(); })));
  if (masterDateTs(state) != null) {
    c.appendChild(el('button', { class: 'btn ghost small', onclick: () => { state.masterDate = ''; refreshAll(); } }, ['Datum entfernen']));
  }
  c.appendChild(el('div', { class: 'divider' }));

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
    r2.appendChild(field('Tick-Schritt', numInput(sg.tickStep, v => { sg.tickStep = v; rerender(); }), { narrow: true }));
    r2.appendChild(field('Relative Breite', numInput(sg.weight, v => { sg.weight = v; rerender(); }), { narrow: true }));
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
      state.segments.push({ id: uid('seg'), label: tr('Neuer Abschnitt'), start, end: start + 14, weight: 1, tickStep: 7, enabled: true });
      sortSegmentsAndRefresh();
    }
  }, ['+ Abschnitt hinzufügen']));
  return c;
}

/* ---------- Kurven (Serien) ---------- */
function renderSeriesPanel() {
  const c = el('div', { class: 'panel-body' });
  if (state.series.length > 1) {
    const allOpen = state.series.every(sr => expandedSeries.has(sr.id));
    c.appendChild(el('button', {
      class: 'btn ghost small', onclick: () => {
        if (allOpen) expandedSeries.clear(); else state.series.forEach(sr => expandedSeries.add(sr.id));
        refreshAll();
      }
    }, [allOpen ? 'Alle einklappen' : 'Alle aufklappen']));
  }
  state.series.forEach((sr, i) => {
    const isOpen = expandedSeries.has(sr.id);
    const card = el('div', { class: 'card series-card' + (isOpen ? '' : ' collapsed') + (sr.visible === false ? ' inactive-card' : '') });
    card.style.borderLeftColor = sr.color;
    const head = el('div', { class: 'card-head' });
    head.appendChild(toggleSwitch(sr.visible !== false, v => { sr.visible = v; refreshAll(); }, 'Kurve ein-/ausblenden'));
    const modeLabel = (SERIES_MODES.find(m => m.value === seriesMode(sr)) || {}).label || '';
    const titleBtn = el('button', {
      class: 'card-title-btn', onclick: () => { if (isOpen) expandedSeries.delete(sr.id); else expandedSeries.add(sr.id); refreshAll(); }
    }, [
      el('span', { class: 'expand-arrow' }, [isOpen ? '▾' : '▸']),
      ` ${sr.name || `Kurve ${i + 1}`}`,
      el('span', { class: 'series-meta' }, [`${modeLabel} · ${sr.points.length} Werte${(sr.axis || 'y1') === 'y2' ? ' · sek.' : ''}`])
    ]);
    head.appendChild(titleBtn);
    head.appendChild(el('button', { class: 'icon-btn danger', title: 'Entfernen', onclick: () => { state.series.splice(i, 1); expandedSeries.delete(sr.id); refreshAll(); } }, ['✕']));
    card.appendChild(head);
    if (!isOpen) { c.appendChild(card); return; }

    card.appendChild(field('Name', textInput(sr.name, v => { sr.name = v; rerender(); })));
    const mode = seriesMode(sr);
    card.appendChild(field('Darstellung', selectInput(mode, SERIES_MODES, v => {
      sr.displayMode = v;
      if (v === 'auc') {
        if (!sr.aucFill) sr.aucFill = sr.color;
        if (sr.aucOpacity == null || sr.aucOpacity === '') sr.aucOpacity = 35;
        if (sr.aucLineWidth == null || sr.aucLineWidth === '') sr.aucLineWidth = 5.5;
      }
      refreshAll();
    })));

    const r1 = el('div', { class: 'row' });
    r1.appendChild(field(mode === 'auc' ? 'Linienfarbe' : 'Farbe', colorInput(sr.color, v => { sr.color = v; rerender(); }), { narrow: true }));
    if (mode === 'lineMarkers' || mode === 'line') r1.appendChild(lineField('Dicke', sliderInput(sr.width, 0.5, 15, 0.25, v => { sr.width = v; rerender(); }, { unit: 'px' }), { narrow: true }));
    else if (mode === 'auc') r1.appendChild(lineField('Dicke', sliderInput(sr.aucLineWidth, 0.5, 15, 0.25, v => { sr.aucLineWidth = Math.max(0.25, v); rerender(); }, { unit: 'px' }), { narrow: true }));
    card.appendChild(r1);

    if (mode === 'auc') {
      const ra = el('div', { class: 'row' });
      ra.appendChild(field('Flächenfarbe', colorInput(sr.aucFill || sr.color, v => { sr.aucFill = v; rerender(); }), { narrow: true }));
      ra.appendChild(field('Deckkraft', sliderInput(sr.aucOpacity, 0, 100, 5, v => { sr.aucOpacity = clamp(v, 0, 100); rerender(); }, { unit: '%' }), { narrow: true }));
      card.appendChild(ra);
    }

    if (mode === 'line') {
    }
    // Symbole sind auch bei AUC / Nur Linie relevant (Form für Punkte mit Markierungsvorlage).
    const r2 = el('div', { class: 'row' });
    r2.appendChild(field('Symbol', selectInput(sr.markerType, SYMBOLS.map(sy => ({ value: sy, label: SYMBOL_LABELS[sy] })), v => { sr.markerType = v; rerender(); }), { narrow: true }));
    r2.appendChild(field('Symbolgröße', sliderInput(sr.markerSize, 4, 40, 0.5, v => { sr.markerSize = v; rerender(); }, { unit: 'px' }), { narrow: true }));
    card.appendChild(r2);

    const r3 = el('div', { class: 'row' });
    if (mode !== 'markers') r3.appendChild(field('Glatte Kurve', checkInput(sr.smooth, v => { sr.smooth = v; rerender(); }), { narrow: true }));
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
      const col = nextColor(state.series.length);
      const nid = uid('ser') + Math.random().toString(36).slice(2, 6);
      expandedSeries.add(nid);
      state.series.push({ id: nid, name: tr('Neue Kurve'), color: col, width: 4.5, smooth: true, axis: 'y1', markerType: 'circle', markerSize: 14, displayMode: 'lineMarkers', aucFill: col, aucOpacity: 35, aucLineWidth: 5.5, points: [{ day: 0, value: 0 }, { day: 10, value: 1 }] });
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
    'Zwei Spalten aus Excel kopieren (Tag, Wert) und hier einfügen. Ersetzt alle vorhandenen Werte dieser ' + (sr.kind === 'values' ? 'Zeile.' : 'Kurve.')
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
        errBox.textContent = tr(result.error);
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
/* ---------- Therapiezyklen: Tab, Vorlagen, Bearbeitungsansicht ---------- */
let selectedCycleId = null;            // Vorlage, die in der Vorschau als anklickbare Tabelle gezeigt wird
let expandedCycles = new Set();        // aufgeklappte Vorlagenkarten
let expandedCycleDays = new Set();     // Vorlagen mit aufgeklapptem Bereich "Tage ein-/ausblenden"
function ensureSelectedCycle() {
  const list = state.cycleTemplates || [];
  if (!list.some(t => t.id === selectedCycleId)) selectedCycleId = list.length ? list[0].id : null;
}
function cycleTemplateUsage(id) {
  let n = 0;
  state.rows.forEach(r => { if (r.kind === 'cycle') (r.items || []).forEach(it => { if (it.templateId === id) n++; }); });
  return n;
}
function dateInput(value, onChange) {
  const i = el('input', { type: 'date', value: value || '' });
  i.addEventListener('change', () => onChange(i.value));
  return i;
}
// Startdatum eines Zyklus: Eingabefeld, oder (bei gesetztem Master-Datum der X-Achse) ausgegraut mit dem berechneten Datum
function cycleDateField(it, onChange) {
  const masterOn = masterDateTs(state) != null;
  if (masterOn) {
    const ts = cycleItemDateTs(state, it);
    const di = dateInput(ts != null ? isoFromTs(ts) : '', () => {});
    di.disabled = true;
    di.title = tr('Aus dem Datum der X-Achse berechnet (Tab „X: Abschnitte“)');
    return field('Startdatum (aus X-Achse)', di);
  }
  return field('Startdatum (optional)', dateInput(it.date, onChange));
}
// "Datum als Markierung anzeigen": Start-, Tag-X- und Enddatum als nummerierte Markierung im Diagramm
function cycleDateMarkControls(it, tpl, onChange) {
  const box = el('div', { class: 'cycle-datemarks' });
  const base = cycleItemDateTs(state, it);
  const days = tpl ? cycleDayList(tpl) : [];
  const dateOf = idx => (base != null && idx >= 0 && idx < days.length) ? fmtCycleDate(base + idx * 86400000, true) : '';
  box.appendChild(el('div', { class: 'popover-sub' }, ['Datum als Markierung anzeigen']));
  const chk = (text, value, on) => {
    const l = el('label', { class: 'popover-check' });
    const c = checkInput(value, on);
    if (base == null) { c.disabled = true; l.title = tr('Dafür wird ein Startdatum oder das Datum der X-Achse benötigt'); l.classList.add('disabled'); }
    l.appendChild(c); l.appendChild(el('span', {}, [text]));
    return l;
  };
  box.appendChild(chk(`Startdatum${days.length ? ' (Tag ' + days[0] + ')' : ''}${dateOf(0) ? ' – ' + dateOf(0) : ''}`, !!it.dateMarkStart, v => { it.dateMarkStart = v; onChange(); }));
  // Tag X: beliebiger Zyklustag
  const rowX = el('label', { class: 'popover-check' + (base == null ? ' disabled' : '') });
  const cx = checkInput(!!it.dateMarkDayOn, v => { it.dateMarkDayOn = v; onChange(); });
  if (base == null) cx.disabled = true;
  rowX.appendChild(cx);
  rowX.appendChild(el('span', {}, ['Tag']));
  const nx = numInput(it.dateMarkDay, v => { it.dateMarkDay = Math.round(v); onChange(true); }, 1);
  nx.style.width = '64px';
  if (base == null) nx.disabled = true;
  rowX.appendChild(nx);
  const idxX = days.indexOf(Number(it.dateMarkDay));
  rowX.appendChild(el('span', { class: 'popover-date-preview' }, [idxX >= 0 ? '– ' + dateOf(idxX) : (base != null ? '(Tag nicht im Zyklus)' : '')]));
  box.appendChild(rowX);
  box.appendChild(chk(`Enddatum${days.length ? ' (Tag ' + days[days.length - 1] + ')' : ''}${dateOf(days.length - 1) ? ' – ' + dateOf(days.length - 1) : ''}`, !!it.dateMarkEnd, v => { it.dateMarkEnd = v; onChange(); }));
  return box;
}
// Klick auf den Tag in einer Zyklustabelle: Kommentar (erscheint als Buchstabe im Kreis + Text unter der Tabelle)
function onCycleDayClick(rowId, itemId, day, ax, ay) {
  const row = state.rows.find(r => r.id === rowId);
  const it = row && (row.items || []).find(i => i.id === itemId);
  if (!it || !isFinite(day)) return;
  it.dayNotes = it.dayNotes || [];
  const holder = el('div', { class: 'popover-body' });
  holder.appendChild(el('div', { class: 'popover-title' }, [`Kommentar zu Tag ${day}`]));
  const cur = it.dayNotes.find(n => n.day === day);
  const ta = textAreaInput(cur ? cur.text : '', v => {
    let note = it.dayNotes.find(n => n.day === day);
    if (!v.trim()) { if (note) it.dayNotes = it.dayNotes.filter(n => n !== note); }
    else if (note) note.text = v;
    else it.dayNotes.push({ id: uid('cyn'), day, text: v });
    rerender();
  });
  ta.placeholder = tr('z. B. Startbedingung …');
  holder.appendChild(ta);
  holder.appendChild(el('button', {
    class: 'btn ghost small', onclick: () => { it.dayNotes = it.dayNotes.filter(n => n.day !== day); rerender(); closePopover(); }
  }, ['Kommentar entfernen']));
  openPopover(ax, ay, holder);
  setTimeout(() => ta.focus(), 0);
}
function toggleCycleCell(tplId, rowId, day) {
  const tpl = findCycleTemplate(state, tplId);
  const row = tpl && tpl.rows.find(r => r.id === rowId);
  if (!row || !isFinite(day)) return;
  const i = row.days.indexOf(day);
  if (i >= 0) row.days.splice(i, 1); else row.days.push(day);
  rerender();
}
function moveInArray(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
}

/* --- Zyklusvorlagen als JSON-Datei (Export/Import) ---
   Import FÜGT Vorlagen hinzu (neue IDs, bestehende bleiben unverändert). Geprüft wird, dass die Datei
   wirklich Zyklusvorlagen enthält (Liste mit Zeilen und Länge je Vorlage). */
const CYCLE_FILE_FORMAT = 'timeline-cycle-templates';
let cycleNote = '';
function cycleTemplatesForFile(list) {
  return list.map(t => ({
    name: t.name, length: cycleLength(t), startDay: cycleStartDay(t), wrapEvery: Math.max(0, Math.round(Number(t.wrapEvery) || 0)),
    emptyMode: t.emptyMode, hiddenDays: (t.hiddenDays || []).slice(), color: t.color, tableStyle: t.tableStyle,
    rows: (t.rows || []).map(r => ({ name: r.name, symbol: r.symbol, color: r.color, days: (r.days || []).slice() }))
  }));
}
function exportCycleTemplates(list, label) {
  if (!list.length) { alert('Es gibt keine Zyklusvorlagen zum Exportieren.'); return; }
  const obj = { format: CYCLE_FILE_FORMAT, version: 1, cycleTemplates: cycleTemplatesForFile(list) };
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const name = `TIMELINE-ZYKLUSVORLAGEN${label ? ' ' + label.replace(/[\\/:*?"<>|]+/g, '-') : ''} # ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} # ${p(d.getHours())}-${p(d.getMinutes())}.json`;
  saveBlobSmart(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), name, 'Zyklusvorlagen (JSON)', { 'application/json': ['.json'] });
}
function validateCycleFile(data) {
  let list = null;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    if (data.format !== undefined && data.format !== CYCLE_FILE_FORMAT) {
      return { error: `Die Datei hat ein anderes Format („${String(data.format).slice(0, 40)}“) und enthält keine Zyklusvorlagen.` };
    }
    if (Array.isArray(data.cycleTemplates)) list = data.cycleTemplates;
  }
  if (!list) return { error: 'Die Datei enthält keine Liste mit Zyklusvorlagen („cycleTemplates“).' };
  if (!list.length) return { error: 'Die Datei enthält keine einzige Zyklusvorlage.' };
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { error: `Eintrag ${i + 1} ist keine Zyklusvorlage.` };
    if (!Array.isArray(e.rows)) return { error: `Eintrag ${i + 1}: „rows“ (Liste der Zeilen) fehlt.` };
    const len = parseFloat(e.length);
    if (!isFinite(len) || len < 1) return { error: `Eintrag ${i + 1}: „length“ (Länge in Tagen) fehlt oder ist ungültig.` };
    for (let j = 0; j < e.rows.length; j++) {
      const r = e.rows[j];
      if (!r || typeof r !== 'object' || Array.isArray(r) || !Array.isArray(r.days)) return { error: `Eintrag ${i + 1}, Zeile ${j + 1}: „days“ (Liste der Gabetage) fehlt.` };
    }
    // Kopie mit neuen IDs; fehlende/ungültige Felder ergänzt normalizeCycleTemplate
    const t = JSON.parse(JSON.stringify(e));
    t.id = uid('cyc'); t.length = len;
    t.rows.forEach(r => { r.id = uid('cyr'); });
    out.push(normalizeCycleTemplate(t));
  }
  return { templates: out };
}
function importCycleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch (e) { alert(`„${file.name}“ konnte nicht importiert werden: Die Datei ist kein gültiges JSON.`); return; }
    const res = validateCycleFile(data);
    if (res.error) { alert(`„${file.name}“ konnte nicht importiert werden:\n${res.error}`); return; }
    state.cycleTemplates = state.cycleTemplates || [];
    res.templates.forEach(t => state.cycleTemplates.push(t));
    selectedCycleId = res.templates[0].id;
    res.templates.forEach(t => expandedCycles.add(t.id));
    cycleNote = `„${file.name}“: ${res.templates.length} ${res.templates.length === 1 ? 'Zyklusvorlage' : 'Zyklusvorlagen'} importiert.`;
    activeTab = 'cycles';
    refreshAll();
  };
  reader.readAsText(file);
}

function renderCyclesPanel() {
  state.cycleTemplates = state.cycleTemplates || [];
  ensureSelectedCycle();
  const c = el('div', { class: 'panel-body' });
  const bar = el('div', { class: 'chipbar' });
  bar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const t = newCycleTemplate(state.cycleTemplates.length + 1);
      state.cycleTemplates.push(t); selectedCycleId = t.id; expandedCycles.add(t.id); refreshAll();
    }
  }, ['+ Zyklusvorlage']));
  c.appendChild(bar);
  const ioRow = el('div', { class: 'row toolbar-gap' });
  ioRow.appendChild(el('button', { class: 'btn secondary small', onclick: () => exportCycleTemplates(state.cycleTemplates, '') }, ['Vorlagen exportieren']));
  ioRow.appendChild(el('button', { class: 'btn secondary small', onclick: () => document.getElementById('cycleLoadInput').click() }, ['Vorlagen importieren']));
  c.appendChild(ioRow);
  if (cycleNote) { c.appendChild(el('div', { class: 'hint small' }, [cycleNote])); cycleNote = ''; }
  if (!state.cycleTemplates.length) c.appendChild(el('div', { class: 'hint small' }, ['Noch keine Zyklusvorlage angelegt.']));

  state.cycleTemplates.forEach((t, ti) => {
    const isOpen = expandedCycles.has(t.id), isSel = t.id === selectedCycleId;
    const card = el('div', { class: 'card cycle-card' + (isOpen ? '' : ' collapsed') + (isSel ? ' selected' : '') });
    const head = el('div', { class: 'card-head' });
    const moveWrap = el('div', { class: 'move-btns' });
    moveWrap.appendChild(el('button', { class: 'icon-btn', title: 'Nach oben', disabled: ti === 0 ? 'disabled' : undefined, onclick: () => { moveInArray(state.cycleTemplates, ti, -1); refreshAll(); } }, ['▲']));
    moveWrap.appendChild(el('button', { class: 'icon-btn', title: 'Nach unten', disabled: ti === state.cycleTemplates.length - 1 ? 'disabled' : undefined, onclick: () => { moveInArray(state.cycleTemplates, ti, 1); refreshAll(); } }, ['▼']));
    head.appendChild(moveWrap);
    head.appendChild(el('button', {
      class: 'card-title-btn', title: 'Aufklappen und in der Vorschau anzeigen',
      onclick: () => { if (isOpen && isSel) expandedCycles.delete(t.id); else { expandedCycles.add(t.id); selectedCycleId = t.id; } refreshAll(); }
    }, [el('span', { class: 'expand-arrow' }, [isOpen ? '▾' : '▸']), ` ${t.name || 'Zyklus'}`]));
    head.appendChild(el('span', { class: 'ms-usage' }, [`${cycleDuration(t)} Tage`]));
    head.appendChild(el('button', { class: 'icon-btn', title: 'Diese Vorlage exportieren', onclick: () => exportCycleTemplates([t], t.name || '') }, ['⇩']));
    head.appendChild(el('button', {
      class: 'icon-btn', title: 'Vorlage duplizieren', onclick: () => {
        const cp = JSON.parse(JSON.stringify(t));
        cp.id = uid('cyc'); cp.name = (t.name || 'Zyklus') + ' (Kopie)';
        cp.rows.forEach(r => { r.id = uid('cyr'); });
        state.cycleTemplates.splice(ti + 1, 0, cp); selectedCycleId = cp.id; expandedCycles.add(cp.id); refreshAll();
      }
    }, ['⧉']));
    head.appendChild(el('button', {
      class: 'icon-btn danger', title: 'Vorlage löschen', onclick: () => {
        const used = cycleTemplateUsage(t.id);
        if (used && !confirm(`Diese Vorlage wird in ${used} Zyklus-Eintrag/-Einträgen verwendet. Trotzdem löschen? Diese Einträge werden dabei entfernt.`)) return;
        state.rows.forEach(r => { if (r.kind === 'cycle') r.items = r.items.filter(it => it.templateId !== t.id); });
        state.cycleTemplates.splice(ti, 1); expandedCycles.delete(t.id); refreshAll();
      }
    }, ['✕']));
    card.appendChild(head);

    if (isOpen) {
      card.appendChild(field('Name', textInput(t.name, v => { t.name = v; rerender(); })));
      card.appendChild(field('Länge (Tage)', numInputCommit(t.length, v => { t.length = Math.max(1, Math.min(366, Math.round(v))); rerender(); }, () => refreshAll(), 1)));
      card.appendChild(field('Zyklus beginnt an Tag', numInputCommit(t.startDay, v => { t.startDay = Math.round(v); rerender(); }, () => refreshAll(), 1)));
      card.appendChild(field('Umbruch alle … Tage (0 = aus)', numInput(t.wrapEvery, v => { t.wrapEvery = Math.max(0, Math.round(v)); rerender(); }, 1)));
      card.appendChild(field('Leere Tage', selectInput(t.emptyMode, CYCLE_EMPTY_MODES, v => { t.emptyMode = v; rerender(); })));
      card.appendChild(colorField('Farbe im Diagramm', colorInput(t.color, v => { t.color = v; rerender(); })));
      card.appendChild(field('Tabellenstil', selectInput(t.tableStyle || 'neutral', CYCLE_SCHEME_CHOICES, v => { t.tableStyle = v; rerender(); })));

      // Eingeklappt: einzelne Tage abwählen (z. B. Protokolle mit Tag -2, -1, 1, 2 ohne Tag 0)
      const daysOpen = expandedCycleDays.has(t.id);
      const nHidden = (t.hiddenDays || []).filter(d => d >= cycleStartDay(t) && d < cycleStartDay(t) + cycleLength(t)).length;
      card.appendChild(el('button', {
        class: 'subtoggle', onclick: () => { if (daysOpen) expandedCycleDays.delete(t.id); else expandedCycleDays.add(t.id); refreshAll(); }
      }, [el('span', { class: 'expand-arrow' }, [daysOpen ? '▾' : '▸']), ` Tage ein-/ausblenden${nHidden ? ` (${nHidden} abgewählt)` : ''}`]));
      if (daysOpen) {
        const chips = el('div', { class: 'day-chips' });
        for (let i = 0; i < cycleLength(t); i++) {
          const d = cycleStartDay(t) + i;
          const off = (t.hiddenDays || []).includes(d);
          chips.appendChild(el('button', {
            class: 'day-chip' + (off ? ' off' : ''), title: off ? 'Tag ist abgewählt – klicken zum Einblenden' : 'Tag abwählen',
            onclick: () => {
              if (off) t.hiddenDays = t.hiddenDays.filter(x => x !== d); else t.hiddenDays.push(d);
              refreshAll();
            }
          }, [String(d)]));
        }
        card.appendChild(chips);
      }

      card.appendChild(el('div', { class: 'section-title small' }, ['Zeilen (Medikamente / Interventionen)']));
      t.rows.forEach((r, ri) => {
        const row = el('div', { class: 'cycle-row' });
        const mv = el('div', { class: 'move-btns' });
        mv.appendChild(el('button', { class: 'icon-btn small', title: 'Nach oben', disabled: ri === 0 ? 'disabled' : undefined, onclick: () => { moveInArray(t.rows, ri, -1); refreshAll(); } }, ['▲']));
        mv.appendChild(el('button', { class: 'icon-btn small', title: 'Nach unten', disabled: ri === t.rows.length - 1 ? 'disabled' : undefined, onclick: () => { moveInArray(t.rows, ri, 1); refreshAll(); } }, ['▼']));
        row.appendChild(mv);
        row.appendChild(textInput(r.name, v => { r.name = v; rerender(); }));
        row.appendChild(selectInput(r.symbol, SYMBOLS.map(sy => ({ value: sy, label: SYMBOL_LABELS[sy] })), v => { r.symbol = v; rerender(); }));
        row.appendChild(colorInput(r.color || '#000000', v => { r.color = v; rerender(); }));
        row.appendChild(el('button', { class: 'icon-btn danger small', title: 'Zeile löschen', onclick: () => { t.rows.splice(ri, 1); refreshAll(); } }, ['✕']));
        card.appendChild(row);
      });
      card.appendChild(el('button', {
        class: 'btn secondary small', onclick: () => { t.rows.push(newCycleRow(t.rows.length + 1)); selectedCycleId = t.id; refreshAll(); }
      }, ['+ Zeile']));
    }
    c.appendChild(card);
  });
  return c;
}

// Zyklus-Zeile im Tab "Ereignisse & Zustände": Eintraege (Vorlage + Starttag + optional Datum)
function buildCycleItemCard(r, it, ii) {
  const tpls = state.cycleTemplates || [];
  const tpl = findCycleTemplate(state, it.templateId);
  const box = el('div', { class: 'cycle-item' });
  const head = el('div', { class: 'cycle-item-head' });
  head.appendChild(el('span', {}, [`Zyklus ${ii + 1}${tpl ? ' – ' + (it.label || tpl.name) : ''}`]));
  head.appendChild(el('button', { class: 'icon-btn danger small', title: 'Eintrag entfernen', onclick: () => { r.items.splice(ii, 1); refreshAll(); } }, ['✕']));
  box.appendChild(head);
  box.appendChild(field('Vorlage', selectInput(it.templateId, tpls.map(t => ({ value: t.id, label: t.name || 'Zyklus' })), v => { it.templateId = v; refreshAll(); })));
  box.appendChild(field('Starttag im Diagramm', numInput(it.start, v => { it.start = Math.round(v); rerender(); }, 1)));
  box.appendChild(cycleDateField(it, v => { it.date = v; if (!parseISODate(v)) it.showDates = false; refreshAll(); }));
  const lbl = textInput(it.label, v => { it.label = v; rerender(); });
  lbl.placeholder = tpl ? tpl.name : '';
  box.appendChild(field('Beschriftung', lbl));
  box.appendChild(colorField('Farbe', colorInput(it.color || (tpl ? tpl.color : '#3B5BA5'), v => { it.color = v; rerender(); })));
  if (r.display !== 'marker') {
    box.appendChild(field('Pause bis zum nächsten Zyklus einblenden', checkInput(it.showPause, v => { it.showPause = v; rerender(); })));
  }
  box.appendChild(field('Tabelle unterhalb anzeigen', checkInput(it.showTable, v => { it.showTable = v; rerender(); })));
  if (cycleItemDateTs(state, it) != null) {
    box.appendChild(field('Absolute Daten in der Tabelle', checkInput(it.showDates, v => { it.showDates = v; rerender(); })));
  }
  box.appendChild(cycleDateMarkControls(it, tpl, () => { rerender(); }));
  return box;
}
function newCycleItemFor(r) {
  const tpls = state.cycleTemplates || [];
  const last = r.items.length ? r.items[r.items.length - 1] : null;
  const lastTpl = last ? findCycleTemplate(state, last.templateId) : null;
  return {
    id: uid('cyi'), templateId: last && lastTpl ? last.templateId : tpls[0].id,
    start: last && lastTpl ? (Number(last.start) || 0) + cycleDuration(lastTpl) : 0,
    date: '', label: '', color: '', showTable: false, showDates: false, showPause: false,
    dayNotes: [], dateMarkStart: false, dateMarkEnd: false, dateMarkDayOn: false,
    dateMarkDay: (last && lastTpl) ? cycleStartDay(lastTpl) : cycleStartDay(findCycleTemplate(state, tpls[0].id))
  };
}

// Klick auf eine Zyklus-Box im Diagramm: Tabelle / Datum direkt umschalten
function onCycleClick(rowId, itemId, ax, ay) {
  const row = state.rows.find(r => r.id === rowId);
  const it = row && (row.items || []).find(i => i.id === itemId);
  if (!it) return;
  const tpl = findCycleTemplate(state, it.templateId);
  const holder = el('div', { class: 'popover-body' });
  const build = () => {
    holder.innerHTML = '';
    holder.appendChild(el('div', { class: 'popover-title' }, [`${it.label || (tpl ? tpl.name : 'Zyklus')} – ab Tag ${it.start}`]));
    const chk = (text, value, onChange) => {
      const l = el('label', { class: 'popover-check' });
      l.appendChild(checkInput(value, onChange)); l.appendChild(el('span', {}, [text]));
      return l;
    };
    if (row.display !== 'marker') holder.appendChild(chk('Pause bis zum nächsten Zyklus einblenden', !!it.showPause, v => { it.showPause = v; rerender(); if (activeTab === 'rows') renderTabs(); }));
    holder.appendChild(chk('Zyklustabelle unterhalb anzeigen', !!it.showTable, v => { it.showTable = v; rerender(); if (activeTab === 'rows') renderTabs(); }));
    holder.appendChild(cycleDateField(it, v => {
      it.date = v; if (!parseISODate(v)) it.showDates = false;
      rerender(); if (activeTab === 'rows') renderTabs();
      build(); if (currentPopover) placePopover(currentPopover, ax, ay);
    }));
    if (cycleItemDateTs(state, it) != null) {
      holder.appendChild(chk('Absolute Daten in der Tabelle', !!it.showDates, v => { it.showDates = v; rerender(); if (activeTab === 'rows') renderTabs(); }));
    }
    holder.appendChild(cycleDateMarkControls(it, tpl, keepFocus => {
      rerender(); if (activeTab === 'rows') renderTabs();
      if (!keepFocus) { build(); if (currentPopover) placePopover(currentPopover, ax, ay); }
    }));
  };
  build();
  openPopover(ax, ay, holder);
}

function moveRow(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= state.rows.length) return;
  const tmp = state.rows[i]; state.rows[i] = state.rows[j]; state.rows[j] = tmp;
  refreshAll();
}

function renderRowsPanel() {
  const c = el('div', { class: 'panel-body' });

  const addBar = el('div', { class: 'chipbar' });
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => { const r = { id: uid('hd'), kind: 'header', text: tr('Neue Überschrift') }; state.rows.push(r); expandedRows.add(r.id); refreshAll(); }
  }, ['+ Überschrift']));
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const r = { id: uid('et'), kind: 'event', name: tr('Neuer Typ'), symbol: 'circle', color: nextColor(state.rows.length), textSize: 13, symbolSize: 13, items: [{ id: uid('evi'), day: 1, label: 'Neues Ereignis', hl: false, hlColor: '', hlLabel: '' }] };
      state.rows.push(r); expandedRows.add(r.id); refreshAll();
    }
  }, ['+ Ereignis-Zeile']));
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const r = { id: uid('st'), kind: 'state', name: tr('Neue Zeile'), items: [{ id: uid('sti'), color: nextColor(0), start: 0, end: 7, label: tr('Neuer Zustand'), hatch: false, marks: [] }] };
      state.rows.push(r); expandedRows.add(r.id); refreshAll();
    }
  }, ['+ Zustands-Zeile']));
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const r = { id: uid('vr'), kind: 'values', name: tr('Neue Werte'), color: '#1E2A24', textSize: 13, bold: false, decimals: 'auto', unit: '', stagger: false, points: [{ day: 0, value: 0 }] };
      state.rows.push(r); expandedRows.add(r.id); refreshAll();
    }
  }, ['+ Werte-Zeile']));
  addBar.appendChild(el('button', {
    class: 'chip', onclick: () => {
      const r = { id: uid('cy'), kind: 'cycle', name: tr('Zyklus'), display: 'box', symbol: 'triangle', symbolSize: 14, textSize: 13, items: [] };
      state.rows.push(r); expandedRows.add(r.id); refreshAll();
    }
  }, ['+ Zyklus-Zeile']));
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
    const kindLabel = r.kind === 'header' ? 'Überschrift' : r.kind === 'event' ? 'Ereignis' : r.kind === 'values' ? 'Werte' : r.kind === 'cycle' ? 'Zyklus' : 'Zustand';
    const titleBtn = el('button', {
      class: 'card-title-btn', onclick: () => { if (isOpen) expandedRows.delete(r.id); else expandedRows.add(r.id); refreshAll(); }
    }, [el('span', { class: 'expand-arrow' }, [isOpen ? '▾' : '▸']), ` ${kindLabel}: ${r.text || r.name || ''}`]);
    head.appendChild(titleBtn);
    head.appendChild(el('button', { class: 'icon-btn danger', title: 'Entfernen', onclick: () => { state.rows.splice(i, 1); expandedRows.delete(r.id); refreshAll(); } }, ['✕']));
    card.appendChild(head);

    if (isOpen) {
      if (r.kind === 'header') {
        card.appendChild(field('Überschrift', textInput(r.text, v => { r.text = v; rerender(); })));
      } else if (r.kind === 'values') {
        card.appendChild(field('Bezeichnung', textInput(r.name, v => { r.name = v; rerender(); })));
        const vr1 = el('div', { class: 'row' });
        vr1.appendChild(colorField('Farbe', colorInput(r.color, v => { r.color = v; rerender(); }), { narrow: true }));
        vr1.appendChild(sizeField('Größe', sliderInput(r.textSize, 8, 40, 0.5, v => { r.textSize = Math.max(4, v); rerender(); }, { unit: 'pt' }), { narrow: true }));
        vr1.appendChild(field('Fett', checkInput(r.bold, v => { r.bold = v; rerender(); }), { narrow: true }));
        card.appendChild(vr1);
        const vr2 = el('div', { class: 'row' });
        vr2.appendChild(field('Nachkommastellen', selectInput(String(r.decimals == null ? 'auto' : r.decimals), [
          { value: 'auto', label: 'Automatisch' }, { value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }
        ], v => { r.decimals = v; rerender(); }), { narrow: true }));
        vr2.appendChild(field('Einheit', textInput(r.unit, v => { r.unit = v; rerender(); }), { narrow: true }));
        card.appendChild(vr2);
        card.appendChild(field('Bei Überlappung versetzen', checkInput(r.stagger, v => { r.stagger = v; rerender(); })));

        card.appendChild(el('div', { class: 'section-title small' }, ['Werte (Tag / Wert)']));
        const table = el('div', { class: 'point-table' });
        r.points.forEach((p, pi) => {
          const row = el('div', { class: 'point-row' });
          row.appendChild(numInputCommit(p.day, v => { p.day = v; rerender(); }, () => sortPointsAndRefresh(r)));
          row.appendChild(numInput(p.value, v => { p.value = v; rerender(); }, 0.01));
          row.appendChild(el('button', { class: 'icon-btn danger small', onclick: () => { r.points.splice(pi, 1); refreshAll(); } }, ['✕']));
          table.appendChild(row);
        });
        card.appendChild(table);
        const vbtn = el('div', { class: 'row' });
        vbtn.appendChild(el('button', {
          class: 'btn secondary small', onclick: () => {
            const last = r.points.length ? r.points[r.points.length - 1] : { day: -1, value: 0 };
            r.points.push({ day: Number(last.day) + 1, value: last.value });
            refreshAll();
          }
        }, ['+ Wert']));
        vbtn.appendChild(el('button', {
          class: 'btn secondary small', onclick: (e) => { const rc = e.target.getBoundingClientRect(); openPastePopover(r, rc.left, rc.top); }
        }, ['Aus Excel einfügen']));
        card.appendChild(vbtn);
      } else if (r.kind === 'event') {
        card.appendChild(field('Bezeichnung', textInput(r.name, v => { r.name = v; rerender(); })));
        const rr1 = el('div', { class: 'row' });
        rr1.appendChild(field('Symbol', selectInput(r.symbol, SYMBOLS.map(sy => ({ value: sy, label: SYMBOL_LABELS[sy] })), v => { r.symbol = v; rerender(); }), { narrow: true }));
        rr1.appendChild(field('Farbe', colorInput(r.color, v => { r.color = v; rerender(); }), { narrow: true }));
        card.appendChild(rr1);
        const rr2 = el('div', { class: 'row' });
        rr2.appendChild(field('Symbolgröße', sliderInput(r.symbolSize, 4, 40, 0.5, v => { r.symbolSize = v; rerender(); }, { unit: 'px' }), { narrow: true }));
        rr2.appendChild(sizeField('Text', sliderInput(r.textSize, 8, 40, 0.5, v => { r.textSize = v; rerender(); }, { unit: 'pt' }), { narrow: true }));
        card.appendChild(rr2);

        card.appendChild(el('div', { class: 'section-title small' }, ['Einträge (Tag / Beschriftung)']));
        const table = el('div', { class: 'point-table events' });
        r.items.forEach((it, ii) => {
          const row = el('div', { class: 'point-row events' });
          row.appendChild(numInput(it.day, v => { it.day = v; rerender(); }));
          row.appendChild(textAreaInput(it.label, v => { it.label = v; rerender(); }));
          row.appendChild(el('button', { class: 'icon-btn danger small', onclick: () => { r.items.splice(ii, 1); refreshAll(); } }, ['✕']));
          table.appendChild(row);
        });
        card.appendChild(table);
        card.appendChild(el('button', {
          class: 'btn secondary small', onclick: () => {
            const lastDay = r.items.length ? r.items[r.items.length - 1].day : 0;
            r.items.push({ id: uid('evi'), day: lastDay + 1, label: tr('Neues Ereignis'), hl: false, hlColor: r.color, hlLabel: '' });
            refreshAll();
          }
        }, ['+ Eintrag']));
      } else if (r.kind === 'cycle') {
        card.appendChild(field('Bezeichnung', textInput(r.name, v => { r.name = v; rerender(); })));
        card.appendChild(field('Darstellung', selectInput(r.display === 'marker' ? 'marker' : 'box', [
          { value: 'box', label: 'Box über die Zyklusdauer' },
          { value: 'marker', label: 'Markierungssymbol am Start' }
        ], v => { r.display = v; refreshAll(); })));
        if (r.display === 'marker') {
          card.appendChild(field('Symbol', selectInput(r.symbol || 'triangle', SYMBOLS.map(sy => ({ value: sy, label: SYMBOL_LABELS[sy] })), v => { r.symbol = v; rerender(); })));
          card.appendChild(field('Symbolgröße', sliderInput(r.symbolSize == null ? 14 : r.symbolSize, 4, 40, 0.5, v => { r.symbolSize = v; rerender(); }, { unit: 'px' })));
          card.appendChild(sizeField('Text', sliderInput(r.textSize == null ? 13 : r.textSize, 8, 40, 0.5, v => { r.textSize = v; rerender(); }, { unit: 'pt' })));
        }
        card.appendChild(el('div', { class: 'section-title small' }, ['Zyklen in dieser Zeile']));
        (r.items || []).forEach((it, ii) => card.appendChild(buildCycleItemCard(r, it, ii)));
        card.appendChild(el('button', {
          class: 'btn secondary small', onclick: () => {
            if (!(state.cycleTemplates || []).length) { alert('Lege zuerst im Tab „Therapiezyklen“ eine Zyklusvorlage an.'); return; }
            r.items.push(newCycleItemFor(r)); refreshAll();
          }
        }, ['+ Zyklus']));
      } else {
        card.appendChild(field('Bezeichnung', textInput(r.name, v => { r.name = v; rerender(); })));

        card.appendChild(el('div', { class: 'section-title small' }, ['Einträge (Farbe / Von / Bis / Beschriftung)']));
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
        card.appendChild(el('button', {
          class: 'btn secondary small', onclick: () => {
            const prev = r.items.length ? r.items[r.items.length - 1] : null;
            const lastEnd = prev ? prev.end : 0;
            // Standard: Farbe des vorherigen Zustands dieser Zeile übernehmen
            // (nur bei einer noch leeren Zeile gibt es keinen Vorgänger -> Palette).
            const newColor = prev && prev.color ? prev.color : nextColor(0);
            r.items.push({ id: uid('sti'), color: newColor, start: lastEnd, end: lastEnd + 7, label: tr('Neuer Zustand'), hatch: false, marks: [] });
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
// URL-Parameter ?preview=N laedt beim Start direkt die N-te Diagrammvorlage (Menue "Vorlagen"):
//   ?preview=1 = Klinische Verlaufsgrafik, ?preview=2 = Therapieplan Verlauf.
// Rein clientseitig (kein Server noetig); ohne oder mit ungueltigem Parameter erscheint die normale Startseite.
function applyPreviewFromUrl() {
  let v = null;
  try { v = new URLSearchParams(window.location.search).get('preview'); } catch (e) { return; }
  if (v == null || !/^\s*\d+\s*$/.test(v)) return;
  const tpl = CHART_TEMPLATES[parseInt(v, 10) - 1];
  if (!tpl) return;
  state = tpl.build();
  currentProjectHandle = null;
  currentProjectHandleName = null;
  activeTab = 'general';
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loadInput').addEventListener('change', (e) => {
    if (e.target.files[0]) loadJSONFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('styleLoadInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importStylePresetFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('markStyleLoadInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importMarkStyleFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('cycleLoadInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importCycleFile(e.target.files[0]);
    e.target.value = '';
  });
  const tabnav = document.getElementById('tabnav');
  tabnav.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabnav.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  document.getElementById('btnTemplates').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openTemplateMenu(r.left + r.width / 2, r.bottom);
  });
  document.getElementById('btnFileMenu').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openFileMenu(r.left + r.width / 2, r.bottom);
  });
  document.getElementById('btnSaveProject').addEventListener('click', () => {
    saveProjectSmart().catch(e => { console.error(e); alert('Speichern fehlgeschlagen: ' + e.message); });
  });
  document.getElementById('langSelect').addEventListener('change', (e) => {
    setUILang(e.target.value);
    closePopover();
    applyStaticI18n();
    refreshAll();
  });
  applyStaticI18n();
  applyPreviewFromUrl();
  refreshAll();
  markClean(); // Ausgangszustand (leer bzw. gerade erst geladen) gilt nicht als "ungespeicherte Aenderung"
});
