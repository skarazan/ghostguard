// GhostGuard — main content script entry point
// Runs after all other GhostGuard scripts are loaded via manifest ordering.

(function () {

  const host = window.location.hostname;
  const isLinkedIn  = host.includes('linkedin.com');
  const isIndeed    = host.includes('indeed.com');
  const isGlassdoor = host.includes('glassdoor.com');

  if (!isLinkedIn && !isIndeed && !isGlassdoor) return;

  // ── Card selectors per platform ──────────────────────────────────────────

  const CARD_SELECTORS = {
    linkedin:  '.job-card-container, .jobs-search-results__list-item, [data-occludable-job-id]',
    indeed:    '.job_seen_beacon, .jobsearch-ResultsList > li[class], .resultContent',
    glassdoor: '[class*="JobsList_jobListItem"], [class*="jobCard"], [data-test="jobListing"]'
  };

  const DETAIL_SELECTORS = {
    linkedin:  '.jobs-details, .jobs-unified-top-card, .job-view-layout',
    indeed:    '#jobDescriptionText, .jobsearch-ViewJobLayout',
    glassdoor: '[class*="JobDetails_jobDetailContainer"], [class*="jobDetails"]'
  };

  const platform = isLinkedIn ? 'linkedin' : isIndeed ? 'indeed' : 'glassdoor';
  const scraper   = GhostGuard.scrapers[platform];

  let settings = { showBadges: true, showTooltips: true, dimGhosts: false };

  // Load settings once
  GhostGuard.storage.getSettings().then(s => { settings = s; });

  // ── Process a single card ─────────────────────────────────────────────────

  async function processCard(cardEl) {
    if (cardEl.dataset.ggScored) return;
    if (!settings.showBadges) return;

    let jobData;
    try { jobData = scraper.extractFromCard(cardEl); } catch (e) { return; }
    if (!jobData) return;

    // Cache check
    if (jobData.jobId) {
      const cached = await GhostGuard.storage.getCached(jobData.jobId);
      if (cached) {
        GhostGuard.badge.injectBadge(cardEl, cached);
        applyDim(cardEl, cached);
        return;
      }
    }

    const result = GhostGuard.scorer.score(jobData);
    GhostGuard.badge.injectBadge(cardEl, result);
    applyDim(cardEl, result);

    if (jobData.jobId) {
      GhostGuard.storage.setCache(jobData.jobId, result);
    }
  }

  // ── Process detail pane ───────────────────────────────────────────────────

  let lastDetailId = null;

  async function processDetail() {
    const detailSel = DETAIL_SELECTORS[platform];
    const detailEl = document.querySelector(detailSel);
    if (!detailEl) return;

    let jobData;
    try {
      if (platform === 'linkedin') {
        jobData = GhostGuard.scrapers.linkedin.extractFromDetail(detailEl);
      } else if (platform === 'indeed') {
        jobData = GhostGuard.scrapers.indeed.extractFromDetail(detailEl);
      } else {
        jobData = GhostGuard.scrapers.glassdoor.extractFromDetail(detailEl);
      }
    } catch (e) { return; }

    if (!jobData) return;
    const id = jobData.jobId || jobData.title + jobData.company;
    if (id === lastDetailId) return;
    lastDetailId = id;

    const result = GhostGuard.scorer.score(jobData);

    // Find & update the active card badge if it exists
    const activeCard = document.querySelector(`[data-job-id="${jobData.jobId}"], [data-occludable-job-id="${jobData.jobId}"]`);
    if (activeCard) {
      // Remove old badge, re-inject with richer data
      const oldBadge = activeCard.querySelector('.gg-badge-host');
      if (oldBadge) oldBadge.remove();
      delete activeCard.dataset.ggScored;
      GhostGuard.badge.injectBadge(activeCard, result);
      applyDim(activeCard, result);
    }

    if (jobData.jobId) GhostGuard.storage.setCache(jobData.jobId, result);
  }

  // ── Dim ghost listings ────────────────────────────────────────────────────

  function applyDim(cardEl, result) {
    if (settings.dimGhosts && result.tier.color === 'red') {
      cardEl.style.opacity = '0.45';
    } else {
      cardEl.style.opacity = '';
    }
  }

  // ── Scan visible cards ────────────────────────────────────────────────────

  function scanCards() {
    const sel = CARD_SELECTORS[platform];
    document.querySelectorAll(sel).forEach(processCard);
    processDetail();
  }

  // ── Message handler (from popup) ──────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'GG_SET_BADGES':
        settings.showBadges = msg.value;
        GhostGuard.badge.setVisible(msg.value);
        break;
      case 'GG_SET_DIM':
        settings.dimGhosts = msg.value;
        // Re-apply dim state to all scored cards
        document.querySelectorAll('[data-gg-scored]').forEach(card => {
          const badge = card.querySelector('.gg-badge-host');
          const score = badge ? parseInt(badge.dataset.ggScore, 10) : 0;
          const tier = GhostGuard.scorer.tierFromScore(score);
          if (msg.value && tier.color === 'red') {
            card.style.opacity = '0.45';
          } else {
            card.style.opacity = '';
          }
        });
        break;
      case 'GG_RESET_STATS':
        break;
    }
  });

  // ── Start ─────────────────────────────────────────────────────────────────

  GhostGuard.observer.start(scanCards);

}());
