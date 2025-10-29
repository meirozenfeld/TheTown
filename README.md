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

### Main\Login Screen
<p align="center">
  <br><sub>Sign in to join a game or create a new one.</sub>
</p>
<img width="1898" height="940" alt="main" src="https://github.com/user-attachments/assets/129a6484-e914-4bdd-9ed2-860725a11e7c" />

### Game Settings (Lobby)
<p align="center">
  <br><sub>Host configures roles, player count, and match options.</sub>
</p>
<img width="1891" height="942" alt="settings" src="https://github.com/user-attachments/assets/15c79355-1ca2-4c2b-9730-6d1183933716" />

### Roles Overview
<p align="center">
  <br><sub>All available roles and their win conditions.</sub>
</p>
<img width="1172" height="876" alt="אזרח" src="https://github.com/user-attachments/assets/fe7a10e1-6b95-4754-a9a9-65875936c670" />
<img width="1173" height="872" alt="זקן" src="https://github.com/user-attachments/assets/b4705e2c-7bb7-404b-94cf-26ed8028842d" />
<img width="1171" height="873" alt="זאב" src="https://github.com/user-attachments/assets/d4658189-356a-4f8d-a889-ebafb30d5ac0" />
<img width="1170" height="871" alt="עלוקה" src="https://github.com/user-attachments/assets/2538677c-1d42-4728-9c23-f89a01423bdf" />
<img width="1171" height="872" alt="קופידון" src="https://github.com/user-attachments/assets/6ba704e1-094a-4723-a6f5-43575c628383" />
<img width="1175" height="872" alt="מגדת עתידות" src="https://github.com/user-attachments/assets/7e49dba9-9c04-421a-8761-4d7372a096d0" />
<img width="1172" height="875" alt="מכשפה" src="https://github.com/user-attachments/assets/fc889225-02b6-415e-824f-031c00d630d7" />
<img width="1172" height="872" alt="מגן" src="https://github.com/user-attachments/assets/0b73f4fc-39d3-419e-b00a-15de6db715dd" />

### Night Roles in Action
<p align="center">
  <br><sub>Sample of night abilities (e.g., Wolves, Elder, Guardian).</sub>
</p>
<img width="1172" height="846" alt="זקן לילה" src="https://github.com/user-attachments/assets/5f086877-217e-4b0a-8ae4-9e9a3be95e82" />
<img width="876" height="812" alt="זאב לילה" src="https://github.com/user-attachments/assets/7b878d08-cc43-4b16-bea0-19e7cc98b63b" />
<img width="1172" height="863" alt="מגן לילה" src="https://github.com/user-attachments/assets/1b6d7b0c-ad48-4ece-9e88-be327e9cf7e2" />
<img width="1171" height="872" alt="בוקר" src="https://github.com/user-attachments/assets/a48870fe-c7c9-4828-bd18-60cba175deb6" />

### Mayor Election
<p align="center">
  <br><sub>Players vote to elect a mayor with tie-breaking power.</sub>
</p>
<img width="1172" height="858" alt="בחירת ראש עיר" src="https://github.com/user-attachments/assets/b5264c5b-9706-42d8-97c9-bb0ed09b6e9a" />
<img width="1173" height="872" alt="ראש העיר הנבחר" src="https://github.com/user-attachments/assets/09bd74e3-d89e-4b34-bf9c-0ee72bdbf3d5" />

### Daytime Voting
<p align="center">
  <br><sub>Public discussion and vote to eliminate one player.</sub>
</p>
<img width="1171" height="875" alt="בחירה בבוקר" src="https://github.com/user-attachments/assets/a509ee3f-014f-41f8-b836-ea218e010842" />

### Player Elimination
<p align="center">
  <br><sub>Eliminated player screen and status update to the town.</sub>
</p>
<img width="1172" height="872" alt="שחקן יצא" src="https://github.com/user-attachments/assets/20b27399-3b83-4b17-9a7d-7cce397d6f3f" />

### Lovers Chosen by Cupid
<p align="center">
  <br><sub>Two players linked as Lovers—shared fate and special win path.</sub>
</p>
<img width="1170" height="873" alt="נאהב" src="https://github.com/user-attachments/assets/a6bd88ff-4e30-4277-b04a-29917fa0fcee" />

### Game Over (Endgame Summary)
<p align="center">
  <br><sub>Final results showing the winning team and key events.</sub>
</p>
<img width="1173" height="875" alt="סוף משחק" src="https://github.com/user-attachments/assets/6c9dd898-c3d1-4f51-a2ac-c8a5cd7dd92d" />



