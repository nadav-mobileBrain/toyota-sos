This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash

bun dev
```

# transfer owener

# For Localhost:

curl "http://localhost:3000/api/cron/check-late-tasks?key=ToyotaSecureKey9988"

# For Production / Preview URL:

curl "https://toyota-sos.vercel.app/api/cron/check-late-tasks?key=ToyotaSecureKey9988"

## fix driver credentials

update auth.users
set
encrypted_password = crypt('Driver@22222', gen_salt('bf')),
updated_at = now()
where email = 'b@b.com';
