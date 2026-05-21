window.GhostGuard = window.GhostGuard || {};

GhostGuard.scorer = (function () {

  const TIER = {
    GREEN:  { label: 'Likely Real',   color: 'green',  emoji: '🟢' },
    YELLOW: { label: 'Caution',       color: 'yellow', emoji: '🟡' },
    RED:    { label: 'Likely Ghost',  color: 'red',    emoji: '🔴' }
  };

  function tierFromScore(score) {
    if (score <= 30) return TIER.GREEN;
    if (score <= 60) return TIER.YELLOW;
    return TIER.RED;
  }

  // ── Signal definitions ────────────────────────────────────────────────────
  // Each returns { triggered: bool, points: number, label: string }

  const signals = [

    // Tier 1 — strong ─────────────────────────────────────────────────────

    function daysPostedVeryOld(d) {
      if (d.daysPosted == null) return null;
      const triggered = d.daysPosted >= 90;
      return { triggered, points: triggered ? 35 : 0, label: `Posted ${d.daysPosted} days ago (90+ days)` };
    },

    function daysPostedOld(d) {
      if (d.daysPosted == null) return null;
      const triggered = d.daysPosted >= 60 && d.daysPosted < 90;
      return { triggered, points: triggered ? 25 : 0, label: `Posted ${d.daysPosted} days ago (60–89 days)` };
    },

    function daysPostedMid(d) {
      if (d.daysPosted == null) return null;
      const triggered = d.daysPosted >= 30 && d.daysPosted < 60;
      return { triggered, points: triggered ? 15 : 0, label: `Posted ${d.daysPosted} days ago (30–59 days)` };
    },

    function daysPostedFresh(d) {
      if (d.daysPosted == null) return null;
      const triggered = d.daysPosted <= 7;
      return { triggered, points: triggered ? -15 : 0, label: 'Posted ≤ 7 days ago' };
    },

    function repostedIndicator(d) {
      const triggered = !!d.reposted;
      return { triggered, points: triggered ? 25 : 0, label: 'Reposted listing' };
    },

    function noSalaryRange(d) {
      const hasSalary = /\$\d+|\bsalary\b|\bcompensation\b|\bpay range\b|\bper (hour|hr|year|yr|annum)\b/i.test(d.salaryText || '');
      const triggered = !hasSalary;
      return { triggered, points: triggered ? 15 : 0, label: 'No salary range listed' };
    },

    function salaryPresent(d) {
      const triggered = /\$\d+[kK]?(\s*[-–]\s*\$?\d+[kK]?)?/.test(d.salaryText || '');
      return { triggered, points: triggered ? -20 : 0, label: 'Salary range disclosed' };
    },

    function lowApplicantFlow(d) {
      if (d.applicantCount == null || !d.daysPosted || d.daysPosted === 0) return null;
      const rate = d.applicantCount / d.daysPosted;
      const triggered = rate < 2;
      return { triggered, points: triggered ? 20 : 0, label: `Low applicant flow (${d.applicantCount} applicants, ${d.daysPosted} days)` };
    },

    function highApplicantFlow(d) {
      if (d.applicantCount == null || !d.daysPosted || d.daysPosted === 0) return null;
      const rate = d.applicantCount / d.daysPosted;
      const triggered = rate > 20;
      return { triggered, points: triggered ? -20 : 0, label: `High applicant flow (${d.applicantCount} applicants, ${d.daysPosted} days)` };
    },

    // Tier 2 — medium ─────────────────────────────────────────────────────

    function competitiveSalaryPhrase(d) {
      const triggered = /competitive\s+(salary|comp|compensation|package|pay)/i.test(
        (d.descriptionText || '') + ' ' + (d.salaryText || '')
      );
      return { triggered, points: triggered ? 10 : 0, label: '"Competitive salary" phrase (no number given)' };
    },

    function genericLocation(d) {
      const loc = d.location || '';
      const triggered = /multiple\s+locations|anywhere/i.test(loc) ||
        /remote\s*[-–—]\s*(us|canada|europe|asia|worldwide|global)/i.test(loc) ||
        /remote[^a-z]*(us|canada|europe|asia)[\/,]/i.test(loc);
      return { triggered, points: triggered ? 8 : 0, label: 'Generic or global location' };
    },

    function descriptionTooShort(d) {
      if (!d.descriptionText) return null;
      const words = d.descriptionText.trim().split(/\s+/).length;
      const triggered = words < 200;
      return { triggered, points: triggered ? 10 : 0, label: `Short description (${words} words, < 200)` };
    },

    function descriptionDetailed(d) {
      if (!d.descriptionText) return null;
      const words = d.descriptionText.trim().split(/\s+/).length;
      const triggered = words > 800;
      return { triggered, points: triggered ? -5 : 0, label: `Detailed description (${words} words)` };
    },

    function excessiveExperience(d) {
      const desc = d.descriptionText || '';
      // "10+ years" + "junior" / "mid" / "associate" anywhere in description/title
      const levelKeywords = /\b(junior|mid[\s-]?level|associate|entry[\s-]?level)\b/i;
      const yearsPattern = /\b(10|11|12|13|14|15)\+?\s*(years?|yrs?)\s+of\s+(experience|exp)\b/i;
      const triggered = levelKeywords.test(desc + ' ' + (d.title || '')) && yearsPattern.test(desc);
      return { triggered, points: triggered ? 10 : 0, label: '10+ yrs experience required for a junior/mid role' };
    },

    function highBuzzwordDensity(d) {
      if (!d.descriptionText) return null;
      const text = d.descriptionText.toLowerCase();
      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount < 50) return null;
      const buzzwords = GhostGuard.data.buzzwords || [];
      let hits = 0;
      for (const bw of buzzwords) {
        if (text.includes(bw.toLowerCase())) hits++;
      }
      const density = (hits / wordCount) * 100;
      const triggered = density > 5;
      return { triggered, points: triggered ? 8 : 0, label: `High buzzword density (${hits} hits)` };
    },

    function specificTechStack(d) {
      if (!d.descriptionText) return null;
      const text = d.descriptionText;
      const keywords = GhostGuard.data.techKeywords || [];
      let hits = 0;
      for (const kw of keywords) {
        try {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`, 'i').test(text)) hits++;
        } catch (_) {}
      }
      const triggered = hits > 5;
      return { triggered, points: triggered ? -10 : 0, label: `Specific tech stack mentioned (${hits} tools)` };
    },

    // Tier 3 — light ──────────────────────────────────────────────────────

    function hiringManagerVisible(d) {
      const triggered = !!d.posterVisible;
      return { triggered, points: triggered ? -15 : 0, label: 'Hiring manager / poster profile visible' };
    },

    function externalApplyLink(d) {
      const triggered = !!d.hasExternalLink;
      return { triggered, points: triggered ? -10 : 0, label: 'Apply on company website (external link)' };
    },

    function easyApplyOnly(d) {
      const triggered = !!d.easyApply && !d.hasExternalLink;
      return { triggered, points: triggered ? 5 : 0, label: 'Easy Apply only (no external link)' };
    },

    function knownGhoster(d) {
      const company = (d.company || '').toLowerCase();
      const list = GhostGuard.data.knownGhosters || [];
      const triggered = list.some(g => company.includes(g));
      return { triggered, points: triggered ? 20 : 0, label: 'Company in known ghost-poster list' };
    },

    function verifiedCompanyBadge(d) {
      const triggered = !!d.verifiedCompany;
      return { triggered, points: triggered ? -10 : 0, label: 'Verified company badge' };
    }
  ];

  // ── Main scorer ───────────────────────────────────────────────────────────

  function score(jobData) {
    let total = 0;
    const reasons = [];

    for (const signal of signals) {
      let result;
      try { result = signal(jobData); } catch (e) { result = null; }
      if (!result || !result.triggered || result.points === 0) continue;
      total += result.points;
      reasons.push({ label: result.label, points: result.points });
    }

    total = Math.max(0, Math.min(100, total));

    // Sort: negative (good) last, positive (bad) first, by absolute value
    reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

    return {
      score: total,
      tier: tierFromScore(total),
      reasons,
      jobData
    };
  }

  return { score, tierFromScore, TIER };
}());
