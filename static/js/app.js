const initialData = window.__INITIAL_DATA__ || {
  dashboard: {
    total_in: 0,
    total_cut: 0,
    total_remaining: 0,
    transaction_count: 0,
    active_numbers: 0,
  },
  grid: [],
  entries: [],
  cuts: [],
  people_summary: [],
};


const DEFAULT_PEOPLE = ['Suhadi Cua', 'Salmon', 'Alimin Bas', 'Afiq', 'Bur', 'Nure'];
const LEGACY_DEFAULT_NAME_RE = /^Nama\s+\d+$/i;

function getDefaultPersonName(index) {
  return DEFAULT_PEOPLE[index - 1] || `Nama ${index}`;
}

function normalizePersonName(value, index) {
  const text = String(value || '').trim();
  if (!text || LEGACY_DEFAULT_NAME_RE.test(text)) return getDefaultPersonName(index + 1);
  return text;
}

const state = {
  dashboard: initialData.dashboard,
  grid: initialData.grid,
  entries: initialData.entries,
  cuts: initialData.cuts,
  peopleSummary: initialData.people_summary || [],
  activeOnly: false,
  search: '',
  people: [],
  activePersonIndex: 1,
};

const statsGrid = document.getElementById('statsGrid');
const currentPath = window.location.pathname;
const isDashboardPage = currentPath === '/';
const isRekapanPage = currentPath === '/rekapan';
const gridBoard = document.getElementById('gridBoard');
const entryHistory = document.getElementById('entryHistory');
const alertBox = document.getElementById('alertBox');
const previewBox = document.getElementById('previewBox');
const entryForm = document.getElementById('entryForm');
const cutAllForm = document.getElementById('cutAllForm');
const searchNumber = document.getElementById('searchNumber');
const filterActiveBtn = document.getElementById('filterActiveBtn');
const rawInput = document.getElementById('raw_input');
const deleteAllHistoryBtn = document.getElementById('deleteAllHistoryBtn');
const savePeopleBtn = document.getElementById('savePeopleBtn');
const divisionBoard = document.getElementById('divisionBoard');
const personInputs = Array.from(document.querySelectorAll('.person-name'));
const personSelect = document.getElementById('personSelect');
const bonusNumberInput = document.getElementById('bonusNumberInput');
const BONUS_RUPIAH = 65000;
const activeCopyBox = document.getElementById('activeCopyBox');
const copyActiveBtn = document.getElementById('copyActiveBtn');
const historySearch = document.getElementById('historySearch');
const historyPagination = document.getElementById('historyPagination');
const personHeaderMenu = document.getElementById('personHeaderMenu');
const personGateButtons = document.getElementById('personGateButtons');
const activePersonBanner = document.getElementById('activePersonBanner');
const activePersonName = document.getElementById('activePersonName');
const changePersonBtn = document.getElementById('changePersonBtn');
const inputWorkArea = document.getElementById('inputWorkArea');
const noPersonNotice = document.getElementById('noPersonNotice');
const ocrPasteZone = document.getElementById('ocrPasteZone');
const convertImageBtn = document.getElementById('convertImageBtn');
const ocrStatus = document.getElementById('ocrStatus');
const ocrTextPreview = document.getElementById('ocrTextPreview');
const ocrPreviewPanel = document.getElementById('ocrPreviewPanel');
const ocrPreviewName = document.getElementById('ocrPreviewName');
const ocrPersonSelect = document.getElementById('ocrPersonSelect');
const ocrPreviewText = document.getElementById('ocrPreviewText');
const saveOcrPreviewBtn = document.getElementById('saveOcrPreviewBtn');
const cancelOcrPreviewBtn = document.getElementById('cancelOcrPreviewBtn');
const ocrConfidenceBox = document.getElementById('ocrConfidenceBox');
const ocrCameraBtn = document.getElementById('ocrCameraBtn');
const ocrGalleryBtn = document.getElementById('ocrGalleryBtn');
const ocrClipboardBtn = document.getElementById('ocrClipboardBtn');
const ocrCameraInput = document.getElementById('ocrCameraInput');
const ocrGalleryInput = document.getElementById('ocrGalleryInput');

state.historyPage = 1;
state.historySearch = '';
const HISTORY_PER_PAGE = 20;
let pastedOcrImageFile = null;
let pendingOcrText = '';
let lastRawOcrText = '';
let lastOcrConfidenceWarnings = [];
let lastOcrConfidenceScore = null;
const OCR_CORRECTION_STORAGE_KEY = 'nilai_parser_ocr_corrections';
const OCR_TOKEN_CORRECTION_STORAGE_KEY = 'nilai_parser_ocr_token_corrections';



function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function renderValueChips(item) {
  const details = Array.isArray(item.value_details) ? item.value_details : [];

  if (details.length) {
    return details.map(detail => {
      const personIndex = Number(detail.person_index || 0);

      // pakai nama terbaru dari input nama
      const name = personIndex >= 1 && personIndex <= 6
        ? (state.people[personIndex - 1] || getDefaultPersonName(personIndex))
        : (detail.person_name || 'Tanpa nama');

      return `<span class="value-chip" data-tooltip="${escapeHtml(name)}" title="${escapeHtml(name)}">${escapeHtml(detail.value)}</span>`;
    }).join(' ');
  }

  const valueList = Array.isArray(item.value_list) ? item.value_list : [];
  return valueList.length
    ? valueList.map(value => `<span class="value-chip">${escapeHtml(value)}</span>`).join(' ')
    : '-';
}

function formatNumber2(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '00';
  return String(num).padStart(2, '0');
}

function loadPeopleNames() {
  try {
    const saved = JSON.parse(localStorage.getItem('nilai_parser_people') || '[]');
    state.people = Array.from({ length: 6 }, (_, index) => normalizePersonName(saved[index], index));
  } catch {
    state.people = Array.from({ length: 6 }, (_, index) => getDefaultPersonName(index + 1));
  }

  localStorage.setItem('nilai_parser_people', JSON.stringify(state.people));

  personInputs.forEach((input, index) => {
    input.value = state.people[index] || getDefaultPersonName(index + 1);
  });
  updatePersonSelectOptions();
  renderPersonGate();
}

