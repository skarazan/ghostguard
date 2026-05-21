// GhostGuard background service worker
// Listens for SPA navigations (pushState) via webNavigation API
// and tells the content script to rescan — more reliable than
// patching history.pushState from the content script side.

const JOB_URL_PATTERNS = [
  /linkedin\.com\/jobs/,
  /indeed\.com/,
  /glassdoor\.com\/Job/
];

function isJobPage(url) {
  return JOB_URL_PATTERNS.some(p => p.test(url));
}

// Fires on every pushState / replaceState navigation (SPA)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return; // main frame only
  if (!isJobPage(details.url)) return;

  chrome.tabs.sendMessage(details.tabId, { type: 'GG_NAV_CHANGED' }).catch(() => {});
});

// Also fire on committed navigations (full page loads via the nav bar)
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  if (!isJobPage(details.url)) return;
  // Full loads reinject the content script automatically — nothing to do
});
