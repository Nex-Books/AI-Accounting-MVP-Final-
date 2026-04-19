-- ============================================================
-- NexBooks — MASTER DATABASE SETUP
-- Run this ONE file in Supabase SQL Editor to set up everything.
-- Safe to re-run (uses IF NOT EXISTS and OR REPLACE).
-- ============================================================

-- ─── 1. TABLES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text UNIQUE NOT NULL,
  name                      text NOT NULL,
  business_type             text,
  gstin                     text,
  pan                       text,
  address                   text,
  fiscal_year_start         text DEFAULT '04-01',
  base_currency             text DEFAULT 'INR',
  plan                      text DEFAULT 'free'
                              CHECK (plan IN ('free','essentials','professional','enterprise')),
  plan_status               text DEFAULT 'active'
                              CHECK (plan_status IN ('active','cancelled','past_due','pending')),
  razorpay_subscription_id  text,
  ai_transactions_used_month integer DEFAULT 0,
  ai_queries_used_month     integer DEFAULT 0,
  docs_uploaded_month       integer DEFAULT 0,
  storage_used_bytes        bigint DEFAULT 0,
  created_at                timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  role        text DEFAULT 'owner' CHECK (role IN ('owner','accountant','viewer')),
  full_name   text,
  email       text,
  avatar_url  text,
  is_active   boolean DEFAULT true,
  last_login_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  sub_type        text,
  parent_id       uuid REFERENCES accounts(id),
  description     text,
  opening_balance numeric DEFAULT 0,
  is_system       boolean DEFAULT false,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS parties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('customer','vendor','both')),
  email           text,
  phone           text,
  gstin           text,
  pan             text,
  address         text,
  city            text,
  state           text,
  pincode         text,
  opening_balance numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  credit_limit    numeric,
  credit_days     integer,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date             date NOT NULL,
  description      text NOT NULL,
  reference_number text,
  document_id      uuid,  -- FK added after documents table
  created_by       uuid REFERENCES users(id),
  created_by_ai    boolean DEFAULT false,
  is_opening_balance boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name           text NOT NULL,
  file_type           text,
  storage_path        text NOT NULL DEFAULT '',
  file_size_bytes     bigint DEFAULT 0,
  journal_entry_id    uuid REFERENCES journal_entries(id),
  ocr_status          text DEFAULT 'pending'
                        CHECK (ocr_status IN ('pending','processing','completed','failed')),
  ocr_extracted_data  jsonb,
  uploaded_by         uuid REFERENCES users(id),
  uploaded_at         timestamptz DEFAULT now()
);

-- Add FK from journal_entries → documents (after both tables exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'document_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN document_id uuid REFERENCES documents(id);
  ELSE
    -- column exists; add FK constraint if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'journal_entries'
        AND kcu.column_name = 'document_id'
    ) THEN
      ALTER TABLE journal_entries
        ADD CONSTRAINT journal_entries_document_id_fkey
        FOREIGN KEY (document_id) REFERENCES documents(id);
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS journal_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       uuid NOT NULL REFERENCES accounts(id),
  party_id         uuid REFERENCES parties(id),
  debit            numeric DEFAULT 0,
  credit           numeric DEFAULT 0,
  narration        text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id),
  table_name  text NOT NULL,
  record_id   uuid,
  action      text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  role        text NOT NULL CHECK (role IN ('user','assistant','system')),
  content     text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid REFERENCES companies(id),
  provider      text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  processed     boolean DEFAULT false,
  error_message text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('accountant','viewer')),
  token       text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by  uuid REFERENCES users(id),
  expires_at  timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ─── 2. INDEXES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_company           ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company        ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type           ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date    ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry     ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account   ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_company   ON journal_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company       ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_parties_company         ON parties(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_company   ON chat_messages(company_id);

-- ─── 3. ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations   ENABLE ROW LEVEL SECURITY;

-- Helper: get company_id for current user (avoids recursive RLS)
CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Drop old policies (safe to re-run)
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Companies
CREATE POLICY "companies_select"   ON companies FOR SELECT USING (id = auth_company_id());
CREATE POLICY "companies_insert"   ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "companies_update"   ON companies FOR UPDATE USING (id = auth_company_id());

-- Users
CREATE POLICY "users_select"       ON users FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "users_insert"       ON users FOR INSERT WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);
CREATE POLICY "users_update"       ON users FOR UPDATE USING (id = auth.uid() OR company_id = auth_company_id());
CREATE POLICY "users_delete"       ON users FOR DELETE USING (company_id = auth_company_id());

-- Accounts
CREATE POLICY "accounts_select"    ON accounts FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "accounts_insert"    ON accounts FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "accounts_update"    ON accounts FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "accounts_delete"    ON accounts FOR DELETE USING (company_id = auth_company_id() AND is_system = false);

