# GhostGuard — Spot Ghost Jobs Instantly

A free Chrome extension that automatically scores every job listing on LinkedIn, Indeed, and Glassdoor for legitimacy — flagging likely ghost jobs in real time.

> **Ghost jobs** are listings companies post with no real intent to hire. Up to 43% of online job postings are estimated to be ghost jobs.

---

## How it works

A small colored badge appears on every job card:

- 🟢 **Green (0–30)** — Likely a real, active listing  
- 🟡 **Yellow (31–60)** — Some warning signs, proceed with caution  
- 🔴 **Red (61–100)** — Likely a ghost job

Hover any badge to see the top signals. Click for the full breakdown.

## What gets checked (21 signals)

| Signal | Weight |
|---|---|
| Posted 90+ days ago | +35 |
| Posted 60–89 days ago | +25 |
| Reposted listing | +25 |
| No salary range | +15 |
| Salary range disclosed | −20 |
| Hiring manager visible | −15 |
| Known ghost-poster company | +20 |
| Low applicant flow | +20 |
| High applicant flow | −20 |
| "Competitive salary" phrase | +10 |
| Description < 200 words | +10 |
| Excessive experience for role level | +10 |
| External apply link | −10 |
| Specific tech stack (5+ tools) | −10 |
| Verified company badge | −10 |
| ... and 6 more | |

## Platforms

- LinkedIn (job search + detail pane + direct URLs)
- Indeed (search results + expanded detail)
- Glassdoor (job listings + detail view)

## Privacy

Everything runs locally in your browser. No data is collected, transmitted, or sold. No accounts. No analytics. No ads. See [PRIVACY.md](PRIVACY.md).

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `GhostGuard` folder
5. Browse LinkedIn, Indeed, or Glassdoor — badges appear automatically

Chrome Web Store listing coming soon.

## Contributing

- Add more tech keywords to [`src/data/tech-keywords.js`](src/data/tech-keywords.js)
- Add known ghost-poster companies to [`src/data/known-ghosters.js`](src/data/known-ghosters.js)
- Fix broken selectors in [`src/scrapers/`](src/scrapers/) when platforms update their DOM
- Run tests: `node test/scoring.test.js`

## License

MIT
