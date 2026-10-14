// BD Railway Ticket Quick Booker - Popup Controller

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// DOM Elements
const fromStationInput = document.getElementById('from-station');
const toStationInput = document.getElementById('to-station');
const btnSwap = document.getElementById('btn-swap');
const journeyDateInput = document.getElementById('journey-date');
const formattedDojSpan = document.getElementById('formatted-doj');
const seatClassSelect = document.getElementById('seat-class');
const trainNameInput = document.getElementById('train-name');
const btnClearTrain = document.getElementById('btn-clear-train');
const autoBookNowCheckbox = document.getElementById('auto-book-now');
const autoSelectSeatsCheckbox = document.getElementById('auto-select-seats');
const seatCountSelect = document.getElementById('seat-count');
const autoContinueCheckbox = document.getElementById('auto-continue');
const urlPreviewDiv = document.getElementById('url-preview');
const btnCopyUrl = document.getElementById('btn-copy-url');
const btnSearch = document.getElementById('btn-search');
const saveStatus = document.getElementById('save-status');
const btnReset = document.getElementById('btn-reset');
const quickDateButtons = document.querySelectorAll('.btn-pill');
const scheduleToggle = document.getElementById('schedule-toggle');
const countdownText = document.getElementById('countdown-text');

let saveTimeout = null;

// Populate Autocomplete Datalists from BD_STATIONS dataset
function populateStationDatalists() {
  if (typeof BD_STATIONS === 'undefined' || !Array.isArray(BD_STATIONS)) {
    console.warn('BD_STATIONS dataset not found');
    return;
  }

  const fromDatalist = document.getElementById('from-stations-list');
  const toDatalist = document.getElementById('to-stations-list');
  if (!fromDatalist || !toDatalist) return;

  // Sort: Top cities first, then alphabetically
  const sortedStations = [...BD_STATIONS].sort((a, b) => {
    if (a.is_top_city && !b.is_top_city) return -1;
    if (!a.is_top_city && b.is_top_city) return 1;
    return a.city_name.localeCompare(b.city_name);
  });

  fromDatalist.innerHTML = '';
  toDatalist.innerHTML = '';

  sortedStations.forEach(station => {
    // Option for From
    const optFrom = document.createElement('option');
    optFrom.value = station.city_name;
    if (station.is_top_city) {
      optFrom.label = '⭐ Top City';
    }
    fromDatalist.appendChild(optFrom);

    // Option for To
    const optTo = document.createElement('option');
    optTo.value = station.city_name;
    if (station.is_top_city) {
      optTo.label = '⭐ Top City';
    }
    toDatalist.appendChild(optTo);
  });
}

// Populate Trains Autocomplete Datalist from BD_TRAINS dataset
function populateTrainDatalists() {
  if (typeof BD_TRAINS === 'undefined' || !Array.isArray(BD_TRAINS)) {
    console.warn('BD_TRAINS dataset not found');
    return;
  }

  const trainsDatalist = document.getElementById('trains-list');
  if (!trainsDatalist) return;

  trainsDatalist.innerHTML = '';
  BD_TRAINS.forEach(train => {
    const opt = document.createElement('option');
    opt.value = train.name;
    opt.label = `Model: ${train.model}`;
    trainsDatalist.appendChild(opt);
  });
}

// Canonical Station Name matching (handles case & space differences)
function getCanonicalStationName(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (typeof BD_STATIONS === 'undefined' || !Array.isArray(BD_STATIONS)) {
    return trimmed;
  }

  // Exact match
  const exact = BD_STATIONS.find(s => s.city_name === trimmed);
  if (exact) return exact.city_name;

  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  const ciMatch = BD_STATIONS.find(s => s.city_name.toLowerCase() === lower);
  if (ciMatch) return ciMatch.city_name;

  // Underscore / Space match (e.g. "Biman Bandar" -> "Biman_Bandar")
  const under = lower.replace(/\s+/g, '_');
  const underMatch = BD_STATIONS.find(s => s.city_name.toLowerCase() === under);
  if (underMatch) return underMatch.city_name;

  // Space instead of underscore
  const space = lower.replace(/_+/g, ' ');
  const spaceMatch = BD_STATIONS.find(s => s.city_name.toLowerCase() === space);
  if (spaceMatch) return spaceMatch.city_name;

  return trimmed;
}