-- Parties
CREATE POLICY "parties_select"     ON parties FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "parties_insert"     ON parties FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "parties_update"     ON parties FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "parties_delete"     ON parties FOR DELETE USING (company_id = auth_company_id());

-- Documents
CREATE POLICY "documents_select"   ON documents FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "documents_insert"   ON documents FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "documents_update"   ON documents FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "documents_delete"   ON documents FOR DELETE USING (company_id = auth_company_id());

-- Journal Entries
CREATE POLICY "je_select"          ON journal_entries FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "je_insert"          ON journal_entries FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "je_update"          ON journal_entries FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "je_delete"          ON journal_entries FOR DELETE USING (company_id = auth_company_id());

-- Journal Lines
CREATE POLICY "jl_select"          ON journal_lines FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "jl_insert"          ON journal_lines FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "jl_update"          ON journal_lines FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "jl_delete"          ON journal_lines FOR DELETE USING (company_id = auth_company_id());

-- Audit Logs
CREATE POLICY "audit_select"       ON audit_logs FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "audit_insert"       ON audit_logs FOR INSERT WITH CHECK (company_id = auth_company_id());

-- Chat Messages
CREATE POLICY "chat_select"        ON chat_messages FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "chat_insert"        ON chat_messages FOR INSERT WITH CHECK (company_id = auth_company_id());

-- Webhook Logs (service role only for insert; owners for select)
CREATE POLICY "webhooks_select"    ON webhook_logs FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "webhooks_insert"    ON webhook_logs FOR INSERT WITH CHECK (true);

-- Invitations
CREATE POLICY "invites_select"     ON invitations FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "invites_insert"     ON invitations FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "invites_update"     ON invitations FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "invites_delete"     ON invitations FOR DELETE USING (company_id = auth_company_id());

-- ─── 4. AUTH TRIGGER — auto-create user on signup ───────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'owner'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 5. CORE ACCOUNTING FUNCTIONS ───────────────────────────

-- Get single account balance as of a date
CREATE OR REPLACE FUNCTION get_account_balance(p_account_id uuid, p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_opening  numeric;
  v_debits   numeric;
  v_credits  numeric;
  v_type     text;
BEGIN
  SELECT type, COALESCE(opening_balance, 0) INTO v_type, v_opening
  FROM accounts WHERE id = p_account_id;

  SELECT COALESCE(SUM(jl.debit), 0), COALESCE(SUM(jl.credit), 0)
  INTO v_debits, v_credits
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE jl.account_id = p_account_id AND je.date <= p_as_of_date;

  IF v_type IN ('asset', 'expense') THEN
    RETURN v_opening + v_debits - v_credits;
  ELSE
    RETURN v_opening + v_credits - v_debits;
  END IF;
END;
$$;

-- Dashboard KPIs
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fy_start  date;
  v_today     date := CURRENT_DATE;
  v_revenue   numeric := 0;
  v_expenses  numeric := 0;
  v_assets    numeric := 0;
  v_liabilities numeric := 0;
  v_cash      numeric := 0;
  v_receivables numeric := 0;
  v_payables  numeric := 0;
  v_fy_start_text text;
BEGIN
  -- Determine fiscal year start
  SELECT fiscal_year_start INTO v_fy_start_text FROM companies WHERE id = p_company_id;
  v_fy_start_text := COALESCE(v_fy_start_text, '04-01');

  -- Build fiscal year start date for current year
  IF EXTRACT(MONTH FROM v_today) >= CAST(split_part(v_fy_start_text, '-', 1) AS int) THEN
    v_fy_start := make_date(EXTRACT(YEAR FROM v_today)::int,
                             CAST(split_part(v_fy_start_text, '-', 1) AS int),
                             CAST(split_part(v_fy_start_text, '-', 2) AS int));
  ELSE
    v_fy_start := make_date(EXTRACT(YEAR FROM v_today)::int - 1,
                             CAST(split_part(v_fy_start_text, '-', 1) AS int),
                             CAST(split_part(v_fy_start_text, '-', 2) AS int));
  END IF;

  -- Total income (current FY)
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0) INTO v_revenue
  FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE a.company_id = p_company_id AND a.type = 'income'
    AND je.date BETWEEN v_fy_start AND v_today;

  -- Total expenses (current FY)
  SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_expenses
  FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE a.company_id = p_company_id AND a.type = 'expense'
    AND je.date BETWEEN v_fy_start AND v_today;

  -- Cash balance (all cash/bank accounts)
  SELECT COALESCE(SUM(
    a.opening_balance + COALESCE(sub.net, 0)
  ), 0) INTO v_cash
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.debit - jl.credit) as net
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= v_today
    GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id
    AND a.type = 'asset'
    AND (a.sub_type IN ('current_asset') OR a.code IN ('1000','1010'))
    AND a.is_active = true;

  -- Total assets
  SELECT COALESCE(SUM(
    a.opening_balance + COALESCE(sub.net, 0)
  ), 0) INTO v_assets
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.debit - jl.credit) as net
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= v_today GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id AND a.type = 'asset' AND a.is_active = true;

  -- Total liabilities
  SELECT COALESCE(SUM(
    a.opening_balance + COALESCE(sub.net, 0)
  ), 0) INTO v_liabilities
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.credit - jl.debit) as net
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= v_today GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id AND a.type = 'liability' AND a.is_active = true;

  -- Accounts receivable
  SELECT COALESCE(SUM(
    a.opening_balance + COALESCE(sub.net, 0)
  ), 0) INTO v_receivables
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.debit - jl.credit) as net
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= v_today GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id
    AND a.type = 'asset'
    AND (a.sub_type = 'accounts_receivable' OR a.code = '1100')
    AND a.is_active = true;

  -- Accounts payable
  SELECT COALESCE(SUM(
    a.opening_balance + COALESCE(sub.net, 0)
  ), 0) INTO v_payables
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.credit - jl.debit) as net
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= v_today GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id
    AND a.type = 'liability'
    AND (a.sub_type = 'accounts_payable' OR a.code = '2000')
    AND a.is_active = true;

  RETURN jsonb_build_object(
    'total_revenue',    v_revenue,
    'total_expenses',   v_expenses,
    'net_income',       v_revenue - v_expenses,
    'total_assets',     v_assets,
    'total_liabilities', v_liabilities,
    'net_worth',        v_assets - v_liabilities,
    'cash_balance',     v_cash,
    'total_receivables', v_receivables,
    'total_payables',   v_payables,
    'revenue_growth',   0,
    'expense_growth',   0
  );
