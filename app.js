'use strict';

const APP_VERSION = '1.5.0';

const DEFAULT_PRINTERS = [
  { id: 'x2d', name: 'X2D', amsType: 'ams'      },
  { id: 'p2s', name: 'P2S', amsType: 'ams'      },
  { id: 'a1',  name: 'A1',  amsType: 'ams-lite' },
];

function getSlotOrder(amsType) {
  if (amsType === 'ams-lite') return [1, 4, 2, 3];
  if (amsType === 'single')   return [1];
  return [1, 2, 3, 4];
}

const DEFAULT_SPOOL_TYPES = [
  { id: 'elegoo-cardboard', name: 'Elegoo Cardboard', tare: 165 },
  { id: 'bambu-plastic',    name: 'Bambu Plastic',    tare: 256 },
];
const STORAGE_KEY = 'filament-tracker-data';
const LOW_GRAM_THRESHOLD = 100;

// ── State ──────────────────────────────────────────────────────────────────

let state = loadState();

function defaultSpoolTypes() {
  return DEFAULT_SPOOL_TYPES.map(t => ({ ...t }));
}

function defaultPrinterList() {
  return DEFAULT_PRINTERS.map(p => ({ ...p }));
}

function initSlotData(printerId) {
  const slots = {};
  for (let s = 1; s <= 4; s++) {
    slots[s] = { grams: null, spoolWeight: DEFAULT_SPOOL_TYPES[0].tare };
  }
  return slots;
}

function defaultState() {
  const printers = {};
  for (const p of DEFAULT_PRINTERS) {
    printers[p.id] = initSlotData(p.id);
  }
  return {
    printers,
    printerList: defaultPrinterList(),
    spoolTypes: defaultSpoolTypes(),
    lastExported: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.spoolTypes)  parsed.spoolTypes  = defaultSpoolTypes();
      if (!parsed.printerList) parsed.printerList = defaultPrinterList();
      // Migrate: amsLite boolean → amsType string
      for (const p of parsed.printerList) {
        if (!p.amsType) p.amsType = p.amsLite ? 'ams-lite' : 'ams';
      }
      return parsed;
    }
  } catch (_) {}
  return defaultState();
}

function getPrinters() {
  return (state.printerList ?? defaultPrinterList()).map(p => ({
    ...p,
    slotOrder: getSlotOrder(p.amsType ?? (p.amsLite ? 'ams-lite' : 'ams')),
  }));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── DOM refs ───────────────────────────────────────────────────────────────

const pageHome     = document.getElementById('page-home');
const pageSettings = document.getElementById('page-settings');
const printerList  = document.querySelector('.printer-list');

const btnSettings  = document.getElementById('btn-settings');
const btnBack      = document.getElementById('btn-back');
const btnExport    = document.getElementById('btn-export');
const btnImport    = document.getElementById('btn-import');
const importInput  = document.getElementById('import-file-input');
const lastExportedDisplay = document.getElementById('last-exported-display');
const appVersionEl = document.getElementById('app-version');
const btnHomeSave  = document.getElementById('btn-home-save');
const homeLastSaved = document.getElementById('home-last-saved');

const modalOverlay  = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const inputWeight   = document.getElementById('input-weight');
const selectSpool   = document.getElementById('select-spool');
const remainingVal  = document.getElementById('filament-remaining-value');
const btnModalOk    = document.getElementById('btn-modal-ok');
const btnModalCancel = document.getElementById('btn-modal-cancel');

// Tab refs
const tabWeigh   = document.getElementById('tab-weigh');
const tabAdjust  = document.getElementById('tab-adjust');
const panelWeigh  = document.getElementById('panel-weigh');
const panelAdjust = document.getElementById('panel-adjust');

// Adjust panel refs
const btnSubtract       = document.getElementById('btn-subtract');
const btnAdd            = document.getElementById('btn-add');
const inputAdjustGrams  = document.getElementById('input-adjust-grams');
const adjustCurrentGrams = document.getElementById('adjust-current-grams');
const adjustAfterValue  = document.getElementById('adjust-after-value');
const adjustInputLabel  = document.getElementById('adjust-input-label');

// Printer modal refs
const printerModalOverlay  = document.getElementById('printer-modal-overlay');
const printerModalTitle    = document.getElementById('printer-modal-title');
const inputPrinterName     = document.getElementById('input-printer-name');
const btnAmsStandard       = document.getElementById('btn-ams-standard');
const btnAmsLite           = document.getElementById('btn-ams-lite');
const btnAmsSingle         = document.getElementById('btn-ams-single');
const btnPrinterCancel     = document.getElementById('btn-printer-cancel');
const btnPrinterSave       = document.getElementById('btn-printer-save');
const printerListSettings  = document.getElementById('printer-list-settings');
const btnAddPrinter        = document.getElementById('btn-add-printer');

// Spool type modal refs
const spoolModalOverlay = document.getElementById('spool-modal-overlay');
const spoolModalTitle   = document.getElementById('spool-modal-title');
const inputSpoolName    = document.getElementById('input-spool-name');
const inputSpoolTare    = document.getElementById('input-spool-tare');
const btnSpoolCancel    = document.getElementById('btn-spool-cancel');
const btnSpoolSave      = document.getElementById('btn-spool-save');
const spoolTypesList    = document.getElementById('spool-types-list');
const btnAddSpool       = document.getElementById('btn-add-spool');

// ── Navigation ─────────────────────────────────────────────────────────────

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  page.classList.add('active');
}

