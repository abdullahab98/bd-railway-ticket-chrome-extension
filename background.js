// BD Railway Ticket Quick Booker - Background Service Worker

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      scheduleEnabled: false,
      botRunTriggered: false
    });
    console.log('BD Railway Ticket Booker installed successfully.');
  }
});

// Alarm Listener for Scheduled Ticket Openings
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'open_railway_ticket_alarm') {
    try {
      const data = await chrome.storage.local.get(['targetUrl']);
      
      let url = data.targetUrl;
      if (!url) {
        url = 'https://eticket.railway.gov.bd/booking/train/search?fromcity=Dhaka&tocity=Joypurhat&class=S_CHAIR';
      }

      // Arm one-time automation trigger for the scheduled search session
      await chrome.storage.local.set({
        botRunTriggered: true,
        botTriggerTimestamp: Date.now(),
        scheduleEnabled: false
      });

      // Open search page in active new tab
      await chrome.tabs.create({ url, active: true });

      console.log('Scheduled search tab opened and bot armed once:', url);
    } catch (err) {
      console.error('Error opening scheduled search tab:', err);
    }
  }
});

