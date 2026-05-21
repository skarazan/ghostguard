// Node-based test runner for scorer.js logic
// Usage: node test/scoring.test.js

// Inline the data and scorer since we can't use chrome APIs in Node

const buzzwords = [
  'rockstar','ninja','guru','wizard','unicorn','family','fast-paced',
  'hit the ground running','wear many hats','self-starter','results-driven',
  'synergy','hustle','go-getter','passion','world-class','best-in-class',
  'competitive salary','competitive compensation'
];

const techKeywords = [
  'React','Vue','Angular','Python','Java','Go','Rust','TypeScript',
  'JavaScript','Node','Django','Spring','AWS','GCP','Azure','Docker',
  'Kubernetes','PostgreSQL','MongoDB','Redis','GraphQL','REST',
  'Figma','Salesforce','HubSpot','Tableau','SQL'
];

const knownGhosters = [
  'insight global','cybercoders','apex systems','tek systems','kforce',
  'robert half','aerotek','manpower','randstad','adecco'
];

// Minimal GhostGuard shim for Node
global.GhostGuard = {
  data: { buzzwords, techKeywords, knownGhosters }
};
global.window = global;

// Load scorer
require('../src/scorer.js');
const { score } = global.GhostGuard.scorer;

// ── Test fixtures ──────────────────────────────────────────────────────────

const fixtures = [
  {
    name: 'Obviously ghost — 90d old, reposted, no salary, competitive phrase',
    input: {
      daysPosted: 90, reposted: true, applicantCount: 10, salaryText: '',
      descriptionText: 'We are a fast-paced company looking for a rockstar. Competitive salary. ' + 'word '.repeat(100),
      location: 'New York', easyApply: true, hasExternalLink: false,
      posterVisible: false, verifiedCompany: false, company: 'acme corp', title: 'Engineer'
    },
    expectedTier: 'red',
    minScore: 61
  },
  {
    name: 'Obviously real — fresh, salary, poster, external, detailed',
    input: {
      daysPosted: 3, reposted: false, applicantCount: 150, salaryText: '$120k–$150k',
      descriptionText: ('We use React, TypeScript, Node, PostgreSQL, AWS, Docker, Kubernetes, GraphQL, Redis. ' + 'word '.repeat(100)),
      location: 'San Francisco', easyApply: false, hasExternalLink: true,
      posterVisible: true, verifiedCompany: true, company: 'stripe', title: 'Senior Engineer'
    },
    expectedTier: 'green',
    maxScore: 30
  },
  {
    name: 'Caution — 45d old, no salary, no poster',
    input: {
      daysPosted: 45, reposted: false, applicantCount: null, salaryText: '',
      descriptionText: 'Join our dynamic team! ' + 'word '.repeat(60),
      location: 'Austin, TX', easyApply: true, hasExternalLink: false,
      posterVisible: false, verifiedCompany: false, company: 'some co', title: 'Manager'
    },
    expectedTier: 'yellow'
  },
  {
    name: 'Known ghoster',
    input: {
      daysPosted: 30, reposted: false, applicantCount: null, salaryText: '',
      descriptionText: 'word '.repeat(50),
      location: 'Remote', easyApply: true, hasExternalLink: false,
      posterVisible: false, verifiedCompany: false, company: 'Robert Half', title: 'Analyst'
    },
    pointsContain: { label: 'Company in known ghost-poster list', points: 20 }
  },
  {
    name: 'Generic location adds points',
    input: {
      daysPosted: 10, reposted: false, applicantCount: null, salaryText: '$80k',
      descriptionText: 'word '.repeat(200),
      location: 'Remote — US/Canada/Europe', easyApply: false, hasExternalLink: true,
      posterVisible: true, verifiedCompany: false, company: 'co', title: 'Dev'
    },
    pointsContain: { label: 'Generic or global location', points: 8 }
  },
  {
    name: 'Sample calculation from spec: score ~80',
    input: {
      daysPosted: 75, reposted: true, applicantCount: null,
      salaryText: '',
      descriptionText: 'We offer competitive salary. ' + 'word '.repeat(50),
      location: 'New York', easyApply: true, hasExternalLink: false,
      posterVisible: false, verifiedCompany: false, company: 'co', title: 'Dev'
    },
    minScore: 70,
    maxScore: 100,
    expectedTier: 'red'
  }
];

// ── Runner ────────────────────────────────────────────────────────────────

let passed = 0; let failed = 0;

for (const fix of fixtures) {
  const result = score(fix.input);
  const errors = [];

  if (fix.expectedTier && result.tier.color !== fix.expectedTier) {
    errors.push(`tier: expected ${fix.expectedTier}, got ${result.tier.color} (score ${result.score})`);
  }
  if (fix.minScore != null && result.score < fix.minScore) {
    errors.push(`score ${result.score} < minScore ${fix.minScore}`);
  }
  if (fix.maxScore != null && result.score > fix.maxScore) {
    errors.push(`score ${result.score} > maxScore ${fix.maxScore}`);
  }
  if (fix.pointsContain) {
    const found = result.reasons.some(r => r.label === fix.pointsContain.label && r.points === fix.pointsContain.points);
    if (!found) errors.push(`expected reason "${fix.pointsContain.label}" (${fix.pointsContain.points}pts) not found`);
  }

  if (errors.length) {
    console.error(`FAIL  ${fix.name}`);
    errors.forEach(e => console.error(`      → ${e}`));
    failed++;
  } else {
    console.log(`PASS  ${fix.name}  (score=${result.score}, tier=${result.tier.color})`);
    passed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
