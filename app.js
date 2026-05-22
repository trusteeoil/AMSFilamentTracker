'use strict';

const APP_VERSION = '1.7.0';

const DEFAULT_PRINTERS = [
  { id: 'x2d', name: 'X2D', amsType: 'ams-hub'  },
  { id: 'p2s', name: 'P2S', amsType: 'ams'      },
  { id: 'a1',  name: 'A1',  amsType: 'ams-lite' },
];

function getSlotOrder(amsType) {
  if (amsType === 'ams-lite') return [1, 4, 2, 3];
  if (amsType === 'single')   return [1];
  if (amsType === 'ams-hub')  return [1, 2, 3, 4, 5];
  return [1, 2, 3, 4];
}

const DEFAULT_SPOOL_TYPES = [
  { id: 'elegoo-cardboard', name: 'Elegoo Cardboard', tare: 165 },
  { id: 'bambu-plastic',    name: 'Bambu Plastic',    tare: 256 },
];

const DEFAULT_FILAMENT_TYPES = [
  { id: 'pla',      name: 'PLA'     },
  { id: 'pla-plus', name: 'PLA+'    },
  { id: 'petg',     name: 'PETG'    },
  { id: 'petg-cf',  name: 'PETG-CF' },
  { id: 'abs',      name: 'ABS'     },
  { id: 'asa',      name: 'ASA'     },
  { id: 'tpu',      name: 'TPU'     },
  { id: 'nylon',    name: 'Nylon'   },
  { id: 'pc',       name: 'PC'      },
  { id: 'pva',      name: 'PVA'     },
  { id: 'support',  name: 'Support' },
];

const DEFAULT_COLORS = [
  { id: 'black',   name: 'Black',   hex: '#1a1a1a' },
  { id: 'white',   name: 'White',   hex: '#f0f0f0' },
  { id: 'grey',    name: 'Grey',    hex: '#9ca3af' },
  { id: 'silver',  name: 'Silver',  hex: '#c0c0c0' },
  { id: 'red',     name: 'Red',     hex: '#dc2626' },
  { id: 'orange',  name: 'Orange',  hex: '#ea580c' },
  { id: 'yellow',  name: 'Yellow',  hex: '#ca8a04' },
  { id: 'green',   name: 'Green',   hex: '#16a34a' },
  { id: 'teal',    name: 'Teal',    hex: '#0d9488' },
  { id: 'blue',    name: 'Blue',    hex: '#2563eb' },
  { id: 'navy',    name: 'Navy',    hex: '#1e3a8a' },
  { id: 'purple',  name: 'Purple',  hex: '#9333ea' },
  { id: 'pink',    name: 'Pink',    hex: '#ec4899' },
  { id: 'brown',   name: 'Brown',   hex: '#92400e' },
  { id: 'natural', name: 'Natural', hex: '#fef3c7' },
];
const STORAGE_KEY = 'filament-tracker-data';
const LOW_GRAM_THRESHOLD = 100;

// ── State ──────────────────────────────────────────────────────────────────

let state = loadState();

function defaultSpoolTypes() {
  return DEFAULT_SPOOL_TYPES.map(t => ({ ...t }));
}

function defaultFilamentTypes() {
  return DEFAULT_FILAMENT_TYPES.map(t => ({ ...t }));
}

function defaultColors() {
  return DEFAULT_COLORS.map(c => ({ ...c }));
}

function defaultPrinterList() {
  return DEFAULT_PRINTERS.map(p => ({ ...p }));
}