function updatePersonSelectOptions() {
  const selected = state.activePersonIndex ? String(state.activePersonIndex) : (personSelect?.value || ocrPersonSelect?.value || '1');
  const optionsHtml = Array.from({ length: 6 }, (_, index) => {
    const value = String(index + 1);
    const name = state.people[index] || getDefaultPersonName(index + 1);
    return `<option value="${value}">${escapeHtml(name)}</option>`;
  }).join('');

  if (personSelect) {
    personSelect.innerHTML = optionsHtml;
    personSelect.value = selected;
  }

  if (ocrPersonSelect) {
    ocrPersonSelect.innerHTML = optionsHtml;
    ocrPersonSelect.value = selected;
  }
}

function savePeopleNames(showMessage = true) {
  state.people = Array.from({ length: 6 }, (_, index) => {
    const input = personInputs[index];
    return normalizePersonName(input?.value, index);
  });

  localStorage.setItem('nilai_parser_people', JSON.stringify(state.people));
  updatePersonSelectOptions();
  renderPersonGate();
  renderDivision();
  renderGrid();

  if (showMessage) showAlert('Nama pembagian berhasil disimpan.', 'success');
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID").format(angka);
}

function renderDivision() {
  if (!divisionBoard) return;

  const people = Array.from({ length: 6 }, (_, index) => state.people[index] || getDefaultPersonName(index + 1));
  const totals = {};

  (state.peopleSummary || []).forEach(row => {
    totals[Number(row.person_index)] = Number(row.total || 0);
  });

  const bonusNumber = (bonusNumberInput?.value || '').replace(/[^0-9]/g, '').padStart(2, '0');
  const bonusTotals = {};

  if (bonusNumber && bonusNumber.length === 2) {
    const targetItem = (state.grid || []).find(item => String(item.number).padStart(2, '0') === bonusNumber);

    if (targetItem && Array.isArray(targetItem.value_details)) {
      targetItem.value_details.forEach(detail => {
        const personIndex = Number(detail.person_index);
        const value = Number(detail.value || 0);

        if (!bonusTotals[personIndex]) {
          bonusTotals[personIndex] = 0;
        }

        bonusTotals[personIndex] += value;
      });
    }
  }

  divisionBoard.innerHTML = people.map((name, index) => {
    const personIndex = index + 1;
    const total = totals[personIndex] || 0;
    const rupiah = total * 750;

    const bonusQty = bonusTotals[personIndex] || 0;
    const bonusRp = bonusQty * BONUS_RUPIAH;
    const grandTotal = bonusRp - rupiah;
    const grandTotalClass = grandTotal >= 0 ? 'positive' : 'negative';
    const grandTotalSign = grandTotal >= 0 ? '+' : '-';

    return `
      <div class="division-item ${personSelect?.value === String(personIndex) ? 'selected-person' : ''} ${bonusNumber && bonusNumber.length === 2 ? `has-grand-total ${grandTotalClass}` : ''}">
        <div class="division-name">${escapeHtml(name)}</div>
        <div class="division-index">Data ${personIndex}</div>

        <div class="division-value mono">${escapeHtml(total)}</div>
        <div class="division-rupiah">
          Total Rp: ${formatRupiah(rupiah)}
        </div>

        ${
          bonusNumber && bonusNumber.length === 2
            ? `
              <div class="division-bonus">
                Bonus angka ${escapeHtml(bonusNumber)}:
                ${escapeHtml(bonusQty)} x Rp 65.000 =
                <strong>Rp ${formatRupiah(bonusRp)}</strong>
              </div>
              <div class="division-grand-total ${grandTotalClass}">
                <span>Total Keseluruhan</span>
                <strong>${grandTotalSign} Rp ${formatRupiah(Math.abs(grandTotal))}</strong>
              </div>
            `
            : ''
        }
      </div>
    `;
  }).join('');
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID").format(angka);
}

function renderStats() {
  if (!statsGrid) return;

  const dashboard = state.dashboard || {};
  const totalMasuk = Number(dashboard.total_in ?? 0);
  const totalHarga = totalMasuk * 750;

  if (isDashboardPage || isRekapanPage) {
    statsGrid.classList.add('dashboard-stats-grid');
    statsGrid.innerHTML = `
      <div class="card stat-card stat-card-with-action dashboard-omzet-card">
        <div class="stat-label">Total Omzet</div>
        <div class="stat-value">${escapeHtml(totalMasuk)}</div>
        <div class="stat-sub">
          Total Harga: Rp ${formatRupiah(totalHarga)}
        </div>
        <button id="deleteAllHistoryBtn" type="button" class="ghost danger-btn stat-delete-btn">Hapus Semua Data</button>
      </div>
    `;
    return;
  }

  statsGrid.classList.remove('dashboard-stats-grid');
  statsGrid.innerHTML = '';
}

function renderGrid() {
  if (!gridBoard) return;

  const query = (state.search || '').trim();
  const safeGrid = Array.isArray(state.grid) ? state.grid : [];

  const cards = safeGrid
    .filter(item => !state.activeOnly || (item.remaining ?? 0) > 0)
    .filter(item => !query || String(item.number).includes(query))
    .map(item => {
      const valueList = Array.isArray(item.value_list) ? item.value_list : [];
      const allValues = renderValueChips(item);
      const isHighlight = query && String(item.number) === query.padStart(2, '0');
      const hasData = !!item.has_data || valueList.length > 0 || (item.total_in ?? 0) !== 0;
      const remaining = Number(item.remaining ?? 0);
      const remainingClass = remaining < 0 ? 'negatif' : 'positif';

      return `
        <div class="num-card ${!hasData ? 'inactive' : ''} ${isHighlight ? 'highlight' : ''}" data-number="${escapeHtml(item.number)}">
          <div class="num-head">
            <div class="num-index mono">${escapeHtml(item.number)}</div>
            <div class="badge">${hasData ? 'aktif' : 'kosong'}</div>
          </div>

          <div class="num-values mono">
            <div><strong>Masuk:</strong> ${allValues}</div>
          </div>

          <div class="num-footer">
            <div class="mini">
              <span>Total</span>
              <strong>${escapeHtml(item.total_in ?? 0)}</strong>
            </div>
            <div class="mini">
              <span>Potong</span>
              <strong>${escapeHtml(item.total_cut ?? 0)}</strong>
            </div>
            <div class="mini ${remainingClass}">
              <span>Sisa</span>
              <strong>${escapeHtml(remaining)}</strong>
            </div>
          </div>
        </div>
      `;
    });

  gridBoard.innerHTML = cards.join('') || '<div class="empty-state">Tidak ada data yang cocok.</div>';
}