btnSettings.addEventListener('click', () => {
  renderSettings();
  showPage(pageSettings);
});

btnBack.addEventListener('click', () => showPage(pageHome));

// ── Relative time ──────────────────────────────────────────────────────────

function formatRelativeTime(isoString) {
  if (!isoString) return null;
  const then = new Date(isoString);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart - 86400000);

  if (then >= todayStart) {
    return then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (then >= yesterdayStart) {
    return 'Yesterday';
  } else {
    const days = Math.floor((todayStart - then) / 86400000);
    return `${days} days ago`;
  }
}

// ── Render Home ────────────────────────────────────────────────────────────

function renderHome() {
  printerList.innerHTML = '';
  for (const printer of getPrinters()) {
    const card = document.createElement('div');
    card.className = 'printer-card';

    const header = document.createElement('div');
    header.className = 'printer-card-header';
    const subtitleText = { 'ams-lite': 'AMS Lite', 'single': 'Single Spool' }[printer.amsType] ?? '';
    const subtitle = subtitleText ? `<span class="printer-subtitle">${subtitleText}</span>` : '';
    header.innerHTML = `<span class="printer-name">${printer.name}</span>${subtitle}`;

    const slotsDiv = document.createElement('div');
    const amsClass = printer.amsType === 'ams-lite' ? ' ams-lite' : printer.amsType === 'single' ? ' single' : '';
    slotsDiv.className = 'printer-slots' + amsClass;

    for (const slot of printer.slotOrder) {
      const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_TYPES[0].tare };
      const grams = slotData.grams;
      const isLow = grams !== null && grams < LOW_GRAM_THRESHOLD;
      const timeLabel = formatRelativeTime(slotData.updatedAt ?? null);

      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.setAttribute('aria-label', `${printer.name} slot ${slot}: ${grams !== null ? grams + 'g' : 'not set'}${timeLabel ? ', updated ' + timeLabel : ''}. Tap to edit.`);

      btn.innerHTML = `
        <span class="slot-label">Slot ${slot}</span>
        <span class="slot-grams${isLow ? ' low' : ''}">${grams !== null ? grams : '—'}</span>
        <span class="slot-unit">grams</span>
        <span class="slot-timestamp">${timeLabel ?? ''}</span>
      `;

      btn.addEventListener('click', () => openModal(printer, slot));
      slotsDiv.appendChild(btn);
    }

    card.appendChild(header);
    card.appendChild(slotsDiv);
    printerList.appendChild(card);
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────

let activeEdit = null; // { printerId, slot }
let activeTab  = 'weigh';   // 'weigh' | 'adjust'
let adjustMode = 'subtract'; // 'subtract' | 'add'

// ── Visual Viewport: keep modal above the keyboard ─────────────────────────

function syncModalToViewport() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  modalOverlay.style.top    = vv.offsetTop + 'px';
  modalOverlay.style.left   = vv.offsetLeft + 'px';
  modalOverlay.style.height = vv.height + 'px';
  modalOverlay.style.width  = vv.width + 'px';
}

