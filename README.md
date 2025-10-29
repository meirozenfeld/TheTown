# The Town — Real-time Social Deduction Game (Werewolf/Mafia-style)

A real-time, multi-player social deduction game inspired by **Mafia/Werewolf**, with richer roles and night/day cycles. Players bluff, vote, and use role powers until either the villagers eliminate all wolves or the wolves overrun the town.

**Live stack:** React (client) · Node.js/Express · Socket.IO<br>
**Deploy:** Render (server + static client)

---

## 🎮 Gameplay (High-level)

- **Cycles:** Night ↔ Day
  - **Night:** Wolves choose a victim; special roles may act (e.g., **Seer**, **Witch**, **Guardian**).
  - **Day:** Discussion + public **vote** to eliminate one player.
- **Win conditions:**
  - **Villagers’ team:** No wolves remain.
  - **Wolves’ team:** Wolves reach parity with non-wolves.
- **Roles included:** **Elder**, **Wolves**, **Cupid**, **Witch**, **Guardian**, **Seer**, **Hunter**, **Leech**, **Villagers**.<br>
  <sub>*(Role availability/counts can be adjusted in server logic.)*</sub>

---

## ✨ Features

- 🔌 Real-time gameplay with **Socket.IO**
- 👥 Multiple **roles & powers** shaping balance and flow
- 🌓 **Night/Day phases** with private vs. public actions
- 🗳️ **Discussion & voting** system
- 🔒 **Server-side authority** for actions, validations, and state
- 🚀 Deployed on **Render** (server API + client hosting)

---

## 🧱 Tech Stack

- **Client:** React + Vite  
- **Server:** Node.js, Express, Socket.IO  
- **Transport:** WebSocket (via Socket.IO)  
- **Hosting:** Render (server & client)

---

## 🖼️ Screenshots

### Login Screen  <!-- מסך כניסה -->
<p align="center">
  <img src="docs/screenshots/login.png" alt="Login screen to join or create a game" width="720">
  <br><sub>Sign in to join a game or create a new one.</sub>
</p>
<img width="1898" height="940" alt="main" src="https://github.com/user-attachments/assets/129a6484-e914-4bdd-9ed2-860725a11e7c" />

### Game Settings (Lobby)
<p align="center">
  <img src="docs/screenshots/lobby-settings.png" alt="Lobby settings with role toggles and match options" width="720">
  <br><sub>Host configures roles, player count, and match options.</sub>
</p>
<img width="1891" height="942" alt="settings" src="https://github.com/user-attachments/assets/15c79355-1ca2-4c2b-9730-6d1183933716" />

### Roles Overview
<p align="center">
  <img src="docs/screenshots/roles-overview.png" alt="List of available roles and brief descriptions" width="720">
  <br><sub>All available roles and their win conditions.</sub>
</p>

### Night Roles in Action
<p align="center">
  <img src="docs/screenshots/night-actions.png" alt="Night phase actions: Wolves, Seer, Witch, Guardian" width="720">
  <br><sub>Sample of night abilities (e.g., Wolves, Seer, Witch, Guardian).</sub>
</p>

### Mayor Election
<p align="center">
  <img src="docs/screenshots/mayor-election.png" alt="Vote interface for electing a mayor" width="720">
  <br><sub>Players vote to elect a mayor with tie-breaking power.</sub>
</p>

### Daytime Voting
<p align="center">
  <img src="docs/screenshots/day-vote.png" alt="Public discussion and vote to eliminate a suspect" width="720">
  <br><sub>Public discussion and vote to eliminate one player.</sub>
</p>

### Player Elimination
<p align="center">
  <img src="docs/screenshots/elimination.png" alt="Eliminated player screen and town status update" width="720">
  <br><sub>Eliminated player screen and status update to the town.</sub>
</p>

### Lovers Chosen by Cupid
<p align="center">
  <img src="docs/screenshots/cupid-lovers.png" alt="Two players linked as Lovers by Cupid" width="720">
  <br><sub>Two players linked as Lovers—shared fate and special win path.</sub>
</p>

### Game Over (Endgame Summary)
<p align="center">
  <img src="docs/screenshots/game-over.png" alt="Final results with winning team and key events" width="720">
  <br><sub>Final results showing the winning team and key events.</sub>
</p>



