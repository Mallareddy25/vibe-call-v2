# VibeCall 📹

A cutting-edge, full-stack real-time video calling platform engineered with a high-fidelity YouTube-style interface. Built for seamless, uninterrupted communication with integrated monetization tiers, recording features, and gesture controls.

## 🚀 Key Features
- **Real-Time WebRTC Video Calling:** Low-latency peer-to-peer video architecture powered by Socket.io.
- **Picture-in-Picture (PiP) Multitasking:** Seamlessly minimize active calls into a draggable floating window while navigating the dashboard.
- **YouTube-Style Dashboard Architecture:** Intuitive, heavily stylized dark-mode UI with dynamic category filtering and fluid animations.
- **Gesture Control System (Simulated):** Advanced UI interactions based on screen tap patterns to control video playback.
- **Tiered Monetization Engine:** Integrated Bronze, Silver, and Gold membership logic gating call durations and recording limits.
- **Server-Side Video Recording:** Capable of recording WebRTC streams directly to WebM format for local downloads.
- **Social Graph:** Fully integrated friend requests, accept/reject workflows, and dynamic "My Circle" mapping.

## 🛠️ Technology Stack
- **Frontend:** Next.js 14, React, Tailwind CSS, Lucide Icons, Redux Toolkit
- **Backend:** Node.js, Express.js, Socket.io (WebSockets)
- **Database / ORM:** SQLite, Sequelize ORM
- **Security:** JWT Authentication, Bcrypt Password Hashing

## ⚙️ Running Locally

### 1. Start the Backend
```bash
cd server
npm install
npm run dev
```

### 2. Start the Frontend
Open a new terminal window:
```bash
cd client
npm install
npm run dev
```
Navigate to `http://localhost:3000` to access the application.

## 📝 Architecture Notes
* **WebSockets vs Serverless:** The backend relies heavily on `socket.io` for WebRTC signaling. It must be deployed to a persistent container service (e.g., Render, Fly.io) rather than a serverless edge function.
* **Database Persistance:** The application uses SQLite. For production deployment on ephemeral file systems, mount a persistent volume or easily swap the Sequelize dialect to PostgreSQL.
