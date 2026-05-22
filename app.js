'use strict';

const APP_VERSION = '1.2.0';

const PRINTERS = [
  { id: 'x2d', name: 'X2D', slotOrder: [1, 2, 3, 4], amsLite: false },
  { id: 'p2s', name: 'P2S', slotOrder: [1, 2, 3, 4], amsLite: false },
  { id: 'a1',  name: 'A1',  slotOrder: [1, 4, 2, 3], amsLite: true  },
];

const SPOOL_TYPES = [
  { value: 165, label: 'Elegoo Cardboard (165g empty)' },
  { value: 256, label: 'Bambu Plastic (256g empty)' },
];

const DEFAULT_SPOOL_WEIGHT = 165;
const STORAGE_KEY = 'filament-tracker-data';
const LOW_GRAM_THRESHOLD = 100;

// ── State ──────────────────────────────────────────────────────────────────

let state = loadState();

function defaultState() {
  const data = {};
  for (const p of PRINTERS) {
    data[p.id] = {};
    for (let slot = 1; slot <= 4; slot++) {
      data[p.id][slot] = { grams: null, spoolWeight: DEFAULT_SPOOL_WEIGHT };
    }
  }
  return { printers: data, lastExported: null };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return defaultState();
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
  for (const printer of PRINTERS) {
    const card = document.createElement('div');
    card.className = 'printer-card';

    const header = document.createElement('div');
    header.className = 'printer-card-header';
    const subtitle = printer.amsLite ? '<span class="printer-subtitle">AMS Lite</span>' : '';
    header.innerHTML = `<span class="printer-name">${printer.name}</span>${subtitle}`;

    const slotsDiv = document.createElement('div');
    slotsDiv.className = 'printer-slots' + (printer.amsLite ? ' ams-lite' : '');

    for (const slot of printer.slotOrder) {
      const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_WEIGHT };
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

// ── Open / Close ───────────────────────────────────────────────────────────

function openModal(printer, slot) {
  activeEdit = { printerId: printer.id, slot };
  const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_WEIGHT };

  modalTitle.textContent = `Update Slot ${slot} — ${printer.name}`;

  // Weigh tab setup
  selectSpool.value = String(slotData.spoolWeight ?? DEFAULT_SPOOL_WEIGHT);
  inputWeight.value = slotData.grams !== null
    ? String(slotData.grams + (slotData.spoolWeight ?? DEFAULT_SPOOL_WEIGHT))
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
}

function updateLastExportedDisplay() {
  if (state.lastExported) {
    const d = new Date(state.lastExported);
    lastExportedDisplay.textContent = d.toLocaleString();
  } else {
    lastExportedDisplay.textContent = 'Never';
  }
}

// ── Export ─────────────────────────────────────────────────────────────────

btnExport.addEventListener('click', () => {
  state.lastExported = new Date().toISOString();
  saveState();
  updateLastExportedDisplay();

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `filament-tracker-${date}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

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
        saveState();
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

// ── Service Worker ─────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Init ───────────────────────────────────────────────────────────────────

renderHome();
