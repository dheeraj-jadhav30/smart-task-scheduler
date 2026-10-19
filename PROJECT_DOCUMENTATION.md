# 📚 Smart Task Scheduler & Reminder System: Deep Engineering Guide

This document is an exhaustive, file-by-file technical reference for the **Smart Task Scheduler & Asynchronous Reminder System**. It covers the architecture, the rationale behind every design decision, and a complete breakdown of every file in the repository.

---

## Table of Contents
1. [Architectural Philosophy](#1-architectural-philosophy)
2. [Complete Project Tree](#2-complete-project-tree)
3. [File-by-File Detailed Analysis](#3-file-by-file-detailed-analysis)
   - [Root Configuration Files](#31-root-configuration-files)
   - [Database & Redis Configuration (`src/config/`)](#32-database--redis-configuration-srcconfig)
   - [Database Models (`src/models/`)](#33-database-models-srcmodels)
   - [Authentication Middleware (`src/middlewares/`)](#34-authentication-middleware-srcmiddlewares)
   - [Controllers (`src/controllers/`)](#35-controllers-srccontrollers)
   - [API Routes (`src/routes/`)](#36-api-routes-srcroutes)
   - [Queue Producer (`src/queues/`)](#37-queue-producer-srcqueues)
   - [Background Worker (`src/workers/`)](#38-background-worker-srcworkers)
   - [Database Seeder (`src/seed.js`)](#39-database-seeder-srcseedjs)
4. [Distributed Systems Patterns & Edge Cases](#4-distributed-systems-patterns--edge-cases)

---

# 1. Architectural Philosophy

Traditional task management applications store tasks in a database and either execute reminders synchronously (blocking the API) or rely on memory-based timers (`setTimeout`), which vanish if the server restarts.

This system solves these issues through **four foundational architectural principles**:

1. **Decoupled Asynchronous Processing**: The API accepts the task, delegates the delayed alarm to Redis, and returns an immediate response ($<15\text{ms}$) to the client.
2. **Authoritative Single Source of Truth**: Redis and BullMQ manage **timing**, but MongoDB remains the authoritative source for **state**. The worker never trusts stale queue payload data.
3. **Optimistic Versioning & Idempotency**: Handled via `reminderVersion` and deterministic job IDs (`task-${id}-v${version}`) to eliminate race conditions, duplicate notifications, and ghost alarms.
4. **Transient Fault Tolerance**: Exponential backoff policies ($5\text{s}, 10\text{s}, 20\text{s}$) with Dead-Letter Queue retention for failed jobs.

---

# 2. Complete Project Tree

```
smart-task-scheduler/
├── .dockerignore                     # Excludes local files from Docker builds
├── .env                              # Secret environment variables (Ignored by Git)
├── .env.example                      # Template for environment variables
├── .gitignore                        # Git exclusion rules
├── Dockerfile                        # Multi-purpose container blueprint
├── docker-compose.yml                # Redis container orchestration
├── package.json                      # Dependency manifest and execution scripts
├── README.md                         # Repository documentation & architecture
├── PROJECT_DOCUMENTATION.md          # Comprehensive engineering guide
├── server.js                         # Application entrypoint (bootstraps DB, Redis, HTTP)
├── app.js                            # Express app configuration & middleware pipeline
└── src/
    ├── config/
    │   ├── db.js                     # MongoDB connection lifecycle manager
    │   └── redis.js                  # ioredis client configured for BullMQ
    ├── models/
    │   ├── user.model.js             # User schema with bcrypt hooks & auth methods
    │   └── task.model.js             # Task schema with versioning & compound indexes
    ├── middlewares/
    │   └── auth.middleware.js        # JWT Bearer and Cookie authentication guard
    ├── controllers/
    │   ├── auth.controller.js        # Registration, login, and token generation
    │   └── task.controller.js        # Task CRUD, pagination, filtering & queue triggers
    ├── routes/
    │   ├── auth.route.js             # Public authentication endpoints
    │   ├── task.route.js             # Protected task management endpoints
    │   └── health.route.js           # Liveness and readiness container health probes
    ├── queues/
    │   └── reminder.queue.js         # BullMQ queue producer with deterministic IDs
    ├── workers/
    │   └── reminder.worker.js        # Independent BullMQ consumer with state validation
    └── seed.js                       # Database population script with realistic fixtures
```

---

# 3. File-by-File Detailed Analysis

---

## 3.1 Root Configuration Files

### `package.json`
- **Purpose**: Defines project metadata, script commands, and third-party dependencies.
- **Key Fields**:
  - `"type": "module"`: Enables modern ECMAScript Module (`import`/`export`) syntax natively in Node.js.
  - `"scripts"`:
    - `"dev"`: Runs `npx nodemon server.js` for auto-reloading API development.
    - `"dev:worker"`: Runs `npx nodemon src/workers/reminder.worker.js` for independent background consumer development.
    - `"start"`: Production execution command for the API.
    - `"seed"`: Executes `node src/seed.js` to reset and populate the database.
- **Core Dependencies**:
  - `express`: Minimalist HTTP routing framework.
  - `mongoose`: MongoDB ODM for structured data modeling.
  - `bullmq` & `ioredis`: Distributed queue and in-memory key-value driver.
  - `jsonwebtoken` & `bcrypt`: Security, authentication, and password hashing.
  - `cookie-parser`: Parses JWT tokens stored in HTTP cookies.

### `.env` & `.env.example`
- **Purpose**: Decouples environment-specific secrets from source code.
- **Variables**:
  - `PORT`: HTTP port for Express (e.g., `5000`).
  - `MONGO_URI`: MongoDB connection string.
  - `REDIS_URL`: Redis connection string (e.g., `redis://localhost:6379`).
  - `JWT_SECRET`: High-entropy secret key used to sign and verify JWT tokens.

### `.gitignore` & `.dockerignore`
- **Purpose**: Prevents sensitive or heavy local files from polluting version control and Docker images.
- **Excluded Items**: `node_modules/`, `.env`, `npm-debug.log`.

### `Dockerfile`
- **Purpose**: Packages the application into a containerized Alpine Linux image.
- **Execution Strategy**:
  1. Uses `node:20-alpine` as a minimal base layer.
  2. Copies `package*.json` and runs `npm install` first, taking advantage of Docker layer caching.
  3. Copies application source code.
  4. Exposes port 5000 and defaults to `CMD ["node", "server.js"]`.

### `docker-compose.yml`
- **Purpose**: Runs the local Redis dependency with volume persistence.
- **Key Directives**:
  - `image: redis`: Pulls official Redis image.
  - `ports: ["6379:6379"]`: Binds Redis to the host machine for local Node processes.

### `server.js`
- **Role**: The server bootstrapper.
- **Workflow**:
  1. Loads `.env` variables via `dotenv.config()`.
  2. Establishes the authoritative database connection by calling `connectDB()`.
  3. Initializes Redis connection via `src/config/redis.js`.
  4. Binds the Express `app` to `process.env.PORT || 5000`.

### `app.js`
- **Role**: The Express application factory and middleware pipeline.
- **Middleware Chain**:
  1. `express.json()`: Parses incoming JSON request payloads.
  2. `cookieParser()`: Reads cookies for token verification.
- **Mounted Route Namespaces**:
  - `/health` $\to$ `healthRouter` (Public monitoring)
  - `/api/auth` $\to$ `authRouter` (Public authentication)
  - `/api/task` $\to$ `taskRouter` (Protected task CRUD)

---

## 3.2 Database & Redis Configuration (`src/config/`)

### `src/config/db.js`
- **Role**: Manages the Mongoose connection lifecycle to MongoDB Atlas.
- **Mechanisms**:
  - Listens to connection events (`connected`, `error`, `disconnected`) and logs them.
  - Implements a `try...catch` wrapper that terminates the process with `process.exit(1)` if initial database connectivity fails (fail-fast principle).

### `src/config/redis.js`
- **Role**: Initializes the singleton `ioredis` client.
- **Crucial BullMQ Setting**:
  - `maxRetriesPerRequest: null`: **Mandatory for BullMQ**. BullMQ relies on blocking commands (`BRPOPLPUSH`, `BLMOVE`) to wait for jobs. If `maxRetriesPerRequest` is set to a number, ioredis will timeout and crash the queue. Setting it to `null` delegates connection retry management to BullMQ.

---

## 3.3 Database Models (`src/models/`)

### `src/models/user.model.js`
- **Schema Attributes**:
  - `name`: String, required, trimmed.
  - `email`: String, required, unique index, lowercase, trimmed.
  - `password`: String, required, minimum length of 6 characters.
- **Hooks & Methods**:
  - `pre('save')` Hook: Automatically intercepts user document saves. If the password was modified, it hashes the plain password with `bcrypt.hash(..., 10)` before writing to MongoDB.
  - `comparePassword(enteredPassword)`: Instance method that securely verifies candidate plain passwords against the stored bcrypt hash using `bcrypt.compare`.

### `src/models/task.model.js`
- **Schema Attributes**:
  - `userId`: `ObjectId` referencing the `User` model. Indexed for fast lookup.
  - `title`: String, required.
  - `description`: String.
  - `priority`: Enum (`'low'`, `'medium'`, `'high'`), default `'medium'`.
  - `status`: Enum (`'pending'`, `'in-progress'`, `'completed'`), default `'pending'`.
  - `dueDate`: Date.
  - `reminderAt`: Target timestamp for notification delivery.
  - `reminderStatus`: Enum (`'unscheduled'`, `'scheduled'`, `'processing'`, `'sent'`, `'failed'`, `'cancelled'`).
  - `reminderVersion`: Number, defaults to `0`. Incremented on every reminder reschedule to invalidate superseded jobs.
  - `reminderSentAt`: Date of successful execution.
  - `lastReminderError`: Detailed stack/message if execution failed.
- **Compound Index**:
  - `{ userId: 1, status: 1, priority: 1 }`: Optimizes user-scoped filtered queries and pagination.

---

## 3.4 Authentication Middleware (`src/middlewares/`)

### `src/middlewares/auth.middleware.js`
- **Role**: Secures all private endpoints.
- **Workflow**:
  1. Inspects `req.headers.authorization` for a `Bearer <token>` format, or falls back to `req.cookies.token`.
  2. If missing, terminates with `401 Unauthorized`.
  3. Verifies the token's cryptographic signature using `jwt.verify(token, process.env.JWT_SECRET)`.
  4. Queries MongoDB for the user document: `userModel.findById(decoded.id).select('-password')`.
  5. Strips the password hash for security and injects the user into `req.user`.
  6. Calls `next()`.

---

## 3.5 Controllers (`src/controllers/`)

### `src/controllers/auth.controller.js`
- **`registerController`**:
  - Validates presence of `name`, `email`, `password`.
  - Checks for existing email duplicate.
  - Creates user (password hashed automatically by model hook).
  - Signs JWT token with `{ id: user._id }`.
  - Returns `201 Created` with token and user object.
- **`loginController`**:
  - Validates input.
  - Locates user by email.
  - Calls `user.comparePassword(password)`.
  - Signs JWT and attaches to HTTP cookie and JSON body.
  - Returns `200 OK`.

### `src/controllers/task.controller.js`
- **`createTask`**:
  - Validates `title` and ensures `reminderAt` is a future date.
  - Saves task with `userId: req.user._id`.
  - If `reminderAt` is set, calls `scheduleReminder(task)`. Catches Redis errors to handle dual-write failure gracefully.
- **`getTasks`**:
  - Implements **Cursor-based pagination**: `skip = (page - 1) * limit`.
  - Dynamically builds filter query for `status` and `priority` scoped to `req.user._id`.
  - Returns paginated data alongside `totalTasks`, `totalPages`, and `currentPage`.
- **`getTaskById`**:
  - Retrieves single task scoped to `{ _id: req.params.id, userId: req.user._id }`.
- **`updateTask`**:
  - If `reminderAt` is modified, increments `task.reminderVersion += 1` and marks `reminderChanged = true`.
  - Persists changes in MongoDB.
  - Cancels obsolete Redis job: `cancelReminder(task._id, oldVersion)`.
  - Schedules new Redis job: `scheduleReminder(task)`.
- **`completedTask`**:
  - Sets `status = 'completed'` and `reminderStatus = 'cancelled'`.
  - Cancels pending Redis job: `cancelReminder(task._id, task.reminderVersion)`.
- **`deleteTask`**:
  - Deletes task from MongoDB.
  - Cancels pending Redis job.

---

## 3.6 API Routes (`src/routes/`)

### `src/routes/auth.route.js`
- Binds `POST /register` $\to$ `registerController`.
- Binds `POST /login` $\to$ `loginController`.

### `src/routes/task.route.js`
- Injects `taskRouter.use(authMiddleware)` to protect all routes.
- Maps endpoints:
  - `POST /create-task`
  - `GET /get-tasks`
  - `GET /:id`
  - `PATCH /:id`
  - `PATCH /:id/complete`
  - `DELETE /:id`

### `src/routes/health.route.js`
- `GET /live`: Immediate 200 response with uptime. Used by Docker/Kubernetes liveness probes.
- `GET /ready`: Pings MongoDB (`readyState === 1`) and Redis (`redis.ping() === 'PONG'`). Returns 200 if all dependencies are healthy, or 503 if any dependency has disconnected.

---

## 3.7 Queue Producer (`src/queues/`)

### `src/queues/reminder.queue.js`
- **`reminderQueue`**:
  - Defines BullMQ queue instance with retry policy (`attempts: 3`, exponential backoff delay of 5000ms).
- **`scheduleReminder(task)`**:
  - Calculates delay: `Math.max(0, new Date(reminderAt) - Date.now())`.
  - Generates deterministic `jobId`: `task-${task._id}-v${task.reminderVersion}`.
  - Enqueues job with minimal payload pointer `{ taskId, version }`.
- **`cancelReminder(taskId, version)`**:
  - Looks up job in Redis by deterministic key `task-${taskId}-v${version}` in $O(1)$ time and removes it.

---

## 3.8 Background Worker (`src/workers/`)

### `src/workers/reminder.worker.js`
- **Execution Model**: Runs as an independent process via `npm run dev:worker`.
- **The 4 Idempotency Guard Rules**:
  1. **Fresh State Fetch**: Queries MongoDB by `taskId`.
  2. **Deletion Guard**: If `!task`, terminates gracefully (task was deleted).
  3. **Completion Guard**: If `task.status === 'completed'` or `task.reminderStatus === 'cancelled'`, skips execution.
  4. **Version Guard**: If `task.reminderVersion !== job.data.version`, skips execution (reminder was rescheduled).
- **Execution & Transition**:
  - Marks `reminderStatus = 'processing'`.
  - Delivers notification (simulated console notification).
  - Updates MongoDB: `reminderStatus = 'sent'`, `reminderSentAt = new Date()`.
- **Lifecycle Listeners**:
  - `on('failed')`: If attempts reach maximum (3 retries), marks `task.reminderStatus = 'failed'` and logs `lastReminderError`.

---

## 3.9 Database Seeder (`src/seed.js`)

### `src/seed.js`
- **Role**: Populates development and testing environments.
- **Workflow**:
  1. Cleans existing data with `deleteMany({})`.
  2. Creates 2 test users (Alice and Bob) with hashed passwords.
  3. Seeds 12 diverse tasks for Alice (different statuses, priorities, past and future reminders).
  4. Seeds 2 tasks for Bob to test multi-tenant data isolation.

---

# 4. Distributed Systems Patterns & Edge Cases

### The Dual-Write Problem
When saving to MongoDB and Redis sequentially, one operation can succeed while the other fails.
- **Solution in code**: If `scheduleReminder(task)` throws an error due to a Redis network drop, the catch block updates `task.reminderStatus = 'unscheduled'` in MongoDB, preventing inconsistent state.

### Race Condition on Reschedule
If a reminder is set for 2:00 PM and the user reschedules it to 4:00 PM at 1:59 PM:
- **Solution in code**: The task version increments to `v1`. Even if the 2:00 PM job (`v0`) fires before Redis finishes removing it, the worker inspects MongoDB, detects `task.reminderVersion (1) !== job.data.version (0)`, and discards the stale job without sending a duplicate notification.