function resetModalViewport() {
  ['top','left','height','width'].forEach(p => modalOverlay.style[p] = '');
}

// ── Tab switching ──────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  const isWeigh = tab === 'weigh';

  tabWeigh.classList.toggle('active', isWeigh);
  tabAdjust.classList.toggle('active', !isWeigh);
  tabWeigh.setAttribute('aria-selected', isWeigh);
  tabAdjust.setAttribute('aria-selected', !isWeigh);

  panelWeigh.classList.toggle('hidden', !isWeigh);
  panelAdjust.classList.toggle('hidden', isWeigh);

  if (!isWeigh) updateAdjustPreview();
}

tabWeigh.addEventListener('click',  () => { switchTab('weigh');  setTimeout(() => inputWeight.focus(), 60); });
tabAdjust.addEventListener('click', () => { switchTab('adjust'); setTimeout(() => inputAdjustGrams.focus(), 60); });

// ── Adjust panel ───────────────────────────────────────────────────────────

function setAdjustMode(mode) {
  adjustMode = mode;
  const isSub = mode === 'subtract';
  btnSubtract.classList.toggle('active', isSub);
  btnAdd.classList.toggle('active', !isSub);
  btnSubtract.setAttribute('aria-pressed', isSub);
  btnAdd.setAttribute('aria-pressed', !isSub);
  adjustInputLabel.textContent = isSub ? 'Grams to subtract' : 'Grams to add';
  updateAdjustPreview();
}

function updateAdjustPreview() {
  const slotData = activeEdit
    ? (state.printers[activeEdit.printerId]?.[activeEdit.slot] ?? null)
    : null;
  const current = slotData?.grams ?? null;

  adjustCurrentGrams.textContent = current !== null ? current + 'g' : '—';

  const delta = parseFloat(inputAdjustGrams.value);
  if (current === null || !inputAdjustGrams.value.trim() || isNaN(delta)) {
    adjustAfterValue.textContent = '—';
    adjustAfterValue.className = 'filament-remaining-value invalid';
    return;
  }

  const after = adjustMode === 'subtract' ? current - delta : current + delta;
  adjustAfterValue.textContent = after + 'g';
  adjustAfterValue.className = 'filament-remaining-value' + (after < LOW_GRAM_THRESHOLD ? ' low' : '');
}

btnSubtract.addEventListener('click', () => setAdjustMode('subtract'));
btnAdd.addEventListener('click',      () => setAdjustMode('add'));
inputAdjustGrams.addEventListener('input', updateAdjustPreview);

// ── Spool select population ────────────────────────────────────────────────

function populateSpoolSelect(preserveValue) {
  const types = state.spoolTypes ?? defaultSpoolTypes();
  const prev  = preserveValue ?? selectSpool.value;
  selectSpool.innerHTML = '';
  for (const t of types) {
    const opt = document.createElement('option');
    opt.value = String(t.tare);
    opt.textContent = `${t.name} (${t.tare}g empty)`;
    selectSpool.appendChild(opt);
  }
  selectSpool.value = prev;
  // Fall back to first option if saved value no longer exists
  if (!selectSpool.value && types.length > 0) {
    selectSpool.value = String(types[0].tare);
  }
}

