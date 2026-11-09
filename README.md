# NEXBANK — Secure Digital Banking & Transaction Management
Secure Transactions. Reliable Banking. Intelligent Management.

An educational ADBMS banking simulation using React, Express, TypeScript and MySQL 8.4. No real money, payment gateway or real banking credentials.

**Status:** implementation and deployment configuration prepared; TypeScript, backend unit tests, frontend component tests and builds pass. Real-MySQL integration, browser E2E and public deployment are NOT verified. Read docs/PROJECT_STATUS.md before presenting this as complete.

## Windows prerequisites
Node.js 22+, Git, VS Code and Docker Desktop with Linux containers. MySQL Workbench/Postman are optional. Open this NEXBANK-ADBMS folder, the one containing package.json, in VS Code.

## First setup — PowerShell in VS Code
```powershell
npm ci
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```
Edit .env and backend/.env in VS Code. Choose your own unique local passwords. Keep the root password in the Docker file and backend development URLs consistent. Generate a JWT secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it only into backend/.env. Do not share it. Set ADMIN_EMAIL and ADMIN_PASSWORD for your own administrator.

Start Docker Desktop, then:
```powershell
docker compose up -d mysql
docker compose ps
npm run prisma:generate -w backend
npm run db:migrate
npm run db:seed
```
Initial Docker setup creates nexbank, nexbank_test and nexbank_lab. If using an older existing volume, create the two isolated databases manually with database/init-databases.sql. Never delete a volume containing data you want to keep.

The development example uses root for migrations and labs on localhost only. Before public hosting, provision the restricted runtime user described in docs/DEPLOYMENT.md. Do not reuse the development root URL in production.

With SEED_DEMO=true, Alice and Bob each receive ₹10,000 of simulated credit, journaled against treasury equity. Their addresses are alice@nexbank.invalid and bob@nexbank.invalid, and their local password is the ADMIN_PASSWORD you selected. Demo seeding refuses NODE_ENV=production. Admin identity comes from ADMIN_EMAIL. Ordinary registration always starts with no accounts and no money.

## Run — two terminals
Terminal 1:
```powershell
npm run dev:backend
```
Terminal 2:
```powershell
npm run dev:frontend
```
Open http://localhost:5173. API readiness: http://localhost:4000/health/ready.

## Verify
```powershell
npm run typecheck
npm test
npm run build
```
Real MySQL tests must use the separate test schema. Supply your own local root password; this URL is test-only:
```powershell
$env:DATABASE_URL="mysql://root:YOUR_LOCAL_PASSWORD@127.0.0.1:3306/nexbank_test"
$env:LAB_DATABASE_URL="mysql://root:YOUR_LOCAL_PASSWORD@127.0.0.1:3306/nexbank_lab"
npm run test:integration
```
Integration tests inject a rollback failure and create/drop lab objects. NEVER use ordinary or production data. For browser checks, set ADMIN_EMAIL=admin@test.invalid and ADMIN_PASSWORD=Test-only-long-password-123! for the isolated test database, JWT_SECRET to a test-only long value and FRONTEND_ORIGINS=http://localhost:5173, then:
```powershell
npx playwright install chromium
npm run test:e2e
```
Remove test overrides when returning to development:
```powershell
Remove-Item Env:DATABASE_URL
Remove-Item Env:LAB_DATABASE_URL
```
Start a new terminal to clear remaining test-only overrides safely.

## Stop and resume
Ctrl+C in each Node terminal. `docker compose stop` stops MySQL while preserving its volume. Next time run `docker compose up -d mysql`, then start the two Node terminals. Do not use `docker compose down -v` unless you explicitly intend to erase the local database.

## Documentation
- docs/ARCHITECTURE.md — requirements, stack, risks and roadmap
- docs/DATABASE_DESIGN.md — ER diagram, normalization and ledger
- docs/ADBMS_CONCEPTS.md — actual SQL behavior and laboratory
- docs/API_DOCUMENTATION.md — endpoints and authorization
- docs/SECURITY.md — controls and limitations
- docs/TESTING.md — actual verification record
- docs/DEPLOYMENT.md — exact GitHub, Railway, Vercel and CI/CD setup
- docs/VIVA_GUIDE.md — 40 simple presentation questions
- docs/PROJECT_STATUS.md — completed work and blockers

The complete SQL scripts are in database/migrations. Do not replace them with Prisma db push: Prisma is used for standard user operations; SQL owns routines, triggers, views and the financial ledger.
