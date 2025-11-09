# Supabase Setup Guide

## Step 1: Create Supabase Projects

Go to https://supabase.com and create two projects:

### Production Project
- **Name:** `toyota-sos-prod`
- **Password:** (generate secure one)
- **Region:** (pick your region)
- **Organization:** (your org)

### Staging Project
- **Name:** `toyota-sos-staging`
- **Password:** (generate secure one)
- **Region:** (same as prod)
- **Organization:** (your org)

## Step 2: Gather Credentials

For EACH project, go to **Settings → API** and copy:
- **Project URL** (top of page, looks like `https://xxxxx.supabase.co`)
- **ANON KEY** (under "Project API keys")
- **SERVICE ROLE KEY** (under "Project API keys")

## Step 3: Configure Local Environment

### `.env.local` (for local development)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key
```

### `.env.production` (for production deployment)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key
```

### `.env.staging` (optional, for staging deployment)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key
```

## Step 4: Verify Setup

```bash
bun run dev
```

Check that the app starts and no `undefined` env errors appear in console.

