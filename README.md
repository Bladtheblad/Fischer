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
| 2. Authentication across 3 VMs (FE, BE, DB), hashing, UFW | Nov 24, 2026 | Not started |
| 3. Full functionality, email verification, logging | Dec 8, 2026 | Not started |

## Architecture

| VM | Role | Software |
| --- | --- | --- |
| Front end | Serves the website; the only VM reachable from outside | nginx |
| Back end | REST API, authentication, Deck of Cards API calls | Node.js, Express |
| Database | Users, sessions, trainer scores | MongoDB |
| Monitoring | System and custom logs | rsyslog |

All VMs sit on a private VLAN, with UFW firewall rules on each one.

## Repository layout

```
fischer/
├── frontend/              Static site served by nginx (Milestone 1)
│   ├── index.html         Home page
│   ├── login.html         Login page
│   ├── register.html      Register page
│   ├── css/style.css      Shared styles
│   ├── js/forms.js        Client-side form validation
│   └── img/favicon.svg
├── deploy/
│   ├── nginx/fischer.conf nginx site config for the front-end VM
│   └── deploy.sh          Copies the site into /var/www/fischer
└── docs/
    └── milestone-1-setup.md  VM, nginx, GitHub, and Trello setup steps
```

## Run it locally

Open `frontend/index.html` in a browser. No build step is needed.

## Deploy to the front-end VM

On an Ubuntu Server VM with nginx installed:

```bash
git clone https://github.com/<your-username>/fischer.git
cd fischer
sudo ./deploy/deploy.sh
```

Full instructions are in [docs/milestone-1-setup.md](docs/milestone-1-setup.md).

## AI usage

As required by the course guidelines:

- **Claude (Anthropic)** helped brainstorm the project, draft the proposal, and generate the page mockups.
- **Claude** generated the initial HTML, CSS, and JavaScript for the Home, Login, and Register pages, plus the nginx config and deploy script. I reviewed, tested, and deployed the code.

Later AI-assisted work will be listed here and noted in commit messages.
