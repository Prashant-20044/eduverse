# 🎓 Eduverse: Technical Interview Prep Guide

This document breaks down the Eduverse project into its core components, detailing the technologies used, alternative options, engineering tradeoffs, and strategies for scaling.

## 1. Frontend (The Client Interface)

> [!NOTE]
> **Role:** The Single Page Application (SPA) where users interact. It handles routing, state management, media rendering (video/whiteboard), and consuming REST APIs.

### Technologies Used
- **React 19 & Vite 8:** Core UI and build tooling.
- **Tailwind CSS 4:** Utility-first styling.
- **Framer Motion:** Smooth animations.
- **Socket.IO Client & WebRTC:** Real-time communication and video streaming.
- **Rough.js:** Interactive whiteboard rendering.

### Why these were chosen
React provides a predictable, component-based architecture. Vite was chosen over Create React App (CRA) or Webpack because of its incredibly fast Hot Module Replacement (HMR) and optimized build speeds utilizing native ES modules. Tailwind CSS allows for rapid styling without context-switching between CSS and JS files.

### Alternatives & Tradeoffs
- **Next.js vs. React (Vite SPA):** 
  - *Tradeoff:* Next.js is better for SEO and initial page load speed (Server-Side Rendering). However, since Eduverse is primarily a behind-login dashboard rather than a public content site, a Vite SPA is simpler to host, cheaper, and perfectly sufficient.
- **Redux vs. Context API:** 
  - *Tradeoff:* React Context is built-in and great for avoiding prop-drilling for global state (like user sessions). However, if the live class state (whiteboard drawings, chat, video) becomes highly complex, Context can cause unnecessary re-renders. Redux Toolkit or Zustand might be better for high-frequency state updates.

### How to Scale
> [!TIP]
> **Scaling Strategy**
> 1. **CDN Hosting:** Host the built static files on a global Edge CDN (like Vercel, Cloudflare, or AWS CloudFront) to reduce latency globally.
> 2. **Code Splitting (Lazy Loading):** Use `React.lazy()` so a user logging in to take a test doesn't download the heavy WebRTC and Whiteboard JavaScript bundles until they actually enter a Live Class.

---

## 2. Backend (REST API Server)

> [!NOTE]
> **Role:** The central brain of the application handling business logic, authentication (JWT/OAuth), database interactions, and secure file uploads.

### Technologies Used
- **Node.js & Express 5:** Backend runtime and web framework.
- **JWT & bcryptjs:** Secure stateless authentication and password hashing.
- **Multer:** Handling multipart/form-data for file uploads.

### Why these were chosen
Node.js uses an event-driven, non-blocking I/O model which makes it lightweight and efficient for real-time, data-intensive applications. Using JavaScript across the entire stack reduces context switching.

### Alternatives & Tradeoffs
- **Express vs. NestJS / Fastify:** 
  - *Tradeoff:* Express is minimal and unopinionated. As the codebase grows, it can become messy if not strictly organized. NestJS provides a strict architecture (good for large teams), while Fastify offers better raw throughput. Express was chosen for its massive ecosystem and fast development speed.
- **Node.js vs. Python (Django) / Go:** 
  - *Tradeoff:* Node.js is single-threaded but excellent for handling thousands of concurrent I/O requests. However, for heavy CPU-bound tasks on the server (like transcoding recorded video streams natively), a multi-threaded language like Go or Python might be more efficient.

### How to Scale
> [!TIP]
> **Scaling Strategy**
> 1. **Horizontal Scaling:** Ensure the API remains completely stateless (using JWTs). This allows spinning up multiple Node.js instances behind a Load Balancer (e.g., NGINX, AWS ALB) to distribute traffic.
> 2. **Caching:** Implement **Redis** to cache frequently accessed data (like lists of available classes or test configs), drastically reducing the database load.

---

## 3. Real-Time Communication Layer

> [!NOTE]
> **Role:** Responsible for ultra-low latency features: Live chat, collaborative whiteboard, notifications, and video streaming.

