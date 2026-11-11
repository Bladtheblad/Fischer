# Milestone 1 setup guide

Milestone 1 (due **Nov 10, 2026**) needs:

- [ ] Home, Login, and Register pages in HTML + CSS
- [ ] Hosted on at least 1 VM
- [ ] GitHub repository updated
- [ ] Trello board updated

The pages are in `frontend/`. This guide covers the other three. Plan on about **1.5 to 2 hours** total, most of it waiting for the Ubuntu install.

**Recommended order:** Trello first (5 minutes, so your board shows the work as it happens), then GitHub, then the VM.

---

## Part 1 — Trello (about 10 minutes)

Trello is 30% of the grade, and graders look at *when* cards moved, so set it up before you do the rest.

1. Go to [trello.com](https://trello.com) and create a board named **Fischer**.
2. Create four lists: **Backlog**, **To-Do**, **In Progress**, **Completed**.
3. Add these cards to **To-Do**, assign yourself to each, and set the due date to **Nov 10**:

| Card | Checklist items |
| --- | --- |
| M1: Build Home page | HTML structure · CSS styling · Responsive layout |
| M1: Build Login page | Form fields · Client-side validation · Link to Register |
| M1: Build Register page | Form fields · Password strength meter · Validation |
| M1: Set up GitHub repo | Create repo · Push front end · Write README |
| M1: Create front-end VM | Install Ubuntu Server · Install nginx · Configure UFW |
| M1: Deploy site to VM | Clone repo · Run deploy script · Test in browser |

4. Add these cards to **Backlog** (no dates yet):
   - M2: Create back-end VM (Node.js + Express)
   - M2: Create database VM (MongoDB)
   - M2: Set up VLAN between VMs
   - M2: UFW rules between all VMs
   - M2: Register + login API with bcrypt hashing
   - M2: Connect front-end forms to API
   - M3: Email verification
   - M3: Custom logging + monitoring VM
   - M3: Bankroll Stats Engine
   - M3: Monte Carlo Equity Calculator
   - M3: Pascal Preflop Trainer
5. **As you work tonight**, move each card to **In Progress** when you start it and **Completed** when you finish, and leave a short comment on each one (for example, "Pushed pages to GitHub, commit a1b2c3d"). Those comments are your evidence of steady work.

---

## Part 2 — GitHub (about 10 minutes)

### Create the repository

1. On [github.com](https://github.com), click **New repository**.
2. Name it `fischer`, set it to **Public** (good for your portfolio), and **don't** add a README (one is included).
3. Click **Create repository**.

### Push the code from your computer

Unzip the project, open a terminal in the `fischer` folder, and run:

```bash
git init
git add .
git commit -m "Milestone 1: Home, Login, and Register pages"
git branch -M main
git remote add origin https://github.com/<your-username>/fischer.git
git push -u origin main
```

If Git asks for a password, use a **personal access token**, not your GitHub password: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token, with the `repo` scope checked.

> Commit often from here on. Small commits with clear messages show steady progress, just like Trello.

---

## Part 3 — Front-end VM (about 1 hour)

### 3.1 Create the VM

Download the **Ubuntu Server 24.04 LTS** ISO from [ubuntu.com/download/server](https://ubuntu.com/download/server), then create a VM in VirtualBox or VMware:

| Setting | Value |
| --- | --- |
| Name | `fischer-frontend` |
| Memory | 2 GB |
| CPUs | 1–2 |
| Disk | 20 GB |
| Network adapter | **Bridged** (so your computer's browser can reach it) |

> **Why Bridged?** It gives the VM its own IP on your home network, so you can open the site from your laptop's browser. In Milestone 2 you'll add a second adapter on the private VLAN (an internal network) for the back-end and database VMs.
>
> If Bridged doesn't work (common on campus Wi-Fi), use **NAT** and add a port-forwarding rule: host port `8080` → guest port `80`. Then the site is at `http://localhost:8080`.

During the Ubuntu install:

- Username: something like `fischer`
- Check **Install OpenSSH server** (lets you SSH in from your laptop instead of typing in the VM window)
- Skip the extra snaps

### 3.2 Update the system and install nginx

Log in to the VM and run:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git rsync
sudo systemctl enable --now nginx
```

### 3.3 Turn on the firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx HTTP'
sudo ufw enable
sudo ufw status verbose
```

You should see `22/tcp` and `80/tcp` allowed. (UFW is a Milestone 2 requirement, but starting it now is good practice.)

### 3.4 Clone the repo and deploy

```bash
cd ~
git clone https://github.com/<your-username>/fischer.git
cd fischer
chmod +x deploy/deploy.sh

# Install the nginx site config
sudo cp deploy/nginx/fischer.conf /etc/nginx/sites-available/fischer
sudo ln -s /etc/nginx/sites-available/fischer /etc/nginx/sites-enabled/fischer
sudo rm -f /etc/nginx/sites-enabled/default

# Copy the site into place and reload nginx
sudo ./deploy/deploy.sh
```

The script ends by printing the VM's address, for example `Done. Visit http://192.168.1.42/`.

### 3.5 Test it

1. On your laptop, open the address the script printed (or `http://localhost:8080` if you used NAT).
2. Click through Home → Sign up → Log in, and try submitting the forms empty to see the validation.
3. Take screenshots of all three pages running from the VM's IP. These are your proof for the milestone.

### 3.6 Take a snapshot

In VirtualBox or VMware, take a snapshot named **"M1 working"**. If anything breaks later, you can roll back in seconds.

### Updating the site later

After you push changes to GitHub:

```bash
cd ~/fischer
git pull
sudo ./deploy/deploy.sh
```

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Browser can't reach the VM | Run `ip a` in the VM and check you're using the right IP. Run `sudo ufw status` to confirm port 80 is allowed. Try NAT + port forwarding if Bridged won't connect. |
| nginx default "Welcome" page shows | The default site is still enabled: `sudo rm /etc/nginx/sites-enabled/default && sudo systemctl reload nginx` |
| `nginx -t` fails | Read the line number in the error; usually a typo in the config file |
| 403 Forbidden | Rerun `sudo ./deploy/deploy.sh`, which fixes file permissions |
| Page loads without styling | Check that `/var/www/fischer/css/style.css` exists: `ls -R /var/www/fischer` |
| Check nginx logs | `sudo tail -f /var/log/nginx/fischer_error.log` |

---

## Milestone 1 checklist

- [ ] Trello board created with all M1 cards moved to **Completed**, with comments
- [ ] GitHub repo `fischer` contains `frontend/`, `README.md`, and `deploy/`
- [ ] Ubuntu Server VM running nginx with UFW enabled
- [ ] All three pages load from the VM's IP address
- [ ] Screenshots saved, and VM snapshot taken
