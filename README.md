# 🎓 EduStream — Online Coaching Platform

A full-stack real-time online coaching platform that enables teachers to conduct live classes, share materials, and create tests — while students join streams, interact via chat and whiteboard, and take timed assessments.

---

## ✨ Features

### 👩‍🏫 Teacher

- **Live Streaming** — Start WebRTC-based live video classes with real-time broadcasting to students.
- **Interactive Whiteboard** — Draw, annotate, and explain concepts on a synced whiteboard visible to all participants.
- **Class Management** — Schedule, start, and manage classes with topics, descriptions, and uploaded materials (images, videos, PDFs via Cloudinary).
- **Test Creation** — Upload question and answer-key files (TXT, JSON) to auto-generate MCQ tests with configurable durations.
- **Real-time Notifications** — Broadcast "Class is Live!" alerts to all connected students when a stream starts.

### 🧑‍🎓 Student

- **Join Live Classes** — Watch teacher streams in real-time with WebRTC peer connections.
- **Live Chat** — Send and receive messages during a live class session.
- **Whiteboard Viewing** — See the teacher's whiteboard annotations in real-time.
- **Take Tests** — Attempt timed MCQ tests, auto-submit on expiry, view scores, and retake tests.
- **Class Notifications** — Receive instant notifications when a teacher goes live.

### 🔐 Authentication

- **Google OAuth 2.0** — One-click sign-in with Google.
- **Email & Password** — Traditional signup/login with bcrypt-hashed passwords.
- **JWT Sessions** — Secure, token-based authentication with 7-day expiry.
- **Role-based Access** — Teacher and Student roles with protected API routes.

---

## 🛠️ Tech Stack

| Layer        | Technology                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| **Frontend** | React 19, Vite 8, React Router 7, Framer Motion, Tailwind CSS 4, Lucide Icons |
| **Backend**  | Node.js, Express 5, Mongoose 9, Socket.IO 4                               |
| **Database** | MongoDB Atlas                                                              |
| **Auth**     | JWT, bcryptjs, Google Auth Library, `@react-oauth/google`                  |
| **Media**    | Cloudinary (image/video/PDF uploads), Multer                               |
| **Real-time**| Socket.IO (chat, whiteboard sync, notifications), WebRTC (video streaming) |
| **TURN/STUN**| Metered.ca relay servers                                                   |

---

## 📁 Project Structure

```
coaching/
├── .env                        # Root environment variables (shared secrets)
├── .gitignore
│
├── backend/
│   ├── server.js               # Express + Socket.IO entry point
│   ├── package.json
│   ├── models/
│   │   ├── User.js             # User schema (teacher/student, OAuth, password)
│   │   ├── Class.js            # Class schema (topic, schedule, materials, recording)
│   │   ├── Test.js             # Test schema (MCQ questions, duration, publish state)
│   │   └── TestAttempt.js      # Student test attempt (responses, score, timing)
│   ├── routes/
│   │   ├── auth.js             # Signup, login, Google OAuth, JWT middleware
│   │   ├── classes.js          # CRUD for classes, scheduling, status updates
│   │   ├── tests.js            # Test creation (file upload), attempt, submit, retake
│   │   └── upload.js           # Cloudinary file uploads
│   └── socket/
│       └── index.js            # Socket.IO handlers (rooms, WebRTC signaling, chat, whiteboard)
│
├── frontend/
│   ├── .env                    # Vite env (Google Client ID, TURN credentials)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Router setup (Landing, Dashboards, LiveClass, TestRoom)
│       ├── App.css
│       ├── index.css
│       ├── context/
│       │   ├── AuthContext.jsx  # Auth state, login/signup/logout methods
│       │   └── SocketContext.jsx# Socket.IO client provider
│       ├── components/
│       │   ├── ChatBox.jsx      # Live chat component
│       │   ├── VideoStream.jsx  # WebRTC video display
│       │   └── Whiteboard.jsx   # Interactive whiteboard canvas
│       ├── pages/
│       │   ├── LandingPage.jsx  # Home / auth page
│       │   ├── TeacherDashboard.jsx # Teacher control panel
│       │   ├── StudentDashboard.jsx # Student home with classes & tests
│       │   ├── LiveClassRoom.jsx    # Live class view (video + chat + whiteboard)
│       │   └── TestRoom.jsx         # Timed MCQ test-taking interface
│       └── styles/              # Additional CSS modules
│
└── scratch/                     # Scratch/utility files
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and **npm**
- **MongoDB Atlas** connection string (or a local MongoDB instance)
- **Google Cloud** OAuth 2.0 Client ID (for Google sign-in)
- **Cloudinary** account (for media uploads)

### 1. Clone the repository

```bash
git clone <repository-url>
cd coaching
```

### 2. Configure environment variables

Create a **`.env`** file in the project root with the following:

```env
# Server
PORT=5000

