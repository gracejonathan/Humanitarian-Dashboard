# Global Humanitarian Crisis Dashboard

A GitHub-ready static web dashboard for monitoring humanitarian crises using public humanitarian data.

## What this repository contains

- `index.html` — dashboard UI
- `styles.css` — visual design
- `app.js` — browser-side data loading and rendering
- `data/crises.json` — curated crisis registry containing crisis start dates, classifications and Christian-presence evidence
- `.github/workflows/validate.yml` — basic repository validation

## Important architecture

The site does **not** use AI search.

The browser loads the curated crisis registry and then attempts to connect directly to the public OCHA Humanitarian Programme Cycle API.

The dashboard explicitly reports:

- which source it is contacting
- whether the HTTP request succeeds
- how many plans are discovered
- whether a current PIN value is returned
- which countries have live data
- which records are falling back to source-backed metadata

This prevents an unavailable API from being mistaken for current data.

## GitHub Pages

1. Create a GitHub repository.
2. Upload all files while preserving the directory structure.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`.
5. Save.

The site will be served from `index.html`.

## Important limitation

GitHub Pages is a static hosting platform. The browser therefore calls the public APIs directly.

If an API does not allow browser CORS requests, the dashboard will report that failure. That is intentional.

For a production system, the next architecture should use a scheduled GitHub Action or serverless function to collect and normalize OCHA/UNHCR/ReliefWeb data into a versioned JSON file. The public dashboard would then read the normalized data rather than depending on browser-to-API connections.

## Christian presence

Christian presence is deliberately maintained separately from humanitarian need.

The dashboard should never infer:

> no humanitarian source mentioning Christians = no Christian presence.

The production evidence model should contain:

- presence status
- local churches/organizations where documented
- source
- publication date
- verification date
- confidence
- notes

This field is intended to support humanitarian situational awareness, not to rank religious communities.

## Data quality rule

Every numerical humanitarian figure should eventually retain:

- value
- unit
- population/year
- source organization
- source report
- source URL
- publication date
- retrieval date
- methodology
- geographic scope

Never silently replace an old value with a new value without retaining the source history.