function renderEntries() {
  if (!entryHistory) return;

  const safeEntries = Array.isArray(state.entries) ? state.entries : [];
  const keyword = (state.historySearch || '').toLowerCase().trim();

const filteredEntries = safeEntries.filter(item => {
  const raw = String(item.raw_input || '').toLowerCase();
  const created = String(item.created_at || '').toLowerCase();
  const items = Array.isArray(item.items)
    ? item.items.map(row => `${formatNumber2(row.number)}=${row.value}`).join(', ').toLowerCase()
    : '';

  const personIndex = Number(item.person_index || 0);
  const personName = personIndex >= 1 && personIndex <= 6
    ? String(state.people[personIndex - 1] || getDefaultPersonName(personIndex)).toLowerCase()
    : '';

  const dataName = personIndex ? `data ${personIndex}` : '';

  return (
    !keyword ||
    raw.includes(keyword) ||
    created.includes(keyword) ||
    items.includes(keyword) ||
    personName.includes(keyword) ||
    dataName.includes(keyword)
  );
});

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / HISTORY_PER_PAGE));

  if (state.historyPage > totalPages) {
    state.historyPage = totalPages;
  }

  const start = (state.historyPage - 1) * HISTORY_PER_PAGE;
  const pageEntries = filteredEntries.slice(start, start + HISTORY_PER_PAGE);

  if (!pageEntries.length) {
    entryHistory.innerHTML = '<div class="empty-state">Riwayat tidak ditemukan.</div>';
  } else {
    entryHistory.innerHTML = pageEntries.map(item => {
      const itemRows = Array.isArray(item.items) ? item.items : [];
      const numberSummary = itemRows.length
        ? itemRows.map(row => `${formatNumber2(row.number)}=${row.value}`).join(', ')
        : '-';

      return `
        <div class="history-card">
          <div class="history-top">
            <div>
              <div class="history-raw mono">${escapeHtml(item.raw_input ?? '')}</div>
              <div class="history-meta">Detail: ${escapeHtml(numberSummary)}</div>
            </div>
            <div class="history-actions">
  <span class="history-owner">
    ${
      item.person_index
        ? escapeHtml(state.people[Number(item.person_index) - 1] || getDefaultPersonName(Number(item.person_index)))
        : 'Tanpa nama'
    }
  </span>

  <button class="small-btn" data-delete-id="${escapeHtml(item.id)}">Hapus</button>
</div>
          </div>
          <div class="history-meta">${escapeHtml(item.created_at ?? '')}</div>
        </div>
      `;
    }).join('');
  }

  renderHistoryPagination(totalPages);

  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus riwayat ini?')) return;

      const id = btn.dataset.deleteId;

      try {
        const response = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (!response.ok) {
          showAlert(result.message || 'Gagal menghapus data.', 'error');
          return;
        }

        applyPayload(result);
        showAlert(result.message || 'Data berhasil dihapus.', 'success');
      } catch {
        showAlert('Terjadi kesalahan saat menghapus data.', 'error');
      }
    });
  });
}

function showAlert(message, type = 'success') {
  if (!alertBox) return;

  alertBox.className = `alert ${type}`;
  alertBox.textContent = message || '';

  setTimeout(() => {
    alertBox.className = 'alert hidden';
    alertBox.textContent = '';
  }, 3500);
}

function showPreview(parsed) {
  if (!previewBox || !parsed) return;

  const numbers = Array.isArray(parsed.numbers)
    ? parsed.numbers.map(formatNumber2).join(', ')
    : '-';

  const multiplierText = parsed.multiplier ?? 'campuran';

  previewBox.classList.remove('hidden');
  previewBox.innerHTML = `
    <strong>Preview tersimpan:</strong><br>
    Input: <span class="mono">${escapeHtml(parsed.raw_input ?? '')}</span><br>
    Angka: <span class="mono">${escapeHtml(numbers)}</span><br>
    Nilai masing-masing: <span class="mono">${escapeHtml(multiplierText)}</span>
  `;
}

function clearPreview() {
  if (!previewBox) return;
  previewBox.classList.add('hidden');
  previewBox.innerHTML = '';
}

function applyPayload(result) {
  state.dashboard = result.dashboard || state.dashboard;
  state.grid = result.grid || state.grid;
  state.entries = result.entries || state.entries;
  state.peopleSummary = result.people_summary || state.peopleSummary;
  loadPeopleNames();
  renderAll();
}

function renderAll() {
  renderStats();
  renderGrid();
  renderEntries();
  renderDivision();
  renderActiveCopyBox();
  renderPersonHeaderMenu();
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID").format(angka);
}

function renderActiveCopyBox() {
  if (!activeCopyBox) return;

  const safeGrid = Array.isArray(state.grid) ? state.grid : [];

  const text = safeGrid
    .filter(item => Number(item.remaining || 0) > 0)
    .map(item => `${formatNumber2(item.number)}x${Number(item.remaining || 0)}`)
    .join('.');

  activeCopyBox.value = text;
}

function renderHistoryPagination(totalPages) {
  if (!historyPagination) return;

  historyPagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `
      <button
        type="button"
        class="page-btn ${state.historyPage === page ? 'active' : ''}"
        data-history-page="${page}"
      >
        ${page}
      </button>
    `;
  }).join('');

  document.querySelectorAll('[data-history-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.historyPage = Number(btn.dataset.historyPage || 1);
      renderEntries();
    });
  });
}

function getActivePersonName() {
  const idx = Number(state.activePersonIndex || personSelect?.value || 1);
  return state.people[idx - 1] || getDefaultPersonName(idx);
}

