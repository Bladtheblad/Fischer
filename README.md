# Fischer

**Play the math, not the cards.**

Fischer is a poker training and bankroll platform built for IT 340 (Intro to Systems Administration) at NJIT. It runs as a full-stack web app deployed across Ubuntu Server virtual machines on a private VLAN.

| Feature | What it does |
| --- | --- |
| **Bankroll Stats Engine** | Logs sessions and reports win rate with a 95% confidence interval, standard deviation, and risk of ruin |
| **Monte Carlo Equity Calculator** | Simulates 10,000+ deals to show how often each hand wins, using a hand evaluator written from scratch |
| **Pascal Preflop Trainer** | Deals a hand and position, scores the user's decision, and tracks accuracy over time |

Fischer is for study and tracking only. It involves no real-money play.

## Project status

| Milestone | Due | Status |
| --- | --- | --- |
| 1. Front end: Home, Login, Register pages hosted on 1 VM | Nov 10, 2026 | ✅ Done |
| 2. Accounts and login across 3 VMs on a VLAN, password hashing, UFW, basic logs | Nov 24, 2026 | ✅ Done |
| 3. Full functionality, email verification, custom logging | Dec 8, 2026 | Not started |

## Architecture

```
Browser ──► fischer-frontend 10.10.0.10 ──► fischer-backend 10.10.0.20 ──► fischer-database 10.10.0.30
            nginx: pages + /api proxy         Node.js + Express API            MongoDB 9.0 (auth on)
```

| VM | Role | Software | Firewall (UFW) accepts |
| --- | --- | --- | --- |
| Front end | Serves pages, forwards `/api` to the back end; the only VM reachable from outside | nginx | SSH, HTTP |
| Back end | REST API: register, login, sessions | Node.js, Express, MongoDB driver | API (3000) and SSH from the front end only |
| Database | Stores users and sessions | MongoDB 9.0 | MongoDB (27017) from the back end; SSH from the front end |
| Monitoring | System and custom logs (Milestone 3) | rsyslog | — |

The VMs share a VirtualBox internal network (`fischer-vlan`, 10.10.0.0/24).

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create an account: `firstName`, `lastName`, `username`, `email`, `password` |
| POST | `/api/auth/login` | Log in with `identifier` (username or email) and `password`; sets a session cookie |
| POST | `/api/auth/logout` | End the session |
| GET | `/api/auth/me` | The logged-in user |

## Security

- Passwords hashed with **scrypt** (built into Node.js), with a random salt per password
- Session tokens in **HttpOnly, SameSite=Strict** cookies; only a SHA-256 hash of each token is stored
- Server-side validation; every field must be a plain string, which blocks **NoSQL injection**
- Login and registration **rate-limited** per IP
- MongoDB **authentication on**, with a least-privilege app user; the database listens only on the VLAN
- API runs as an unprivileged `fischer-api` system user under systemd hardening
- **UFW** on every VM allows only the connections each VM needs

## Repository layout

```
fischer/
├── frontend/                 Static site served by nginx
│   ├── index.html, login.html, register.html, dashboard.html
│   ├── css/style.css
│   └── js/forms.js, js/dashboard.js
├── backend/                  Node.js + Express API
│   ├── src/                  server, routes, hashing, sessions, validation
│   └── test/                 automated tests (npm test)
├── deploy/                   Setup scripts for each VM
│   ├── vm-init.sh            hostname + static VLAN IP
│   ├── firewall.sh           UFW rules per VM
│   ├── database-setup.sh     MongoDB install + users + authentication
│   ├── backend-deploy.sh     API install as a systemd service
│   ├── frontend-deploy.sh    nginx config + pages
│   ├── status.sh             health check for any VM
│   ├── nginx/fischer.conf
│   └── systemd/fischer-api.service
└── docs/
    ├── milestone-1-setup.md
    └── milestone-2-setup.md
```

## Run the tests

```bash
cd backend
npm install
npm test
```

The tests use an in-memory stand-in for MongoDB, so they run anywhere.

## Deploy

Step-by-step instructions: [docs/milestone-2-setup.md](docs/milestone-2-setup.md).

## AI usage

As required by the course guidelines:

- **Claude (Anthropic)** helped brainstorm the project, draft the proposal, and generate the page mockups.
- **Milestone 1:** Claude generated the initial HTML, CSS, and JavaScript for the Home, Login, and Register pages, plus the nginx config and deploy script.
- **Milestone 2:** Claude generated the back-end API (Express routes, scrypt hashing, sessions, validation, tests), the dashboard page, the front-end API integration, the MongoDB schema and indexes, and the VM setup scripts (VLAN, UFW, MongoDB, systemd).

I reviewed, tested, deployed, and configured everything on my VMs. Later AI-assisted work will be listed here and noted in commit messages.