### Technologies Used
- **Socket.IO:** Real-time event-based communication.
- **WebRTC:** Peer-to-peer (P2P) low-latency live video streaming.
- **Metered.ca (TURN/STUN):** NAT traversal for strict firewalls.

### How WebRTC Works in Eduverse & Why It Was Chosen

**WebRTC (Web Real-Time Communication)** is the industry standard for sub-500ms latency video streaming. It allows browsers to communicate directly (Peer-to-Peer) without passing the heavy video data through a central server. 

If asked how a WebRTC connection is established in your app, explain this flow:
1. **Signaling (Socket.IO):** WebRTC cannot find peers on its own. It needs a signaling server (our Node.js + Socket.IO backend) to pass initial connection data.
2. **SDP (Session Description Protocol):** The peers use Socket.IO to exchange SDP **Offers** and **Answers**. These contain data about media capabilities (e.g., "I support VP8 video codec at 720p").
3. **STUN Servers:** Browsers are usually behind NATs (routers) and firewalls, hiding their public IP addresses. The peers query a **STUN server** (Metered.ca) to discover their own public IP address.
4. **ICE Candidates:** Once they know their public IPs, they exchange these as **ICE Candidates** via Socket.IO to try and establish a direct connection.
5. **TURN Servers (Fallback):** If a corporate firewall is too strict and blocks the direct P2P connection, the WebRTC connection falls back to a **TURN server** (also Metered.ca), which acts as a cloud relay to bounce the video data between the users.

Socket.IO was chosen over raw WebSockets for the signaling layer because it provides fallback polling, automatic reconnections, and "rooms" natively, making it very easy to separate chat and signaling traffic by "Classroom".

### Alternatives & Tradeoffs
- **WebRTC P2P Mesh vs. SFU (Media Server):** 
  - *Tradeoff:* P2P is great and free for 1-to-1 tutoring. However, if a teacher broadcasts to 50 students using P2P, the teacher's computer must upload the video stream 50 times, which will crash their bandwidth. 

### How to Scale
> [!IMPORTANT]
> **The Bottleneck & Scaling Solution**
> 1. **Move to an SFU (Selective Forwarding Unit):** To scale classes past 5-10 students, you must integrate a WebRTC SFU like **LiveKit** or **Mediasoup**. The teacher uploads the video *once* to a cloud server, and the server distributes it to all students.
> 2. **Redis Adapter for Socket.IO:** When scaling the backend horizontally across multiple servers, you must add the `@socket.io/redis-adapter`. This uses a Redis Pub/Sub mechanism to pass socket events (like chat or whiteboard drawings) between users connected to different backend servers.

---

## 4. Database & Storage Layer

> [!NOTE]
> **Role:** Persistent storage of user data, class metadata, test scores, and large media files.

### Technologies Used
- **MongoDB Atlas & Mongoose:** NoSQL document database and ODM.
- **Cloudinary:** Media CDN and cloud storage.

### Why these were chosen
MongoDB stores data in flexible, JSON-like documents that pair perfectly with a Node/Express backend. Cloudinary is an excellent media CDN that handles not just storage, but on-the-fly image optimization and formatting.

### Alternatives & Tradeoffs
- **MongoDB (NoSQL) vs. PostgreSQL (SQL):** 
  - *Tradeoff:* SQL is highly structured and great for complex relational queries and strict data integrity. MongoDB was chosen for its flexibility. If you want to change the structure of a "Test" document, NoSQL allows you to do that without complex database migrations.
- **Cloudinary vs. AWS S3:** 
  - *Tradeoff:* AWS S3 is cheaper at massive scale. Cloudinary was chosen for developer velocity—it acts as both the storage bucket and the CDN, providing built-in transformations (like resizing) out of the box.

### How to Scale
> [!TIP]
> **Scaling Strategy**
> 1. **Database Indexing:** Ensure fields queried often (like `classId` in tests) are properly indexed in MongoDB to change a query from an $O(N)$ full-collection scan to an $O(1)$ or $O(\log N)$ lookup.
> 2. **Read Replicas:** In MongoDB Atlas, you can configure Read Replicas. You can route heavy "Read" operations to the replica, leaving the primary node completely free to handle "Write" operations (like real-time test submissions).