END;
$$;

-- Financial Summary (used by AI chat tool get_financial_summary)
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_company_id uuid,
  p_start_date date,
  p_end_date   date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_revenue    numeric := 0;
  v_expenses   numeric := 0;
  v_assets     numeric := 0;
  v_liabilities numeric := 0;
  v_equity     numeric := 0;
BEGIN
  SELECT COALESCE(SUM(jl.credit - jl.debit), 0) INTO v_revenue
  FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE a.company_id = p_company_id AND a.type = 'income'
    AND je.date BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_expenses
  FROM journal_lines jl
  JOIN accounts a ON a.id = jl.account_id
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE a.company_id = p_company_id AND a.type = 'expense'
    AND je.date BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(a.opening_balance + COALESCE(sub.net,0)), 0) INTO v_assets
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.debit - jl.credit) AS net
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= p_end_date GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id AND a.type = 'asset';

  SELECT COALESCE(SUM(a.opening_balance + COALESCE(sub.net,0)), 0) INTO v_liabilities
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.credit - jl.debit) AS net
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= p_end_date GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id AND a.type = 'liability';

  SELECT COALESCE(SUM(a.opening_balance + COALESCE(sub.net,0)), 0) INTO v_equity
  FROM accounts a
  LEFT JOIN (
    SELECT jl.account_id, SUM(jl.credit - jl.debit) AS net
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.date <= p_end_date GROUP BY jl.account_id
  ) sub ON sub.account_id = a.id
  WHERE a.company_id = p_company_id AND a.type = 'equity';

  RETURN jsonb_build_object(
    'total_revenue',    v_revenue,
    'total_expenses',   v_expenses,
    'net_profit',       v_revenue - v_expenses,
    'total_assets',     v_assets,
    'total_liabilities', v_liabilities,
    'total_equity',     v_equity,
    'net_worth',        v_assets - v_liabilities
  );
END;
$$;

