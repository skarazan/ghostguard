(async function () {

  // ── Load stats ─────────────────────────────────────────────────────────────
  const data = await chrome.storage.local.get('gg_session_stats');
  const stats = data.gg_session_stats || { green: 0, yellow: 0, red: 0, total: 0 };

  function pct(n, total) {
    if (!total) return '';
    return `(${Math.round((n / total) * 100)}%)`;
  }

  document.getElementById('stat-green').textContent  = stats.green;
  document.getElementById('stat-yellow').textContent = stats.yellow;
  document.getElementById('stat-red').textContent    = stats.red;
  document.getElementById('stat-total').textContent  = stats.total;
  document.getElementById('pct-green').textContent   = pct(stats.green, stats.total);
  document.getElementById('pct-yellow').textContent  = pct(stats.yellow, stats.total);
  document.getElementById('pct-red').textContent     = pct(stats.red, stats.total);

  // ── Load settings ──────────────────────────────────────────────────────────
  const settingsData = await chrome.storage.local.get('gg_settings');
  const settings = Object.assign(
    { showBadges: true, showTooltips: true, dimGhosts: false },
    settingsData.gg_settings || {}
  );

  const toggleBadges   = document.getElementById('toggle-badges');
  const toggleTooltips = document.getElementById('toggle-tooltips');
  const toggleDim      = document.getElementById('toggle-dim');

  toggleBadges.checked   = settings.showBadges;
  toggleTooltips.checked = settings.showTooltips;
  toggleDim.checked      = settings.dimGhosts;

  async function saveSetting(key, value) {
    const d = await chrome.storage.local.get('gg_settings');
    const s = Object.assign({ showBadges: true, showTooltips: true, dimGhosts: false }, d.gg_settings || {});
    s[key] = value;
    await chrome.storage.local.set({ gg_settings: s });
  }

  async function sendToActiveTab(msg) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }

  toggleBadges.addEventListener('change', async () => {
    await saveSetting('showBadges', toggleBadges.checked);
    sendToActiveTab({ type: 'GG_SET_BADGES', value: toggleBadges.checked });
  });

  toggleTooltips.addEventListener('change', async () => {
    await saveSetting('showTooltips', toggleTooltips.checked);
    sendToActiveTab({ type: 'GG_SET_TOOLTIPS', value: toggleTooltips.checked });
  });

  toggleDim.addEventListener('change', async () => {
    await saveSetting('dimGhosts', toggleDim.checked);
    sendToActiveTab({ type: 'GG_SET_DIM', value: toggleDim.checked });
  });

  // ── Reset stats ────────────────────────────────────────────────────────────
  document.getElementById('btn-reset').addEventListener('click', async () => {
    await chrome.storage.local.set({ gg_session_stats: { green: 0, yellow: 0, red: 0, total: 0 } });
    ['stat-green','stat-yellow','stat-red','stat-total'].forEach(id => {
      document.getElementById(id).textContent = '0';
    });
    ['pct-green','pct-yellow','pct-red'].forEach(id => {
      document.getElementById(id).textContent = '';
    });
    sendToActiveTab({ type: 'GG_RESET_STATS' });
  });

}());