// ── Open / Close ───────────────────────────────────────────────────────────

function openModal(printer, slot) {
  activeEdit = { printerId: printer.id, slot };
  const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_TYPES[0].tare };

  modalTitle.textContent = `Update Slot ${slot} — ${printer.name}`;

  // Weigh tab setup — populate dropdown then select saved spool
  populateSpoolSelect(String(slotData.spoolWeight ?? DEFAULT_SPOOL_TYPES[0].tare));
  inputWeight.value = slotData.grams !== null
    ? String(slotData.grams + (slotData.spoolWeight ?? DEFAULT_SPOOL_TYPES[0].tare))
    : '';
  updateRemainingDisplay();

  // Adjust tab setup
  inputAdjustGrams.value = '';
  setAdjustMode('subtract');

  // Always open on the Weigh tab
  switchTab('weigh');

  modalOverlay.classList.remove('hidden');

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncModalToViewport);
    window.visualViewport.addEventListener('scroll', syncModalToViewport);
    syncModalToViewport();
  }

  setTimeout(() => inputWeight.focus(), 80);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  activeEdit = null;
  inputWeight.value = '';
  inputAdjustGrams.value = '';

  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', syncModalToViewport);
    window.visualViewport.removeEventListener('scroll', syncModalToViewport);
  }
  resetModalViewport();
}

// ── Weigh tab live calc ────────────────────────────────────────────────────

function updateRemainingDisplay() {
  const total  = parseFloat(inputWeight.value);
  const spoolW = parseInt(selectSpool.value, 10);

  if (!inputWeight.value.trim() || isNaN(total)) {
    remainingVal.textContent = '—';
    remainingVal.className = 'filament-remaining-value invalid';
    return;
  }

  const filament = Math.round(total - spoolW);
  remainingVal.textContent = filament + 'g';
  remainingVal.className = 'filament-remaining-value' + (filament < LOW_GRAM_THRESHOLD ? ' low' : '');
}

inputWeight.addEventListener('input', updateRemainingDisplay);
selectSpool.addEventListener('change', updateRemainingDisplay);

// ── Save ───────────────────────────────────────────────────────────────────

btnModalOk.addEventListener('click', () => {
  if (!activeEdit) return;

  if (activeTab === 'weigh') {
    const total  = parseFloat(inputWeight.value);
    const spoolW = parseInt(selectSpool.value, 10);

    if (!inputWeight.value.trim() || isNaN(total)) {
      inputWeight.focus();
      inputWeight.style.borderColor = 'var(--color-danger)';
      setTimeout(() => { inputWeight.style.borderColor = ''; }, 1000);
      return;
    }

    state.printers[activeEdit.printerId][activeEdit.slot] = {
      grams: Math.round(total - spoolW),
      spoolWeight: spoolW,
      updatedAt: new Date().toISOString(),
    };

  } else {
    const slotData = state.printers[activeEdit.printerId]?.[activeEdit.slot] ?? null;
    const current  = slotData?.grams ?? null;
    const delta    = parseFloat(inputAdjustGrams.value);

    if (current === null) {
      alert('No filament recorded yet for this slot. Use the "Weigh Spool" tab to set an initial weight first.');
      return;
    }

    if (!inputAdjustGrams.value.trim() || isNaN(delta)) {
      inputAdjustGrams.focus();
      inputAdjustGrams.style.borderColor = 'var(--color-danger)';
      setTimeout(() => { inputAdjustGrams.style.borderColor = ''; }, 1000);
      return;
    }

    const after = adjustMode === 'subtract' ? current - delta : current + delta;
    state.printers[activeEdit.printerId][activeEdit.slot] = {
      ...slotData,
      grams: Math.round(after),
      updatedAt: new Date().toISOString(),
    };
  }

  saveState();
  renderHome();
  closeModal();
});