-- Trial Balance
CREATE OR REPLACE FUNCTION get_trial_balance(p_company_id uuid, p_as_of_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  account_id       uuid,
  account_code     text,
  account_name     text,
  account_type     text,
  opening_balance  numeric,
  total_debit      numeric,
  total_credit     numeric,
  closing_balance  numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.code,
    a.name,
    a.type,
    COALESCE(a.opening_balance, 0),
    COALESCE(SUM(jl.debit), 0),
    COALESCE(SUM(jl.credit), 0),
    CASE
      WHEN a.type IN ('asset','expense') THEN
        COALESCE(a.opening_balance, 0) + COALESCE(SUM(jl.debit - jl.credit), 0)
      ELSE
        COALESCE(a.opening_balance, 0) + COALESCE(SUM(jl.credit - jl.debit), 0)
    END
  FROM accounts a
  LEFT JOIN journal_lines jl ON jl.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.date <= p_as_of_date
  WHERE a.company_id = p_company_id AND a.is_active = true
  GROUP BY a.id, a.code, a.name, a.type, a.opening_balance
  ORDER BY a.type, a.code;
END;
$$;

-- Ledger with running balance
CREATE OR REPLACE FUNCTION get_ledger(
  p_account_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '1 year')::date,
  p_end_date   date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  entry_date       date,
  description      text,
  reference_number text,
  debit            numeric,
  credit           numeric,
  running_balance  numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_opening  numeric;
  v_type     text;
BEGIN
  SELECT type, COALESCE(opening_balance, 0) INTO v_type, v_opening
  FROM accounts WHERE id = p_account_id;

  -- Opening balance before start date
  SELECT COALESCE(v_opening + CASE
    WHEN v_type IN ('asset','expense') THEN COALESCE(SUM(jl.debit - jl.credit), 0)
    ELSE COALESCE(SUM(jl.credit - jl.debit), 0)
  END, v_opening) INTO v_opening
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE jl.account_id = p_account_id AND je.date < p_start_date;

  RETURN QUERY
  SELECT
    je.date,
    je.description,
    je.reference_number,
    jl.debit,
    jl.credit,
    v_opening + SUM(
      CASE WHEN v_type IN ('asset','expense') THEN jl.debit - jl.credit
           ELSE jl.credit - jl.debit END
    ) OVER (ORDER BY je.date, je.created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE jl.account_id = p_account_id
    AND je.date BETWEEN p_start_date AND p_end_date
  ORDER BY je.date, je.created_at;
END;
$$;

-- ─── 6. VIEWS ────────────────────────────────────────────────

-- Profit & Loss view (current financial year)
CREATE OR REPLACE VIEW profit_loss AS
SELECT
  je.company_id,
  a.type                                                        AS category,
  a.sub_type,
  a.name                                                        AS account_name,
  a.code                                                        AS account_code,
  CASE
    WHEN a.type = 'income'  THEN COALESCE(SUM(jl.credit - jl.debit), 0)
    WHEN a.type = 'expense' THEN COALESCE(SUM(jl.debit - jl.credit), 0)
    ELSE 0
  END                                                           AS amount
FROM journal_lines jl
JOIN accounts a       ON a.id  = jl.account_id
JOIN journal_entries je ON je.id = jl.journal_entry_id
WHERE a.type IN ('income', 'expense')
GROUP BY je.company_id, a.type, a.sub_type, a.name, a.code
HAVING CASE
  WHEN a.type = 'income'  THEN COALESCE(SUM(jl.credit - jl.debit), 0)
  WHEN a.type = 'expense' THEN COALESCE(SUM(jl.debit - jl.credit), 0)
END != 0
ORDER BY a.type DESC, a.code;

-- Balance Sheet view
CREATE OR REPLACE VIEW balance_sheet AS
SELECT
  jl.company_id,
  a.type                                       AS section,
  a.sub_type,
  a.name                                       AS account_name,
  a.code                                       AS account_code,
  CASE
    WHEN a.type IN ('asset','expense') THEN
      COALESCE(a.opening_balance, 0) + COALESCE(SUM(jl.debit - jl.credit), 0)
    ELSE
      COALESCE(a.opening_balance, 0) + COALESCE(SUM(jl.credit - jl.debit), 0)
  END                                          AS amount
FROM journal_lines jl
JOIN accounts a ON a.id = jl.account_id
GROUP BY jl.company_id, a.type, a.sub_type, a.name, a.code, a.opening_balance
ORDER BY a.type, a.code;

-- ─── 7. STORAGE BUCKET ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50 MB per file
  ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "doc_upload"     ON storage.objects;
DROP POLICY IF EXISTS "doc_read"       ON storage.objects;
DROP POLICY IF EXISTS "doc_delete"     ON storage.objects;

CREATE POLICY "doc_upload"  ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND auth.uid() IS NOT NULL
);
CREATE POLICY "doc_read"    ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND auth.uid() IS NOT NULL
);
CREATE POLICY "doc_delete"  ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND auth.uid() IS NOT NULL
);

-- ─── 8. DISABLE EMAIL CONFIRMATION (development) ─────────────
-- Remove this section for production!
UPDATE auth.config SET value = 'false' WHERE parameter = 'mailer_autoconfirm'
  AND EXISTS (SELECT 1 FROM auth.config WHERE parameter = 'mailer_autoconfirm');

-- ─── DONE ─────────────────────────────────────────────────────
-- Run this script, then add your .env.local keys and start the dev server.
-- See SETUP.md for full instructions.