# MongoDB
CONNECTION_STRING=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority

# Auth
SECRET_KEY=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# TURN/STUN (for WebRTC NAT traversal)
TURN_SERVER_URL=stun:stun.relay.metered.ca:80
TURN_USERNAME=your_turn_username
TURN_CREDENTIAL=your_turn_credential

# Email (optional — SMTP for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# AI-powered test parsing (optional)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Create a **`frontend/.env`** file:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_TURN_SERVER_URL=stun:stun.relay.metered.ca:80
VITE_TURN_USERNAME=your_turn_username
VITE_TURN_CREDENTIAL=your_turn_credential
```

### 3. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Run the application

Open two terminals:

```bash
# Terminal 1 — Backend (runs on port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (runs on port 5173)
cd frontend
npm run dev
```

Visit **http://localhost:5173** in your browser.

---

## 📡 API Reference

### Authentication — `/api/auth`

| Method | Endpoint  | Description                   | Auth |
| ------ | --------- | ----------------------------- | ---- |
| POST   | `/google` | Google OAuth login/register   | ✗    |
| POST   | `/signup` | Email & password registration | ✗    |
| POST   | `/login`  | Email & password login        | ✗    |
| GET    | `/me`     | Get current user profile      | ✓    |

### Classes — `/api/classes`

| Method | Endpoint | Description                        | Auth | Role    |
| ------ | -------- | ---------------------------------- | ---- | ------- |
| GET    | `/`      | List classes                       | ✓    | Any     |
| POST   | `/`      | Create a new class                 | ✓    | Teacher |
| PATCH  | `/:id`   | Update class status/details        | ✓    | Teacher |

### Tests — `/api/tests`

| Method | Endpoint           | Description                        | Auth | Role    |
| ------ | ------------------ | ---------------------------------- | ---- | ------- |
| GET    | `/teacher`         | List teacher's own tests           | ✓    | Teacher |
| POST   | `/`                | Create test (upload question files) | ✓    | Teacher |
| GET    | `/available`       | List published tests for students  | ✓    | Student |
| POST   | `/:testId/start`   | Start a test attempt               | ✓    | Student |
| POST   | `/:testId/retake`  | Retake a previously submitted test | ✓    | Student |
| POST   | `/:testId/submit`  | Submit test answers                | ✓    | Student |

### Uploads — `/api/upload`

| Method | Endpoint | Description                    | Auth |
| ------ | -------- | ------------------------------ | ---- |
| POST   | `/`      | Upload file to Cloudinary      | ✓    |

---

## 🔌 Socket.IO Events

| Event             | Direction         | Description                                      |
| ----------------- | ----------------- | ------------------------------------------------ |
| `join-room`       | Client → Server   | Join a class room (with userId, userName, role)   |
| `user-connected`  | Server → Room     | Notify room that a new user joined                |
| `user-disconnected`| Server → Room    | Notify room that a user left                      |
| `offer`           | Client → Client   | WebRTC SDP offer (teacher → student)              |
| `answer`          | Client → Client   | WebRTC SDP answer (student → teacher)             |
| `ice-candidate`   | Client → Client   | ICE candidate exchange for peer connection        |
| `send-chat`       | Client → Server   | Send a chat message to a room                     |
| `receive-chat`    | Server → Room     | Broadcast chat message to room members            |
| `draw-action`     | Client ↔ Server   | Sync whiteboard drawing actions                   |
| `clear-board`     | Client → Room     | Clear the whiteboard for all participants          |
| `sync-board`      | Client → Room     | Sync full whiteboard history to new joiners        |
| `stream-started`  | Client → All      | Broadcast notification that a class is live        |
| `stream-ended`    | Server → Room     | Notify students that the teacher's stream ended    |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend (Vite + React)          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Auth    │  │  Pages   │  │   Components     │   │
│  │  Context │  │Dashboard │  │ VideoStream      │   │
│  │  Socket  │  │LiveClass │  │ Whiteboard       │   │
│  │  Context │  │TestRoom  │  │ ChatBox          │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│           ↕ HTTP (Axios)    ↕ WebSocket (Socket.IO)  │
└─────────────────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Express REST    │    │  Socket.IO       │
│  API Server      │    │  (Real-time)     │
│  ─ Auth          │    │  ─ Rooms         │
│  ─ Classes       │    │  ─ WebRTC Signal │
│  ─ Tests         │    │  ─ Chat          │
│  ─ Uploads       │    │  ─ Whiteboard    │
└────────┬─────────┘    └──────────────────┘
         │
    ┌────┴────┐      ┌──────────────┐
    │ MongoDB │      │  Cloudinary  │
    │  Atlas  │      │  (Media CDN) │
    └─────────┘      └──────────────┘
```

---

## 📝 License

This project is licensed under the ISC License.
