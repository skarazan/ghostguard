window.GhostGuard = window.GhostGuard || {};

GhostGuard.storage = (function () {

  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const MAX_ENTRIES = 5000;
  const STATS_KEY = 'gg_session_stats';
  const SETTINGS_KEY = 'gg_settings';
  const FLAGS_KEY = 'gg_flags';

  const DEFAULT_SETTINGS = {
    showBadges: true,
    showTooltips: true,
    dimGhosts: false
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
    // Evict oldest entries if over cap (best-effort)
    pruneCacheIfNeeded();
  }

  async function pruneCacheIfNeeded() {
    const all = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(all).filter(k => k.startsWith('gg_cache_'));
    if (cacheKeys.length <= MAX_ENTRIES) return;
    // Sort by timestamp, remove oldest
    const sorted = cacheKeys
      .map(k => ({ k, ts: all[k]?.ts || 0 }))
      .sort((a, b) => a.ts - b.ts);
    const toRemove = sorted.slice(0, sorted.length - MAX_ENTRIES).map(e => e.k);
    await chrome.storage.local.remove(toRemove);
  }

  // ── Session stats ──────────────────────────────────────────────────────────

  async function getStats() {
    const data = await chrome.storage.local.get(STATS_KEY);
    return data[STATS_KEY] || { green: 0, yellow: 0, red: 0, total: 0 };
  }

  async function incrementStat(color) {
    const stats = await getStats();
    if (color in stats) stats[color]++;
    stats.total++;
    await chrome.storage.local.set({ [STATS_KEY]: stats });
  }

  async function resetStats() {
    await chrome.storage.local.set({ [STATS_KEY]: { green: 0, yellow: 0, red: 0, total: 0 } });
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async function getSettings() {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_SETTINGS, data[SETTINGS_KEY] || {});
  }

  async function setSetting(key, value) {
    const current = await getSettings();
    current[key] = value;
    await chrome.storage.local.set({ [SETTINGS_KEY]: current });
  }

  // ── Flags ──────────────────────────────────────────────────────────────────

  async function flagInaccurate(result) {
    const data = await chrome.storage.local.get(FLAGS_KEY);
    const flags = data[FLAGS_KEY] || [];
    flags.push({
      ts: Date.now(),
      jobId: result.jobData?.jobId,
      title: result.jobData?.title,
      company: result.jobData?.company,
      score: result.score,
      tier: result.tier?.label,
      reasons: result.reasons
    });
    await chrome.storage.local.set({ [FLAGS_KEY]: flags });
  }

  // ── Clear all ──────────────────────────────────────────────────────────────

  async function clearAll() {
    const all = await chrome.storage.local.get(null);
    const ggKeys = Object.keys(all).filter(k => k.startsWith('gg_'));
    await chrome.storage.local.remove(ggKeys);
  }

  return {
    getCached, setCache,
    getStats, incrementStat, resetStats,
    getSettings, setSetting,
    flagInaccurate, clearAll
  };
}());
