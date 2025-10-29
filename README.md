The Town — Real-time Social Deduction Game (Werewolf/Mafia-style)

A real-time, multi-player social deduction game inspired by Mafia/Werewolf, with richer roles and night/day cycles. Players bluff, vote, and use role powers until either the villagers eliminate all wolves or the wolves overrun the town.

Live stack: React (client) + Node.js/Express + Socket.IO (server)
Deploy: Render (server + static client)

🎮 Gameplay (High-level)

Cycles: Night ↔ Day.

Night: Wolves choose a victim; special roles may act (e.g., Seer, Witch, Guardian).

Day: Discussion + public vote to eliminate one player.

Win conditions:

Villagers’ team: No wolves remain.

Wolves’ team: Wolves reach parity with non-wolves.

Roles included: Elder, Wolves, Cupid, Witch, Guardian, Seer, Hunter, Leech, Villagers.
(You can adjust role availability and counts in the server logic.)

✨ Features

🔌 Real-time gameplay with Socket.IO

👥 Multiple roles & powers influencing balance and flow

🌓 Night/Day phases with private vs. public actions

🗳️ Discussion & voting system

🔒 Server-side authority for actions, validations, and state

🚀 Deployed on Render (server API + client hosting)

🧱 Tech Stack

Client: React + Vite

Server: Node.js, Express, Socket.IO

Transport: WebSocket (fallbacks via Socket.IO)

Hosting: Render (server & client)
