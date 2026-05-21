window.GhostGuard = window.GhostGuard || {};

GhostGuard.badge = (function () {

  const COLORS = {
    green:  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    yellow: { bg: '#fef3c7', text: '#a16207', border: '#fcd34d' },
    red:    { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' }
  };

  const DARK_COLORS = {
    green:  { bg: '#14532d', text: '#86efac', border: '#15803d' },
    yellow: { bg: '#451a03', text: '#fcd34d', border: '#a16207' },
    red:    { bg: '#450a0a', text: '#fca5a5', border: '#b91c1c' }
  };

  const darkMode = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

  function getColors(tier) {
    const scheme = darkMode() ? DARK_COLORS : COLORS;
    return scheme[tier.color] || scheme.yellow;
  }

  // P4: sanitize any string going into innerHTML
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Shadow DOM badge ──────────────────────────────────────────────────────

  let tooltipsEnabled = true;

  function buildBadgeHTML(result) {
    const c = getColors(result.tier);
    const top3 = result.reasons.slice(0, 3);
    const darkBg   = darkMode() ? '#1e1b4b' : '#fff';
    const darkText = darkMode() ? '#e2e8f0' : '#1e293b';

    // Labels come from scorer constants + integers — safe, but esc() anyway for future-proofing
    const tooltipRows = top3.map(r => `
      <div class="gg-tip-row">
        <span class="gg-tip-points" style="color:${r.points > 0 ? '#b91c1c' : '#15803d'}">${r.points > 0 ? '+' : ''}${r.points}</span>
        <span class="gg-tip-label">${esc(r.label)}</span>
      </div>`).join('');

    return `
      <style>
        :host { display: inline-block; vertical-align: middle; margin-left: 6px; position: relative; }
        .gg-pill {
          display: inline-flex; align-items: center; gap: 3px;
          height: 18px; padding: 0 7px;
          border-radius: 4px; border: 1px solid ${c.border};
          background: ${c.bg}; color: ${c.text};
          font-size: 11px; font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          cursor: pointer; white-space: nowrap; user-select: none;
          transition: opacity 0.15s;
        }
        .gg-pill:hover { opacity: 0.85; }
        .gg-dot { width: 7px; height: 7px; border-radius: 50%; background: ${c.text}; flex-shrink: 0; }
        .gg-tooltip {
          display: none; position: absolute; left: 0; top: calc(100% + 5px);
          min-width: 240px; max-width: 280px; z-index: 99999;
          background: ${darkBg}; color: ${darkText};
          border: 1px solid #e2e8f0; border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
        .gg-tip-header {
          padding: 8px 12px; font-size: 12px; font-weight: 700;
          background: ${c.bg}; color: ${c.text}; border-bottom: 1px solid ${c.border};
        }
        .gg-tip-body { padding: 8px 12px; }
        .gg-tip-row { display: flex; gap: 8px; font-size: 11px; padding: 2px 0; }
        .gg-tip-points { font-weight: 700; min-width: 28px; text-align: right; flex-shrink: 0; }
        .gg-tip-label { color: ${darkText}; opacity: 0.85; }
        .gg-tip-footer { padding: 5px 12px 8px; font-size: 10px; opacity: 0.55; border-top: 1px solid #e2e8f0; margin-top: 4px; }
        :host(.gg-hidden) { display: none !important; }
        :host(.gg-no-tooltip) .gg-tooltip { display: none !important; }
      </style>
      <div class="gg-pill" tabindex="0" role="button" aria-label="${esc(result.tier.label)} — Score ${result.score}. Click for details.">
        <span class="gg-dot"></span>${result.score} ${esc(result.tier.label)}
      </div>
      <div class="gg-tooltip" role="tooltip">
        <div class="gg-tip-header">${esc(result.tier.emoji)} ${esc(result.tier.label)} — Score ${result.score}</div>
        <div class="gg-tip-body">${tooltipRows || '<div style="font-size:11px;opacity:0.6">No strong signals detected</div>'}</div>
        <div class="gg-tip-footer">Click for full breakdown</div>
      </div>
    `;
  }

  function createBadgeElement(result) {
    const host = document.createElement('span');
    host.className = 'gg-badge-host';
    host.dataset.ggJobId = result.jobData.jobId || '';
    host.dataset.ggScore = result.score;
    if (!tooltipsEnabled) host.classList.add('gg-no-tooltip');

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = buildBadgeHTML(result);

    const pill    = shadow.querySelector('.gg-pill');
    const tooltip = shadow.querySelector('.gg-tooltip');

    let hoverTimer = null;

    pill.addEventListener('mouseenter', () => {
      if (!tooltipsEnabled) return;
      hoverTimer = setTimeout(() => { tooltip.style.display = 'block'; }, 300);
    });
    pill.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      tooltip.style.display = 'none';
    });

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltip.style.display = 'none';
      GhostGuard.badge.openDetailPanel(result);
    });

    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        GhostGuard.badge.openDetailPanel(result);
      }
    });

    return host;
  }

  // ── Inject badge into a card ──────────────────────────────────────────────

  function injectBadge(cardEl, result) {
    if (!result) return;
    // dataset.ggScored is managed by content.js; badge.js just injects
    const titleEl = cardEl.querySelector(
      '.job-card-list__title, .artdeco-entity-lockup__title, h3, h2, [data-test="job-link"]'
    );

    const badgeEl = createBadgeElement(result);

    if (titleEl) {
      titleEl.style.display = 'inline';
      titleEl.after(badgeEl);
    } else {
      cardEl.style.position = 'relative';
      badgeEl.style.position = 'absolute';
      badgeEl.style.top = '8px';
      badgeEl.style.right = '8px';
      cardEl.appendChild(badgeEl);
    }

    if (typeof GhostGuard.storage !== 'undefined') {
      GhostGuard.storage.incrementStat(result.tier.color);
    }
  }

  // ── Detail panel — P4: all job data escaped ───────────────────────────────

  function openDetailPanel(result) {
    closeDetailPanel();

    const darkBg   = darkMode() ? '#1e1b4b' : '#fff';
    const darkText = darkMode() ? '#e2e8f0' : '#1e293b';
    const c = getColors(result.tier);

    const backdrop = document.createElement('div');
    backdrop.className = 'gg-panel-backdrop';
    backdrop.addEventListener('click', closeDetailPanel);

    const panel = document.createElement('div');
    panel.className = 'gg-detail-panel';

    const positiveReasons = result.reasons.filter(r => r.points < 0);
    const negativeReasons = result.reasons.filter(r => r.points > 0);

    function reasonsHTML(list) {
      if (!list.length) return '<div class="gg-panel-none">None detected.</div>';
      return list.map(r => `
        <div class="gg-panel-reason">
          <span class="gg-panel-pts" style="color:${r.points > 0 ? '#b91c1c' : '#15803d'}">${r.points > 0 ? '+' : ''}${r.points}</span>
          <span>${esc(r.label)}</span>
        </div>`).join('');
    }

    // Build job info line safely using DOM, not innerHTML
    const jobInfoParts = [];
    if (result.jobData.title) {
      jobInfoParts.push(`<strong>${esc(result.jobData.title)}</strong> at <strong>${esc(result.jobData.company || '—')}</strong>`);
    }
    if (result.jobData.daysPosted != null) {
      jobInfoParts.push(`Posted ${result.jobData.daysPosted} days ago`);
    }
    const jobInfoHTML = jobInfoParts.join('<br>');

    panel.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .gg-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
          background: ${darkBg};
        }
        .gg-panel-title { font-size: 14px; font-weight: 700; color: ${darkText}; }
        .gg-panel-close {
          background: none; border: none; cursor: pointer; font-size: 18px; color: ${darkText};
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          border-radius: 4px; opacity: 0.6;
        }
        .gg-panel-close:hover { opacity: 1; background: #f1f5f9; }
        .gg-panel-hero {
          padding: 20px; text-align: center; background: ${c.bg}; border-bottom: 1px solid ${c.border};
        }
        .gg-panel-hero-label { font-size: 18px; font-weight: 800; color: ${c.text}; margin-bottom: 4px; }
        .gg-panel-hero-score { font-size: 36px; font-weight: 900; color: ${c.text}; }
        .gg-panel-hero-sub { font-size: 12px; color: ${c.text}; opacity: 0.7; margin-top: 4px; }
        .gg-panel-body { padding: 20px; background: ${darkBg}; }
        .gg-panel-section-title {
          font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
          color: ${darkText}; opacity: 0.5; margin-bottom: 10px; margin-top: 20px;
        }
        .gg-panel-section-title:first-child { margin-top: 0; }
        .gg-panel-reason {
          display: flex; gap: 10px; align-items: flex-start; font-size: 13px;
          color: ${darkText}; padding: 5px 0; border-bottom: 1px solid #f1f5f9;
        }
        .gg-panel-pts { font-weight: 700; min-width: 32px; flex-shrink: 0; }
        .gg-panel-none { font-size: 13px; color: ${darkText}; opacity: 0.45; font-style: italic; }
        .gg-panel-job-info { font-size: 12px; color: ${darkText}; opacity: 0.5; margin-top: 16px; line-height: 1.6; }
        .gg-panel-footer { padding: 16px 20px; border-top: 1px solid #e2e8f0; background: ${darkBg}; }
        .gg-panel-flag {
          width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;
          background: none; cursor: pointer; font-size: 12px; color: ${darkText}; opacity: 0.6;
        }
        .gg-panel-flag:hover { opacity: 1; background: #f8fafc; }
      </style>
      <div class="gg-panel-header">
        <span class="gg-panel-title">GhostGuard Analysis</span>
        <button class="gg-panel-close" id="gg-close-btn" aria-label="Close">×</button>
      </div>
      <div class="gg-panel-hero">
        <div class="gg-panel-hero-label">${esc(result.tier.emoji)} ${esc(result.tier.label)}</div>
        <div class="gg-panel-hero-score">${result.score}</div>
        <div class="gg-panel-hero-sub">out of 100</div>
      </div>
      <div class="gg-panel-body">
        <div class="gg-panel-section-title">Warning signals</div>
        ${reasonsHTML(negativeReasons.length ? negativeReasons : [])}
        <div class="gg-panel-section-title">Positive signals</div>
        ${reasonsHTML(positiveReasons)}
        <div class="gg-panel-job-info">${jobInfoHTML}</div>
      </div>
      <div class="gg-panel-footer">
        <button class="gg-panel-flag" id="gg-flag-btn">Flag this score as inaccurate</button>
      </div>
    `;

    panel.querySelector('#gg-close-btn').addEventListener('click', closeDetailPanel);
    panel.querySelector('#gg-flag-btn').addEventListener('click', () => {
      if (typeof GhostGuard.storage !== 'undefined') {
        GhostGuard.storage.flagInaccurate(result);
      }
      const btn = panel.querySelector('#gg-flag-btn');
      btn.textContent = 'Flagged — thank you';
      btn.disabled = true;
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('gg-open'));

    // P11: persistent listener (not { once: true }) — removed in closeDetailPanel
    document.addEventListener('keydown', handlePanelEsc);
  }

  function handlePanelEsc(e) {
    if (e.key === 'Escape') closeDetailPanel();
  }

  function closeDetailPanel() {
    document.querySelectorAll('.gg-panel-backdrop, .gg-detail-panel').forEach(el => el.remove());
    document.removeEventListener('keydown', handlePanelEsc);
  }

  // ── Visibility toggles ────────────────────────────────────────────────────

  function setVisible(visible) {
    document.querySelectorAll('.gg-badge-host').forEach(host => {
      host.classList.toggle('gg-hidden', !visible);
    });
  }

  // P10: tooltip toggle
  function setTooltipsEnabled(enabled) {
    tooltipsEnabled = enabled;
    document.querySelectorAll('.gg-badge-host').forEach(host => {
      host.classList.toggle('gg-no-tooltip', !enabled);
    });
  }

  return { injectBadge, openDetailPanel, closeDetailPanel, setVisible, setTooltipsEnabled };
}());
