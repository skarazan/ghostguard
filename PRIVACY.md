# GhostGuard Privacy Policy

**Last updated: 2026-05-21**

GhostGuard does not collect, transmit, or store any of your data on remote servers.
Everything stays on your device.

---

## What we access

We read the rendered content of job listing pages you visit on LinkedIn, Indeed, and Glassdoor
in order to score them for potential ghost-job signals. This processing happens entirely in your
browser and **no data ever leaves your device**.

Specifically, we read:
- Job title, company name, location
- Posting date and "reposted" indicators
- Applicant count (where shown)
- Salary text (where shown)
- Job description text (used for scoring only; not stored after scoring)
- Whether a hiring manager profile is visible
- Whether the job uses Easy Apply or an external link

We do **not** read:
- Your LinkedIn profile, connections, or messages
- Your Indeed or Glassdoor account information
- Any personally identifiable information about you
- Any recruiter's personal data beyond what is publicly visible in the listing

---

## What we store locally

All storage uses `chrome.storage.local` — data lives only in your browser profile
and is never transmitted externally.

| Key | Content | TTL |
|---|---|---|
| `gg_cache_<jobId>` | Score, tier, signal reasons, job title, company, days posted. **Raw description text is stripped before caching.** | 24 hours |
| `gg_session_stats` | Counts of green/yellow/red scores this session | Until reset |
| `gg_settings` | Your preferences (show badges, dim ghosts, ToS accepted) | Permanent |
| `gg_flags` | Jobs you flagged as inaccurately scored (title, company, score, reasons) | Permanent, capped at 500 entries |

---

## What we do not do

- No data is sent to any server (no analytics, no telemetry, no crash reporting)
- No user accounts or sign-in
- No advertising
- No sale or sharing of any data
- No collection of your browsing history beyond the job listing pages matched by the extension
- No screenshots or recording of page content
- No access to any page outside LinkedIn jobs, Indeed, and Glassdoor jobs

---

## Terms of Service notice

LinkedIn, Indeed, and Glassdoor's Terms of Service prohibit automated reading of their pages
by browser extensions. Using GhostGuard may violate those terms and could result in account
restrictions on those platforms. **You use this extension at your own risk.**

Under US federal law (_hiQ Labs v. LinkedIn_, 9th Cir. 2022), reading pages you have legitimate
access to is not a federal crime. GhostGuard does not bypass any login, CAPTCHA, or technical
access control.

---

## GDPR

GhostGuard processes data locally on your own device for your own personal job-search purposes.
This falls under the GDPR "household exemption" (Article 2(2)(c)) — no personal data is
transmitted to any third party, and we are not a data controller in respect of your usage.

If a future version adds any remote data features, this policy will be updated and you will
be asked to re-consent.

---

## Children

GhostGuard is not directed at children under 13 and does not knowingly process data from minors.

---

## Changes

Material changes to this policy will be noted in the extension's release notes and reflected
in the "Last updated" date above.

---

## Contact

Questions or concerns: https://github.com/skarazan/ghostguard/issues
