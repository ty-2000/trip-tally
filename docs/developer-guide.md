# Developer Guide

Setup instructions and contribution guidelines for Trip Tally.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Backend and frontend runtime |
| npm | 10+ | Package manager |
| Docker | any | CDK bundling (esbuild in container) |
| PostgreSQL | 15+ | Local database |
| AWS CLI | v2 | Deployments and Lambda invocation |

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd trip-tally

# Install all workspaces
(cd backend && npm install)
(cd frontend-web && npm install)
(cd infrastructure && npm install)
```

### 2. Set up local database

```bash
# Create database and user
psql -U postgres <<SQL
CREATE USER triptally_admin WITH PASSWORD 'password';
CREATE DATABASE triptally OWNER triptally_admin;
SQL

# Apply schema
psql -U triptally_admin -d triptally -f backend/src/db/schema.sql
```

### 3. Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=triptally
DB_USER=triptally_admin
DB_PASSWORD=password
AWS_REGION=us-east-2
S3_BUCKET_NAME=           # leave empty to disable receipt uploads locally
```

### 4. Start the backend

```bash
cd backend
npm run dev
# → Express server on http://localhost:3001
```

### 5. Start the frontend

```bash
cd frontend-web
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
# → Next.js on http://localhost:3000
```

---

## Project Scripts

### Backend (`backend/`)

| Command | Description |
|---|---|
| `npm run dev` | Start local Express server (ts-node) |
| `npm run build` | Type-check + bundle Lambda functions to `dist/` |
| `npm test` | Run Jest unit tests |
| `npm run lint` | ESLint |

### Frontend (`frontend-web/`)

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (static export to `out/`) |
| `npm run type-check` | TypeScript check without emitting |
| `npm run lint` | ESLint via Next.js |

### Infrastructure (`infrastructure/`)

| Command | Description |
|---|---|
| `npx cdk diff` | Preview changes against deployed stacks |
| `npx cdk deploy <StackName>` | Deploy a specific stack |
| `npx cdk deploy --all` | Deploy all stacks |
| `npx cdk synth` | Synthesize CloudFormation templates |

---

## Backend Architecture

### Adding a new API endpoint

1. Add the route types to `shared/types/index.ts`
2. Add repository method to the interface in `backend/src/repositories/types.ts`
3. Implement it in `backend/src/repositories/postgres/pg<Resource>Repo.ts`
4. Add business logic to `backend/src/services/<resource>Service.ts`
5. Add the Lambda handler in `backend/src/functions/<resource>.ts`
6. Wire the route in `infrastructure/lib/api-stack.ts`
7. Add the route to the local Express server in `backend/src/local-server.ts`

### DB credentials

In Lambda, credentials are fetched from Secrets Manager at cold-start via `DB_SECRET_ARN`. Locally, plain env vars are used. Both paths are handled in `backend/src/db/client.ts`.

### Money

All monetary amounts are stored and computed as **integer cents**. Never use floats for money. Use the helpers in `services/debtSimplification.ts` for split computation.

---

## Database Migrations

Schema changes are applied via the `migrate` Lambda. Embed the idempotent DDL in `backend/src/functions/migrate.ts`.

**On AWS:**

```bash
aws lambda invoke \
  --function-name trip-tally-migrate \
  --region us-east-2 \
  --payload '{}' \
  /tmp/out.json && cat /tmp/out.json
```

**Locally:** run the SQL directly against your local PostgreSQL.

---

## AWS Deployment

### First-time setup

```bash
# 1. Bootstrap CDK in your AWS account/region
cd infrastructure
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>

# 2. Deploy the OIDC stack to create the GitHub Actions deploy role
npx cdk deploy TripTallyGitHubOIDCStack

# 3. Note the DeployRoleArn output and add it as a GitHub secret:
#    AWS_DEPLOY_ROLE_ARN = arn:aws:iam::...
#    AWS_ACCOUNT_ID      = 123456789012
```

### Manual deployment

```bash
cd infrastructure
npx cdk deploy \
  TripTallyNetworkStack \
  TripTallyDatabaseStack \
  TripTallyStorageStack \
  TripTallyApiStack \
  --require-approval never
```

### CI/CD

- **PR to main** → `ci.yml` runs backend tests, type checks (backend + frontend), and a frontend build check
- **Push to main** → `deploy.yml` deploys all CDK stacks, then deploys the frontend to Amplify

OIDC authentication is used — no AWS access keys are stored in GitHub Secrets.

---

## Testing

Unit tests live in `backend/src/services/__tests__/`. Run them with:

```bash
cd backend && npm test
```

The debt simplification algorithm has the most critical coverage. When adding new split computation logic, add tests alongside it.

---

## Code Conventions

- **TypeScript strict mode** is enabled in all packages
- **Zod** is used for all runtime validation (Lambda input and API client responses)
- **No floating-point money** — always integer cents
- Repository interfaces (`ITripRepository`, etc.) are defined in `repositories/types.ts`; Lambda handlers never import from `repositories/postgres/` directly — they go through services
- Shared types between frontend and backend live in `shared/types/index.ts`
- Do not store settlements in the database — compute them fresh from balances on every request