btnModalCancel.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && !modalOverlay.classList.contains('hidden')) {
    btnModalOk.click();
  }
});

// ── Settings ───────────────────────────────────────────────────────────────

function renderSettings() {
  appVersionEl.textContent = 'v' + APP_VERSION;
  updateLastExportedDisplay();
  renderPrinterList();
  renderSpoolTypes();
}

function updateLastExportedDisplay() {
  const text = state.lastExported
    ? new Date(state.lastExported).toLocaleString()
    : 'Never';
  lastExportedDisplay.textContent = text;
  homeLastSaved.textContent = state.lastExported
    ? 'Last saved: ' + formatRelativeTime(state.lastExported)
    : 'Not yet saved — tap to back up';
}

// ── Export / Save ──────────────────────────────────────────────────────────

function doSave() {
  state.lastExported = new Date().toISOString();
  saveState();
  updateLastExportedDisplay();

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'filament-tracker.json'; // fixed name so each save overwrites the last
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

btnExport.addEventListener('click', doSave);
btnHomeSave.addEventListener('click', doSave);

// ── Import ─────────────────────────────────────────────────────────────────

btnImport.addEventListener('click', () => importInput.click());

importInput.addEventListener('change', () => {
  const file = importInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);

      if (!parsed.printers) {
        alert('This file does not look like a valid Filament Tracker export. Import cancelled.');
        return;
      }

      const confirmed = confirm(
        'Import this file?\n\nThis will OVERWRITE all current filament data. This cannot be undone.'
      );

      if (confirmed) {
        state = parsed;
        if (!state.spoolTypes)  state.spoolTypes  = defaultSpoolTypes();
        if (!state.printerList) state.printerList = defaultPrinterList();
        saveState();
        populateSpoolSelect();
        renderHome();
        renderSettings();
        alert('Data imported successfully.');
      }
    } catch (_) {
      alert('Could not read the file. Make sure it is a valid JSON export from this app.');
    }
    importInput.value = '';
  };
  reader.readAsText(file);
});

// ── Printer management ─────────────────────────────────────────────────────

let editingPrinterIndex = null; // null = new, number = editing
let selectedAmsType = 'ams'; // 'ams' | 'ams-lite' | 'single'

function renderPrinterList() {
  const printers = state.printerList ?? defaultPrinterList();
  printerListSettings.innerHTML = '';

  for (let i = 0; i < printers.length; i++) {
    const p = printers[i];
    const row = document.createElement('div');
    row.className = 'spool-type-row';

    const amsLabel = {
      'ams':      'AMS — 4 slots in a row',
      'ams-lite': 'AMS Lite — 2×2 grid (1 4 / 2 3)',
      'single':   'Single Spool — 1 slot',
    }[p.amsType ?? (p.amsLite ? 'ams-lite' : 'ams')] ?? 'AMS';

    const info = document.createElement('div');
    info.className = 'spool-type-info';
    info.innerHTML = `
      <span class="spool-type-name">${p.name}</span>
      <span class="spool-type-tare">${amsLabel}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'spool-type-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'spool-action-btn edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit ${p.name}`);
    editBtn.addEventListener('click', () => openPrinterModal(i));

    const delBtn = document.createElement('button');
    delBtn.className = 'spool-action-btn delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete ${p.name}`);
    delBtn.disabled = printers.length <= 1;
    delBtn.addEventListener('click', () => deletePrinter(i));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(info);
    row.appendChild(actions);
    printerListSettings.appendChild(row);
  }
}

function setAmsType(type) {
  selectedAmsType = type;
  btnAmsStandard.classList.toggle('active', type === 'ams');
  btnAmsLite.classList.toggle('active',     type === 'ams-lite');
  btnAmsSingle.classList.toggle('active',   type === 'single');
  btnAmsStandard.setAttribute('aria-pressed', type === 'ams');
  btnAmsLite.setAttribute('aria-pressed',     type === 'ams-lite');
  btnAmsSingle.setAttribute('aria-pressed',   type === 'single');
}

