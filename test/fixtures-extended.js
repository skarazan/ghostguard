// Extended test fixtures for GhostGuard scorer
// Usage: incorporated into scoring.test.js or a separate runner
// Each fixture documents expected score, tier, and which specific reasons fire/don't fire.

const extendedFixtures = [

  // ── 1. Salary format: "$85,000/yr" — should trigger salaryPresent (-20) ──────
  {
    id: 'SALARY-01',
    name: 'Salary format: $85,000/yr (comma-formatted dollar amount)',
    notes: 'The salaryPresent regex matches \\$\\d+ so $85,000 hits. noSalaryRange also checks /\\$\\d+/ so no-salary does NOT fire.',
    input: {
      daysPosted: 5,
      salaryText: '$85,000/yr',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Software Engineer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    expectedTier: 'green',
    maxScore: 0,
    mustFire: [{ label: 'Salary range disclosed', points: -20 }],
    mustNotFire: ['No salary range listed']
  },

  // ── 2. Salary format: "85k-120k" (no dollar sign) — noSalary fires, salaryPresent does NOT ──
  {
    id: 'SALARY-02',
    name: 'Salary format: "85k-120k" (no $ prefix) — treated as no salary',
    notes: 'salaryPresent requires \\$\\d+[kK]?. "85k" without $ does NOT match. noSalaryRange also requires \\$\\d+, so +15 fires. This is a gap: "85k-120k" is a real salary but GhostGuard misses it.',
    input: {
      daysPosted: 5,
      salaryText: '85k-120k',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Engineer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    expectedTier: 'green',
    mustFire: [{ label: 'No salary range listed', points: 15 }],
    mustNotFire: ['Salary range disclosed'],
    knownBug: true,
    bugDescription: 'Salary "85k-120k" should be recognized as a disclosed range but is not due to missing $ in regex.'
  },

  // ── 3. Salary format: "DOE" — should trigger no-salary (+15) ─────────────────
  {
    id: 'SALARY-03',
    name: 'Salary format: "DOE" (Depends on Experience)',
    notes: '"DOE" is a common evasion phrase. Neither salaryPresent nor noSalaryRange keywords match it, so +15 fires correctly.',
    input: {
      daysPosted: 5,
      salaryText: 'DOE',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Engineer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    expectedTier: 'green',
    mustFire: [{ label: 'No salary range listed', points: 15 }],
    mustNotFire: ['Salary range disclosed']
  },

  // ── 4. Salary format: "negotiable" — no-salary fires ─────────────────────────
  {
    id: 'SALARY-04',
    name: 'Salary format: "negotiable"',
    notes: '"negotiable" is not in the noSalaryRange allowlist, so +15 fires.',
    input: {
      daysPosted: 5,
      salaryText: 'negotiable',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Engineer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    expectedTier: 'green',
    mustFire: [{ label: 'No salary range listed', points: 15 }],
    mustNotFire: ['Salary range disclosed']
  },

  // ── 5. Salary format: "market rate" — no-salary fires ────────────────────────
  {
    id: 'SALARY-05',
    name: 'Salary format: "market rate"',
    notes: '"market rate" is not in the noSalaryRange allowlist.',
    input: {
      daysPosted: 5,
      salaryText: 'market rate',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Engineer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    expectedTier: 'green',
    mustFire: [{ label: 'No salary range listed', points: 15 }],
    mustNotFire: ['Salary range disclosed']
  },

  // ── 6. Title: "Head of Engineering" + 10yr req — excessiveExperience should NOT fire ──
  {
    id: 'TITLE-01',
    name: 'Title "Head of Engineering" with 12+ years requirement — excessiveExperience should NOT fire',
    notes: 'excessiveExperience requires levelKeywords (junior/mid/associate/entry) in title+desc. "Head of" is not a junior level keyword so this correctly does not trigger.',
    input: {
      daysPosted: 10,
      salaryText: '$180,000/yr',
      descriptionText: 'We require 12+ years of experience in distributed systems. ' + 'word '.repeat(200),
      company: 'co', title: 'Head of Engineering',
      reposted: false, applicantCount: 40, location: 'NYC',
      easyApply: false, hasExternalLink: true, posterVisible: true, verifiedCompany: true
    },
    mustNotFire: ['10+ yrs experience required for a junior/mid role']
  },

  // ── 7. Title: "Junior Software Engineer" + 12yr req — excessiveExperience fires ──
  {
    id: 'TITLE-02',
    name: 'Title "Junior Software Engineer" with 12+ years requirement — excessiveExperience fires',
    input: {
      daysPosted: 10,
      salaryText: '$80,000',
      descriptionText: 'We require 12+ years of experience for this entry-level role. ' + 'word '.repeat(200),
      company: 'co', title: 'Junior Software Engineer',
      reposted: false, applicantCount: 40, location: 'NYC',
      easyApply: false, hasExternalLink: true, posterVisible: true, verifiedCompany: true
    },
    mustFire: [{ label: '10+ yrs experience required for a junior/mid role', points: 10 }]
  },

  // ── 8. Very high buzzword density — all buzzwords present ─────────────────────
  {
    id: 'BUZZ-01',
    name: 'Maximum buzzword density — every buzzword in the list present',
    notes: 'All 42 buzzwords are present. density = 42/~140 words = ~30%, >> 5% threshold. +8 fires.',
    input: {
      daysPosted: 5,
      salaryText: '$120k',
      // All buzzwords concatenated + padding to reach 50+ words
      descriptionText: 'rockstar ninja guru wizard unicorn family fast-paced fast paced dynamic dynamic environment hit the ground running wear many hats self-starter self starter results-driven results driven synergy ecosystem disrupt hustle go-getter go getter passion passionate a-player world-class best-in-class cutting-edge cutting edge thought leader innovative visionary game-changer game changer move fast scrappy hungry driven motivated individual competitive salary competitive compensation competitive package ' + 'word '.repeat(100),
      company: 'co', title: 'Developer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [
      { label: 'High buzzword density (42 hits)', points: 8 },
      { label: '"Competitive salary" phrase (no number given)', points: 10 }
    ]
  },

  // ── 9. Mixed signals: 100d old BUT has salary + poster + high applicants ───────
  {
    id: 'MIXED-01',
    name: 'Mixed signals: 100d old BUT salary disclosed + poster visible + verified + high applicant flow',
    notes: 'daysPosted=100 adds +35. But salary -20, poster -15, external link -10, verified -10, high flow -20 sum to -75. Net = max(0, 35-75) = 0. Score=0, green.',
    input: {
      daysPosted: 100,
      reposted: false,
      applicantCount: 500,
      salaryText: '$130,000–$160,000',
      descriptionText: 'word '.repeat(300),
      location: 'Austin TX',
      easyApply: false, hasExternalLink: true,
      posterVisible: true, verifiedCompany: true,
      company: 'airbnb', title: 'Senior Engineer'
    },
    expectedTier: 'green',
    maxScore: 10,
    mustFire: [{ label: 'Posted 100 days ago (90+ days)', points: 35 }],
    mustNotFire: ['Likely Ghost']
  },

  // ── 10. Description boundary: 199 words (< 200 threshold) — short desc fires ──
  {
    id: 'DESC-01',
    name: 'Description with exactly 199 words — descriptionTooShort fires',
    input: {
      daysPosted: 5,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(199),
      company: 'co', title: 'Developer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [{ label: 'Short description (199 words, < 200)', points: 10 }]
  },

  // ── 11. Description boundary: 201 words (just above 200) — short desc does NOT fire ──
  {
    id: 'DESC-02',
    name: 'Description with exactly 201 words — descriptionTooShort does NOT fire',
    input: {
      daysPosted: 5,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(201),
      company: 'co', title: 'Developer',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustNotFire: ['Short description (201 words, < 200)']
  },

  // ── 12. Company partial match: "Robert Half Technology" includes "robert half" ──
  {
    id: 'GHOSTER-01',
    name: 'Company "Robert Half Technology" — partial match fires knownGhoster',
    notes: 'knownGhoster uses company.toLowerCase().includes(g). "robert half technology".includes("robert half") = true. +20 fires.',
    input: {
      daysPosted: 20,
      salaryText: '',
      descriptionText: 'word '.repeat(200),
      company: 'Robert Half Technology', title: 'Analyst',
      reposted: false, applicantCount: null, location: 'Chicago IL',
      easyApply: true, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [{ label: 'Company in known ghost-poster list', points: 20 }]
  },

  // ── 13. daysPosted=null — must not crash, score reflects only non-age signals ──
  {
    id: 'NULL-01',
    name: 'daysPosted=null — unknown age — must not throw, age signals absent',
    notes: 'All four age signals return null when daysPosted==null. Score still reflects salary/poster/etc.',
    input: {
      daysPosted: null,
      salaryText: '',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, applicantCount: null, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustNotFire: [
      'Posted null days ago (90+ days)',
      'Posted null days ago (60–89 days)',
      'Posted null days ago (30–59 days)',
      'Posted ≤ 7 days ago'
    ],
    mustFire: [{ label: 'No salary range listed', points: 15 }],
    noThrow: true
  },

  // ── 14. reposted=true + daysPosted=5 — reposted signal fires despite fresh age ──
  {
    id: 'REPOST-01',
    name: 'reposted=true + daysPosted=5 — repostedIndicator fires regardless of freshness',
    notes: 'reposted=true triggers +25 unconditionally. daysPosted=5 triggers -15. Net = +10.',
    input: {
      daysPosted: 5,
      reposted: true,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [
      { label: 'Reposted listing', points: 25 },
      { label: 'Posted ≤ 7 days ago', points: -15 }
    ]
  },

  // ── 15. applicantCount=200, daysPosted=1 — highApplicantFlow fires (200 >> 20 threshold) ──
  {
    id: 'FLOW-01',
    name: 'applicantCount=200 on day 1 — high applicant flow fires (rate=200, threshold=20)',
    input: {
      daysPosted: 1,
      applicantCount: 200,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [{ label: 'High applicant flow (200 applicants, 1 days)', points: -20 }],
    mustNotFire: ['Low applicant flow (200 applicants, 1 days)']
  },

  // ── 16. Tech keywords boundary: exactly 6 — specificTechStack fires (>5) ───────
  {
    id: 'TECH-01',
    name: 'Exactly 6 tech keywords in description — specificTechStack fires (threshold >5)',
    notes: 'React, TypeScript, Node, PostgreSQL, AWS, Docker = 6 hits. 6 > 5 = triggered. -10.',
    input: {
      daysPosted: 20,
      salaryText: '$100,000',
      descriptionText: 'We use React TypeScript Node PostgreSQL AWS Docker in our stack. ' + 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [{ label: 'Specific tech stack mentioned (6 tools)', points: -10 }]
  },

  // ── 17. Tech keywords boundary: exactly 5 — specificTechStack does NOT fire ────
  {
    id: 'TECH-02',
    name: 'Exactly 5 tech keywords in description — specificTechStack does NOT fire (threshold >5, not >=5)',
    notes: 'React, TypeScript, Node, PostgreSQL, AWS = 5 hits. 5 is NOT > 5. Signal stays off.',
    input: {
      daysPosted: 20,
      salaryText: '$100,000',
      descriptionText: 'We use React TypeScript Node PostgreSQL AWS in our stack. ' + 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustNotFire: ['Specific tech stack mentioned (5 tools)']
  },

  // ── 18. Minimum achievable score: all positive signals firing simultaneously ───
  {
    id: 'MINMAX-01',
    name: 'Minimum score (all positive/green signals): should score 0 (floor)',
    notes: 'Fresh post (3 days, -15), salary ($150k-200k, -20), high flow (500/3=166, -20), poster (-15), external link (-10), verified (-10), 10+ tech keywords (-10). Total = -100, clamped to 0.',
    input: {
      daysPosted: 3,
      reposted: false,
      applicantCount: 500,
      salaryText: '$150,000–$200,000',
      descriptionText: 'We use React TypeScript Node PostgreSQL AWS Docker Kubernetes GraphQL Redis Python Django and many other tools here. ' + 'word '.repeat(200),
      location: 'San Francisco CA',
      easyApply: false, hasExternalLink: true,
      posterVisible: true, verifiedCompany: true,
      company: 'stripe', title: 'Senior Engineer'
    },
    expectedTier: 'green',
    exactScore: 0
  },

  // ── 19. Maximum achievable score: all negative signals firing simultaneously ───
  {
    id: 'MINMAX-02',
    name: 'Maximum score (all ghost signals): should score 100 (ceiling)',
    notes: '90+d (+35), reposted (+25), low flow 5/120=0.04 (+20), known ghoster insight global (+20), no salary (+15), competitive phrase (+10), <200 words (+10), 10+yrs junior (+10), generic location (+8), easyApply only (+5) = 158, clamped to 100.',
    input: {
      daysPosted: 120,
      reposted: true,
      applicantCount: 5,
      salaryText: '',
      descriptionText: 'We are a rockstar ninja guru wizard unicorn family fast-paced dynamic synergy hustle passion driven world-class best-in-class cutting-edge thought leader innovative visionary game-changer. Competitive salary. We require 12+ years of experience for this junior associate entry-level role. ' + 'word '.repeat(10),
      location: 'Remote - US/Canada/Europe',
      easyApply: true, hasExternalLink: false,
      posterVisible: false, verifiedCompany: false,
      company: 'Insight Global Partners', title: 'Junior Associate Developer'
    },
    expectedTier: 'red',
    exactScore: 100
  },

  // ── 20. easyApply=true AND hasExternalLink=true — easyApplyOnly must NOT fire ──
  {
    id: 'APPLY-01',
    name: 'easyApply=true AND hasExternalLink=true — easyApplyOnly signal must NOT fire',
    notes: 'easyApplyOnly = !!easyApply && !hasExternalLink. With hasExternalLink=true the condition is false.',
    input: {
      daysPosted: 5,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: true, hasExternalLink: true,
      posterVisible: false, verifiedCompany: false
    },
    mustNotFire: ['Easy Apply only (no external link)'],
    mustFire: [{ label: 'Apply on company website (external link)', points: -10 }]
  },

  // ── 21. Glassdoor listing: old, no salary, generic location ──────────────────
  {
    id: 'PLATFORM-01',
    name: 'Glassdoor listing: 75d old, no salary, short desc, generic location — should be yellow',
    notes: '60-89d +25, no salary +15, <200 words +10, generic location +8 = 58. Yellow tier (31-60).',
    input: {
      daysPosted: 75,
      reposted: false,
      applicantCount: null,
      salaryText: '',
      descriptionText: 'word '.repeat(150),
      location: 'Remote - US/Canada',
      easyApply: false, hasExternalLink: false,
      posterVisible: false, verifiedCompany: false,
      company: 'Big Consulting Firm', title: 'Business Analyst',
      platform: 'glassdoor'
    },
    expectedTier: 'yellow',
    minScore: 50,
    maxScore: 65
  },

  // ── 22. Edge: all null/undefined jobData values — must not throw ──────────────
  {
    id: 'EDGE-01',
    name: 'All null/undefined jobData — must not throw, must return a valid score object',
    input: {},
    noThrow: true,
    mustFire: [{ label: 'No salary range listed', points: 15 }]
  },

  // ── 23. Salary "per hour" phrasing in description — recognized by noSalaryRange ──
  {
    id: 'SALARY-06',
    name: 'Salary text: "$35 per hour" — noSalaryRange recognizes "per hour" keyword',
    notes: 'noSalaryRange regex includes /per (hour|hr|year|yr|annum)/i. "$35 per hour" contains both $\\d+ and "per hour".',
    input: {
      daysPosted: 10,
      salaryText: '$35 per hour',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Contractor',
      reposted: false, applicantCount: 20, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustNotFire: ['No salary range listed'],
    mustFire: [{ label: 'Salary range disclosed', points: -20 }]
  },

  // ── 24. applicantCount=0 with daysPosted=5 — low flow fires but fresh also fires ──
  {
    id: 'FLOW-02',
    name: 'applicantCount=0 + daysPosted=5 — low flow (+20) and fresh (-15) both fire',
    notes: 'rate=0/5=0 < 2, so lowApplicantFlow triggers. A brand new post with no applicants yet is normal — this is a false positive worth noting.',
    input: {
      daysPosted: 5,
      applicantCount: 0,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [
      { label: 'Low applicant flow (0 applicants, 5 days)', points: 20 },
      { label: 'Posted ≤ 7 days ago', points: -15 }
    ],
    knownBug: true,
    bugDescription: 'A fresh post with 0 applicants triggers low-flow — this is expected behavior on day 1-2 and is a false positive. Consider guarding lowApplicantFlow when daysPosted <= 3.'
  },

  // ── 25. daysPosted=30 exact boundary — daysPostedMid fires (>= 30, < 60) ───────
  {
    id: 'AGE-01',
    name: 'daysPosted=30 — boundary of 30-59 tier (+15)',
    input: {
      daysPosted: 30,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustFire: [{ label: 'Posted 30 days ago (30–59 days)', points: 15 }],
    mustNotFire: ['Posted ≤ 7 days ago', 'Posted 30 days ago (60–89 days)']
  },

  // ── 26. daysPosted=29 — falls below all penalty tiers, no age signal fires ─────
  {
    id: 'AGE-02',
    name: 'daysPosted=29 — falls between fresh (<=7) and mid (>=30), no age signal fires',
    notes: 'This is a dead zone in the age model (8-29 days). No signal fires for posting age.',
    input: {
      daysPosted: 29,
      salaryText: '$100,000',
      descriptionText: 'word '.repeat(200),
      company: 'co', title: 'Dev',
      reposted: false, applicantCount: 30, location: 'Austin TX',
      easyApply: false, hasExternalLink: false, posterVisible: false, verifiedCompany: false
    },
    mustNotFire: [
      'Posted 29 days ago (30–59 days)',
      'Posted ≤ 7 days ago',
      'Posted 29 days ago (60–89 days)',
      'Posted 29 days ago (90+ days)'
    ]
  }

];

// Export for Node test runner
if (typeof module !== 'undefined') module.exports = { extendedFixtures };
