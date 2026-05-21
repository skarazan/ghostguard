// GhostGuard — main content script entry point

(function () {

  const host = window.location.hostname;
  const isLinkedIn  = host.includes('linkedin.com');
  const isIndeed    = host.includes('indeed.com');
  const isGlassdoor = host.includes('glassdoor.com');

  if (!isLinkedIn && !isIndeed && !isGlassdoor) return;

  const CARD_SELECTORS = {
    linkedin:  '.job-card-container, .jobs-search-results__list-item, [data-occludable-job-id]',
    indeed:    '.job_seen_beacon, .jobsearch-ResultsList > li[class], .resultContent',
    // data-test="jobListing" is the stable anchor; class* fallbacks for older builds
    glassdoor: '[data-test="jobListing"], [class*="JobsList_jobListItem"], [class*="jobCard"]'
  };

  const DETAIL_SELECTORS = {
    linkedin:  '.jobs-details, .jobs-unified-top-card, .job-view-layout',
    indeed:    '#jobDescriptionText, .jobsearch-ViewJobLayout',
    glassdoor: '[class*="JobDetails_jobDetailContainer"], [class*="jobDetails"]'
  };

  const platform = isLinkedIn ? 'linkedin' : isIndeed ? 'indeed' : 'glassdoor';
  const scraper   = GhostGuard.scrapers[platform];

  let settings = { showBadges: true, showTooltips: true, dimGhosts: false };

  // ── P15: await settings before starting observer ──────────────────────────
  GhostGuard.storage.getSettings().then(s => {
    settings = s;
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

    const result = GhostGuard.scorer.score(jobData);

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
    if (resetNav) resetNavState();
    document.querySelectorAll(CARD_SELECTORS[platform]).forEach(processCard);
    processDetail();
  }

  // ── Message handler ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'GG_SET_BADGES':
        settings.showBadges = msg.value;
        GhostGuard.badge.setVisible(msg.value);
        break;
      // P10: tooltip toggle now wired
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
    }
  });

}());