function openPrinterModal(index = null) {
  editingPrinterIndex = index;
  const printers = state.printerList ?? defaultPrinterList();

  if (index !== null) {
    printerModalTitle.textContent = 'Edit Printer';
    inputPrinterName.value = printers[index].name;
    setAmsType(printers[index].amsType ?? (printers[index].amsLite ? 'ams-lite' : 'ams'));
  } else {
    printerModalTitle.textContent = 'Add Printer';
    inputPrinterName.value = '';
    setAmsType('ams');
  }

  printerModalOverlay.classList.remove('hidden');

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncPrinterModal);
    window.visualViewport.addEventListener('scroll', syncPrinterModal);
    syncPrinterModal();
  }

  setTimeout(() => inputPrinterName.focus(), 80);
}

function syncPrinterModal() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  printerModalOverlay.style.top    = vv.offsetTop + 'px';
  printerModalOverlay.style.left   = vv.offsetLeft + 'px';
  printerModalOverlay.style.height = vv.height + 'px';
  printerModalOverlay.style.width  = vv.width + 'px';
}

function closePrinterModal() {
  printerModalOverlay.classList.add('hidden');
  editingPrinterIndex = null;
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', syncPrinterModal);
    window.visualViewport.removeEventListener('scroll', syncPrinterModal);
  }
  ['top','left','height','width'].forEach(p => printerModalOverlay.style[p] = '');
}

function deletePrinter(index) {
  const printers = state.printerList ?? defaultPrinterList();
  if (printers.length <= 1) return;
  const p = printers[index];
  if (!confirm(`Delete "${p.name}"?\n\nAll filament data recorded for this printer will be permanently removed.`)) return;
  delete state.printers[p.id];
  printers.splice(index, 1);
  saveState();
  renderPrinterList();
  renderHome();
}

btnAddPrinter.addEventListener('click',   () => openPrinterModal(null));
btnPrinterCancel.addEventListener('click', closePrinterModal);
btnAmsStandard.addEventListener('click',  () => setAmsType('ams'));
btnAmsLite.addEventListener('click',      () => setAmsType('ams-lite'));
btnAmsSingle.addEventListener('click',    () => setAmsType('single'));

printerModalOverlay.addEventListener('click', (e) => {
  if (e.target === printerModalOverlay) closePrinterModal();
});

btnPrinterSave.addEventListener('click', () => {
  const name = inputPrinterName.value.trim();

  if (!name) {
    inputPrinterName.focus();
    inputPrinterName.style.borderColor = 'var(--color-danger)';
    setTimeout(() => { inputPrinterName.style.borderColor = ''; }, 1000);
    return;
  }

  if (!state.printerList) state.printerList = defaultPrinterList();

  if (editingPrinterIndex !== null) {
    state.printerList[editingPrinterIndex] = {
      ...state.printerList[editingPrinterIndex],
      name,
      amsType: selectedAmsType,
    };
  } else {
    const newId = `printer-${Date.now()}`;
    state.printerList.push({ id: newId, name, amsType: selectedAmsType });
    state.printers[newId] = initSlotData(newId);
  }

  saveState();
  renderPrinterList();
  renderHome();
  closePrinterModal();
});

// ── Spool type management ──────────────────────────────────────────────────

let editingSpoolIndex = null; // null = new, number = editing existing