function selectActivePerson(personIndex) {
  const idx = Number(personIndex || 0);
  if (idx < 1 || idx > 6) return;

  state.activePersonIndex = idx;
  if (personSelect) personSelect.value = String(idx);
  if (ocrPersonSelect) ocrPersonSelect.value = String(idx);
  renderPersonGate();
  renderDivision();

  setTimeout(() => {
    rawInput?.focus();
  }, 50);
}

function resetActivePerson() {
  if (rawInput) rawInput.value = '';
  pastedOcrImageFile = null;
  pendingOcrText = '';
  if (ocrTextPreview) {
    ocrTextPreview.classList.add('hidden');
    ocrTextPreview.textContent = '';
  }
  if (ocrPreviewPanel) ocrPreviewPanel.classList.add('hidden');
  if (ocrPreviewText) ocrPreviewText.value = '';
  renderOcrConfidence([], null);
  setOcrStatus('Siap paste gambar');
  renderPersonGate();
  renderDivision();
}

function renderPersonGate() {
  const activeName = getActivePersonName();

  if (personGateButtons) {
    personGateButtons.innerHTML = Array.from({ length: 6 }, (_, index) => {
      const personIndex = index + 1;
      const name = state.people[index] || getDefaultPersonName(personIndex);
      const activeClass = state.activePersonIndex === personIndex ? 'active' : '';
      return `
        <button type="button" class="person-gate-btn ${activeClass}" data-select-person="${personIndex}">
          ${escapeHtml(name)}
        </button>
      `;
    }).join('');

    personGateButtons.querySelectorAll('[data-select-person]').forEach(btn => {
      btn.addEventListener('click', () => selectActivePerson(btn.dataset.selectPerson));
    });
  }

  if (activePersonName) activePersonName.textContent = activeName || '-';
  activePersonBanner?.classList.toggle('hidden', true);
  inputWorkArea?.classList.remove('hidden');
  noPersonNotice?.classList.add('hidden');
}

function renderPersonHeaderMenu() {
  // Menu rekap nama di header sudah tidak dipakai.
  renderPersonGate();
}

function getCurrentSessionWita(now) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const sdyStart = 10 * 60;
  const sdyEnd = 15 * 60;

  const sgpStart = 15 * 60 + 30;
  const sgpEnd = 19 * 60;

  const hkgStart = 20 * 60;
  const hkgEnd = 24 * 60 + 30;

  if (totalMinutes >= sdyStart && totalMinutes <= sdyEnd) {
    return "SDY";
  }

  if (totalMinutes >= sgpStart && totalMinutes <= sgpEnd) {
    return "SGP";
  }

  if (totalMinutes >= hkgStart || totalMinutes <= 30) {
    return "HKG";
  }

  return "ISTIRAHAT";
}

function updateLiveClock() {
  const liveClock = document.getElementById("liveClock");
  const liveSession = document.getElementById("liveSession");

  if (!liveClock || !liveSession) return;

  const now = new Date();

  const timeText = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const witaParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(witaParts.find(p => p.type === "hour")?.value || 0);
  const minute = Number(witaParts.find(p => p.type === "minute")?.value || 0);

  const fakeWitaDate = new Date();
  fakeWitaDate.setHours(hour, minute, 0, 0);

  const sessionName = getCurrentSessionWita(fakeWitaDate);

  liveClock.textContent = timeText;
  liveSession.textContent = `Sekarang Memasuki Sesi ${sessionName}`;
}

setInterval(updateLiveClock, 1000);
updateLiveClock();


