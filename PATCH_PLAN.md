# GhostGuard — Patch Plan v1.1

Generated from multi-agent audit: functional testing, code review, security analysis, DOM selector reliability, and competitive analysis.

All issues are ordered by severity. Each patch includes the file, line(s), root cause, and exact fix.

---

## CRITICAL (fix before any public release)

---

### P1 — Async race condition: duplicate badge injection
**File:** `src/content.js:38` + `src/badge.js:125`  
**Root cause:** `processCard()` is `async`. The dedup guard `if (cardEl.dataset.ggScored) return` runs before `await getCached()`. The MutationObserver fires again during that await gap, a second invocation passes the guard, and both inject a badge + double-count the stat.

**Fix:**
```js
async function processCard(cardEl) {
  if (cardEl.dataset.ggScored) return;
  cardEl.dataset.ggScored = 'pending';   // ← claim BEFORE first await
  if (!settings.showBadges) {
    delete cardEl.dataset.ggScored;
    return;
  }
  // ... rest unchanged; injectBadge sets it to '1'
}
```

---

### P2 — Missing `tabs` / `activeTab` permission breaks popup messaging
**File:** `manifest.json:6`  
**Root cause:** `popup.js` calls `chrome.tabs.query` + `chrome.tabs.sendMessage`. Neither `"tabs"` nor `"activeTab"` is declared. Every toggle in the popup silently fails to reach the content script.

**Fix — add `"activeTab"` to manifest.json:**
```json
"permissions": ["storage", "activeTab"]
```

---

### P3 — `C++` (and similar) crashes `specificTechStack` signal silently
**File:** `src/scorer.js:138`  
**Root cause:** `kw.replace('.', '\\.')` only escapes dots, not `+`, `#`, `*`, `(`, `)`. `new RegExp('\bC++\b')` throws `SyntaxError`. Caught by the outer try/catch → signal always returns null → **the entire specificTechStack signal is permanently disabled** for any user whose keywords list contains `C++`.

**Status: ALREADY FIXED** — regex now uses full special-char escaping:
```js
const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`, 'i').test(text)) hits++;
```

---

## HIGH (fix before Chrome Web Store submission)

---

### P4 — XSS: job title + company injected raw into detail panel innerHTML
**File:** `src/badge.js:241` and `src/badge.js:174`  
**Root cause:** `panel.innerHTML` uses template literals that embed `result.jobData.title`, `result.jobData.company`, and `r.label` without sanitization. While `.textContent` on the scraper side strips HTML tags, a future scraper change or platform quirk that uses `innerHTML`/`innerText` could expose raw HTML. The panel writes directly to `document.body`, not a Shadow DOM.

**Fix — add an escape helper and use it everywhere:**
```js
function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// In openDetailPanel, replace:
${result.jobData.title ? `<strong>${result.jobData.title}</strong>...` : ''}
// With:
${result.jobData.title ? `<strong>${escapeHTML(result.jobData.title)}</strong> at <strong>${escapeHTML(result.jobData.company || '—')}</strong><br>` : ''}

// In reasonsHTML(), replace:
<span>${r.label}</span>
// With:
<span>${escapeHTML(r.label)}</span>
```

---

### P5 — SPA navigation: MutationObserver never resets on URL change
**File:** `src/observer.js`  
**Root cause:** LinkedIn is a React SPA. When a user navigates between search pages or clicks a different job, `history.pushState` fires but the observer is never notified. `lastDetailId` in `content.js` is stale from the previous "page." The first job on the new page may be silently skipped.

**Fix — intercept pushState and popstate in `observer.js`:**
```js
function start(processCardsFn) {
  if (mo) return;
  // existing MutationObserver setup...

  // SPA navigation detection
  const _push = history.pushState.bind(history);
  history.pushState = function (...args) {
    _push(...args);
    debounce(processCardsFn, 300);
  };
  window.addEventListener('popstate', () => debounce(processCardsFn, 300));
}
```
Also expose a `resetNavState()` callback from `content.js` so `lastDetailId` can be cleared on navigation.

---

### P6 — `noSalaryRange` false-negative: "competitive salary" text suppresses +15 penalty
**File:** `src/scorer.js:54`  
**Root cause:** The regex `/\$\d+|\bsalary\b|\bcompensation\b|.../` treats the mere _word_ "salary" as proof that a salary exists. A job listing saying "competitive salary" (no number) gets `hasSalary = true`, blocking the +15 penalty it deserves.

**Fix — remove bare word matches from the hasSalary check:**
```js
// Before:
const hasSalary = /\$\d+|\bsalary\b|\bcompensation\b|\bpay range\b|\bper (hour|hr|year|yr|annum)\b/i.test(d.salaryText || '');

