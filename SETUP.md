# NexBooks – Go Live in 15 Minutes

## Prerequisites
- Node.js 18+ and pnpm installed
- Supabase account (free tier works)
- OpenAI API key (GPT-4o access recommended)
- Vercel account for hosting

---

## Step 1 – Clone and Install

```bash
git clone <your-repo-url>
cd AI-Accounting-MVP-Final-
pnpm install
```

---

## Step 2 – Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region (Mumbai `ap-south-1` recommended for India)
3. Copy these from **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 3 – Run Database Setup

1. In Supabase dashboard → **SQL Editor**
2. Open `scripts/000_MASTER_SETUP.sql` from this repo
3. Paste the entire contents and click **Run**
4. You should see "Success" with no errors

This creates all tables, views, functions, RLS policies, and the storage bucket in one shot.

---

## Step 4 – Set Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron security (generate any random string)
CRON_SECRET=your-random-secret-here

# Razorpay (optional – only needed for billing)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_ID_ESSENTIALS=plan_...
RAZORPAY_PLAN_ID_PROFESSIONAL=plan_...
RAZORPAY_PLAN_ID_ENTERPRISE=plan_...
```

---

## Step 5 – Run Locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — sign up, complete onboarding, and start using the AI.

---

## Step 6 – Deploy to Vercel

```bash
pnpm build   # verify no build errors first
```

Then in Vercel dashboard:
1. Import the GitHub repository
2. Add all environment variables from Step 4
3. Change `NEXT_PUBLIC_APP_URL` to your Vercel domain
4. Deploy

The `vercel.json` cron job (`0 0 1 * *`) resets monthly AI usage on the 1st of each month automatically.

---

## Core User Flow

1. **Sign up** → **Onboarding** (company name, GSTIN/PAN, chart of accounts seeded automatically)
2. **AI Chat** → Type anything in plain English:
   - *"Received ₹50,000 from Tata Consultancy for consulting services"*
   - *"Paid ₹12,000 rent for office, TDS deducted"*
   - *"Sales invoice to ABC Ltd for ₹1,00,000 + 18% GST"*
3. **Upload Invoices** → AI reads PDF/image and creates journal entries automatically
4. **Reports** → Balance Sheet, P&L, Trial Balance, Ledger — all update in real time

---

## Indian Accounting Features

| Feature | Details |
|---|---|
| GST | CGST+SGST (intra-state), IGST (inter-state), rates 5/12/18/28% |
| TDS | 194J Professional 10%, 194I Rent 10%, 194C Contractor 1-2% |
| Fiscal Year | April 1 – March 31 (configurable to Jan–Dec) |
| Chart of Accounts | Pre-seeded with Indian standard accounts on signup |
| Reports | Balance Sheet, P&L, Trial Balance, Ledger (all downloadable) |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server only) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (GPT-4o recommended) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your deployed app URL |
| `CRON_SECRET` | Yes | Random string to secure cron endpoint |
| `RAZORPAY_KEY_ID` | No | Razorpay key for billing |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret for billing |
| `RAZORPAY_WEBHOOK_SECRET` | No | Razorpay webhook verification |
| `RAZORPAY_PLAN_ID_ESSENTIALS` | No | Razorpay plan ID for Essentials tier |
| `RAZORPAY_PLAN_ID_PROFESSIONAL` | No | Razorpay plan ID for Professional tier |
| `RAZORPAY_PLAN_ID_ENTERPRISE` | No | Razorpay plan ID for Enterprise tier |

---

## Support

- Email: connect@nexbooks.co.in
- Website: www.nexbooks.co.in
