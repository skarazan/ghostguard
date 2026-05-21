window.GhostGuard = window.GhostGuard || {};
GhostGuard.scrapers = GhostGuard.scrapers || {};

GhostGuard.scrapers.indeed = (function () {

  function parseDaysAgo(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (t.includes('just posted') || t.includes('today') || t.includes('active today')) return 0;
    if (t.includes('1 day') || t.includes('yesterday')) return 1;
    const d = t.match(/(\d+)\s*day/);
    if (d) return parseInt(d[1], 10);
    const w = t.match(/(\d+)\s*week/);
    if (w) return parseInt(w[1], 10) * 7;
    const m = t.match(/(\d+)\s*month/);
    if (m) return parseInt(m[1], 10) * 30;
    // "30+ days ago"
    const plus = t.match(/(\d+)\+\s*days/);
    if (plus) return parseInt(plus[1], 10);
    return null;
  }

  function extractJobId(cardEl) {
    // data-jk on card wrapper
    const jk = cardEl.dataset.jk || cardEl.closest('[data-jk]')?.dataset.jk;
    if (jk) return `indeed_${jk}`;
    const anchor = cardEl.querySelector('a[href*="jk="]');
    if (anchor) {
      const m = anchor.href.match(/jk=([a-f0-9]+)/i);
      if (m) return `indeed_${m[1]}`;
    }
    return null;
  }

  function getText(el, ...selectors) {
    for (const sel of selectors) {
      const found = el.querySelector(sel);
      if (found?.textContent?.trim()) return found.textContent.trim();
    }
    return '';
  }

  function extractFromCard(cardEl) {
    const jobId = extractJobId(cardEl);

    const title = getText(cardEl,
      '.jobTitle', '[data-testid="job-title"]', 'h2 a', 'h2'
    );

    const company = getText(cardEl,
      '[data-testid="company-name"]', '.companyName', '.company'
    );

    const location = getText(cardEl,
      '[data-testid="text-location"]', '.companyLocation', '.location'
    );

    const postedText = getText(cardEl,
      '.date', '[data-testid="myJobsStateDate"]', '.result-footer .date'
    );

    const salaryText = getText(cardEl,
      '.metadata.salary-snippet-container', '[data-testid="attribute_snippet_testid"]',
      '.salary-snippet', '.estimated-salary'
    );

    const easyApply = !!cardEl.querySelector(
      '.indeedApplyButton, [data-indeed-apply], button[aria-label*="Apply"]'
    );

    const hasExternalLink = !easyApply &&
      !!cardEl.querySelector('a[href*="apply"], a[href*="application"]');

    return {
      jobId,
      title,
      company,
      location,
      daysPosted: parseDaysAgo(postedText),
      reposted: false,
      applicantCount: null,
      salaryText,
      hasExternalLink,
      easyApply,
      descriptionText: '',
      posterVisible: false,
      verifiedCompany: false,
      source: 'indeed-card'
    };
  }

  function extractFromDetail(panelEl) {
    const title = getText(panelEl,
      '[data-testid="jobsearch-JobInfoHeader-title"]', 'h1', 'h2'
    );
    const company = getText(panelEl,
      '[data-testid="inlineHeader-companyName"]', '[data-testid="jobsearch-JobInfoHeader-companyName"]'
    );
    const location = getText(panelEl,
      '[data-testid="job-location"]', '[data-testid="jobsearch-JobInfoHeader-companyLocation"]'
    );
    const postedText = getText(panelEl,
      '[data-testid="myJobsStateDate"]', '.jobsearch-JobMetadataHeader-item'
    );
    const salaryText = getText(panelEl,
      '[data-testid="jobsearch-JobMetadataHeader-salaryInfoAndJobType"]',
      '.icl-u-xs-mt--xs .attribute_snippet'
    );
    const descriptionText = panelEl.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText')?.innerText || '';

    const easyApply = !!panelEl.querySelector('.indeedApplyButton, [data-indeed-apply]');
    // P12: don't infer external link from absence of easy-apply — check explicitly
    const hasExternalLink = !easyApply &&
      !!panelEl.querySelector('a[href*="apply"]:not([data-indeed-apply]), .applyButtonContainer a');

    // P17: extract jobId from URL
    const urlMatch = (typeof window !== 'undefined' ? window.location.href : '').match(/jk=([a-f0-9]+)/i);
    const jobId = urlMatch ? `indeed_${urlMatch[1]}` : null;

    return {
      jobId,
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
      source: 'indeed-detail'
    };
  }

  return { extractFromCard, extractFromDetail, parseDaysAgo };
}());