// After:
const hasSalary = /\$\d+|\bpay range\b|\bper (hour|hr|year|yr|annum)\b|\d+k?\s*(per|\/)\s*(hour|hr|year|yr)/i.test(d.salaryText || '');
```

---

### P7 — `competitiveSalaryPhrase` fires even when salary is present
**File:** `src/scorer.js:82`  
**Root cause:** If `salaryText = "$85k — competitive package"`, `salaryPresent` fires (-20) AND `competitiveSalaryPhrase` also fires (+10). The label says "no number given" but there clearly is a number. Net: a transparent salary gets penalized +10 for buzzword.

**Fix — gate the signal on salary absence:**
```js
function competitiveSalaryPhrase(d) {
  const hasRealSalary = /\$\d+/.test(d.salaryText || '');
  if (hasRealSalary) return { triggered: false, points: 0, label: '' };
  const triggered = /competitive\s+(salary|comp|compensation|package|pay)/i.test(
    (d.descriptionText || '') + ' ' + (d.salaryText || '')
  );
  return { triggered, points: triggered ? 10 : 0, label: '"Competitive salary" phrase (no number given)' };
}
```

---

### P8 — `incrementStat` read-modify-write race: stat counts silently lost
**File:** `src/storage.js:59`  
**Root cause:** All parallel `processCard` calls invoke `incrementStat` concurrently. Each reads the same snapshot, increments one counter, writes back — all but one increment is lost. 25 cards scanned → popup shows "1 scanned."

**Fix — batch increments with a short flush window:**
```js
let _pendingStats = { green: 0, yellow: 0, red: 0, total: 0 };
let _flushTimer = null;

function incrementStat(color) {
  if (color in _pendingStats) _pendingStats[color]++;
  _pendingStats.total++;
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(_flushStats, 500);
}

async function _flushStats() {
  const snap = { ..._pendingStats };
  _pendingStats = { green: 0, yellow: 0, red: 0, total: 0 };
  const data = await chrome.storage.local.get(STATS_KEY);
  const stats = data[STATS_KEY] || { green: 0, yellow: 0, red: 0, total: 0 };
  for (const k of Object.keys(snap)) stats[k] += snap[k];
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}
```

---

### P9 — `pruneCacheIfNeeded` unawaited: 25 concurrent full-storage reads on page load
**File:** `src/storage.js:37`  
**Root cause:** `setCache` calls `pruneCacheIfNeeded()` without `await` and with no in-progress guard. 25 badge injections fire 25 concurrent full `chrome.storage.local.get(null)` reads.

**Fix — in-progress flag:**
```js
let _pruning = false;
async function pruneCacheIfNeeded() {
  if (_pruning) return;
  _pruning = true;
  try {
    const all = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(all).filter(k => k.startsWith('gg_cache_'));
    if (cacheKeys.length > MAX_ENTRIES) {
      const sorted = cacheKeys.map(k => ({ k, ts: all[k]?.ts || 0 })).sort((a, b) => a.ts - b.ts);
      await chrome.storage.local.remove(sorted.slice(0, sorted.length - MAX_ENTRIES).map(e => e.k));
    }
  } finally {
    _pruning = false;
  }
}
```

---

## MEDIUM (fix in v1.1 patch release)

---

### P10 — `GG_SET_TOOLTIPS` message has no handler: tooltip toggle does nothing
**File:** `src/content.js:125`  
Add `case 'GG_SET_TOOLTIPS'` to the message listener and implement `GhostGuard.badge.setTooltipsEnabled(bool)` in `badge.js` that toggles a class on all badge shadow roots.

---

### P11 — Escape key listener removed on first non-Escape keypress
**File:** `src/badge.js:266`  
Remove `{ once: true }` from the `keydown` listener registration. The `closeDetailPanel` already calls `removeEventListener` explicitly.

```js
// Before:
document.addEventListener('keydown', handlePanelEsc, { once: true });
// After:
document.addEventListener('keydown', handlePanelEsc);
```

---

### P12 — Indeed: `hasExternalLink = !easyApply` is inverted logic
**File:** `src/scrapers/indeed.js:112`  
Expired jobs with no apply button get `easyApply=false`, `hasExternalLink=true` → incorrectly credited with -10 "external apply" discount.

```js
// Before:
const hasExternalLink = !easyApply && !!cardEl.querySelector('a[href*="apply"]...');
// After (in extractFromDetail):
const hasExternalLink = !!panelEl.querySelector('a[href*="apply"]:not([data-indeed-apply])');
const easyApply = !!panelEl.querySelector('.indeedApplyButton, [data-indeed-apply]');
```

---

### P13 — Glassdoor: `easyApply = !hasExternalLink` same inverted logic
**File:** `src/scrapers/glassdoor.js:122`  
```js
// After:
const easyApply = !!panelEl.querySelector('[data-test="easyApply"], button[aria-label*="Easy Apply"]');
```

---

### P14 — `btoa(anchor.href)` throws on non-ASCII Glassdoor URLs
**File:** `src/scrapers/glassdoor.js:31`  
```js
// Before:
return `gd_${btoa(anchor.href).slice(0, 16)}`;
// After:
return `gd_${btoa(encodeURIComponent(anchor.href)).slice(0, 16)}`;
```

---

### P15 — Settings load async but first scan runs synchronously
**File:** `src/content.js:33`  
User's `showBadges: false` preference is ignored on the very first scan.

```js
// Before:
GhostGuard.storage.getSettings().then(s => { settings = s; });
GhostGuard.observer.start(scanCards);