// Canonical Train Name matching (handles model number or name search)
function getCanonicalTrainName(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (typeof BD_TRAINS === 'undefined' || !Array.isArray(BD_TRAINS)) {
    return trimmed;
  }

  // Exact match
  const exact = BD_TRAINS.find(t => t.name === trimmed);
  if (exact) return exact.name;

  // Model number match (e.g. user typed "705")
  const modelMatch = BD_TRAINS.find(t => t.model === trimmed);
  if (modelMatch) return modelMatch.name;

  // Case-insensitive name match
  const lower = trimmed.toLowerCase();
  const ciMatch = BD_TRAINS.find(t => t.name.toLowerCase() === lower);
  if (ciMatch) return ciMatch.name;

  // Substring match (e.g. "ekota express")
  const subMatch = BD_TRAINS.find(t => t.name.toLowerCase().includes(lower));
  if (subMatch) return subMatch.name;

  return trimmed;
}

// Helpers: Date formatting
function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(valueStr) {
  if (!valueStr) return new Date();
  const parts = valueStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date();
}

function formatDoj(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd}-${month}-${yyyy}`; // e.g., 21-Oct-2026
}

// Generate the search URL
function buildSearchUrl() {
  const fromCity = getCanonicalStationName(fromStationInput.value) || fromStationInput.value.trim();
  const toCity = getCanonicalStationName(toStationInput.value) || toStationInput.value.trim();
  const dojDate = parseDateInput(journeyDateInput.value);
  const dojFormatted = formatDoj(dojDate);
  const seatClass = seatClassSelect.value;

  const params = new URLSearchParams({
    fromcity: fromCity,
    tocity: toCity,
    doj: dojFormatted,
    class: seatClass
  });

  return `https://eticket.railway.gov.bd/booking/train/search?${params.toString()}`;
}