function initSlotData() {
  const slots = {};
  for (let s = 1; s <= 5; s++) { // 5 covers all types incl. ams-hub
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
    filamentTypes: defaultFilamentTypes(),
    colors: defaultColors(),
    lastExported: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.spoolTypes)    parsed.spoolTypes    = defaultSpoolTypes();
      if (!parsed.printerList)   parsed.printerList   = defaultPrinterList();
      if (!parsed.filamentTypes) parsed.filamentTypes = defaultFilamentTypes();
      if (!parsed.colors)        parsed.colors        = defaultColors();
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
const btnSortPrinters      = document.getElementById('btn-sort-printers');
const btnSortSpoolTypes    = document.getElementById('btn-sort-spools');
const btnSortFilamentTypes = document.getElementById('btn-sort-filament-types');
const btnSortColors        = document.getElementById('btn-sort-colors');

const modalOverlay  = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const inputWeight   = document.getElementById('input-weight');
const selectSpool   = document.getElementById('select-spool');
const remainingVal  = document.getElementById('filament-remaining-value');
const btnModalOk    = document.getElementById('btn-modal-ok');
const btnModalCancel = document.getElementById('btn-modal-cancel');

// Filament type + color selects in weigh panel
const selectFilamentType = document.getElementById('select-filament-type');
const selectColor        = document.getElementById('select-color');
const colorDotPreview    = document.getElementById('color-dot-preview');

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
const btnAmsHub            = document.getElementById('btn-ams-hub');
const btnAmsSingle         = document.getElementById('btn-ams-single');
const btnPrinterCancel     = document.getElementById('btn-printer-cancel');
const btnPrinterSave       = document.getElementById('btn-printer-save');
const printerListSettings  = document.getElementById('printer-list-settings');
const btnAddPrinter        = document.getElementById('btn-add-printer');

// Filament type modal refs
const filamentTypeModalOverlay = document.getElementById('filament-type-modal-overlay');
const filamentTypeModalTitle   = document.getElementById('filament-type-modal-title');
const inputFilamentTypeName    = document.getElementById('input-filament-type-name');
const btnFilamentTypeCancel    = document.getElementById('btn-filament-type-cancel');
const btnFilamentTypeSave      = document.getElementById('btn-filament-type-save');
const filamentTypesList        = document.getElementById('filament-types-list');
const btnAddFilamentType       = document.getElementById('btn-add-filament-type');

// Color modal refs
const colorModalOverlay  = document.getElementById('color-modal-overlay');
const colorModalTitle    = document.getElementById('color-modal-title');
const inputColorName     = document.getElementById('input-color-name');
const inputColorHex      = document.getElementById('input-color-hex');
const btnColorCancel     = document.getElementById('btn-color-cancel');
const btnColorSave       = document.getElementById('btn-color-save');
const colorsList         = document.getElementById('colors-list');
const btnAddColor        = document.getElementById('btn-add-color');

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
    const subtitleText = { 'ams-lite': 'AMS Lite', 'single': 'Single Spool', 'ams-hub': 'AMS + Ext' }[printer.amsType] ?? '';
    const subtitle = subtitleText ? `<span class="printer-subtitle">${subtitleText}</span>` : '';
    header.innerHTML = `<span class="printer-name">${printer.name}</span>${subtitle}`;

    const slotsDiv = document.createElement('div');
    const amsClassMap = { 'ams-lite': ' ams-lite', 'single': ' single', 'ams-hub': ' ams-hub' };
    slotsDiv.className = 'printer-slots' + (amsClassMap[printer.amsType] ?? '');

    const allColors        = state.colors ?? defaultColors();
    const allFilamentTypes = state.filamentTypes ?? defaultFilamentTypes();

    for (const slot of printer.slotOrder) {
      const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_TYPES[0].tare };
      const grams = slotData.grams;
      const isEmpty = grams === 0;
      const isLow   = grams !== null && grams < LOW_GRAM_THRESHOLD; // 0 is also low
      const timeLabel = formatRelativeTime(slotData.updatedAt ?? null);

      const colorEntry = slotData.color ? allColors.find(c => c.id === slotData.color) : null;
      const typeEntry  = slotData.filamentType ? allFilamentTypes.find(t => t.id === slotData.filamentType) : null;

      const isExternal = printer.amsType === 'ams-hub' && slot === 5;
      const slotLabel  = isExternal ? 'External' : `Slot ${slot}`;
      const gramsText  = isEmpty ? 'EMPTY' : (grams !== null ? grams : '—');
      const unitText   = isEmpty ? '' : 'grams';

      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      if (isExternal) btn.classList.add('slot-external');
      btn.style.boxShadow = colorEntry ? `inset 8px 0 0 0 ${colorEntry.hex}` : '';
      btn.setAttribute('aria-label', `${printer.name} ${slotLabel}: ${isEmpty ? 'empty' : grams !== null ? grams + 'g' : 'not set'}${typeEntry ? ', ' + typeEntry.name : ''}${colorEntry ? ', ' + colorEntry.name : ''}${timeLabel ? ', updated ' + timeLabel : ''}. Tap to edit.`);

      btn.innerHTML = `
        <span class="slot-label">${slotLabel}</span>
        <span class="slot-type">${typeEntry ? typeEntry.name : ''}</span>
        <span class="slot-grams${isLow ? ' low' : ''}">${gramsText}</span>
        <span class="slot-unit">${unitText}</span>
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

  const after = Math.max(0, adjustMode === 'subtract' ? current - delta : current + delta);
  adjustAfterValue.textContent = after === 0 ? 'Empty' : after + 'g';
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

function populateFilamentTypeSelect(preserveValue) {
  const types = state.filamentTypes ?? defaultFilamentTypes();
  const prev  = preserveValue ?? selectFilamentType.value;
  selectFilamentType.innerHTML = '<option value="">— None —</option>';
  for (const t of types) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    selectFilamentType.appendChild(opt);
  }
  selectFilamentType.value = prev;
}

function populateColorSelect(preserveValue) {
  const colors = state.colors ?? defaultColors();
  const prev   = preserveValue ?? selectColor.value;
  selectColor.innerHTML = '<option value="">— None —</option>';
  for (const c of colors) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    selectColor.appendChild(opt);
  }
  selectColor.value = prev;
  updateColorDotPreview();
}

function updateColorDotPreview() {
  const colors = state.colors ?? defaultColors();
  const entry  = colors.find(c => c.id === selectColor.value);
  colorDotPreview.style.background      = entry ? entry.hex : '';
  colorDotPreview.style.borderColor     = entry ? entry.hex : '';
  colorDotPreview.style.opacity         = entry ? '1' : '0';
}

selectColor.addEventListener('change', updateColorDotPreview);

// ── Open / Close ───────────────────────────────────────────────────────────

function openModal(printer, slot) {
  activeEdit = { printerId: printer.id, slot };
  const defaultTare = state.spoolTypes?.[0]?.tare ?? DEFAULT_SPOOL_TYPES[0].tare;
  const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: defaultTare };

  modalTitle.textContent = `Update Slot ${slot} — ${printer.name}`;

  // Weigh tab setup — populate dropdowns then select saved values
  populateSpoolSelect(String(slotData.spoolWeight ?? defaultTare));
  populateFilamentTypeSelect(slotData.filamentType ?? '');
  populateColorSelect(slotData.color ?? '');
  inputWeight.value = slotData.grams !== null
    ? String(slotData.grams + (slotData.spoolWeight ?? defaultTare))
    : '';
  updateRemainingDisplay();

  // Adjust tab setup
  inputAdjustGrams.value = '';
  setAdjustMode('subtract');

  // Always open on the Weigh tab
  switchTab('weigh');

  modalOverlay.classList.remove('hidden');
  setTimeout(() => inputWeight.focus(), 80);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  activeEdit = null;
  inputWeight.value = '';
  inputAdjustGrams.value = '';

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
  if (filament <= 0) {
    remainingVal.textContent = 'Empty';
    remainingVal.className = 'filament-remaining-value low';
    return;
  }
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

    const existingSlot = state.printers[activeEdit.printerId]?.[activeEdit.slot] ?? {};
    state.printers[activeEdit.printerId][activeEdit.slot] = {
      ...existingSlot,
      grams: Math.max(0, Math.round(total - spoolW)),
      spoolWeight: spoolW,
      updatedAt: new Date().toISOString(),
      filamentType: selectFilamentType.value || null,
      color: selectColor.value || null,
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
      grams: Math.max(0, Math.round(after)),
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
  // Reset sort modes whenever settings page is opened
  printerSortMode      = false;
  spoolSortMode        = false;
  filamentTypeSortMode = false;
  colorSortMode        = false;
  renderPrinterList();
  renderSpoolTypes();
  renderFilamentTypes();
  renderColors();
}

function updateLastExportedDisplay() {
  lastExportedDisplay.textContent = state.lastExported
    ? new Date(state.lastExported).toLocaleString()
    : 'Never';
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
        if (!state.spoolTypes)    state.spoolTypes    = defaultSpoolTypes();
        if (!state.printerList)   state.printerList   = defaultPrinterList();
        if (!state.filamentTypes) state.filamentTypes = defaultFilamentTypes();
        if (!state.colors)        state.colors        = defaultColors();
        saveState();
        populateSpoolSelect();
        populateFilamentTypeSelect();
        populateColorSelect();
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

let editingPrinterIndex    = null;
let selectedAmsType        = 'ams';
let printerSortMode        = false;
let spoolSortMode          = false;
let filamentTypeSortMode   = false;
let colorSortMode          = false;

function renderPrinterList() {
  const printers = state.printerList ?? defaultPrinterList();
  printerListSettings.innerHTML = '';

  // Sync sort toggle button label
  btnSortPrinters.textContent = printerSortMode ? 'Done' : 'Sort';
  btnSortPrinters.classList.toggle('active', printerSortMode);

  for (let i = 0; i < printers.length; i++) {
    const p = printers[i];
    const row = document.createElement('div');
    row.className = 'spool-type-row';

    const amsLabel = {
      'ams':      'AMS — 4 slots in a row',
      'ams-hub':  'AMS + Ext — 4 slots + 1 external',
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

    if (printerSortMode) {
      const upBtn = document.createElement('button');
      upBtn.className = 'sort-btn';
      upBtn.textContent = '↑';
      upBtn.setAttribute('aria-label', `Move ${p.name} up`);
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', () => movePrinter(i, -1));

      const downBtn = document.createElement('button');
      downBtn.className = 'sort-btn';
      downBtn.textContent = '↓';
      downBtn.setAttribute('aria-label', `Move ${p.name} down`);
      downBtn.disabled = i === printers.length - 1;
      downBtn.addEventListener('click', () => movePrinter(i, 1));

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
    } else {
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
    }

    row.appendChild(info);
    row.appendChild(actions);
    printerListSettings.appendChild(row);
  }
}

function movePrinter(index, direction) {
  const list = state.printerList;
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[index], list[newIdx]] = [list[newIdx], list[index]];
  saveState();
  renderPrinterList();
  renderHome();
}

btnSortPrinters.addEventListener('click', () => {
  printerSortMode = !printerSortMode;
  renderPrinterList();
});

function setAmsType(type) {
  selectedAmsType = type;
  btnAmsStandard.classList.toggle('active', type === 'ams');
  btnAmsHub.classList.toggle('active',      type === 'ams-hub');
  btnAmsLite.classList.toggle('active',     type === 'ams-lite');
  btnAmsSingle.classList.toggle('active',   type === 'single');
  btnAmsStandard.setAttribute('aria-pressed', type === 'ams');
  btnAmsHub.setAttribute('aria-pressed',      type === 'ams-hub');
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
  setTimeout(() => inputPrinterName.focus(), 80);
}

function closePrinterModal() {
  printerModalOverlay.classList.add('hidden');
  editingPrinterIndex = null;
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
btnAmsHub.addEventListener('click',       () => setAmsType('ams-hub'));
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

  // Sync sort toggle button label
  btnSortSpoolTypes.textContent = spoolSortMode ? 'Done' : 'Sort';
  btnSortSpoolTypes.classList.toggle('active', spoolSortMode);

  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const row = document.createElement('div');
    row.className = 'spool-type-row';

    const isDefault = i === 0;
    const info = document.createElement('div');
    info.className = 'spool-type-info';
    info.innerHTML = `
      <span class="spool-type-name">${t.name}${isDefault ? ' <span class="default-badge">default</span>' : ''}</span>
      <span class="spool-type-tare">${t.tare}g empty spool weight</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'spool-type-actions';

    if (spoolSortMode) {
      const upBtn = document.createElement('button');
      upBtn.className = 'sort-btn';
      upBtn.textContent = '↑';
      upBtn.setAttribute('aria-label', `Move ${t.name} up`);
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', () => moveSpoolType(i, -1));

      const downBtn = document.createElement('button');
      downBtn.className = 'sort-btn';
      downBtn.textContent = '↓';
      downBtn.setAttribute('aria-label', `Move ${t.name} down`);
      downBtn.disabled = i === types.length - 1;
      downBtn.addEventListener('click', () => moveSpoolType(i, 1));

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
    } else {
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
    }

    row.appendChild(info);
    row.appendChild(actions);
    spoolTypesList.appendChild(row);
  }
}