function getOcrCorrections() {
  try {
    const saved = JSON.parse(localStorage.getItem(OCR_CORRECTION_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function saveOcrCorrections(map) {
  localStorage.setItem(OCR_CORRECTION_STORAGE_KEY, JSON.stringify(map || {}));
}


function getOcrTokenCorrections() {
  try {
    const saved = JSON.parse(localStorage.getItem(OCR_TOKEN_CORRECTION_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function saveOcrTokenCorrections(map) {
  localStorage.setItem(OCR_TOKEN_CORRECTION_STORAGE_KEY, JSON.stringify(map || {}));
}

function applyLearnedOcrTokenCorrections(text) {
  const corrections = getOcrTokenCorrections();
  let value = String(text || '');

  Object.entries(corrections).forEach(([from, to]) => {
    if (!from || !to) return;
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    value = value.replace(new RegExp(`(?<!\\d)${escaped}(?!\\d)`, 'gi'), to);
  });

  return value;
}

function applyLearnedOcrCorrections(text) {
  const corrections = getOcrCorrections();
  let value = String(text || '');

  Object.entries(corrections).forEach(([from, to]) => {
    if (!from || !to) return;
    value = value.split(from).join(to);
    value = value.split(from.toUpperCase()).join(to);
  });

  return value;
}

function applyCommonOcrCorrections(text) {
  // Koreksi umum OCR: O sering terbaca sebagai 0, I/l sebagai 1,
  // S sebagai 5, B sebagai 8, Z sebagai 2. Hanya diterapkan saat
  // karakternya berada di sekitar angka/x supaya kata biasa tidak ikut rusak.
  return String(text || '')
    .replace(/[×✕✖*]/g, 'x')
    .replace(/[oO](?=\d|x|\s*x)/g, '0')
    .replace(/(?<=\d|x)[oO]/g, '0')
    .replace(/[iIlL](?=\d|x|\s*x)/g, '1')
    .replace(/(?<=\d|x)[iIlL]/g, '1')
    .replace(/[sS](?=\d|x|\s*x)/g, '5')
    .replace(/(?<=\d|x)[sS]/g, '5')
    .replace(/[bB](?=\d|x|\s*x)/g, '8')
    .replace(/(?<=\d|x)[bB]/g, '8')
    .replace(/[zZ](?=\d|x|\s*x)/g, '2')
    .replace(/(?<=\d|x)[zZ]/g, '2');
}

function isTotalLikeLine(line) {
  return /\b(total|jumlah|jml|ttl|totai|jumiah|sum)\b/i.test(String(line || ''));
}

function cleanOcrLine(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/[×✕✖*]/g, 'x')
    .replace(/kali/g, 'x')
    .replace(/[“”‘’]/g, ' ')
    .replace(/[^0-9x.,\s\[\]{}()|/\\\-]/g, ' ')
    .replace(/([0-9])\s*[.,]\s*(?=[0-9])/g, '$1.')
    .replace(/\s*x\s*/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasBracketTouch(line) {
  return /[\[\]{}()|/\\\-]/.test(String(line || ''));
}

function normalizeDigitsFromText(text) {
  const chunks = String(text || '').match(/\d+/g) || [];
  const numbers = [];

  chunks.forEach(chunk => {
    if (chunk.length <= 2) {
      numbers.push(chunk.padStart(2, '0'));
      return;
    }

    const padded = chunk.length % 2 === 0 ? chunk : `0${chunk}`;
    for (let i = 0; i < padded.length; i += 2) {
      numbers.push(padded.slice(i, i + 2));
    }
  });

  return numbers;
}

function enhanceBracketGroupFormat(text) {
  const value = String(text || '').trim();
  const xMatches = Array.from(value.matchAll(/x(\d+)/g));

  if (xMatches.length !== 1) return value;

  const multiplier = xMatches[0][1];
  const numberText = value.replace(/x\d+/g, ' ');
  const normalizedNumbers = normalizeDigitsFromText(numberText);

  return normalizedNumbers.length ? `${normalizedNumbers.join('.')}x${multiplier}` : value;
}

function normalizeOcrLinesToSafeText(text) {
  const rawLines = String(text || '').split(/\r?\n/);
  const lines = rawLines
    .map(original => ({ original, clean: cleanOcrLine(original) }))
    .filter(item => item.clean && /[0-9x]/.test(item.clean))
    .filter(item => !isTotalLikeLine(item.original));

  if (!lines.length) return '';

  const xLineIndexes = [];
  lines.forEach((line, index) => {
    if (/x\d+/.test(line.clean)) xLineIndexes.push(index);
  });

  // Kalau tidak ada x/kali, jangan simpan apa pun. Ini mencegah angka total
  // atau catatan bawah ikut masuk ke grid.
  if (!xLineIndexes.length) return '';

  // Banyak x berarti format campuran. Ambil hanya baris yang punya x,
  // serta baris bracket yang benar-benar menempel pada grup x terdekat.
  if (xLineIndexes.length > 1) {
    const kept = lines.filter((line, index) => {
      if (/x\d+/.test(line.clean)) return true;
      if (!hasBracketTouch(line.clean)) return false;
      return xLineIndexes.some(xIndex => Math.abs(xIndex - index) <= 2);
    });
    return kept.map(line => line.clean.replace(/[\[\]{}()|/\\\-]/g, ' ')).join(' ');
  }

  // Satu x: ini biasanya format bracket/daftar angka lalu x2.
  // Ambil angka di grup yang sama, tapi buang baris total/jumlah.
  const xIndex = xLineIndexes[0];
  const hasAnyBracket = lines.some(line => hasBracketTouch(line.clean));
  let kept;

  if (hasAnyBracket) {
    kept = lines.filter((line, index) => {
      if (/x\d+/.test(line.clean)) return true;
      if (!/\d/.test(line.clean)) return false;
      return hasBracketTouch(line.clean) || Math.abs(index - xIndex) <= 2;
    });
  } else {
    // Tanpa bracket, pakai baris x saja agar angka total tanpa x tidak ikut.
    // Jika gambar hanya berupa daftar angka + x2 di baris akhir, baris angka
    // yang tepat menempel di atas x tetap diambil.
    kept = lines.filter((line, index) => /x\d+/.test(line.clean) || (index < xIndex && xIndex - index <= 6));
  }

  return kept.map(line => line.clean.replace(/[\[\]{}()|/\\\-]/g, ' ')).join(' ');
}

function normalizeOcrText(text) {
  // Lebih aman: angka OCR hanya disiapkan kalau ada x/kali, atau masih satu
  // grup bracket dengan x. Baris total/jumlah dibuang sebelum parsing.
  const correctedText = applyCommonOcrCorrections(
    applyLearnedOcrTokenCorrections(applyLearnedOcrCorrections(text))
  );

  const grouped = normalizeOcrLinesToSafeText(correctedText);
  const normalized = String(grouped || '')
    .toLowerCase()
    .replace(/[|\[\]{}()\/\\:;_~`'"“”‘’\-—–]/g, ' ')
    .replace(/[^0-9x.,\s]/g, ' ')
    .replace(/\s*x\s*/g, 'x')
    .replace(/([0-9])\s*[.,]\s*(?=[0-9])/g, '$1.')
    .replace(/\s+/g, ' ')
    .replace(/\.+/g, '.')
    .replace(/\.x/g, 'x')
    .replace(/x\./g, 'x')
    .trim();

  return enhanceBracketGroupFormat(normalized);
}

function learnOcrCorrections(rawText, finalText) {
  const rawTokens = String(rawText || '').match(/[A-Za-z0-9]+/g) || [];
  const finalTokens = String(finalText || '').match(/[0-9x]+/gi) || [];
  const corrections = getOcrCorrections();
  const tokenCorrections = getOcrTokenCorrections();
  const learned = [];

  rawTokens.forEach((rawToken, index) => {
    const finalToken = finalTokens[index];
    if (!finalToken || rawToken.length !== finalToken.length) return;

    const rawLower = rawToken.toLowerCase();
    const finalLower = finalToken.toLowerCase();

    // Untuk kasus raw digit seperti 4↔9, jangan simpan sebagai koreksi huruf
    // global. Simpan sebagai koreksi token lengkap supaya tidak merusak angka 4/9 lain.
    if (/\d/.test(rawLower) && rawLower !== finalLower && rawLower.length >= 2) {
      tokenCorrections[rawLower] = finalLower;
      learned.push(`${rawToken}→${finalToken}`);
      return;
    }

    for (let i = 0; i < rawToken.length; i += 1) {
      const from = rawToken[i];
      const to = finalToken[i].toLowerCase();
      if (from.toLowerCase() === to) continue;
      if (!/[a-z]/i.test(from) || !/[0-9x]/.test(to)) continue;

      const key = from.toLowerCase();
      if (corrections[key] !== to) {
        corrections[key] = to;
        learned.push(`${from}→${to}`);
      }
    }
  });

  if (learned.length) {
    saveOcrCorrections(corrections);
    saveOcrTokenCorrections(tokenCorrections);
  }

  return learned;
}

async function prepareImageForOcr(file) {
  // Pre-processing ringan: perbesar, grayscale, dan threshold.
  // Ini membantu OCR membaca tulisan kecil seperti 56.76.23...26x2
  // dan gambar daftar angka dengan bracket lalu x2.
  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageUrl;
    });

    const scale = Math.max(2, Math.min(4, 1600 / Math.max(img.width, img.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      const value = gray < 185 ? 0 : 255;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}


function getTesseractWordItems(data) {
  const words = Array.isArray(data?.words) ? data.words : [];
  return words
    .map(word => ({
      text: String(word.text || '').trim(),
      confidence: Number(word.confidence),
    }))
    .filter(word => word.text);
}

function buildOcrConfidenceReport(rawText, convertedText, tesseractData) {
  const warnings = [];
  const raw = String(rawText || '');
  const converted = String(convertedText || '');
  const wordItems = getTesseractWordItems(tesseractData);
  const numericWords = wordItems.filter(word => /[0-9OoIiLlSsBbZz49xX]/.test(word.text));
  const confidenceValues = numericWords
    .map(word => word.confidence)
    .filter(value => Number.isFinite(value));

  let score = null;
  if (confidenceValues.length) {
    score = Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length);
    if (score < 70) {
      warnings.push(`OCR agak ragu. Rata-rata keyakinan hanya ${score}%. Cek ulang semua angka di preview.`);
    }

    const lowWords = numericWords
      .filter(word => Number.isFinite(word.confidence) && word.confidence < 65)
      .slice(0, 6)
      .map(word => `${word.text} (${Math.round(word.confidence)}%)`);

    if (lowWords.length) {
      warnings.push(`Bagian yang paling perlu dicek: ${lowWords.join(', ')}.`);
    }
  }

  if (/[49]/.test(converted) || /[49]/.test(raw)) {
    warnings.push('Periksa khusus angka 4 dan 9, karena OCR kadang tertukar pada tulisan tangan. Sistem tidak mengganti 4↔9 otomatis.');
  }

  if (/[oOiIlLsSbBzZ]/.test(raw)) {
    warnings.push('Ada karakter mirip angka yang dikoreksi otomatis, seperti O→0, I/l→1, S→5, B→8, atau Z→2.');
  }

  if (/[-—–_]{2,}|={2,}|~{2,}|\/{2,}|\\{2,}/.test(raw)) {
    warnings.push('Terdeteksi kemungkinan coretan/garis. Pastikan angka yang dicoret memang tidak ikut masuk.');
  }

  if (/\b(total|jumlah|jml|ttl|sum)\b/i.test(raw)) {
    warnings.push('Baris total/jumlah terdeteksi dan otomatis tidak dimasukkan, tapi tetap cek preview sebelum simpan.');
  }

  if (!warnings.length) {
    warnings.push('Tidak ada tanda OCR ragu yang besar, tetapi tetap cek preview sebelum simpan.');
  }

  return { score, warnings };
}

function renderOcrConfidence(warnings = [], score = null) {
  if (!ocrConfidenceBox) return;

  const hasContent = Array.isArray(warnings) && warnings.length;
  ocrConfidenceBox.classList.toggle('hidden', !hasContent);

  if (!hasContent) {
    ocrConfidenceBox.innerHTML = '';
    return;
  }

  const scoreText = Number.isFinite(score) ? `Confidence OCR: ${score}%` : 'Confidence OCR: perlu cek manual';
  const scoreClass = Number.isFinite(score) && score >= 80 ? 'good' : (Number.isFinite(score) && score < 65 ? 'danger' : 'warn');

  ocrConfidenceBox.innerHTML = `
    <div class="ocr-confidence-head">
      <strong>⚠ Cek OCR</strong>
      <span class="ocr-confidence-score ${scoreClass}">${escapeHtml(scoreText)}</span>
    </div>
    <ul>
      ${warnings.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function setOcrStatus(message, type = '') {
  if (!ocrStatus) return;
  ocrStatus.textContent = message;
  ocrStatus.className = `ocr-status ${type}`.trim();
}

async function submitRawInputFromOcr(convertedText) {
  if (!entryForm || !rawInput) return;

  state.activePersonIndex = Number(ocrPersonSelect?.value || personSelect?.value || state.activePersonIndex || 1);
  if (personSelect) personSelect.value = String(state.activePersonIndex);
  rawInput.value = convertedText;
  savePeopleNames(false);
  renderPersonHeaderMenu();

  const formData = new FormData(entryForm);
  if (personSelect) {
    const idx = Number(state.activePersonIndex || personSelect.value || 1);
    formData.set('person_index', String(idx));
    formData.set('person_name', state.people[idx - 1] || getDefaultPersonName(idx));
  }
  formData.set('raw_input', convertedText);

  const response = await fetch('/parse', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Hasil OCR tidak bisa disimpan. Periksa teks hasil convert.');
  }

  applyPayload(result);
  showPreview(result.parsed);
  showAlert('Hasil OCR berhasil disimpan ke grid.', 'success');
  resetActivePerson();
}

function showOcrPreview(convertedText, confidenceReport = null) {
  pendingOcrText = convertedText || '';
  lastOcrConfidenceWarnings = confidenceReport?.warnings || [];
  lastOcrConfidenceScore = Number.isFinite(confidenceReport?.score) ? confidenceReport.score : null;

  if (ocrTextPreview) {
    ocrTextPreview.classList.remove('hidden');
    ocrTextPreview.textContent = pendingOcrText || '(tidak ada teks terbaca)';
  }

  const previewIdx = Number(personSelect?.value || state.activePersonIndex || 1);
  state.activePersonIndex = previewIdx;
  if (ocrPersonSelect) ocrPersonSelect.value = String(previewIdx);
  if (ocrPreviewName) {
    ocrPreviewName.textContent = getActivePersonName() || '-';
  }

  if (ocrPreviewText) {
    ocrPreviewText.value = pendingOcrText;
  }

  ocrPreviewPanel?.classList.toggle('hidden', !pendingOcrText);
  renderOcrConfidence(lastOcrConfidenceWarnings, lastOcrConfidenceScore);
}

function getImageFileFromClipboard(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
  return imageItem ? imageItem.getAsFile() : null;
}

async function convertImageFileToPreview(file) {
  state.activePersonIndex = Number(personSelect?.value || state.activePersonIndex || 1);

  if (!file) {
    showAlert('Tempel gambar dulu, atau pilih dari Kamera/Galeri.', 'error');
    return;
  }

  if (!window.Tesseract) {
    showAlert('Library OCR belum termuat. Pastikan koneksi internet aktif lalu refresh halaman.', 'error');
    return;
  }

  try {
    setOcrStatus('Membaca gambar...', 'loading');
    if (ocrPasteZone) ocrPasteZone.classList.add('loading');
    if (ocrPreviewPanel) ocrPreviewPanel.classList.add('hidden');

    const preparedImage = await prepareImageForOcr(file);

    const result = await Tesseract.recognize(preparedImage, 'eng', {
      tessedit_char_whitelist: '0123456789xX.,×✕✖*oOiIlLsSbBzZkKaAtToOjJuUmMhH[]{}()|/\- ',
      preserve_interword_spaces: '1',
      logger: info => {
        if (info.status === 'recognizing text') {
          const percent = Math.round((info.progress || 0) * 100);
          setOcrStatus(`OCR ${percent}%`, 'loading');
        }
      },
    });

    lastRawOcrText = result?.data?.text || '';
    const convertedText = normalizeOcrText(lastRawOcrText);
    const confidenceReport = buildOcrConfidenceReport(lastRawOcrText, convertedText, result?.data);

    if (!convertedText) {
      showOcrPreview('', confidenceReport);
      setOcrStatus('Tidak terbaca', 'error');
      showAlert('Tidak ada angka yang terbaca dari gambar.', 'error');
      return;
    }

    showOcrPreview(convertedText, confidenceReport);
    setOcrStatus(Number.isFinite(confidenceReport.score) ? `Siap dicek (${confidenceReport.score}%)` : 'Siap dicek', 'success');
    showAlert('OCR selesai. Cek preview dulu, lalu klik Simpan Hasil OCR.', 'success');
  } catch (error) {
    setOcrStatus('Gagal OCR', 'error');
    showAlert(error.message || 'Gagal membaca gambar.', 'error');
  } finally {
    if (ocrPasteZone) ocrPasteZone.classList.remove('loading');
  }
}

async function handleOcrImageFile(file) {
  if (!file) return;
  pastedOcrImageFile = file;
  await convertImageFileToPreview(file);
}

async function readImageFromClipboardButton() {
  if (!navigator.clipboard?.read) {
    showAlert('Browser HP ini belum mendukung tombol Paste langsung. Tekan lama area OCR lalu pilih Paste, atau pakai Kamera/Galeri.', 'error');
    ocrPasteZone?.focus();
    return;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const file = new File([blob], `ocr-paste-${Date.now()}.png`, { type: imageType });
        await handleOcrImageFile(file);
        return;
      }
    }
    showAlert('Clipboard tidak berisi gambar. Copy/screenshot gambar dulu.', 'error');
  } catch (error) {
    showAlert('Tidak bisa membaca clipboard. Tekan lama area OCR lalu Paste, atau pakai Kamera/Galeri.', 'error');
    ocrPasteZone?.focus();
  }
}

if (ocrPasteZone) {
  ocrPasteZone.addEventListener('click', event => {
    if (event.target?.closest?.('button')) return;
    ocrPasteZone.focus();
  });

  ocrPasteZone.addEventListener('paste', async event => {
    const file = getImageFileFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    await handleOcrImageFile(file);
  });
}

ocrCameraBtn?.addEventListener('click', () => ocrCameraInput?.click());
ocrGalleryBtn?.addEventListener('click', () => ocrGalleryInput?.click());
ocrClipboardBtn?.addEventListener('click', readImageFromClipboardButton);

ocrCameraInput?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  await handleOcrImageFile(file);
  event.target.value = '';
});

ocrGalleryInput?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  await handleOcrImageFile(file);
  event.target.value = '';
});

document.addEventListener('paste', async event => {
  if (inputWorkArea?.classList.contains('hidden')) return;

  const activeTag = String(document.activeElement?.tagName || '').toLowerCase();
  if (activeTag === 'textarea' || activeTag === 'input') return;

  const file = getImageFileFromClipboard(event);
  if (!file) return;
  event.preventDefault();
  await handleOcrImageFile(file);
});

if (saveOcrPreviewBtn) {
  saveOcrPreviewBtn.addEventListener('click', async () => {
    const text = (ocrPreviewText?.value || pendingOcrText || '').trim();

    if (!text) {
      showAlert('Preview OCR masih kosong.', 'error');
      return;
    }

    try {
      saveOcrPreviewBtn.disabled = true;
      setOcrStatus('Menyimpan...', 'loading');
      const learned = learnOcrCorrections(lastRawOcrText, text);
      await submitRawInputFromOcr(text);
      if (learned.length) {
        showAlert(`Hasil OCR disimpan. Koreksi baru dipelajari: ${learned.slice(0, 5).join(', ')}.`, 'success');
      }
    } catch (error) {
      setOcrStatus('Gagal simpan', 'error');
      showAlert(error.message || 'Gagal menyimpan hasil OCR.', 'error');
    } finally {
      saveOcrPreviewBtn.disabled = false;
    }
  });
}

if (cancelOcrPreviewBtn) {
  cancelOcrPreviewBtn.addEventListener('click', () => {
    pendingOcrText = '';
    lastRawOcrText = '';
    pastedOcrImageFile = null;
    if (ocrTextPreview) {
      ocrTextPreview.classList.add('hidden');
      ocrTextPreview.textContent = '';
    }
    if (ocrPreviewText) ocrPreviewText.value = '';
    renderOcrConfidence([], null);
    ocrPreviewPanel?.classList.add('hidden');
    setOcrStatus('Dibatalkan');
  });
}

if (convertImageBtn) {
  convertImageBtn.addEventListener('click', () => convertImageFileToPreview(pastedOcrImageFile));
}

if (entryForm) {
  entryForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      state.activePersonIndex = Number(personSelect?.value || state.activePersonIndex || 1);

      savePeopleNames(false);
      renderPersonHeaderMenu();
      const formData = new FormData(entryForm);
      if (personSelect) {
        const idx = Number(state.activePersonIndex || personSelect.value || 1);
        formData.set('person_index', String(idx));
        formData.set('person_name', state.people[idx - 1] || getDefaultPersonName(idx));
      }

      const response = await fetch('/parse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        showAlert(result.message || 'Terjadi kesalahan.', 'error');
        return;
      }

      applyPayload(result);
      showPreview(result.parsed);
      showAlert(result.message || 'Data berhasil disimpan.', 'success');
      resetActivePerson();
    } catch {
      showAlert('Terjadi kesalahan saat menyimpan data.', 'error');
    }
  });
}

if (cutAllForm) {
  cutAllForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const payload = {
        cut_value: document.getElementById('cut_all_value')?.value ?? '',
        note: document.getElementById('cut_all_note')?.value ?? '',
      };

      if (!payload.cut_value) {
        showAlert('Isi jumlah potong terlebih dahulu.', 'error');
        return;
      }

      const response = await fetch('/api/cut-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let result = {};

      try {
        result = JSON.parse(text);
      } catch {
        showAlert(`Response server bukan JSON: ${text}`, 'error');
        return;
      }

      if (!response.ok) {
        showAlert(result.message || 'Gagal memotong semua angka.', 'error');
        return;
      }

      applyPayload(result);
      showAlert(result.message || 'Berhasil memotong semua angka.', 'success');
      cutAllForm.reset();
    } catch (error) {
      showAlert(`Terjadi kesalahan: ${error.message}`, 'error');
    }
  });
}

if (savePeopleBtn) {
  savePeopleBtn.addEventListener('click', () => savePeopleNames(true));
}

personInputs.forEach(input => {
  input.addEventListener('input', () => savePeopleNames(false));
});

async function handleDeleteAllData() {
  const ok = confirm('Yakin ingin menghapus semua data? Grid, riwayat input, dan rekap akan dibersihkan.');
  if (!ok) return;

  try {
    const response = await fetch('/api/entries', {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      showAlert(result.message || 'Gagal menghapus semua data.', 'error');
      return;
    }

    applyPayload(result);
    clearPreview();
    showAlert(result.message || 'Semua data berhasil dihapus.', 'success');
  } catch {
    showAlert('Terjadi kesalahan saat menghapus semua data.', 'error');
  }
}

document.addEventListener('click', event => {
  const btn = event.target.closest('#deleteAllHistoryBtn');
  if (!btn) return;
  event.preventDefault();
  handleDeleteAllData();
});

if (searchNumber) {
  searchNumber.addEventListener('input', () => {
    const value = searchNumber.value.replace(/[^0-9]/g, '').slice(0, 2);
    state.search = value;
    searchNumber.value = value;
    renderGrid();
  });
}


if (changePersonBtn) {
  changePersonBtn.addEventListener('click', () => resetActivePerson());
}

if (personSelect) {
  personSelect.addEventListener('change', () => {
    if (personSelect.value) selectActivePerson(personSelect.value);
  });
}

if (ocrPersonSelect) {
  ocrPersonSelect.addEventListener('change', () => {
    state.activePersonIndex = Number(ocrPersonSelect.value || 1);
    if (personSelect) personSelect.value = ocrPersonSelect.value;
    if (ocrPreviewName) ocrPreviewName.textContent = getActivePersonName() || '-';
    renderDivision();
  });
}

if (filterActiveBtn) {
  filterActiveBtn.addEventListener('click', () => {
    state.activeOnly = !state.activeOnly;
    filterActiveBtn.textContent = state.activeOnly ? 'Tampilkan semua' : 'Tampilkan aktif saja';
    renderGrid();
  });
}
if (bonusNumberInput) {
  bonusNumberInput.addEventListener('input', () => {
    bonusNumberInput.value = bonusNumberInput.value.replace(/[^0-9]/g, '').slice(0, 2);
    renderDivision();
  });
}

if (copyActiveBtn) {
  copyActiveBtn.addEventListener('click', async () => {
    if (!activeCopyBox || !activeCopyBox.value.trim()) {
      showAlert('Tidak ada angka aktif untuk disalin.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(activeCopyBox.value);
      showAlert('Angka aktif berhasil dicopy.', 'success');
    } catch {
      activeCopyBox.select();
      document.execCommand('copy');
      showAlert('Angka aktif berhasil dicopy.', 'success');
    }
  });
}

if (historySearch) {
  historySearch.addEventListener('input', () => {
    state.historySearch = historySearch.value;
    state.historyPage = 1;
    renderEntries();
  });
}

document.querySelectorAll('.edit-session-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cell = btn.closest('.session-edit-cell');
    const input = cell.querySelector('.session-total-input');
    input.removeAttribute('readonly');
    input.focus();
  });
});

document.querySelectorAll('.save-session-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const cell = btn.closest('.session-edit-cell');
    const input = cell.querySelector('.session-total-input');

    const payload = {
      person_index: cell.dataset.person,
      date: cell.dataset.date,
      session: cell.dataset.session,
      total: input.value || 0,
    };

    const response = await fetch('/api/session-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      location.reload();
    } else {
      alert('Gagal menyimpan data.');
    }
  });
});

document.querySelectorAll('.delete-session-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!confirm('Hapus edit manual sesi ini?')) return;

    const cell = btn.closest('.session-edit-cell');

    const payload = {
      person_index: cell.dataset.person,
      date: cell.dataset.date,
      session: cell.dataset.session,
    };

    const response = await fetch('/api/session-manual', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      location.reload();
    } else {
      alert('Gagal menghapus data.');
    }
  });
});

loadPeopleNames();
renderAll();