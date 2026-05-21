window.GhostGuard = window.GhostGuard || {};

GhostGuard.storage = (function () {

  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_ENTRIES  = 5000;
  const MAX_FLAGS    = 500;
  const STATS_KEY    = 'gg_session_stats';
  const SETTINGS_KEY = 'gg_settings';
  const FLAGS_KEY    = 'gg_flags';

  const DEFAULT_SETTINGS = {
    showBadges:    true,
    showTooltips:  true,
    dimGhosts:     false,
    tosAccepted:   false   // legal consent gate
  };

  // ── Cache ──────────────────────────────────────────────────────────────────

  async function getCached(jobId) {
    if (!jobId) return null;
    const key = `gg_cache_${jobId}`;
    const data = await chrome.storage.local.get(key);
    const entry = data[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      chrome.storage.local.remove(key);
      return null;
    }
    return entry.result;
  }

  async function setCache(jobId, result) {
    if (!jobId) return;
    const key = `gg_cache_${jobId}`;
    await chrome.storage.local.set({ [key]: { ts: Date.now(), result } });
    pruneCacheIfNeeded();
  }

  // P9: in-progress guard prevents concurrent full-storage scans
  let _pruning = false;
  async function pruneCacheIfNeeded() {
    if (_pruning) return;
    _pruning = true;
    try {
      const all = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(all).filter(k => k.startsWith('gg_cache_'));
      if (cacheKeys.length <= MAX_ENTRIES) return;
      const sorted = cacheKeys
        .map(k => ({ k, ts: all[k]?.ts || 0 }))
        .sort((a, b) => a.ts - b.ts);
      await chrome.storage.local.remove(
        sorted.slice(0, sorted.length - MAX_ENTRIES).map(e => e.k)
      );
    } finally {
      _pruning = false;
    }
  }

  // ── Session stats — P8: batch to avoid read-modify-write race ─────────────

  let _pending = { green: 0, yellow: 0, red: 0, total: 0 };
  let _flushTimer = null;

  function incrementStat(color) {
    if (color in _pending) _pending[color]++;
    _pending.total++;
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(_flushStats, 500);
  }

  async function _flushStats() {
    const snap = { ..._pending };
    _pending = { green: 0, yellow: 0, red: 0, total: 0 };
    const data = await chrome.storage.local.get(STATS_KEY);
    const stats = data[STATS_KEY] || { green: 0, yellow: 0, red: 0, total: 0 };
    for (const k of Object.keys(snap)) {
      if (k in stats) stats[k] += snap[k];
    }
    await chrome.storage.local.set({ [STATS_KEY]: stats });
  }

  async function getStats() {
    const data = await chrome.storage.local.get(STATS_KEY);
    return data[STATS_KEY] || { green: 0, yellow: 0, red: 0, total: 0 };
  }

  async function resetStats() {
    _pending = { green: 0, yellow: 0, red: 0, total: 0 };
    clearTimeout(_flushTimer);
    await chrome.storage.local.set({ [STATS_KEY]: { green: 0, yellow: 0, red: 0, total: 0 } });
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async function getSettings() {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = data[SETTINGS_KEY] || {};
    // P: only merge known keys — prevents prototype pollution
    return {
      showBadges:   stored.showBadges   ?? DEFAULT_SETTINGS.showBadges,
      showTooltips: stored.showTooltips ?? DEFAULT_SETTINGS.showTooltips,
      dimGhosts:    stored.dimGhosts    ?? DEFAULT_SETTINGS.dimGhosts,
      tosAccepted:  stored.tosAccepted  ?? DEFAULT_SETTINGS.tosAccepted,
    };
  }

  async function setSetting(key, value) {
    const current = await getSettings();
    if (key in DEFAULT_SETTINGS) current[key] = value;
    await chrome.storage.local.set({ [SETTINGS_KEY]: current });
  }

  // ── Flags — P21: capped at MAX_FLAGS ──────────────────────────────────────

  async function flagInaccurate(result) {
    const data = await chrome.storage.local.get(FLAGS_KEY);
    const flags = data[FLAGS_KEY] || [];
    flags.push({
      ts:      Date.now(),
      jobId:   result.jobData?.jobId,
      title:   result.jobData?.title,
      company: result.jobData?.company,
      score:   result.score,
      tier:    result.tier?.label,
      reasons: result.reasons
      // descriptionText intentionally excluded
    });
    // Evict oldest if over cap
    if (flags.length > MAX_FLAGS) flags.splice(0, flags.length - MAX_FLAGS);
    await chrome.storage.local.set({ [FLAGS_KEY]: flags });
  }

  // ── Clear all ──────────────────────────────────────────────────────────────

  async function clearAll() {
    _pending = { green: 0, yellow: 0, red: 0, total: 0 };
    clearTimeout(_flushTimer);
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter(k => k.startsWith('gg_')));
  }

  return {
    getCached, setCache,
    getStats, incrementStat, resetStats,
    getSettings, setSetting,
    flagInaccurate, clearAll
  };
}());
