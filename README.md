# CRM Lead Management REST API

## 1. Project Purpose & Technology Stack
A minimal, production-grade Node.js Express REST API designed for CRM lead management. It enables prospective students to submit public course enquiries, while counselors/employees register, log in, view public enquiries, and claim them with concurrency protection.

**Technology Stack:**
- **Runtime:** Node.js (v20 or v22), CommonJS (`require` / `module.exports`)
- **Framework:** Express.js 4.21.2
- **Database:** PostgreSQL (dedicated `crm_db` database)
- **ORM:** Prisma ORM / Prisma Client 6.19.3
- **Authentication & Security:** JWT (`jsonwebtoken` 9.0.2, HS256), password hashing (`bcryptjs` 2.4.3), CORS (`cors` 2.8.5)

---

## 2. Prerequisites
- Node.js (>= 20 and < 23)
- npm
- Running PostgreSQL instance with a dedicated `crm_db` database created

---

## 3. Environment Configuration
Copy `.env.example` to `.env` manually and configure actual local credentials:
```bash
cp .env.example .env
```
Ensure you provide:
- `PORT`: Server port (e.g., 5000)
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://DB_USER:DB_PASSWORD@localhost:5432/crm_db?schema=public`). **Note:** If your database password contains special characters, ensure they are URL-encoded.
- `JWT_SECRET`: A secure random secret string of at least 32 characters.

---

## 4. Authorized Lifecycle Commands
In accordance with operational guidelines, all terminal commands require explicit user authorization before execution:

1. `node --version` — Verifies Node.js 20/22 runtime environment.
2. `npm --version` — Verifies npm package manager.
3. `npm install` — Installs declared dependencies and produces `package-lock.json`.
4. `npx prisma validate` — Validates `prisma/schema.prisma` against configuration.
5. `npx prisma migrate dev --name init` — Applies initial database migration to `crm_db`.
6. `npx prisma generate` — Generates Prisma Client artifacts.
7. `npm run dev` — Starts local development server using nodemon.

---

## 5. API Endpoints Contract

### Overview
| # | Method | Path | JWT Auth | Purpose |
|---|---|---|---|---|
| 1 | POST | `/api/auth/register` | No | Register employee account |
| 2 | POST | `/api/auth/login` | No | Authenticate employee & get JWT |
| 3 | POST | `/api/enquiries` | No | Public enquiry submission |
| 4 | GET | `/api/enquiries/unclaimed` | Yes | List all unclaimed leads |
| 5 | PATCH | `/api/enquiries/:id/claim` | Yes | Claim an unclaimed lead |
| 6 | GET | `/api/enquiries/my-leads` | Yes | List logged-in employee's claimed leads |

Protected endpoints require the header:
```text
Authorization: Bearer <JWT_TOKEN>
```

> **Postman Collection:** A ready-to-import Postman collection is provided in [CRM_API.postman_collection.json](./CRM_API.postman_collection.json). It includes all 6 endpoints with dynamic variables for `{{base_url}}`, `{{jwt_token}}`, and auto-token extraction on login.


### Request & Response Specifications

#### 1. POST `/api/auth/register`
- **Request Body:**
  ```json
  {
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "password": "Password@123"
  }
  ```
- **Responses:** `201 Created` (returns employee object without password), `400 Bad Request` (validation error), `409 Conflict` (duplicate email), `500 Internal Server Error`.

#### 2. POST `/api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "rahul@example.com",
    "password": "Password@123"
  }
  ```
- **Responses:** `200 OK` (returns JWT token and employee profile), `400 Bad Request`, `401 Unauthorized` (invalid credentials), `500 Internal Server Error`.

#### 3. POST `/api/enquiries` (Public)
- **Request Body:**
  ```json
  {
    "name": "Amit Kumar",
    "email": "amit@example.com",
    "courseInterest": "Full Stack Development",
    "phone": "9876543210"
  }
  ```
  *(phone is optional)*
- **Responses:** `201 Created` (enquiry created with `claimedById: null`), `400 Bad Request`, `500 Internal Server Error`.

#### 4. GET `/api/enquiries/unclaimed` (Protected)
- **Responses:** `200 OK` (`{ "count": <number>, "enquiries": [...] }`), `401 Unauthorized`.

#### 5. PATCH `/api/enquiries/:id/claim` (Protected)
- **Request Body:** None.
- **Responses:** `200 OK` (claimed successfully), `400 Bad Request` (invalid ID), `401 Unauthorized`, `404 Not Found` (enquiry ID does not exist), `409 Conflict` (already claimed), `500 Internal Server Error`.

#### 6. GET `/api/enquiries/my-leads` (Protected)
- **Responses:** `200 OK` (`{ "count": <number>, "enquiries": [...] }` for logged-in employee), `401 Unauthorized`.

---

## 6. Public vs. Private Enquiries & Atomic Claim Protection
- **Public Enquiries:** When prospective students submit enquiries via `POST /api/enquiries`, the record is saved with `claimedById = null`. It is visible to all authenticated employees via `/api/enquiries/unclaimed`.
- **Private Enquiries:** Once claimed, `claimedById` is populated with the claiming employee's ID. The lead disappears from `/unclaimed` and appears only in `/my-leads` for that specific employee.
- **Atomic Claim Protection:** Claiming executes a single atomic conditional update:
  ```javascript
  prisma.enquiry.updateMany({
    where: { id, claimedById: null },
    data: { claimedById: req.employeeId }
  })
  ```
  This guarantees that under concurrent claim attempts, exactly one request can claim the record (returning count 1), while all other concurrent requests receive count 0 and result in HTTP `409 Conflict`. Read-then-update race conditions are strictly prevented.

---

## 7. Expected Response Codes & Acceptance Test Scenarios
1. **Register Counselor A:** `POST /api/auth/register` → `201 Created`.
2. **Register Counselor B:** `POST /api/auth/register` → `201 Created`.
3. **Duplicate Registration:** Register Counselor A again → `409 Conflict`.
4. **Login A & B:** `POST /api/auth/login` → `200 OK` with valid JWT; bad password → `401 Unauthorized`.
5. **Submit Public Enquiry:** `POST /api/enquiries` (no auth header) → `201 Created`, `claimedById === null`.
6. **Fetch Unclaimed:** `GET /api/enquiries/unclaimed` with token A or B → `200 OK`, enquiry present.
7. **Claim Lead:** `PATCH /api/enquiries/<id>/claim` with token A → `200 OK`, `claimedById` equals A's ID.
8. **Verify Isolation:**
   - `GET /api/enquiries/unclaimed` → lead is absent.
   - `GET /api/enquiries/my-leads` with token A → lead is present.
   - `GET /api/enquiries/my-leads` with token B → lead is absent.
9. **Conflict on Second Claim:** `PATCH /api/enquiries/<id>/claim` with token B → `409 Conflict`; repeated attempt with token A → `409 Conflict`.
10. **Auth & Validation Guards:** Corrupt/missing token → `401 Unauthorized`; non-numeric ID → `400 Bad Request`; nonexistent ID → `404 Not Found`.
11. **Concurrency Check:** Simultaneous claim requests for the same unclaimed lead → exactly one `200 OK`, other request receives `409 Conflict`.

---

## 8. Out of Scope Notes
This project implements the backend REST API only:
- No frontend, UI, or templates.
- No admin panel or role-based access control.
- No lead deletion, lead re-assignment, or unclaiming endpoints.
- No deployment configuration or external third-party integrations.
