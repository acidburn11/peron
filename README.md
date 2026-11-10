# Peron

Ad-free public transport planner for Europe, built as a PWA for iPhone. Romanian and English UI.

Data: [Transitous](https://transitous.org/sources/) (MOTIS API). Map: © OpenStreetMap contributors.
Personal, non-commercial use, following the [Transitous API policy](https://transitous.org/api/).

- `index.html`, `app.js`, `style.css`, `sw.js`: the app (GitHub Pages)
- `config.js`: URL of the push server
- `worker/`: Cloudflare Worker + Durable Object that sends lock screen notifications (Web Push)