// After:
GhostGuard.storage.getSettings().then(s => {
  settings = s;
  GhostGuard.observer.start(scanCards);
});
```

---

### P16 — `knownGhosters` substring matching: "meta" hits "Metamorphic Inc"
**File:** `src/scorer.js:163`  
```js
// Before:
const triggered = list.some(g => company.includes(g));

// After:
const triggered = list.some(g => {
  const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$|,)`, 'i').test(company);
});
```
Also remove `'amazon'`, `'meta'`, `'oracle'` from `known-ghosters.js` — too generic. Keep only staffing firms with clear evidence.

---

### P17 — Indeed detail view: `jobId` always null
**File:** `src/scrapers/indeed.js` in `extractFromDetail`  
```js
// Add at top of extractFromDetail:
const urlMatch = window.location.href.match(/jk=([a-f0-9]+)/i);
const jobId = urlMatch ? `indeed_${urlMatch[1]}` : null;
```

---

### P18 — `detail+company` dedup key collides for identical roles
**File:** `src/content.js:85`  
```js
// Before:
const id = jobData.jobId || jobData.title + jobData.company;
// After:
const id = jobData.jobId || (jobData.title + '|' + jobData.company + '|' + (jobData.location || ''));
```

---

### P19 — Strip `descriptionText` before caching (copyright + storage bloat)
**File:** `src/content.js` (before `setCache` call)  
```js
// Before storing:
if (jobData.jobId) {
  GhostGuard.storage.setCache(jobData.jobId, result);
}

// After:
if (jobData.jobId) {
  const cacheResult = { ...result, jobData: { ...result.jobData, descriptionText: '' } };
  GhostGuard.storage.setCache(jobData.jobId, cacheResult);
}
```
Reduces per-entry storage from ~5KB to ~300 bytes and eliminates copyright exposure from retaining full job descriptions.

---

## LOW (clean-up / polish)

---

### P20 — Add explicit CSP to manifest.json
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none';"
}
```

---

### P21 — Cap flags array to 500 entries
**File:** `src/storage.js:88`  
```js
if (flags.length > 500) flags.splice(0, flags.length - 500);
```

---

### P22 — Add `rel="noopener noreferrer"` to popup feedback link
**File:** `src/popup/popup.html:61`  
```html
<a class="gg-link" href="..." target="_blank" rel="noopener noreferrer">Help / Feedback</a>
```

---

### P23 — Add JSON-LD extraction for LinkedIn + Indeed detail pages
LinkedIn and Indeed embed `<script type="application/ld+json">` with `@type: "JobPosting"` on detail pages. This provides `datePosted`, `baseSalary`, `jobLocation`, `title`, `hiringOrganization` — all without any CSS class dependency. Add a `extractFromJsonLd()` function in each scraper as a primary data source before DOM fallbacks.

---

### P24 — Glassdoor: add `[data-test="jobListing"]` as primary card selector
**File:** `src/content.js:CARD_SELECTORS.glassdoor`  
The CSS-Module-hash-based `[class*="JobsList_jobListItem"]` breaks on every Glassdoor build deploy. Prepend `[data-test="jobListing"]` as the primary selector — it's stable across builds.

---

### P25 — Add ToS risk disclaimer in popup and README
Before Chrome Web Store submission, surface a one-time warning: "GhostGuard reads job listing pages. Use on LinkedIn, Indeed, and Glassdoor may be subject to those platforms' Terms of Service." Log in `chrome.storage.local` that the user has seen it.

---

## Summary

| Priority | Count | Blocking |
|---|---|---|
| CRITICAL | 3 (P1–P3) | Release |
| HIGH | 6 (P4–P9) | CWS submission |
| MEDIUM | 10 (P10–P19) | v1.1 patch |
| LOW | 6 (P20–P25) | v1.2 polish |

**Estimated effort:** 2–3 days to close all CRITICAL + HIGH items.

---

*Audit date: 2026-05-20. Re-audit recommended after any LinkedIn/Indeed/Glassdoor DOM update.*
