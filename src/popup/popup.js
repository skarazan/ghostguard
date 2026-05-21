(async function () {

  // ── ToS consent gate ───────────────────────────────────────────────────────
  const settingsData = await chrome.storage.local.get('gg_settings');
  const settings = Object.assign(
    { showBadges: true, showTooltips: true, dimGhosts: false, tosAccepted: false },
    settingsData.gg_settings || {}
  );

  const tosScreen  = document.getElementById('tos-screen');
  const mainScreen = document.getElementById('main-screen');

  if (!settings.tosAccepted) {
    tosScreen.style.display = 'block';
    document.getElementById('btn-accept').addEventListener('click', async () => {
      await saveSetting('tosAccepted', true);
      tosScreen.style.display = 'none';
      mainScreen.style.display = 'block';
      initMain();
    });
    return; // don't load main UI until accepted
  }

  mainScreen.style.display = 'block';
  initMain();

  // ── Main UI ────────────────────────────────────────────────────────────────

  async function initMain() {
    // Stats
    const statsData = await chrome.storage.local.get('gg_session_stats');
    const stats = statsData.gg_session_stats || { green: 0, yellow: 0, red: 0, total: 0 };

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

    // Reload fresh settings after possible accept
    const fresh = await chrome.storage.local.get('gg_settings');
    const s = Object.assign(
      { showBadges: true, showTooltips: true, dimGhosts: false, tosAccepted: true },
      fresh.gg_settings || {}
    );

    const toggleBadges   = document.getElementById('toggle-badges');
    const toggleTooltips = document.getElementById('toggle-tooltips');
    const toggleDim      = document.getElementById('toggle-dim');

    toggleBadges.checked   = s.showBadges;
    toggleTooltips.checked = s.showTooltips;
    toggleDim.checked      = s.dimGhosts;

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
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function saveSetting(key, value) {
    const d = await chrome.storage.local.get('gg_settings');
    const stored = d.gg_settings || {};
    stored[key] = value;
    await chrome.storage.local.set({ gg_settings: stored });
  }

  async function sendToActiveTab(msg) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    } catch (_) {}
  }

}());
