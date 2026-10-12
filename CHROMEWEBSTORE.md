# Chrome Web Store Listing — BD Railway Ticket Quick Booker

> Last Updated: 2026-10-12

## Store Listing

**Extension Name** [REQUIRED]
BD Railway Ticket Quick Booker

**Short Description** [REQUIRED]
Pre-configure route, journey date, and class to instantly search and book tickets on Bangladesh Railway e-ticket portal.

**Detailed Description** [REQUIRED]
BD Railway Ticket Quick Booker helps you save time and secure train tickets on the Bangladesh Railway e-ticket portal without repeatedly typing your route and date.

Key Features:
- Pre-set your From and To stations with instant autocomplete
- Select Journey Date easily with quick shortcuts (Today, +1, +2, +3, +7, and +10 days advance)
- Pre-select preferred seat class (Shovon Chair, Snigdha, AC Berth, AC Seat, First Class)
- One-click swap between departure and arrival stations
- Generates the exact direct search link for Bangladesh Railway e-ticket portal
- Optional 8:00 AM auto-open timer for morning ticket rush
- Auto-saves your preferred settings locally so they are ready every time

How to Use:
1. Click the extension icon in your browser toolbar.
2. Select or type your departure station (From) and destination (To).
3. Choose your date of journey and preferred seat class.
4. Click "Search & Open Page" to jump straight to the search results.

Privacy & Permissions:
Your travel preferences and station selections are stored solely on your local device. No personal data or browsing history is tracked, collected, or transmitted to any external server.

Support & Feedback:
Created to assist railway commuters in Bangladesh.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Pre-sets journey criteria and opens direct search results on Bangladesh Railway e-ticket portal.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Stores the user's preferred departure station, arrival station, class, and journey date on their device. |
| tabs | permissions | Opens the Bangladesh Railway e-ticket search page with pre-filled parameters in a new browser tab. |
| alarms | permissions | Powers the optional 8:00 AM timer to trigger opening the ticket search page at ticket release time. |
| https://eticket.railway.gov.bd/* | host_permissions | Opens and navigates directly to the Bangladesh Railway e-ticketing search and booking URLs. |

## Privacy & Data Use

### Data Collection
This extension collects **no personal data**. All station preferences and dates are saved strictly inside the browser's local storage (`chrome.storage.local`).

## Version History

- **v1.0.0** (2026-10-12): Initial release with station presets, quick date selection, class picker, and direct URL generation.

