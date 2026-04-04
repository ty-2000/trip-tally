# Deployment Setup Guide

## Prerequisites
- AWS CLI configured with admin credentials (one-time only)
- Node.js 20+
- CDK bootstrapped in your account

## Step 1: Bootstrap CDK (once per AWS account/region)

```bash
cd infrastructure
npm install
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

## Step 2: Create the GitHub OIDC role (once)

This creates an IAM role that GitHub Actions can assume without storing AWS access keys.

```bash
# Replace with your GitHub org/username and repo name
export GITHUB_REPO="your-github-username/trip-tally"
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1

npx cdk deploy TripTallyGitHubOidcStack --require-approval never
```

Copy the `DeployRoleArn` output value — you'll need it in the next step.

## Step 3: Add GitHub repository secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | The `DeployRoleArn` from Step 2 |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |

## Step 4: Push to main

The deploy pipeline runs automatically on every push to `main`:

```
Push to main
  ├── deploy-infrastructure  (CDK: all 5 stacks)
  ├── deploy-frontend        (build Next.js → S3 → CloudFront invalidation)
  └── run-migrations         (DB schema is idempotent)
```

PRs run CI checks (tests + type check + build) but do NOT deploy.

## Step 5: Apply the DB schema (first deploy only)

After the first CDK deploy, connect to RDS and run the schema:

```bash
# Get the DB secret from Secrets Manager
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id /trip-tally/db-credentials \
  --query SecretString --output text)

DB_HOST=$(echo $SECRET | jq -r .host)
DB_USER=$(echo $SECRET | jq -r .username)
DB_PASS=$(echo $SECRET | jq -r .password)

# Run schema via an EC2 bastion or AWS Systems Manager Session Manager
# (RDS is in a private subnet, not directly accessible from the internet)
psql "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/triptally" \
  -f backend/src/db/schema.sql
```

## Workflow overview

```
.github/
├── workflows/
│   ├── ci.yml      — PR checks: tests, type check, build (no deploy)
│   └── deploy.yml  — Push to main: CDK → S3/CloudFront
```

## Environment variables in production

These are set automatically by CDK and the deploy workflow:
- `NEXT_PUBLIC_API_URL` — set at Next.js build time from CDK output
- Lambda env vars (`DB_HOST`, `RECEIPTS_BUCKET`, etc.) — set by CDK at deploy time
- DB credentials — fetched from Secrets Manager at Lambda cold start
