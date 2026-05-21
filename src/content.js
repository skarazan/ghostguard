// GhostGuard — main content script entry point

(function () {

  function hasRuntimeAccess() {
    try {
      return !!chrome?.runtime?.id;
    } catch (_) {
      return false;
    }
  }

  const host = window.location.hostname;
  const isLinkedIn  = host.includes('linkedin.com');
  const isIndeed    = host.includes('indeed.com');
  const isGlassdoor = host.includes('glassdoor.com');

  if (!isLinkedIn && !isIndeed && !isGlassdoor) return;
  if (!hasRuntimeAccess()) return;

  const CARD_SELECTORS = {
    // Single selector per platform — multiple selectors match nested elements and produce duplicate badges
    linkedin:  '[data-occludable-job-id]',
    indeed:    '.job_seen_beacon',
    glassdoor: '[data-test="jobListing"]'
  };

  const DETAIL_SELECTORS = {
    linkedin:  '.jobs-details, .jobs-unified-top-card, .job-view-layout',
    indeed:    '#jobsearch-ViewjobPaneWrapper, .jobsearch-RightPane, [data-testid="jobDetailPage"], .jobsearch-ViewJobLayout',
    glassdoor: '[class*="JobDetails_jobDetailContainer"], [class*="jobDetails"]'
  };

  const platform = isLinkedIn ? 'linkedin' : isIndeed ? 'indeed' : 'glassdoor';
  const scraper   = GhostGuard.scrapers[platform];

  let settings = { showBadges: true, showTooltips: true, dimGhosts: false };

  // ── P15: await settings before starting observer ──────────────────────────
  GhostGuard.storage.getSettings()
    .then(s => {
      settings = s;
    })
    .catch(() => {})
    .finally(() => {
      GhostGuard.observer.start(scanCards);
    });

  // ── P1: Claim dedup flag BEFORE first await to prevent race ──────────────

  async function processCard(cardEl) {
    if (cardEl.dataset.ggScored) return;
    cardEl.dataset.ggScored = 'pending';   // claim before any await

    if (!settings.showBadges) {
      delete cardEl.dataset.ggScored;
      return;
    }

    let jobData;
    try { jobData = scraper.extractFromCard(cardEl); } catch (e) {
      delete cardEl.dataset.ggScored;
      return;
    }
    if (!jobData) { delete cardEl.dataset.ggScored; return; }

    // Cache check
    if (jobData.jobId) {
      const cached = await GhostGuard.storage.getCached(jobData.jobId);
      if (cached) {
        cardEl.dataset.ggScored = '1';
        GhostGuard.badge.injectBadge(cardEl, cached);
        applyDim(cardEl, cached);
        return;
      }
    }

    const result = GhostGuard.scorer.score(jobData);
    cardEl.dataset.ggScored = '1';
    GhostGuard.badge.injectBadge(cardEl, result);
    applyDim(cardEl, result);

    if (jobData.jobId) {
      // P19: strip raw description before caching — scoring is done, no need to store it
      const lean = { ...result, jobData: { ...result.jobData, descriptionText: '' } };
      GhostGuard.storage.setCache(jobData.jobId, lean);
    }
  }

  // ── Detail pane ───────────────────────────────────────────────────────────

  let lastDetailId = null;

  // P5: reset on SPA navigation
  function resetNavState() {
    lastDetailId = null;
  }

  async function processDetail() {
    const detailEl = document.querySelector(DETAIL_SELECTORS[platform]);
    if (!detailEl) return;

    let jobData;
    try {
      jobData = scraper.extractFromDetail
        ? scraper.extractFromDetail(detailEl)
        : GhostGuard.scrapers[platform].extractFromDetail(detailEl);
    } catch (e) { return; }

    if (!jobData) return;

    // P18: include location in fallback id to reduce collisions
    const id = jobData.jobId || (jobData.title + '|' + jobData.company + '|' + (jobData.location || ''));
    if (id === lastDetailId) return;
    lastDetailId = id;

    // Show loading badge immediately; yield one frame so it renders before scoring
    GhostGuard.badge.injectLoadingBadge(detailEl);
    await new Promise(r => setTimeout(r, 0));

    const result = GhostGuard.scorer.score(jobData);

    GhostGuard.badge.injectDetailBadge(detailEl, result);

    const activeCard = document.querySelector(
      `[data-job-id="${jobData.jobId}"], [data-occludable-job-id="${jobData.jobId}"]`
    );
    if (activeCard) {
      const oldBadge = activeCard.querySelector('.gg-badge-host');
      if (oldBadge) oldBadge.remove();
      delete activeCard.dataset.ggScored;
      GhostGuard.badge.injectBadge(activeCard, result);
      applyDim(activeCard, result);
    }

    if (jobData.jobId) {
      const lean = { ...result, jobData: { ...result.jobData, descriptionText: '' } };
      GhostGuard.storage.setCache(jobData.jobId, lean);
    }
  }

  function applyDim(cardEl, result) {
    cardEl.style.opacity = (settings.dimGhosts && result.tier.color === 'red') ? '0.45' : '';
  }

  function scanCards(resetNav) {
    if (resetNav) {
      resetNavState();
      // Clear stale markers + remove old badges so reused DOM nodes get re-scored
      document.querySelectorAll('[data-gg-scored]').forEach(el => {
        delete el.dataset.ggScored;
        el.querySelectorAll('.gg-badge-host').forEach(b => b.remove());
      });
    }
    document.querySelectorAll(CARD_SELECTORS[platform]).forEach(processCard);
    processDetail();
  }

  // ── Message handler ───────────────────────────────────────────────────────

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      switch (msg.type) {
        case 'GG_SET_BADGES':
          settings.showBadges = msg.value;
          GhostGuard.badge.setVisible(msg.value);
          break;
        case 'GG_SET_TOOLTIPS':
          settings.showTooltips = msg.value;
          GhostGuard.badge.setTooltipsEnabled(msg.value);
          break;
        case 'GG_SET_DIM':
          settings.dimGhosts = msg.value;
          document.querySelectorAll('[data-gg-scored="1"]').forEach(card => {
            const badge = card.querySelector('.gg-badge-host');
            const s = badge ? parseInt(badge.dataset.ggScore, 10) : 0;
            const tier = GhostGuard.scorer.tierFromScore(s);
            card.style.opacity = (msg.value && tier.color === 'red') ? '0.45' : '';
          });
          break;
        case 'GG_RESET_STATS':
          break;
        case 'GG_NAV_CHANGED':
          // Background script detected a pushState navigation to a job page
          scanCards(true);
          // Retry for 3s in case React hasn't rendered cards yet
          let navAttempts = 0;
          const navRetry = setInterval(() => {
            if (document.querySelectorAll(CARD_SELECTORS[platform]).length > 0 || ++navAttempts >= 10) {
              clearInterval(navRetry);
            }
            scanCards(false);
          }, 300);
          break;
      }
    });
  } catch (_) {}

}());
