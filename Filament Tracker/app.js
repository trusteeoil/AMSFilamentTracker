'use strict';

const APP_VERSION = '1.0.0';

const PRINTERS = [
  { id: 'x2d', name: 'X2D' },
  { id: 'p2s', name: 'P2S' },
  { id: 'a1',  name: 'A1'  },
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

// ── Render Home ────────────────────────────────────────────────────────────

function renderHome() {
  printerList.innerHTML = '';
  for (const printer of PRINTERS) {
    const card = document.createElement('div');
    card.className = 'printer-card';

    const header = document.createElement('div');
    header.className = 'printer-card-header';
    header.innerHTML = `<span class="printer-name">${printer.name}</span>`;

    const slotsDiv = document.createElement('div');
    slotsDiv.className = 'printer-slots';

    for (let slot = 1; slot <= 4; slot++) {
      const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_WEIGHT };
      const grams = slotData.grams;
      const isLow = grams !== null && grams < LOW_GRAM_THRESHOLD;

      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.setAttribute('aria-label', `${printer.name} slot ${slot}: ${grams !== null ? grams + 'g' : 'not set'}. Tap to edit.`);

      btn.innerHTML = `
        <span class="slot-label">Slot ${slot}</span>
        <span class="slot-grams${isLow ? ' low' : ''}">${grams !== null ? grams : '—'}</span>
        <span class="slot-unit">grams</span>
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

function openModal(printer, slot) {
  activeEdit = { printerId: printer.id, slot };
  const slotData = state.printers[printer.id]?.[slot] ?? { grams: null, spoolWeight: DEFAULT_SPOOL_WEIGHT };

  modalTitle.textContent = `Update Slot ${slot} — ${printer.name}`;
  selectSpool.value = String(slotData.spoolWeight ?? DEFAULT_SPOOL_WEIGHT);

  // If grams are stored, back-calculate total weight to pre-fill
  if (slotData.grams !== null && slotData.grams !== undefined) {
    inputWeight.value = String(slotData.grams + (slotData.spoolWeight ?? DEFAULT_SPOOL_WEIGHT));
  } else {
    inputWeight.value = '';
  }

  updateRemainingDisplay();
  modalOverlay.classList.remove('hidden');
  setTimeout(() => inputWeight.focus(), 80);
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  activeEdit = null;
  inputWeight.value = '';
}

function updateRemainingDisplay() {
  const total = parseFloat(inputWeight.value);
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

btnModalOk.addEventListener('click', () => {
  if (!activeEdit) return;
  const total = parseFloat(inputWeight.value);
  const spoolW = parseInt(selectSpool.value, 10);

  if (!inputWeight.value.trim() || isNaN(total)) {
    inputWeight.focus();
    inputWeight.style.borderColor = 'var(--color-danger)';
    setTimeout(() => { inputWeight.style.borderColor = ''; }, 1000);
    return;
  }

  const filament = Math.round(total - spoolW);
  state.printers[activeEdit.printerId][activeEdit.slot] = {
    grams: filament,
    spoolWeight: spoolW,
  };
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