function moveSpoolType(index, direction) {
  const types = state.spoolTypes;
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= types.length) return;
  [types[index], types[newIdx]] = [types[newIdx], types[index]];
  saveState();
  renderSpoolTypes();
  populateSpoolSelect();
}

btnSortSpoolTypes.addEventListener('click', () => {
  spoolSortMode = !spoolSortMode;
  renderSpoolTypes();
});

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
  setTimeout(() => inputSpoolName.focus(), 80);
}

function closeSpoolModal() {
  spoolModalOverlay.classList.add('hidden');
  editingSpoolIndex = null;
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

// ── Filament type management ───────────────────────────────────────────────

let editingFilamentTypeIndex = null;

function renderFilamentTypes() {
  const types = state.filamentTypes ?? defaultFilamentTypes();
  filamentTypesList.innerHTML = '';

  btnSortFilamentTypes.textContent = filamentTypeSortMode ? 'Done' : 'Sort';
  btnSortFilamentTypes.classList.toggle('active', filamentTypeSortMode);

  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const row = document.createElement('div');
    row.className = 'spool-type-row';

    const info = document.createElement('div');
    info.className = 'spool-type-info';
    info.innerHTML = `
      <span class="spool-type-name">${t.name}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'spool-type-actions';

    if (filamentTypeSortMode) {
      const upBtn = document.createElement('button');
      upBtn.className = 'sort-btn';
      upBtn.textContent = '↑';
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', () => moveFilamentType(i, -1));

      const downBtn = document.createElement('button');
      downBtn.className = 'sort-btn';
      downBtn.textContent = '↓';
      downBtn.disabled = i === types.length - 1;
      downBtn.addEventListener('click', () => moveFilamentType(i, 1));

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className = 'spool-action-btn edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openFilamentTypeModal(i));

      const delBtn = document.createElement('button');
      delBtn.className = 'spool-action-btn delete-btn';
      delBtn.textContent = 'Delete';
      delBtn.disabled = types.length <= 1;
      delBtn.addEventListener('click', () => deleteFilamentType(i));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    }

    row.appendChild(info);
    row.appendChild(actions);
    filamentTypesList.appendChild(row);
  }
}

function moveFilamentType(index, direction) {
  const types = state.filamentTypes;
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= types.length) return;
  [types[index], types[newIdx]] = [types[newIdx], types[index]];
  saveState();
  renderFilamentTypes();
  populateFilamentTypeSelect();
}

btnSortFilamentTypes.addEventListener('click', () => {
  filamentTypeSortMode = !filamentTypeSortMode;
  renderFilamentTypes();
});

function openFilamentTypeModal(index = null) {
  editingFilamentTypeIndex = index;
  const types = state.filamentTypes ?? defaultFilamentTypes();

  if (index !== null) {
    filamentTypeModalTitle.textContent = 'Edit Filament Type';
    inputFilamentTypeName.value = types[index].name;
  } else {
    filamentTypeModalTitle.textContent = 'Add Filament Type';
    inputFilamentTypeName.value = '';
  }

  filamentTypeModalOverlay.classList.remove('hidden');
  setTimeout(() => inputFilamentTypeName.focus(), 80);
}

function closeFilamentTypeModal() {
  filamentTypeModalOverlay.classList.add('hidden');
  editingFilamentTypeIndex = null;
}

function deleteFilamentType(index) {
  const types = state.filamentTypes ?? defaultFilamentTypes();
  if (types.length <= 1) return;
  const name = types[index].name;
  if (!confirm(`Delete "${name}"?\n\nSlots using this type will keep their saved data, the label will just not display.`)) return;
  types.splice(index, 1);
  saveState();
  renderFilamentTypes();
  populateFilamentTypeSelect();
}

btnAddFilamentType.addEventListener('click', () => openFilamentTypeModal(null));
btnFilamentTypeCancel.addEventListener('click', closeFilamentTypeModal);

filamentTypeModalOverlay.addEventListener('click', (e) => {
  if (e.target === filamentTypeModalOverlay) closeFilamentTypeModal();
});

btnFilamentTypeSave.addEventListener('click', () => {
  const name = inputFilamentTypeName.value.trim();

  if (!name) {
    inputFilamentTypeName.focus();
    inputFilamentTypeName.style.borderColor = 'var(--color-danger)';
    setTimeout(() => { inputFilamentTypeName.style.borderColor = ''; }, 1000);
    return;
  }

  if (!state.filamentTypes) state.filamentTypes = defaultFilamentTypes();

  if (editingFilamentTypeIndex !== null) {
    state.filamentTypes[editingFilamentTypeIndex] = {
      ...state.filamentTypes[editingFilamentTypeIndex],
      name,
    };
  } else {
    state.filamentTypes.push({ id: `type-${Date.now()}`, name });
  }

  saveState();
  renderFilamentTypes();
  populateFilamentTypeSelect();
  closeFilamentTypeModal();
});

// ── Color management ───────────────────────────────────────────────────────

let editingColorIndex = null;

function renderColors() {
  const colors = state.colors ?? defaultColors();
  colorsList.innerHTML = '';

  btnSortColors.textContent = colorSortMode ? 'Done' : 'Sort';
  btnSortColors.classList.toggle('active', colorSortMode);

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const row = document.createElement('div');
    row.className = 'spool-type-row';

    const info = document.createElement('div');
    info.className = 'spool-type-info';
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = c.hex;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'spool-type-name';
    nameSpan.style.display = 'flex';
    nameSpan.style.alignItems = 'center';
    nameSpan.style.gap = '8px';
    nameSpan.appendChild(dot);
    nameSpan.appendChild(document.createTextNode(c.name));

    info.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'spool-type-actions';

    if (colorSortMode) {
      const upBtn = document.createElement('button');
      upBtn.className = 'sort-btn';
      upBtn.textContent = '↑';
      upBtn.disabled = i === 0;
      upBtn.addEventListener('click', () => moveColor(i, -1));

      const downBtn = document.createElement('button');
      downBtn.className = 'sort-btn';
      downBtn.textContent = '↓';
      downBtn.disabled = i === colors.length - 1;
      downBtn.addEventListener('click', () => moveColor(i, 1));

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className = 'spool-action-btn edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openColorModal(i));

      const delBtn = document.createElement('button');
      delBtn.className = 'spool-action-btn delete-btn';
      delBtn.textContent = 'Delete';
      delBtn.disabled = colors.length <= 1;
      delBtn.addEventListener('click', () => deleteColor(i));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    }

    row.appendChild(info);
    row.appendChild(actions);
    colorsList.appendChild(row);
  }
}

function moveColor(index, direction) {
  const colors = state.colors;
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= colors.length) return;
  [colors[index], colors[newIdx]] = [colors[newIdx], colors[index]];
  saveState();
  renderColors();
  populateColorSelect();
}

btnSortColors.addEventListener('click', () => {
  colorSortMode = !colorSortMode;
  renderColors();
});

function openColorModal(index = null) {
  editingColorIndex = index;
  const colors = state.colors ?? defaultColors();

  if (index !== null) {
    colorModalTitle.textContent = 'Edit Color';
    inputColorName.value = colors[index].name;
    inputColorHex.value  = colors[index].hex;
  } else {
    colorModalTitle.textContent = 'Add Color';
    inputColorName.value = '';
    inputColorHex.value  = '#2563eb';
  }

  colorModalOverlay.classList.remove('hidden');
  setTimeout(() => inputColorName.focus(), 80);
}

function closeColorModal() {
  colorModalOverlay.classList.add('hidden');
  editingColorIndex = null;
}

function deleteColor(index) {
  const colors = state.colors ?? defaultColors();
  if (colors.length <= 1) return;
  const name = colors[index].name;
  if (!confirm(`Delete "${name}"?\n\nSlots using this color will keep their saved data, the accent will just not display.`)) return;
  colors.splice(index, 1);
  saveState();
  renderColors();
  populateColorSelect();
  renderHome();
}

btnAddColor.addEventListener('click', () => openColorModal(null));
btnColorCancel.addEventListener('click', closeColorModal);

colorModalOverlay.addEventListener('click', (e) => {
  if (e.target === colorModalOverlay) closeColorModal();
});

btnColorSave.addEventListener('click', () => {
  const name = inputColorName.value.trim();
  const hex  = inputColorHex.value;

  if (!name) {
    inputColorName.focus();
    inputColorName.style.borderColor = 'var(--color-danger)';
    setTimeout(() => { inputColorName.style.borderColor = ''; }, 1000);
    return;
  }

  if (!state.colors) state.colors = defaultColors();

  if (editingColorIndex !== null) {
    state.colors[editingColorIndex] = {
      ...state.colors[editingColorIndex],
      name,
      hex,
    };
  } else {
    state.colors.push({ id: `color-${Date.now()}`, name, hex });
  }

  saveState();
  renderColors();
  populateColorSelect();
  renderHome();
  closeColorModal();
});

// ── Service Worker ─────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Init ───────────────────────────────────────────────────────────────────

populateSpoolSelect();
populateFilamentTypeSelect();
populateColorSelect();
updateLastExportedDisplay();
renderHome();
