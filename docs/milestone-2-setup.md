# Milestone 2 setup guide

**Due: Nov 24, 2026.** Plan on about **2–3 hours**, mostly waiting for installs.

Milestone 2 requires:

- [ ] Create an account and sign in
- [ ] Hosted on at least 3 VMs on a VLAN (front end, back end, database)
- [ ] Basic security: no SQL/NoSQL injection, password hashing, UFW firewall
- [ ] Basic system logs
- [ ] Trello + GitHub updated

## What you're building

```
                 Your laptop's browser
                         │  http://localhost:8080
                         ▼
┌──────────────────── VirtualBox internal network "fischer-vlan" (10.10.0.0/24) ───────────────────┐
│                                                                                                   │
│   fischer-frontend 10.10.0.10      fischer-backend 10.10.0.20       fischer-database 10.10.0.30   │
│   nginx: pages + /api proxy  ───►  Node.js + Express API  ───►     MongoDB 9.0 (auth on)          │
│   UFW: 22, 80 from anywhere        UFW: 3000, 22 from FE only       UFW: 27017 from BE, 22 from FE │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| VM | VLAN IP | Runs | Internet |
| --- | --- | --- | --- |
| fischer-frontend | 10.10.0.10 | nginx (pages + reverse proxy) | NAT with port forwards: the only VM you can reach from outside |
| fischer-backend | 10.10.0.20 | Node.js API as a systemd service | NAT outbound only (no port forwards), for npm and later the Deck of Cards API |
| fischer-database | 10.10.0.30 | MongoDB | Disconnected after setup: fully private |

The browser only ever talks to the front end. nginx forwards `/api/...` requests to the back end, and only the back end talks to the database.

**Each VM is set up by running scripts from the repo**, so you mostly paste short commands:

| Script | Runs on | What it does |
| --- | --- | --- |
| `deploy/vm-init.sh <role>` | each VM | Hostname, static VLAN IP, new identity for clones |
| `deploy/firewall.sh <role>` | each VM | UFW rules for that VM |
| `deploy/database-setup.sh` | database | Installs MongoDB, creates users, turns on authentication |
| `deploy/backend-deploy.sh` | back end | Installs Node.js, installs the API as the `fischer-api` service |
| `deploy/frontend-deploy.sh` | front end | Installs the nginx config and copies the pages |
| `deploy/status.sh` | any VM | Health check: services, firewall, what it can and can't reach |

---

## Part 0 — Trello (5 minutes)

Move these Backlog cards to **In Progress** now, and to **Completed** as you finish each part. Add a short comment each time.

- M2: Create back-end VM (Node.js + Express)
- M2: Create database VM (MongoDB)
- M2: Set up VLAN between VMs
- M2: UFW rules between all VMs
- M2: Register + login API with password hashing
- M2: Connect front-end forms to API

Also add a new card: **M2: Basic system logs**.

---

## Part 1 — Put the new code on GitHub (10 minutes, on your laptop)

1. Download **fischer-milestone-2.zip**, right-click it → **Extract All** → **Extract** (into Downloads).
2. Copy the new files over your existing project folder. In Command Prompt:
   ```
   robocopy "%USERPROFILE%\Downloads\fischer-milestone-2\fischer" "%USERPROFILE%\Downloads\fischer-milestone-1\fischer" /E
   ```
3. Commit and push:
   ```
   cd %USERPROFILE%\Downloads\fischer-milestone-1\fischer
   git add -A
   git commit -m "Milestone 2: back-end API, MongoDB, VLAN, firewall scripts"
   git push
   ```
4. Check github.com/Bladtheblad/fischer. You should now see a `backend` folder.

---

## Part 2 — Create the other two VMs (20 minutes, in VirtualBox)

You'll **clone** your front-end VM instead of installing Ubuntu two more times. The clones already have Ubuntu, your user account, git, and the repo.

### 2.1 Snapshot and shut down

1. If the front-end VM is running, SSH in and run `sudo shutdown now`.
2. Select **Fisher-frontend** → **Snapshots** → **Take** → name it `Before M2`.

### 2.2 Clone it twice

1. Right-click **Fisher-frontend** → **Clone...**
2. **Name:** `fischer-backend`
3. **MAC Address Policy:** **Generate new MAC addresses for all network adapters**
4. **Clone type:** **Full clone** (if asked about snapshots, choose **Current machine state**)
5. Click **Finish** and wait.
6. Repeat with the name `fischer-database`.

### 2.3 Memory

Check your laptop's RAM in **Task Manager → Performance → Memory**.

| Laptop RAM | Front end | Back end | Database |
| --- | --- | --- | --- |
| 16 GB or more | 1024 MB | 1536 MB | 2048 MB |
| 8 GB | 1024 MB | 1024 MB | 1024 MB |

Set it in each VM's **Settings → System → Base Memory**.

### 2.4 Network adapters (this is the VLAN)

A VirtualBox **Internal Network** is a private virtual switch: only VMs attached to the same network name can talk to each other, and nothing outside can see it. That's your VLAN.

**For all three VMs:** **Settings → Network → Adapter 2**
- ✅ **Enable Network Adapter**
- **Attached to:** **Internal Network**
- **Name:** type `fischer-vlan`. It must be spelled exactly the same on all three.

**For `fischer-backend` and `fischer-database` only:** **Adapter 1** stays **NAT**, but open **Advanced → Port Forwarding** and **delete both rules** (web and ssh). The clones copied them from the front end, and two VMs can't use the same laptop ports.

**For `Fisher-frontend`:** leave Adapter 1 as **NAT** with its two port-forwarding rules (8080 → 80, 2222 → 22).

---

## Part 3 — Front-end VM (5 minutes)

1. Start **Fisher-frontend** and wait about a minute.
2. On your laptop, open Command Prompt and connect:
   ```
   ssh -p 2222 bladimir@localhost
   ```
3. Get the new code and set up the VLAN and firewall:
   ```
   cd ~/fischer && git fetch && git reset --hard origin/main
   sudo bash deploy/vm-init.sh frontend
   sudo bash deploy/firewall.sh frontend
   ```
   `vm-init` should end with **`fischer-frontend at 10.10.0.10`**. The firewall should list **22/tcp** and **80/tcp** as ALLOW.

   `git fetch && git reset --hard origin/main` makes the VM's copy exactly match GitHub. It's safer than `git pull` here, which can refuse if a file changed on the VM (for example, from `chmod` in Milestone 1). Never edit code on the VMs; edit on your laptop, push, then run this.

Leave this window open, and leave the VM running for the rest of the setup.

---

## Part 4 — Database VM (15 minutes)

### 4.1 Give it its VLAN address (in the VirtualBox window)

1. Start **fischer-database**. Log in **in its VirtualBox window**. You can't SSH to it yet.
2. Type:
   ```
   cd ~/fischer && git fetch && git reset --hard origin/main
   sudo bash deploy/vm-init.sh database
   ```
   It should end with **`fischer-database at 10.10.0.30`**.

### 4.2 SSH in through the front end

From now on, use SSH so you can copy and paste. Open a **new** Command Prompt on your laptop:
```
ssh -J bladimir@localhost:2222 bladimir@10.10.0.30
```
`-J` means "jump through the front end." Your laptop can't reach the VLAN directly, so SSH hops through the front-end VM. You'll be asked for your password twice (front end, then database), and to type `yes` for the new VM.

### 4.3 Install MongoDB

```
cd ~/fischer
sudo bash deploy/database-setup.sh
```
This takes 3–5 minutes. At the end, it prints a box with a line starting with **`mongodb://fischer_app:...`**.