// Update UI & URL preview
function updateUi() {
  const dojDate = parseDateInput(journeyDateInput.value);
  const formatted = formatDoj(dojDate);
  formattedDojSpan.textContent = formatted;

  const url = buildSearchUrl();
  urlPreviewDiv.textContent = url;
  urlPreviewDiv.title = url;

  // Highlight matching quick date button
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = dojDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  quickDateButtons.forEach(btn => {
    const days = parseInt(btn.dataset.days, 10);
    if (days === diffDays) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  savePreferences();
}

// Auto-save user preferences to chrome.storage.local
function savePreferences() {
  if (saveTimeout) clearTimeout(saveTimeout);

  if (saveStatus) {
    saveStatus.textContent = 'Saving...';
    saveStatus.className = 'status-badge saving';
  }

  saveTimeout = setTimeout(async () => {
    try {
      await chrome.storage.local.set({
        fromStation: fromStationInput.value.trim(),
        toStation: toStationInput.value.trim(),
        journeyDate: journeyDateInput.value,
        seatClass: seatClassSelect.value,
        selectedTrain: trainNameInput.value.trim(),
        autoBookNow: autoBookNowCheckbox ? autoBookNowCheckbox.checked : true,
        autoSelectSeats: autoSelectSeatsCheckbox ? autoSelectSeatsCheckbox.checked : true,
        seatCount: seatCountSelect ? parseInt(seatCountSelect.value, 10) : 1,
        autoContinue: autoContinueCheckbox ? autoContinueCheckbox.checked : false,
        targetUrl: buildSearchUrl()
      });

      if (saveStatus) {
        saveStatus.textContent = '✓ Saved';
        saveStatus.className = 'status-badge';
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  }, 250);
}

// Reset form and saved preferences to defaults
async function resetDefaults() {
  fromStationInput.value = 'Dhaka';
  toStationInput.value = 'Joypurhat';
  seatClassSelect.value = 'S_CHAIR';
  trainNameInput.value = '';

  const advanceDate = new Date();
  advanceDate.setDate(advanceDate.getDate() + 10);
  journeyDateInput.value = toDateInputValue(advanceDate);

  if (autoBookNowCheckbox) autoBookNowCheckbox.checked = true;
  if (autoSelectSeatsCheckbox) autoSelectSeatsCheckbox.checked = true;
  if (seatCountSelect) seatCountSelect.value = '1';
  if (autoContinueCheckbox) autoContinueCheckbox.checked = false;

  updateUi();

  if (saveStatus) {
    saveStatus.textContent = '✓ Reset';
    saveStatus.className = 'status-badge';
    setTimeout(() => {
      saveStatus.textContent = '✓ Saved';
    }, 1200);
  }
}

// Set Date by Offset
function setDateByOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  journeyDateInput.value = toDateInputValue(date);
  updateUi();
}

// Swap Stations
function swapStations() {
  const temp = fromStationInput.value;
  fromStationInput.value = toStationInput.value;
  toStationInput.value = temp;
  updateUi();
}

// Normalize station names on blur
function handleStationBlur(e) {
  const canonical = getCanonicalStationName(e.target.value);
  if (canonical && canonical !== e.target.value) {
    e.target.value = canonical;
    updateUi();
  }
}

// Normalize train name on blur
function handleTrainBlur(e) {
  if (!e.target.value.trim()) return;
  const canonical = getCanonicalTrainName(e.target.value);
  if (canonical && canonical !== e.target.value) {
    e.target.value = canonical;
    updateUi();
  }
}

// Clear selected train
function clearSelectedTrain() {
  trainNameInput.value = '';
  updateUi();
}

// Search & Open Page (One-time trigger armed on explicit user click)
async function openSearchPage() {
  const url = buildSearchUrl();
  try {
    // Arm one-time automation trigger for the content script
    await chrome.storage.local.set({
      botRunTriggered: true,
      botTriggerTimestamp: Date.now(),
      seatClass: seatClassSelect.value,
      selectedTrain: trainNameInput.value.trim(),
      autoBookNow: autoBookNowCheckbox ? autoBookNowCheckbox.checked : true,
      autoSelectSeats: autoSelectSeatsCheckbox ? autoSelectSeatsCheckbox.checked : true,
      seatCount: seatCountSelect ? parseInt(seatCountSelect.value, 10) : 1,
      autoContinue: autoContinueCheckbox ? autoContinueCheckbox.checked : false,
      targetUrl: url
    });

    await chrome.tabs.create({ url, active: true });
  } catch (err) {
    console.error('Error opening search tab:', err);
  }
}

// Copy URL to Clipboard
async function copyUrlToClipboard() {
  const url = buildSearchUrl();
  try {
    await navigator.clipboard.writeText(url);
    const originalText = btnCopyUrl.textContent;
    btnCopyUrl.textContent = '✓ Copied!';
    setTimeout(() => {
      btnCopyUrl.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy URL:', err);
  }
}

// Schedule 8:00 AM Auto-Open
async function handleScheduleToggle(e) {
  const isEnabled = e.target.checked;
  const url = buildSearchUrl();

  if (isEnabled) {
    const now = new Date();
    const target = new Date();
    target.setHours(8, 0, 0, 0); // 8:00:00 AM

    if (now.getTime() >= target.getTime()) {
      // If 8:00 AM already passed today, set for tomorrow
      target.setDate(target.getDate() + 1);
    }

    await chrome.storage.local.set({
      scheduleEnabled: true,
      scheduleTargetTimestamp: target.getTime(),
      targetUrl: url
    });

    await chrome.alarms.create('open_railway_ticket_alarm', {
      when: target.getTime()
    });

    updateCountdownDisplay(target.getTime());
  } else {
    await chrome.storage.local.set({ scheduleEnabled: false });
    await chrome.alarms.clear('open_railway_ticket_alarm');
    countdownText.textContent = 'Status: Off';
  }
}

function updateCountdownDisplay(targetTimestamp) {
  if (!targetTimestamp) {
    countdownText.textContent = 'Status: Off';
    return;
  }

  const now = Date.now();
  const diff = targetTimestamp - now;

  if (diff <= 0) {
    countdownText.textContent = 'Ready to launch at 08:00 AM!';
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  countdownText.textContent = `Active: Opens in ${hours}h ${minutes}m ${seconds}s`;
}

// Initialize Popup
async function init() {
  // Populate datalists from official datasets
  populateStationDatalists();
  populateTrainDatalists();

  // Set default min date to today
  const today = new Date();
  journeyDateInput.min = toDateInputValue(today);

  // Load saved preferences from chrome.storage.local
  try {
    const saved = await chrome.storage.local.get([
      'fromStation',
      'toStation',
      'journeyDate',
      'seatClass',
      'selectedTrain',
      'autoBookNow',
      'autoSelectSeats',
      'seatCount',
      'autoContinue',
      'scheduleEnabled',
      'scheduleTargetTimestamp'
    ]);

    if (saved.fromStation) fromStationInput.value = saved.fromStation;
    else fromStationInput.value = 'Dhaka';

    if (saved.toStation) toStationInput.value = saved.toStation;
    else toStationInput.value = 'Joypurhat';

    if (saved.seatClass) seatClassSelect.value = saved.seatClass;
    else seatClassSelect.value = 'S_CHAIR';

    if (saved.selectedTrain !== undefined) trainNameInput.value = saved.selectedTrain;
    else trainNameInput.value = '';

    if (saved.autoBookNow !== undefined && autoBookNowCheckbox) autoBookNowCheckbox.checked = saved.autoBookNow;
    else if (autoBookNowCheckbox) autoBookNowCheckbox.checked = true;

    if (saved.autoSelectSeats !== undefined && autoSelectSeatsCheckbox) autoSelectSeatsCheckbox.checked = saved.autoSelectSeats;
    else if (autoSelectSeatsCheckbox) autoSelectSeatsCheckbox.checked = true;

    if (saved.seatCount && seatCountSelect) seatCountSelect.value = String(saved.seatCount);
    else if (seatCountSelect) seatCountSelect.value = '1';

    if (saved.autoContinue !== undefined && autoContinueCheckbox) autoContinueCheckbox.checked = saved.autoContinue;
    else if (autoContinueCheckbox) autoContinueCheckbox.checked = false;

    // Intelligent date restoration:
    // If saved journey date is today or in the future, keep it.
    // If it was in the past (or not set), default to 10 days in advance.
    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);

    if (saved.journeyDate) {
      const savedDateObj = parseDateInput(saved.journeyDate);
      savedDateObj.setHours(0, 0, 0, 0);
      if (savedDateObj.getTime() >= todayZero.getTime()) {
        journeyDateInput.value = saved.journeyDate;
      } else {
        const advanceDate = new Date();
        advanceDate.setDate(advanceDate.getDate() + 10);
        journeyDateInput.value = toDateInputValue(advanceDate);
      }
    } else {
      const advanceDate = new Date();
      advanceDate.setDate(advanceDate.getDate() + 10);
      journeyDateInput.value = toDateInputValue(advanceDate);
    }

    // Check 8:00 AM schedule timer status
    if (saved.scheduleEnabled && saved.scheduleTargetTimestamp) {
      if (saved.scheduleTargetTimestamp > Date.now()) {
        scheduleToggle.checked = true;
        updateCountdownDisplay(saved.scheduleTargetTimestamp);
      } else {
        await chrome.storage.local.set({ scheduleEnabled: false });
        scheduleToggle.checked = false;
        countdownText.textContent = 'Status: Off';
      }
    } else {
      scheduleToggle.checked = false;
      countdownText.textContent = 'Status: Off';
    }
  } catch (err) {
    console.error('Failed to load saved preferences:', err);
  }

  updateUi();

  // Event Listeners
  fromStationInput.addEventListener('input', updateUi);
  fromStationInput.addEventListener('blur', handleStationBlur);

  toStationInput.addEventListener('input', updateUi);
  toStationInput.addEventListener('blur', handleStationBlur);

  journeyDateInput.addEventListener('change', updateUi);
  seatClassSelect.addEventListener('change', updateUi);

  trainNameInput.addEventListener('input', updateUi);
  trainNameInput.addEventListener('blur', handleTrainBlur);
  btnClearTrain.addEventListener('click', clearSelectedTrain);

  if (autoBookNowCheckbox) autoBookNowCheckbox.addEventListener('change', updateUi);
  if (autoSelectSeatsCheckbox) autoSelectSeatsCheckbox.addEventListener('change', updateUi);
  if (seatCountSelect) seatCountSelect.addEventListener('change', updateUi);
  if (autoContinueCheckbox) autoContinueCheckbox.addEventListener('change', updateUi);
  if (btnReset) btnReset.addEventListener('click', resetDefaults);

  btnSwap.addEventListener('click', swapStations);
  btnSearch.addEventListener('click', openSearchPage);
  btnCopyUrl.addEventListener('click', copyUrlToClipboard);
  scheduleToggle.addEventListener('change', handleScheduleToggle);

  quickDateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days, 10);
      setDateByOffset(days);
    });
  });

  // Update countdown every second if schedule active
  setInterval(async () => {
    if (scheduleToggle.checked) {
      const { scheduleTargetTimestamp } = await chrome.storage.local.get('scheduleTargetTimestamp');
      updateCountdownDisplay(scheduleTargetTimestamp);
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
