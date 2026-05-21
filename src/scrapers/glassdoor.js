window.GhostGuard = window.GhostGuard || {};
GhostGuard.scrapers = GhostGuard.scrapers || {};

GhostGuard.scrapers.glassdoor = (function () {

  function parseDaysAgo(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (t.includes('today') || t.includes('just') || t.includes('hours') || t.includes('hr')) return 0;
    if (t.includes('1d') || t === '1 day ago') return 1;
    const d = t.match(/(\d+)d/);
    if (d) return parseInt(d[1], 10);
    const days = t.match(/(\d+)\s*day/);
    if (days) return parseInt(days[1], 10);
    const w = t.match(/(\d+)\s*w/);
    if (w) return parseInt(w[1], 10) * 7;
    const mo = t.match(/(\d+)\s*mo/);
    if (mo) return parseInt(mo[1], 10) * 30;
    if (t.includes('30+') || t.includes('month')) return 35;
    return null;
  }

  function extractJobId(cardEl) {
    // Glassdoor often has jobListingId in data attrs or anchor URLs
    const anchor = cardEl.querySelector('a[href*="job-listing"], a[href*="jobListingId="], a[data-test="job-link"]');
    if (anchor) {
      const m = (anchor.href || '').match(/jobListingId[=_](\d+)/i) ||
                (anchor.href || '').match(/GD_JOB_AD\/\d+\/pos\/(\d+)/i);
      if (m) return `gd_${m[1]}`;
      // Use href hash as fallback id
      // P14: encodeURIComponent prevents btoa() from throwing on non-ASCII URLs
      try { return `gd_${btoa(encodeURIComponent(anchor.href)).slice(0, 16)}`; } catch (_) { return null; }
    }
    return null;
  }

  function getText(el, ...selectors) {
    for (const sel of selectors) {
      try {
        const found = el.querySelector(sel);
        if (found?.textContent?.trim()) return found.textContent.trim();
      } catch (_) {}
    }
    return '';
  }

  function extractFromCard(cardEl) {
    const jobId = extractJobId(cardEl);

    const title = getText(cardEl,
      '[data-test="job-link"]', '[data-test="jobTitle"]', 'a[class*="jobTitle"]', 'h3', 'h2'
    );

    const company = getText(cardEl,
      '[data-test="employer-name"]', '[class*="EmployerProfile"]', '.employer-name'
    );

    const location = getText(cardEl,
      '[data-test="emp-location"]', '[class*="location"]', '.location'
    );

    const postedText = getText(cardEl,
      '[data-test="job-age"]', '[class*="listingAge"]', '[class*="age"]'
    );

    const salaryText = getText(cardEl,
      '[data-test="detailSalary"]', '[class*="salary"]', '[class*="Salary"]'
    );

    return {
      jobId,
      title,
      company,
      location,
      daysPosted: parseDaysAgo(postedText),
      reposted: false,
      applicantCount: null,
      salaryText,
      hasExternalLink: false,
      easyApply: false,
      descriptionText: '',
      posterVisible: false,
      verifiedCompany: false,
      source: 'glassdoor-card'
    };
  }

  function extractFromDetail(panelEl) {
    const title = getText(panelEl,
      '[data-test="jobTitle"]', '[class*="JobDetails_jobTitle"]', 'h1'
    );
    const company = getText(panelEl,
      '[data-test="employer-name"]', '[class*="EmployerProfile_name"]'
    );
    const location = getText(panelEl,
      '[data-test="location"]', '[class*="location"]'
    );
    const postedText = getText(panelEl,
      '[data-test="job-age"]', '[class*="age"]'
    );
    const salaryText = getText(panelEl,
      '[data-test="detailSalary"]', '[class*="SalaryEstimate"]'
    );

    // Description: Glassdoor uses randomized class names
    let descriptionText = '';
    const descEl = panelEl.querySelector('[class*="JobDetails_jobDescription"], [class*="desc__"]');
    if (descEl) descriptionText = descEl.innerText || descEl.textContent || '';

    const hasExternalLink = !!panelEl.querySelector('a[href*="apply"][href*="http"]:not([href*="glassdoor.com"])');
    // P13: detect Easy Apply explicitly rather than inferring from absence of external link
    const easyApply = !!panelEl.querySelector('[data-test="easyApply"], button[aria-label*="Easy Apply"], [class*="EasyApply"]');

    return {
      jobId: null,
      title,
      company,
      location,
      daysPosted: parseDaysAgo(postedText),
      reposted: false,
      applicantCount: null,
      salaryText,
      hasExternalLink,
      easyApply,
      descriptionText,
      posterVisible: false,
      verifiedCompany: false,
      source: 'glassdoor-detail'
    };
  }

  return { extractFromCard, extractFromDetail, parseDaysAgo };
}());