**Copy that whole line** (select it, then right-click) and paste it into Notepad. The back end needs it in Part 5. If you lose it, run `sudo cat /root/fischer-db-credentials.txt`.

### 4.4 Firewall

```
sudo bash deploy/firewall.sh database
```
Expect **27017 ALLOW from 10.10.0.20** and **22 ALLOW from 10.10.0.10**.

---

## Part 5 — Back-end VM (10 minutes)

### 5.1 VLAN address (in the VirtualBox window)

Start **fischer-backend**, log in **in its VirtualBox window**, and type:
```
cd ~/fischer && git fetch && git reset --hard origin/main
sudo bash deploy/vm-init.sh backend
```
It should end with **`fischer-backend at 10.10.0.20`**.

### 5.2 SSH in and install the API

New Command Prompt on your laptop:
```
ssh -J bladimir@localhost:2222 bladimir@10.10.0.20
```
Then:
```
cd ~/fischer
sudo bash deploy/backend-deploy.sh
```
When it asks **"Paste the MONGO_URI..."**, right-click to paste the line from Notepad and press **Enter**.

It should end with:
```
Fischer API is running:  {"ok":true,"service":"fischer-api"}
```

### 5.3 Firewall

```
sudo bash deploy/firewall.sh backend
```
Expect **3000 ALLOW from 10.10.0.10** and **22 ALLOW from 10.10.0.10**.

