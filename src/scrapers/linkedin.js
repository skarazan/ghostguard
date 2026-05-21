// LinkedIn job data extractor — list view + detail pane + standalone URL

window.GhostGuard = window.GhostGuard || {};

GhostGuard.scrapers = GhostGuard.scrapers || {};

GhostGuard.scrapers.linkedin = (function () {

  function extractJobId(el) {
    // Card has data-job-id or data-occludable-job-id
    const id =
      el.dataset.jobId ||
      el.dataset.occludableJobId ||
      el.closest('[data-job-id]')?.dataset.jobId ||
      el.closest('[data-occludable-job-id]')?.dataset.occludableJobId;
    if (id) return id;

    // Fallback: parse from any anchor href inside the card
    const anchor = el.querySelector('a[href*="/jobs/view/"]');
    if (anchor) {
      const m = anchor.href.match(/\/jobs\/view\/(\d+)/);
      if (m) return m[1];
    }

    // Standalone detail page
    const m = window.location.href.match(/\/jobs\/view\/(\d+)/);
    return m ? m[1] : null;
  }

  function getText(el, ...selectors) {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found?.textContent?.trim()) return found.textContent.trim();
    }
    return '';
  }

  function parseDaysAgo(text) {
    if (!text) return null;
    const t = text.toLowerCase();

    if (t.includes('just now') || t.includes('today') || t.includes('less than a day')) return 0;
    if (t.includes('yesterday')) return 1;

    // "X hours ago" → same day
    const hoursMatch = t.match(/(\d+)\s*hour/);
    if (hoursMatch) return 0;

    // "X days ago" or "X day ago"
    const daysMatch = t.match(/(\d+)\s*day/);
    if (daysMatch) return parseInt(daysMatch[1], 10);

    // "X weeks ago"
    const weeksMatch = t.match(/(\d+)\s*week/);
    if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;

    // "X months ago"
    const monthsMatch = t.match(/(\d+)\s*month/);
    if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;

    // Absolute date: "Jan 15, 2026" or "January 15, 2026"
    const dateMatch = t.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (dateMatch) {
      const parsed = new Date(text);
      if (!isNaN(parsed)) {
        const diff = Math.floor((Date.now() - parsed.getTime()) / 86400000);
        return Math.max(0, diff);
      }
    }

    return null;
  }

  function parseApplicantCount(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    // "Over 200 applicants", "200+ applicants", "47 applicants"
    const m = t.match(/(\d+)\+?\s*applicant/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  function extractFromCard(cardEl) {
    const jobId = extractJobId(cardEl);

    const title = getText(
      cardEl,
      '.job-card-list__title',
      '.artdeco-entity-lockup__title',
      'h3',
      'a[data-control-id]'
    );

    const company = getText(
      cardEl,
      '.artdeco-entity-lockup__subtitle',
      '.job-card-container__company-name',
      '[data-control-id*="company"]'
    );

    const location = getText(
      cardEl,
      '.artdeco-entity-lockup__caption',
      '.job-card-container__metadata-item',
      '.job-card-list__metadata-item'
    );

    const timeEl = cardEl.querySelector('time[datetime]');
    const timeText = timeEl?.getAttribute('datetime') || timeEl?.textContent || '';
    const postedText = getText(
      cardEl,
      '.job-card-container__listed-status',
      '.job-card-list__footer-wrapper time',
      'time'
    ) || timeText;

    const easyApply = !!cardEl.querySelector(
      '.job-card-list__easy-apply-text, [aria-label*="Easy Apply"], .jobs-apply-button--top-card'
    );

    return {
      jobId,
      title,
      company,
      location,
      daysPosted: parseDaysAgo(postedText),
      reposted: postedText.toLowerCase().includes('repost'),
      applicantCount: null,   // not available in list view
      salaryText: '',         // rarely in list view
      hasExternalLink: false, // not determinable in list view
      easyApply,
      descriptionText: '',    // not available in list view
      posterVisible: false,   // not available in list view
      verifiedCompany: !!cardEl.querySelector('[aria-label*="Verified"]'),
      source: 'linkedin-card'
    };
  }

  function extractFromDetail(panelEl) {
    const jobId = extractJobId(panelEl);

    const title = getText(
      panelEl,
      '.jobs-unified-top-card__job-title',
      '.t-24.t-bold',
      'h1',
      'h2'
    );

    const company = getText(
      panelEl,
      '.jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__subtitle-primary-grouping a',
      'a[data-control-id*="company"]'
    );

    const location = getText(
      panelEl,
      '.jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__workplace-type',
      '.jobs-unified-top-card__subtitle-secondary-grouping'
    );

    // Posted date text
    const postedEl = panelEl.querySelector(
      '.jobs-unified-top-card__posted-date, time[datetime], .jobs-unified-top-card__subtitle-secondary-grouping time'
    );
    const postedText = postedEl?.textContent?.trim() || '';
    const reposted = postedText.toLowerCase().includes('repost') ||
      !!panelEl.querySelector('[aria-label*="Reposted"]');

    // Applicants
    const applicantEl = panelEl.querySelector(
      '.jobs-unified-top-card__applicant-count, [data-test*="applicant"], .jobs-unified-top-card__hiring-insights'
    );
    const applicantText = applicantEl?.textContent || '';

    // Salary — look in insight chips
    let salaryText = '';
    panelEl.querySelectorAll('.jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight').forEach(el => {
      const t = el.textContent;
      if (/\$|salary|compensation/i.test(t)) salaryText += ' ' + t;
    });

    // Description
    const descEl = panelEl.querySelector(
      '.jobs-description__content, .jobs-description-content__text, #job-details'
    );
    const descriptionText = descEl?.innerText || descEl?.textContent || '';

    // External link
    const hasExternalLink = !!panelEl.querySelector(
      'a[href*="apply"][href*="http"]:not([href*="linkedin.com"]), .jobs-apply-button[data-apply-method*="external"]'
    );

    // Easy Apply
    const easyApply = !!panelEl.querySelector(
      '.jobs-apply-button--top-card[aria-label*="Easy Apply"], button[aria-label*="Easy Apply"]'
    );

    // Poster
    const posterVisible = !!panelEl.querySelector(
      '.jobs-poster__name, .hirer-card__hirer-information, [data-control-id*="poster"]'
    );

    // Verified company badge
    const verifiedCompany = !!panelEl.querySelector(
      '.jobs-unified-top-card__verified-badge, [aria-label*="Verified company"]'
    );

    return {
      jobId,
      title,
      company,
      location,
      daysPosted: parseDaysAgo(postedText),
      reposted,
      applicantCount: parseApplicantCount(applicantText),
      salaryText: salaryText.trim(),
      hasExternalLink,
      easyApply,
      descriptionText,
      posterVisible,
      verifiedCompany,
      source: 'linkedin-detail'
    };
  }

  function extractFromPage() {
    // Standalone job page (/jobs/view/...)
    const detailPanel = document.querySelector(
      '.jobs-details, .job-view-layout, .jobs-unified-top-card'
    );
    if (detailPanel) return extractFromDetail(detailPanel);
    return null;
  }

  return { extractFromCard, extractFromDetail, extractFromPage, parseDaysAgo };
}());