function renderSpoolTypes() {
  const types = state.spoolTypes ?? defaultSpoolTypes();
  spoolTypesList.innerHTML = '';

  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const row = document.createElement('div');
    row.className = 'spool-type-row';

    const info = document.createElement('div');
    info.className = 'spool-type-info';
    info.innerHTML = `
      <span class="spool-type-name">${t.name}</span>
      <span class="spool-type-tare">${t.tare}g empty spool weight</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'spool-type-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'spool-action-btn edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit ${t.name}`);
    editBtn.addEventListener('click', () => openSpoolModal(i));

    const delBtn = document.createElement('button');
    delBtn.className = 'spool-action-btn delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete ${t.name}`);
    delBtn.disabled = types.length <= 1;
    delBtn.addEventListener('click', () => deleteSpoolType(i));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(info);
    row.appendChild(actions);
    spoolTypesList.appendChild(row);
  }
}

function openSpoolModal(index = null) {
  editingSpoolIndex = index;
  const types = state.spoolTypes ?? defaultSpoolTypes();

  if (index !== null) {
    spoolModalTitle.textContent = 'Edit Spool Type';
    inputSpoolName.value = types[index].name;
    inputSpoolTare.value = String(types[index].tare);
  } else {
    spoolModalTitle.textContent = 'Add Spool Type';
    inputSpoolName.value = '';
    inputSpoolTare.value = '';
  }

  spoolModalOverlay.classList.remove('hidden');

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncSpoolModal);
    window.visualViewport.addEventListener('scroll', syncSpoolModal);
    syncSpoolModal();
  }

  setTimeout(() => inputSpoolName.focus(), 80);
}

function syncSpoolModal() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  spoolModalOverlay.style.top    = vv.offsetTop + 'px';
  spoolModalOverlay.style.left   = vv.offsetLeft + 'px';
  spoolModalOverlay.style.height = vv.height + 'px';
  spoolModalOverlay.style.width  = vv.width + 'px';
}

function closeSpoolModal() {
  spoolModalOverlay.classList.add('hidden');
  editingSpoolIndex = null;
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', syncSpoolModal);
    window.visualViewport.removeEventListener('scroll', syncSpoolModal);
  }
  ['top','left','height','width'].forEach(p => spoolModalOverlay.style[p] = '');
}

function deleteSpoolType(index) {
  const types = state.spoolTypes ?? defaultSpoolTypes();
  if (types.length <= 1) return;
  const name = types[index].name;
  if (!confirm(`Delete "${name}"?\n\nThis won't affect filament already recorded — those weights are already saved.`)) return;
  types.splice(index, 1);
  saveState();
  renderSpoolTypes();
  populateSpoolSelect();
}

btnAddSpool.addEventListener('click', () => openSpoolModal(null));
btnSpoolCancel.addEventListener('click', closeSpoolModal);

spoolModalOverlay.addEventListener('click', (e) => {
  if (e.target === spoolModalOverlay) closeSpoolModal();
});

btnSpoolSave.addEventListener('click', () => {
  const name = inputSpoolName.value.trim();
  const tare = parseInt(inputSpoolTare.value, 10);

  if (!name) {
    inputSpoolName.focus();
    inputSpoolName.style.borderColor = 'var(--color-danger)';
    setTimeout(() => { inputSpoolName.style.borderColor = ''; }, 1000);
    return;
  }

  if (!inputSpoolTare.value.trim() || isNaN(tare) || tare < 0) {
    inputSpoolTare.focus();
    inputSpoolTare.style.borderColor = 'var(--color-danger)';
    setTimeout(() => { inputSpoolTare.style.borderColor = ''; }, 1000);
    return;
  }

  if (!state.spoolTypes) state.spoolTypes = defaultSpoolTypes();

  if (editingSpoolIndex !== null) {
    state.spoolTypes[editingSpoolIndex] = {
      ...state.spoolTypes[editingSpoolIndex],
      name,
      tare,
    };
  } else {
    state.spoolTypes.push({ id: `custom-${Date.now()}`, name, tare });
  }

  saveState();
  renderSpoolTypes();
  populateSpoolSelect();
  closeSpoolModal();
});

// ── Service Worker ─────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Init ───────────────────────────────────────────────────────────────────

populateSpoolSelect();
updateLastExportedDisplay();
renderHome();