---

## Part 6 — Deploy the front end and try it (5 minutes)

In the **front-end** SSH window:
```
cd ~/fischer
sudo bash deploy/frontend-deploy.sh
```
The last line should show `{"ok":true,"service":"fischer-api"}`. That's the front end reaching the back end over the VLAN.

Now in your browser, go to **http://localhost:8080**:

1. Click **Sign up** and create an account.
2. You land on the **Log in** page with "Account created!" Log in.
3. You should see **"Welcome, [your name]."** on the dashboard.
4. Click **Log out**. Going to `localhost:8080/dashboard.html` should send you back to the login page.

🎉 That's the core of Milestone 2.

---

## Part 7 — Make the database private (2 minutes)

The database needed internet only to download MongoDB. Cut it off:

1. In the **fischer-database** VirtualBox window: **Devices → Network → uncheck "Connect Network Adapter 1"**.
2. In the database SSH window:
   ```
   sudo netplan apply
   sudo bash ~/fischer/deploy/status.sh
   ```
   You should see **"No internet route: the database is private."**
3. Refresh the website and log in again. It still works, because the database only needs the VLAN.

> **About the back end's NAT adapter:** it's outbound-only. It has no port forwards, so nothing outside can connect to it, and UFW only accepts the front end. It stays connected because Milestone 3 calls the Deck of Cards API and sends verification emails. If your professor wants it fully private for now, disconnect it the same way; the site keeps working.

---

## Part 8 — Check everything (5 minutes)

Run this on **each** VM:
```
sudo bash ~/fischer/deploy/status.sh
```

| VM | You should see |
| --- | --- |
| Front end | nginx running ✔ · Back-end API reachable ✔ · **Database blocked, as it should be ✔** · API health `{"ok":true...}` |
| Back end | fischer-api running ✔ · MongoDB on the database VM reachable ✔ |
| Database | mongod running ✔ · listening on 10.10.0.30 ✔ · authentication ON ✔ · no internet route ✔ |

The front end being **blocked** from the database is the firewall doing its job. That's a great thing to show your professor.

Then take a snapshot of all three VMs named `M2 working`.

---

## Basic system logs

All of these are standard logs the system or service writes on its own.

| What | VM | Command |
| --- | --- | --- |
| Website visits | Front end | `sudo tail -n 20 /var/log/nginx/fischer_access.log` |
| nginx errors | Front end | `sudo tail -n 20 /var/log/nginx/fischer_error.log` |
| API requests and errors | Back end | `sudo journalctl -u fischer-api -n 30` |
| Database (connections, logins) | Database | `sudo tail -n 20 /var/log/mongodb/mongod.log` |
| Firewall blocks | Any | `sudo journalctl -k --grep UFW -n 20` |
| SSH logins | Any | `sudo journalctl -u ssh -n 20` |

The API log shows the method, path, status code, time, and client IP for each request, for example `POST /api/auth/login 401 41ms ip=10.0.2.2`. **It never logs request bodies, so passwords never appear in any log.**

---

## Show the security features (for your demo)

**Passwords are hashed.** On the database VM:
```
sudo cat /root/fischer-db-credentials.txt
mongosh "PASTE-THE-MONGO_URI-HERE"
```
Keep the quotes around the URI.
Then inside mongosh:
```
db.users.find({}, { username: 1, passwordHash: 1 })
exit
```
Each `passwordHash` looks like `scrypt$16384$8$1$...`. The real password is never stored.

