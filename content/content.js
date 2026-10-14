// BD Railway Ticket Quick Booker - Automated Booking Content Script
// Built specifically for eticket.railway.gov.bd Angular Architecture

(async function () {
  'use strict';

  // Gate: Only run if explicitly triggered by clicking "Search & Open" in extension
  const triggerData = await chrome.storage.local.get(['botRunTriggered', 'botTriggerTimestamp']);
  const isTriggered = triggerData.botRunTriggered === true;
  const isRecent = triggerData.botTriggerTimestamp && (Date.now() - triggerData.botTriggerTimestamp < 120000);

  if (!isTriggered || !isRecent) {
    console.log('[BD Railway Booker] Inactive: Waiting for user to click "Search & Open Page" from extension.');
    return; // Stop completely! Do not run!
  }

  // ONE TIME ONLY: Immediately consume the trigger so it never repeats on refresh or other tabs
  await chrome.storage.local.set({ botRunTriggered: false });
  console.log('[BD Railway Booker] One-time auto-assistant activated for this search session!');

  // Read user configuration from extension storage
  const config = await chrome.storage.local.get([
    'seatClass',
    'selectedTrain',
    'autoBookNow',
    'autoSelectSeats',
    'seatCount',
    'autoContinue'
  ]);

  const targetClass = (config.seatClass || 'S_CHAIR').trim().toUpperCase();
  const targetTrain = (config.selectedTrain || '').trim();
  const autoBookNow = config.autoBookNow !== false; // default true
  const autoSelectSeats = config.autoSelectSeats !== false; // default true
  const targetSeatCount = Math.min(Math.max(parseInt(config.seatCount, 10) || 1, 1), 4);
  const autoContinue = config.autoContinue === true; // default false

  let isPaused = false;
  let bookNowClicked = false;
  let isSelectingSeats = false;
  let seatsSelected = false;
  let lastStatusHtml = '';
  let runner = null;
  let isProcessingTrip = false;

  console.log('[BD Railway Booker] Initialized with config:', {
    targetClass,
    targetTrain,
    autoBookNow,
    autoSelectSeats,
    targetSeatCount,
    autoContinue
  });

  // Create Floating Status HUD on page
  let currentStep = 1;
  const stepTitles = [
    'Train Search',
    'Class & Seats',
    'Book Now',
    'Seat Pick',
    'Checkout'
  ];

  const hud = createHud();

  function addLog(message, type = 'info') {
    if (!hud) return;
    const logBox = hud.querySelector('#hud-log-box');
    if (!logBox) return;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:6px; line-height:1.4; align-items:flex-start;';

    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0') + ':' +
                    String(now.getSeconds()).padStart(2, '0');

    let textColor = '#e2e8f0';
    if (type === 'success') textColor = '#86efac';
    else if (type === 'warn') textColor = '#fde047';
    else if (type === 'error') textColor = '#fca5a5';

    row.innerHTML = `<span style="color:#64748b; flex-shrink:0;">[${timeStr}]</span><span style="color:${textColor}; word-break:break-word;">${message}</span>`;
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function setStep(stepIndex, state, message = '') {
    // stepIndex: 1 to 5
    // state: 'pending' | 'active' | 'completed' | 'warn' | 'error'
    currentStep = stepIndex;
    if (!hud) return;

    for (let i = 1; i <= 5; i++) {
      const pill = hud.querySelector(`#step-pill-${i}`);
      const icon = hud.querySelector(`#step-icon-${i}`);
      if (!pill || !icon) continue;

      if (i < stepIndex) {
        // Earlier steps completed
        pill.style.background = '#ecfdf5';
        pill.style.borderColor = '#10b981';
        pill.style.color = '#047857';
        icon.innerHTML = '✓';
        icon.style.background = '#10b981';
        icon.style.color = '#ffffff';
      } else if (i === stepIndex) {
        if (state === 'completed') {
          pill.style.background = '#ecfdf5';
          pill.style.borderColor = '#10b981';
          pill.style.color = '#047857';
          icon.innerHTML = '✓';
          icon.style.background = '#10b981';
          icon.style.color = '#ffffff';
        } else if (state === 'warn') {
          pill.style.background = '#fefce8';
          pill.style.borderColor = '#eab308';
          pill.style.color = '#a16207';
          icon.innerHTML = '!';
          icon.style.background = '#eab308';
          icon.style.color = '#ffffff';
        } else if (state === 'error') {
          pill.style.background = '#fef2f2';
          pill.style.borderColor = '#ef4444';
          pill.style.color = '#b91c1c';
          icon.innerHTML = '✕';
          icon.style.background = '#ef4444';
          icon.style.color = '#ffffff';
        } else {
          // Active
          pill.style.background = '#eff6ff';
          pill.style.borderColor = '#3b82f6';
          pill.style.color = '#1d4ed8';
          icon.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">↻</span>`;
          icon.style.background = '#3b82f6';
          icon.style.color = '#ffffff';
        }
      } else {
        // Pending
        pill.style.background = '#f8fafc';
        pill.style.borderColor = '#e2e8f0';
        pill.style.color = '#94a3b8';
        icon.innerHTML = `${i}`;
        icon.style.background = '#e2e8f0';
        icon.style.color = '#64748b';
      }
    }

    // Update banner
    const bannerBadge = hud.querySelector('#hud-step-badge');
    const bannerStatus = hud.querySelector('#hud-status-text');
    const bannerBox = hud.querySelector('#hud-current-banner');

    if (bannerBadge) {
      bannerBadge.textContent = `Step ${stepIndex}/5: ${stepTitles[stepIndex - 1]}`;
    }
    if (bannerStatus && message) {
      bannerStatus.innerHTML = message;
    }

    if (bannerBox) {
      if (state === 'completed') {
        bannerBox.style.background = '#ecfdf5';
        bannerBox.style.borderLeftColor = '#10b981';
      } else if (state === 'warn') {
        bannerBox.style.background = '#fefce8';
        bannerBox.style.borderLeftColor = '#eab308';
      } else if (state === 'error') {
        bannerBox.style.background = '#fef2f2';
        bannerBox.style.borderLeftColor = '#ef4444';
      } else {
        bannerBox.style.background = '#eff6ff';
        bannerBox.style.borderLeftColor = '#3b82f6';
      }
    }
  }

  function updateStatus(message, type = 'info') {
    if (!hud || message === lastStatusHtml) return;
    lastStatusHtml = message;

    const bannerStatus = hud.querySelector('#hud-status-text');
    if (bannerStatus) {
      bannerStatus.innerHTML = message;
      if (type === 'success') bannerStatus.style.color = '#15803d';
      else if (type === 'warn') bannerStatus.style.color = '#b45309';
      else if (type === 'error') bannerStatus.style.color = '#dc2626';
      else bannerStatus.style.color = '#1e293b';
    }
  }

  function createHud() {
    if (document.getElementById('railway-booker-hud')) return document.getElementById('railway-booker-hud');

    // Add rotating animation styles
    if (!document.getElementById('railway-hud-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'railway-hud-styles';
      styleEl.textContent = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        #hud-log-box::-webkit-scrollbar { width: 4px; }
        #hud-log-box::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      `;
      document.head.appendChild(styleEl);
    }

    const container = document.createElement('div');
    container.id = 'railway-booker-hud';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #ffffff;
      border: 2px solid #006a4e;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 10px 30px rgba(0, 106, 78, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #1e293b;
      width: 390px;
      max-width: calc(100vw - 32px);
      box-sizing: border-box;
      pointer-events: auto;
    `;

    container.innerHTML = `
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">🚆</span>
          <div>
            <strong style="color:#006a4e; font-size:14px; display:block; line-height:1.2;">Railway Ticket Bot</strong>
            <span style="font-size:11px; color:#64748b;">Live Step Monitor (ধাপসমূহ)</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button id="hud-btn-toggle-log" type="button" title="Toggle Activity Log" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:600; padding:3px 8px; cursor:pointer; color:#475569;">Log ▾</button>
          <button id="hud-btn-pause" type="button" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:11px; font-weight:600; padding:3px 10px; cursor:pointer; color:#1e293b;">Pause</button>
          <button id="hud-btn-close" type="button" title="Close & Stop Bot" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer; line-height:1; padding:0 4px;">&times;</button>
        </div>
      </div>

      <!-- Target Info Bar -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; margin-bottom:10px; font-size:11.5px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
        <span>Train: <strong style="color:#006a4e;">${targetTrain || 'Any Train'}</strong></span>
        <span>Class: <strong style="color:#006a4e;">${targetClass}</strong></span>
        <span>Seats: <strong style="color:#006a4e;">${targetSeatCount}</strong></span>
      </div>

      <!-- 5-Step Stepper -->
      <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:4px; margin-bottom:10px;">
        <div id="step-pill-1" style="display:flex; flex-direction:column; align-items:center; padding:4px 2px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; font-size:10px; text-align:center; transition:all 0.2s ease;">
          <div id="step-icon-1" style="width:16px; height:16px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; margin-bottom:2px;">1</div>
          <span>Train</span>
        </div>
        <div id="step-pill-2" style="display:flex; flex-direction:column; align-items:center; padding:4px 2px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; font-size:10px; text-align:center; transition:all 0.2s ease;">
          <div id="step-icon-2" style="width:16px; height:16px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; margin-bottom:2px;">2</div>
          <span>Class</span>
        </div>
        <div id="step-pill-3" style="display:flex; flex-direction:column; align-items:center; padding:4px 2px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; font-size:10px; text-align:center; transition:all 0.2s ease;">
          <div id="step-icon-3" style="width:16px; height:16px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; margin-bottom:2px;">3</div>
          <span>Book</span>
        </div>
        <div id="step-pill-4" style="display:flex; flex-direction:column; align-items:center; padding:4px 2px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; font-size:10px; text-align:center; transition:all 0.2s ease;">
          <div id="step-icon-4" style="width:16px; height:16px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; margin-bottom:2px;">4</div>
          <span>Seats</span>
        </div>
        <div id="step-pill-5" style="display:flex; flex-direction:column; align-items:center; padding:4px 2px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; font-size:10px; text-align:center; transition:all 0.2s ease;">
          <div id="step-icon-5" style="width:16px; height:16px; border-radius:50%; background:#e2e8f0; color:#64748b; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; margin-bottom:2px;">5</div>
          <span>Finish</span>
        </div>
      </div>

      <!-- Current Step Status Banner -->
      <div id="hud-current-banner" style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:6px; padding:8px 12px; margin-bottom:8px; transition:all 0.2s ease;">
        <div id="hud-step-badge" style="font-size:10.5px; font-weight:700; text-transform:uppercase; color:#1d4ed8; margin-bottom:2px;">
          Step 1/5: Train Search
        </div>
        <div id="hud-status-text" style="font-weight:600; font-size:12.5px; color:#1e293b; line-height:1.4;">
          🔍 Searching train results...
        </div>
      </div>

      <!-- Live Activity Log -->
      <div id="hud-log-box" style="background:#0f172a; border-radius:6px; padding:8px 10px; font-family:monospace; font-size:11px; max-height:100px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
      </div>
    `;

    document.body.appendChild(container);

    const btnPause = container.querySelector('#hud-btn-pause');
    btnPause.addEventListener('click', () => {
      isPaused = !isPaused;
      btnPause.textContent = isPaused ? 'Resume' : 'Pause';
      btnPause.style.background = isPaused ? '#fee2e2' : '#f1f5f9';
      btnPause.style.color = isPaused ? '#991b1b' : '#1e293b';
      if (isPaused) {
        updateStatus('⏸️ Bot Paused by user.', 'warn');
        addLog('⏸️ Bot execution paused by user', 'warn');
      } else {
        updateStatus('▶️ Bot Resumed.', 'success');
        addLog('▶️ Bot execution resumed', 'success');
      }
    });

    const btnClose = container.querySelector('#hud-btn-close');
    btnClose.addEventListener('click', () => {
      isPaused = true;
      if (runner) clearInterval(runner);
      container.remove();
      console.log('[BD Railway Booker] HUD closed and bot stopped by user.');
    });

    const btnToggleLog = container.querySelector('#hud-btn-toggle-log');
    const logBox = container.querySelector('#hud-log-box');
    btnToggleLog.addEventListener('click', () => {
      if (logBox.style.display === 'none') {
        logBox.style.display = 'flex';
        btnToggleLog.textContent = 'Log ▾';
      } else {
        logBox.style.display = 'none';
        btnToggleLog.textContent = 'Log ▸';
      }
    });

    return container;
  }

  // Initialize Step 1
  setStep(1, 'active', `🔍 Scanning train list for <strong>${targetTrain || 'available trains'}</strong>...`);
  addLog(`🚀 Bot started for [${targetTrain || 'Any Train'}], Class [${targetClass}], Seats [${targetSeatCount}]`, 'info');
  addLog(`🔍 Step 1: Scanning available train trips...`, 'info');

  // Helper: Extract model number from train string
  function extractTrainModel(str) {
    if (!str) return '';
    const m = str.match(/\((\d+)\)/);
    return m ? m[1] : '';
  }

  // Helper: sleep
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // STEP 1 & 2: Find Train Card and Click "BOOK NOW"
  async function processTrainResults() {
    if (isPaused || bookNowClicked || isProcessingTrip) return;
    isProcessingTrip = true;

    try {
      const trips = document.querySelectorAll('app-single-trip');
      if (!trips || trips.length === 0) return;

      const targetModel = extractTrainModel(targetTrain);
      const cleanTrainName = targetTrain.replace(/\(\d+\)/, '').trim().toLowerCase();

      let matchedTrip = null;

      // Look for trip matching user's selected train
      for (const trip of trips) {
        const titleEl = trip.querySelector('.trip-left-info h2, .trip-name h2');
        if (!titleEl) continue;
        const tripText = titleEl.textContent || '';
        const tripLower = tripText.toLowerCase();

        if (targetTrain) {
          if ((targetModel && tripText.includes(targetModel)) || (cleanTrainName && tripLower.includes(cleanTrainName))) {
            matchedTrip = trip;
            break;
          }
        } else {
          // If no specific train chosen, pick first one with available seats for target class
          const classEl = trip.querySelector(`.seat-classes-row .single-seat-class .seat-class-name`);
          if (classEl) {
            matchedTrip = trip;
            break;
          }
        }
      }

      if (!matchedTrip) {
        updateStatus(`Searching: Looking for <strong>${targetTrain || 'trains'}</strong>...`);
        return;
      }

      // Train found! Highlight and scroll to it
      const tripWrapper = matchedTrip.querySelector('.single-trip-wrapper') || matchedTrip;
      if (!tripWrapper.dataset.botHighlighted) {
        tripWrapper.dataset.botHighlighted = 'true';
        tripWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tripWrapper.style.outline = '3px solid #006a4e';
        tripWrapper.style.outlineOffset = '4px';
        tripWrapper.style.borderRadius = '8px';
        tripWrapper.style.boxShadow = '0 0 15px rgba(0, 106, 78, 0.35)';
      }

      const trainTitle = matchedTrip.querySelector('.trip-left-info h2')?.textContent?.trim() || targetTrain;

      setStep(1, 'completed', `✓ Train found: <strong>${trainTitle}</strong>`);
      addLog(`✅ Step 1: Matched "${trainTitle}"`, 'success');

      // Auto-expand trip card if it is collapsed (off)
      const collapsibleDiv = matchedTrip.querySelector('.trip-collapsible, .trip-div');
      const isCollapsed = collapsibleDiv && (
        collapsibleDiv.classList.contains('trip-collapsed') ||
        collapsibleDiv.offsetHeight === 0 ||
        (window.getComputedStyle(collapsibleDiv).display === 'none') ||
        (window.getComputedStyle(collapsibleDiv).height === '0px')
      );

      if (isCollapsed) {
        updateStatus(`📂 Expanding <strong>${trainTitle}</strong> card details...`, 'info');
        addLog(`📂 Trip card is collapsed. Expanding "${trainTitle}"...`, 'info');

        const collapseBtn = matchedTrip.querySelector('.trip-collapse-btn, button.rotate-collapse-btn, .trip-name button') || matchedTrip.querySelector('.trip-name');
        if (collapseBtn) {
          collapseBtn.click();
          console.log('[BD Railway Booker] Clicked trip-collapse-btn to expand card.');
          // Wait for Angular animation and DOM rendering
          await sleep(350);
        }
      }

      setStep(2, 'active', `Checking availability for <strong>${targetClass}</strong>...`);
      addLog(`🔍 Step 2: Checking seat class "${targetClass}"...`, 'info');

      // Find requested seat class in this train
      const seatClasses = matchedTrip.querySelectorAll('.seat-classes-row .single-seat-class');
      let targetSeatClassEl = null;

      for (const sc of seatClasses) {
        const nameEl = sc.querySelector('.seat-class-name');
        if (nameEl && nameEl.textContent.trim().toUpperCase() === targetClass) {
          targetSeatClassEl = sc;
          break;
        }
      }

      if (!targetSeatClassEl) {
        setStep(2, 'error', `Class <strong>${targetClass}</strong> not found on <strong>${trainTitle}</strong>.`);
        addLog(`❌ Step 2: Class "${targetClass}" not found on ${trainTitle}`, 'error');
        return;
      }

      // Check availability
      const availableSeatsEl = targetSeatClassEl.querySelector('.all-seats');
      const availableCount = availableSeatsEl ? parseInt(availableSeatsEl.textContent.trim(), 10) : 0;
      const bookNowBtn = targetSeatClassEl.querySelector('.book-now-btn');

      if (bookNowBtn && (availableCount > 0 || isNaN(availableCount))) {
        setStep(2, 'completed', `🎉 <strong>${availableCount} seat(s)</strong> available for <strong>${targetClass}</strong>!`);
        addLog(`✅ Step 2: ${availableCount} seat(s) available for "${targetClass}"`, 'success');

        if (autoBookNow && !bookNowClicked) {
          bookNowClicked = true;
          setStep(3, 'active', `⚡ Auto-clicking <strong>BOOK NOW</strong> for ${targetClass}...`);
          addLog(`⚡ Step 3: Clicking BOOK NOW for "${targetClass}"...`, 'info');

          bookNowBtn.style.boxShadow = '0 0 12px #da291c';
          setTimeout(() => {
            bookNowBtn.click();
            console.log('[BD Railway Booker] Clicked BOOK NOW button!');
            setStep(3, 'completed', `✓ BOOK NOW clicked! Loading seat layout modal...`);
            addLog(`✅ Step 3: BOOK NOW clicked! Seat layout loading...`, 'success');
          }, 200);
        }
      } else {
        setStep(2, 'warn', `⚠️ No seats currently available for <strong>${targetClass}</strong> (${trainTitle}).`);
        addLog(`⚠️ Step 2: 0 seats available for "${targetClass}"`, 'warn');
      }
    } finally {
      isProcessingTrip = false;
    }
  }

  // STEP 3 & 4: Handle Seat Layout & Selection in <app-seat-layout>
  async function processSeatLayout() {
    if (isPaused || isSelectingSeats || seatsSelected) return;

    const seatLayout = document.querySelector('app-seat-layout .seat-layout-view, .seat-layout-view');
    if (!seatLayout) return;

    isSelectingSeats = true;
    setStep(4, 'active', `Opening coach & picking <strong>${targetSeatCount} seat(s)</strong>...`);
    addLog(`🔍 Step 4: Seat layout modal detected, preparing selection...`, 'info');

    try {
      // Coach / Bogie Selection
      const bogieSelect = seatLayout.querySelector('#select-bogie');
      if (bogieSelect && bogieSelect.options && bogieSelect.options.length > 0) {
        const currentOptText = bogieSelect.options[bogieSelect.selectedIndex]?.textContent || '';
        if (currentOptText.includes('0 Seat(s)')) {
          for (let i = 0; i < bogieSelect.options.length; i++) {
            const opt = bogieSelect.options[i];
            if (!opt.textContent.includes('0 Seat(s)')) {
              bogieSelect.selectedIndex = i;
              bogieSelect.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('[BD Railway Booker] Switched to coach with seats:', opt.textContent);
              addLog(`🔁 Switched to coach with seats: ${opt.textContent.trim()}`, 'info');
              await sleep(400); // Allow Angular to re-render coach seats
              break;
            }
          }
        }
      }

      // Seat Selection (Sequential: 1 by 1, waits until confirmed before next)
      if (autoSelectSeats) {
        updateStatus(`Selecting <strong>${targetSeatCount} seat(s)</strong> (১টি করে নিশ্চিত হওয়ার পর পরবর্তী সিট)...`);
        addLog(`💺 Starting sequential selection for ${targetSeatCount} seat(s)...`, 'info');

        function getCurrentlySelectedSeatCount() {
          return seatLayout.querySelectorAll('button.seat-selected, button.sleeper-selected, .seat-selected, .sleeper-selected').length;
        }

        function isSeatButtonSelected(btn) {
          if (!btn) return false;
          return btn.classList.contains('seat-selected') ||
                 btn.classList.contains('sleeper-selected') ||
                 btn.classList.contains('active') ||
                 btn.getAttribute('aria-pressed') === 'true';
        }

        async function waitForSeatConfirmation(btn, seatTitle, initialCount, maxWaitMs = 6000) {
          const startTime = Date.now();
          while (Date.now() - startTime < maxWaitMs) {
            if (isPaused) return false;

            // Condition 1: Button received selected class
            if (isSeatButtonSelected(btn)) {
              return true;
            }

            // Condition 2: Overall selected seats count increased
            if (getCurrentlySelectedSeatCount() > initialCount) {
              return true;
            }

            // Condition 3: Seat name appeared in fare / booking details
            const summaryEls = Array.from(seatLayout.querySelectorAll('.selected-seats, .seat-details, .table, tbody, .trip-fare-details, .booking-summary'));
            const foundInSummary = summaryEls.some(el => el.textContent && el.textContent.includes(seatTitle));
            if (foundInSummary) {
              return true;
            }

            await sleep(150);
          }
          return false;
        }

        // Helper to prioritize available seats starting from the middle towards the side with more vacant seats
        function getPrioritizedAvailableSeats() {
          const allCoachButtons = Array.from(seatLayout.querySelectorAll('button.btn-seat, .btn-seat'));
          if (allCoachButtons.length === 0) return { seats: [], preferredSide: 'Unknown' };

          // Map all seats in coach to extract numeric number / visual index
          const allSeatsMapped = allCoachButtons.map((btn, idx) => {
            const text = (btn.title || btn.textContent || '').trim();
            const numMatch = text.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0], 10) : (idx + 1);
            return {
              btn,
              idx,
              title: text || `Seat ${idx + 1}`,
              num
            };
          });

          // Determine middle of coach
          const allNums = allSeatsMapped.map(s => s.num);
          const minNum = Math.min(...allNums);
          const maxNum = Math.max(...allNums);
          const midNum = (minNum + maxNum) / 2;

          // Filter only available seats that haven't been clicked/selected yet
          const availableMapped = allSeatsMapped.filter(s => {
            const btn = s.btn;
            return btn.classList.contains('seat-available') &&
                   !btn.classList.contains('seat-booked') &&
                   !btn.hasAttribute('disabled') &&
                   !btn.dataset.botClicked &&
                   !isSeatButtonSelected(btn);
          });

          if (availableMapped.length === 0) {
            return { seats: [], midNum, lowerCount: 0, upperCount: 0, preferredSide: 'None' };
          }

          // Split available seats into Lower half (< midNum) and Upper half (>= midNum)
          const lowerHalf = availableMapped.filter(s => s.num < midNum);
          const upperHalf = availableMapped.filter(s => s.num >= midNum);

          const lowerCount = lowerHalf.length;
          const upperCount = upperHalf.length;

          // Sort both halves by distance from middle ascending (closest to middle first!)
          lowerHalf.sort((a, b) => Math.abs(a.num - midNum) - Math.abs(b.num - midNum));
          upperHalf.sort((a, b) => Math.abs(a.num - midNum) - Math.abs(b.num - midNum));

          // Pick direction that has more vacant seats (যেদিক বেশি ফাঁকা)
          let prioritized = [];
          let preferredSide = 'Balanced';

          if (upperCount > lowerCount) {
            // Upper half has more vacant seats -> pick from upper half (closest to middle first), then lower half
            prioritized = [...upperHalf, ...lowerHalf];
            preferredSide = 'Upper';
          } else if (lowerCount > upperCount) {
            // Lower half has more vacant seats -> pick from lower half (closest to middle first), then upper half
            prioritized = [...lowerHalf, ...upperHalf];
            preferredSide = 'Lower';
          } else {
            // Both sides have equal vacancies -> sort all available by distance from middle
            prioritized = [...availableMapped].sort((a, b) => Math.abs(a.num - midNum) - Math.abs(b.num - midNum));
            preferredSide = 'Balanced';
          }

          return {
            seats: prioritized,
            midNum,
            lowerCount,
            upperCount,
            preferredSide
          };
        }

        const selectedTitles = [];
        let attempts = 0;
        const maxAttempts = targetSeatCount * 4;
        let loggedStrategy = false;

        while (selectedTitles.length < targetSeatCount && attempts < maxAttempts) {
          if (isPaused) break;
          attempts++;

          // Get prioritized available seats based on coach middle and vacancies
          const strategyResult = getPrioritizedAvailableSeats();
          const availableSeats = strategyResult.seats || [];

          if (!loggedStrategy && strategyResult.midNum !== undefined) {
            loggedStrategy = true;
            addLog(`💺 Coach Mid: ~${Math.round(strategyResult.midNum)} | Lower: ${strategyResult.lowerCount} vacant, Upper: ${strategyResult.upperCount} vacant`, 'info');
            addLog(`🎯 Strategy: Starting from middle towards ${strategyResult.preferredSide} side (more vacant seats)`, 'info');
          }

          if (availableSeats.length === 0) {
            console.warn('[BD Railway Booker] No more available seats found in coach.');
            addLog(`⚠️ No more available seats found in coach`, 'warn');
            break;
          }

          const targetSeatObj = availableSeats[0];
          const btn = targetSeatObj.btn;
          btn.dataset.botClicked = 'true';
          const seatTitle = targetSeatObj.title;
          const currentSeatNum = selectedTitles.length + 1;
          const countBefore = getCurrentlySelectedSeatCount();

          updateStatus(`Clicking Seat ${currentSeatNum} of ${targetSeatCount}: <strong>${seatTitle}</strong>... (মাঝের দিক হতে নিশ্চিতকরণের অপেক্ষা)`);
          addLog(`👉 Clicking Seat ${currentSeatNum}/${targetSeatCount}: "${seatTitle}" (closest to middle in ${strategyResult.preferredSide} side)...`, 'info');

          // Click the seat
          btn.click();

          // Wait until this specific seat is confirmed by the system!
          const confirmed = await waitForSeatConfirmation(btn, seatTitle, countBefore, 6000);

          if (confirmed) {
            selectedTitles.push(seatTitle);
            updateStatus(`✓ Seat ${currentSeatNum}/${targetSeatCount} ("${seatTitle}") confirmed! Next seat wait...`, 'success');
            addLog(`✅ Seat ${currentSeatNum}/${targetSeatCount} ("${seatTitle}") নিশ্চিত হয়েছে!`, 'success');

            // Wait 500ms to let Angular state settle before clicking the next seat
            await sleep(500);
          } else {
            console.warn(`[BD Railway Booker] Seat "${seatTitle}" could not be confirmed in time.`);
            addLog(`⚠️ Seat "${seatTitle}" নিশ্চিত হতে পারেনি, পরবর্তী সিট খোঁজা হচ্ছে...`, 'warn');
            await sleep(300);
          }
        }

        seatsSelected = true;
        setStep(4, 'completed', `✓ Selected <strong>${selectedTitles.length} seat(s)</strong>: <code>${selectedTitles.join(', ')}</code>!`);
        addLog(`✅ Step 4: Successfully selected ${selectedTitles.length} seat(s) [${selectedTitles.join(', ')}]`, 'success');
        console.log('[BD Railway Booker] Selected seats successfully:', selectedTitles);

        // Ensure Boarding Point is selected
        const boardingSelect = seatLayout.querySelector('#boardingpoint');
        if (boardingSelect && boardingSelect.options && boardingSelect.options.length > 0) {
          if (!boardingSelect.value && boardingSelect.options[0]) {
            boardingSelect.selectedIndex = 0;
            boardingSelect.dispatchEvent(new Event('change', { bubbles: true }));
            addLog(`📍 Boarding station confirmed`, 'info');
          }
        }

        // Handle Continue Purchase Button
        const continueBtn = seatLayout.querySelector('button.continue-btn');
        if (continueBtn) {
          continueBtn.style.boxShadow = '0 0 15px #006a4e';
          continueBtn.style.transform = 'scale(1.02)';

          if (autoContinue) {
            setStep(5, 'active', `🚀 Auto-clicking <strong>CONTINUE PURCHASE</strong> in 1 sec...`);
            addLog(`🚀 Step 5: Auto-clicking CONTINUE PURCHASE in 1s...`, 'info');
            await sleep(1000);
            if (!isPaused) {
              continueBtn.click();
              setStep(5, 'completed', `🎉 Proceeding to payment/checkout page!`);
              addLog(`🎉 Step 5: Proceeding to checkout page!`, 'success');
            }
          } else {
            setStep(5, 'completed', `🎯 <strong>${selectedTitles.length} seat(s) selected!</strong> Click <strong>CONTINUE PURCHASE</strong> to complete.`);
            addLog(`🎯 Step 5: Seats locked! Click CONTINUE PURCHASE to complete booking.`, 'success');
          }
        }
      }
    } catch (err) {
      console.error('[BD Railway Booker] Error during seat selection:', err);
      addLog(`❌ Error in seat selection: ${err.message || err}`, 'error');
      setStep(4, 'error', `Error during seat selection: ${err.message || err}`);
      isSelectingSeats = false;
    }
  }

  // Lightweight interval runner (NO MutationObserver to avoid CPU freeze/hang)
  runner = setInterval(() => {
    if (isPaused) return;

    if (!bookNowClicked) {
      processTrainResults();
    } else if (!seatsSelected) {
      processSeatLayout();
    } else {
      // All done, stop loop
      clearInterval(runner);
    }
  }, 500);

})();
