window.GhostGuard = window.GhostGuard || {};
window.GhostGuard.data = window.GhostGuard.data || {};

// Seed list — companies with documented patterns of ghost posting.
// Sources: r/recruitinghell, Blind, Glassdoor reviews.
// Contributions welcome via GitHub PR.
GhostGuard.data.knownGhosters = [
  // Staffing / volume recruiters known for ghost listings
  'insight global',
  'cybercoders',
  'apex systems',
  'diversant',
  'tek systems',
  'teksystems',
  'kforce',
  'staffmark',
  'robert half',
  'aerotek',
  'spherion',
  'manpower',
  'randstad',
  'adecco',
  'hays',
  // Tech companies with well-documented ghost-posting history
  'amazon',  // note: high-volume, many phantom reqs
  'meta',
  'oracle',
  // Add more via community PRs
];