**The database requires a password.** On the database VM:
```
mongosh --eval 'db.getSiblingDB("fischer").users.findOne()'
```
→ an error saying the command **requires authentication**.

**NoSQL injection is blocked.** On the front-end VM:
```
curl -s -X POST http://localhost/api/auth/login -H "Content-Type: application/json" -d '{"identifier":{"$gt":""},"password":{"$gt":""}}'
```
→ `{"error":"Please fix the highlighted fields.",...}` (HTTP 400). The API only accepts plain text values, so a MongoDB operator like `$gt` can never reach a query.

**Login attempts are rate-limited.** Try logging in with a wrong password 11 times: the 11th says "Too many login attempts."

---

## How it works (for your presentation)

- **Reverse proxy:** the browser only talks to nginx on the front end. nginx forwards `/api/` to the back end at 10.10.0.20:3000, so the back end and database are never exposed.
- **Password hashing:** passwords are hashed with **scrypt**, which is built into Node.js (no extra library to approve). Each password gets a random 16-byte salt. scrypt is deliberately slow and memory-hungry, which makes guessing attacks expensive.
- **Sessions:** after login, the browser gets a random token in an **HttpOnly, SameSite=Strict** cookie. JavaScript can't read it, and other sites can't use it. The database stores only a SHA-256 hash of the token, and MongoDB deletes expired sessions automatically.
- **Injection protection:** every field is validated on the server and must be a plain string, which blocks NoSQL operator injection. Usernames and emails are unique via database indexes.
- **Least privilege:** the API runs as its own `fischer-api` system user with no login shell, under systemd hardening. The app's MongoDB user can only read and write the `fischer` database. Database credentials live in `/etc/fischer/api.env`, readable only by root and the service.
- **Firewall:** each VM accepts only the traffic it needs (see the diagram). The database accepts MongoDB connections only from the back end.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `git fetch` on a cloned VM: "Could not resolve host" | The clone's internet (Adapter 1, NAT) isn't up. Run `ip a`: `enp0s3` should show `inet 10.0.2.15`. If it doesn't, run `sudo netplan apply` and retry. |
| `vm-init`: "Couldn't tell which network card is the VLAN one" | Adapter 2 isn't enabled. Shut down the VM, enable Adapter 2 as Internal Network `fischer-vlan`, and rerun. |
| `ssh -J ...` times out | The target VM isn't running, `vm-init` wasn't run on it, or the network name isn't exactly `fischer-vlan` on all VMs. From the front end, try `ping -c 2 10.10.0.30`. |
| `ssh -J` says "REMOTE HOST IDENTIFICATION HAS CHANGED" | Run `ssh-keygen -R 10.10.0.30` (or `.20`) on your laptop, then retry. |
| `database-setup.sh` fails during `apt-get` | The database VM has no internet. Make sure Adapter 1 (NAT) is connected until setup finishes. |
| `database-setup.sh`: "MongoDB didn't start" | Run `sudo tail -n 30 /var/log/mongodb/mongod.log` and send me the output. |
| `backend-deploy.sh`: "The API didn't respond" with "Authentication failed" | The MONGO_URI was pasted wrong. Fix it with `sudo nano /etc/fischer/api.env`, then `sudo systemctl restart fischer-api`. |
| Same, with "Server selection timed out" | The back end can't reach MongoDB. Run `status.sh` on the database VM: is mongod running, and does the firewall allow 10.10.0.20? |
| Browser shows **502 Bad Gateway**, or forms say "Can't reach the server" | The back end is down or blocked. Run `status.sh` on the front end and back end. |
| `localhost:8080` doesn't load at all | Check the front end's port forwarding (8080 → 80) and that the VM is running. |
| At home with **Bridged** instead of NAT | Use the front end's IP instead of localhost: `ssh bladimir@192.168.1.253`, `ssh -J bladimir@192.168.1.253 bladimir@10.10.0.30`, and `http://192.168.1.253` |
