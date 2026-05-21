window.GhostGuard = window.GhostGuard || {};
window.GhostGuard.data = window.GhostGuard.data || {};

// Staffing agencies and firms with documented patterns of ghost posting.
// Sources: r/recruitinghell, Blind, Glassdoor "fake postings" reviews.
// Entries use whole-word matching in scorer.js — be specific enough to avoid false positives.
// Contributions welcome via GitHub PR (include a source link).
GhostGuard.data.knownGhosters = [
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
  // Removed: 'amazon', 'meta', 'oracle' — too generic, caused false positives
  // on companies like "Metamorphic", "Amazonian Ventures", "Oracle Hospitality".
  // Add specific subsidiaries or BPO arms if evidence warrants.
];
