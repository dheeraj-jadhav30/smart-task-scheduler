# ⏱️ Smart Task Scheduler & Asynchronous Reminder Engine

[![Node.js Version](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-forestgreen.svg)](https://www.mongodb.com/)
[![Queue & Cache](https://img.shields.io/badge/Queue-Redis%20%2B%20BullMQ-red.svg)](https://bullmq.io/)
[![Container](https://img.shields.io/badge/Containers-Docker%20%2B%20Compose-blue.svg)](https://www.docker.com/)

A production-grade, distributed backend system that enables users to manage tasks, prioritize deadlines, and schedule delayed reminders. Built with **Node.js, Express, MongoDB, Redis, and BullMQ**, this application completely decouples HTTP request-response cycles from background notification delivery using an asynchronous worker architecture.

---

## 🏗️ System Architecture

```
                          ┌────────────────────────┐
                          │   Client / Postman     │
                          └───────────┬────────────┘
                                      │ HTTP Requests (JWT Auth)
                                      ▼
                          ┌────────────────────────┐
                          │  Express REST API Server│
                          │   (server.js / app.js) │
                          └─────┬────────────┬─────┘
                                │            │
      1. Write Task & User State│            │ 2. Enqueue Delayed Job
                                ▼            ▼ (delay = reminderAt - now)
     ┌────────────────────────────┐        ┌────────────────────────────┐
     │      MongoDB Atlas         │        │    Redis (Port 6379)       │
     │ (Authoritative Data Store) │        │  (BullMQ Delayed Set ZSET) │
     └─────────────▲──────────────┘        └─────────────┬──────────────┘
                   │                                     │
                   │ 3. Query authoritative task state   │ 4. Delayed timer expires
                   │    Verify version & status          ▼
                   │                       ┌────────────────────────────┐
                   └───────────────────────┤ Background Reminder Worker │
                     5. Update state to    │    (reminder.worker.js)    │
                        'sent' or 'failed' └─────────────┬──────────────┘
                                                         │
                                                         ▼
                                           ┌────────────────────────────┐
                                           │ Simulated Notification Svc │
                                           │   (Email / SMS / Push)     │
                                           └────────────────────────────┘
```

---

## 🚀 Key Engineering Highlights

- **Decoupled Asynchronous Processing**: HTTP responses return in $<15\text{ms}$. Delayed reminder scheduling and notification delivery are processed entirely off the main event loop by an independent BullMQ background worker.
- **Worker Idempotency & Fresh State Verification**: The worker never trusts stale queue payload data. It re-fetches authoritative task documents from MongoDB before sending notifications, preventing ghost alerts for completed or deleted tasks.
- **Optimistic Versioning (`reminderVersion`)**: Resolves race conditions when reminders are rescheduled. When a user updates a reminder time, older delayed jobs waking up in Redis detect a version mismatch and exit gracefully.
- **Deterministic Deduplication Keys**: Custom BullMQ Job IDs (`task-${id}-v${version}`) ensure network retries or duplicate button clicks never generate duplicate jobs in Redis.
- **Resilient Fault Tolerance & Exponential Backoff**: Configured with 3 automated retries doubling wait intervals ($5\text{s}, 10\text{s}, 20\text{s}$) with Dead-Letter Queue retention for post-mortem inspection.
- **Multi-Tenant Security**: Strict query scoping to `req.user._id` verified through JWT authentication middleware and bcrypt password encryption.
- **Operational Health Checks**: Production-grade `/health/live` (process liveness) and `/health/ready` (MongoDB and Redis ping readiness) endpoints for container orchestration.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (ES Modules) | High-performance asynchronous JavaScript engine |
| **Framework** | Express.js | REST API routing and middleware management |
| **Primary Database** | MongoDB Atlas & Mongoose | Authoritative data store for users, tasks, and state metadata |
| **Distributed Queue** | Redis & BullMQ | In-memory delayed job scheduling and worker coordination |
| **Authentication** | JWT (`jsonwebtoken`) & `bcrypt` | Stateless bearer token auth & one-way password hashing |
| **Containerization** | Docker & Docker Compose | Multi-container orchestration (API, Worker, Redis) |

---

## 📡 REST API Contract

### Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | ❌ No |
| `POST` | `/api/auth/login` | Authenticate user and issue JWT token | ❌ No |

### Task Endpoints
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/task/create-task` | Create a task with optional future reminder | ✅ Yes |
| `GET` | `/api/task/get-tasks` | List tasks with pagination (`?page=1&limit=10`) and filters (`?status=...&priority=...`) | ✅ Yes |
| `GET` | `/api/task/:id` | Fetch details of a single task by ID | ✅ Yes |
| `PATCH` | `/api/task/:id` | Update task fields (reschedules reminder if date changed) | ✅ Yes |
| `PATCH` | `/api/task/:id/complete` | Mark task as completed & cancel pending Redis reminder | ✅ Yes |
| `DELETE` | `/api/task/:id` | Delete task & cancel pending Redis reminder | ✅ Yes |

### Operational Health Endpoints
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health/live` | Process liveness probe | ❌ No |
| `GET` | `/health/ready` | Dependency readiness probe (verifies MongoDB & Redis) | ❌ No |

---

## 🏃 Local Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/dheeraj-jadhav30/smart-task-scheduler.git
cd smart-task-scheduler
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smart-task-scheduler
REDIS_URL=redis://localhost:6379
JWT_SECRET=super_secret_jwt_key_at_least_16_characters
```

### 3. Start Redis via Docker
```bash
docker compose up -d redis
```

### 4. Seed Database with Test Data
Populates the database with 2 test users and 14 diverse tasks:
```bash
npm run seed
```

### 5. Start the Application
Open two separate terminal windows:
```bash
# Terminal 1: Run Express REST API
npm run dev

# Terminal 2: Run Background BullMQ Worker
npm run dev:worker
```

---

## 📄 Resume Bullet Points (STAR Method)

- Architected a decoupled, asynchronous task scheduling backend using Node.js, Express, MongoDB, and Redis/BullMQ to offload delayed notification processing from the HTTP event loop.
- Engineered an idempotent background worker pattern with optimistic versioning (`reminderVersion`) to resolve distributed dual-write inconsistencies and prevent duplicate notification execution upon task reschedule.
- Implemented deterministic job deduplication and resilient retry policies with exponential backoff ($5\text{s}, 10\text{s}, 20\text{s}$) and dead-letter failure tracking in Redis.
- Designed secure multi-tenant REST APIs scoped strictly by JWT authentication, supporting dynamic multi-criteria filtering and cursor-based pagination.
- Integrated Kubernetes-ready container health probes (`/health/live` and `/health/ready`) to monitor process liveness and dependency readiness.
