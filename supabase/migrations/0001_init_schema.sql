-- ============================================================================
-- AI Paper Trader — Stage 1: core schema
-- ============================================================================
-- Run once in the Supabase SQL Editor. No application code depends on this
-- yet — this stage is schema only. See the accompanying chat explanation for
-- the reasoning behind each section.

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
-- gen_random_uuid() lives in pgcrypto. Supabase projects almost always have
-- it enabled already; "if not exists" just makes this script safe to re-run.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- user_id is UNIQUE for now: the app only ever assumes one portfolio per
-- user, and a silent duplicate would produce a wrong cash balance with no
-- obvious cause. When multi-portfolio ships, drop this constraint with:
--   alter table public.portfolios drop constraint portfolios_user_id_unique;
-- That one-line migration is cheap; debugging a duplicate portfolio isn't.
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cash numeric(14, 2) not null default 100000.00,
  created_at timestamptz not null default now(),
  constraint portfolios_user_id_unique unique (user_id)
);

-- unique (portfolio_id, symbol): a portfolio can't hold two separate rows
-- for the same symbol - same "silent duplicate breaks the math" failure
-- mode as the portfolios.user_id constraint above. It also means stage 3
-- can upsert with "on conflict (portfolio_id, symbol) do update" instead of
-- a manual select-then-insert-or-update dance.
--
-- check (symbol = upper(symbol)) on both this table and transactions: the
-- unique constraint only catches duplicates if 'AAPL' and 'aapl' are
-- guaranteed to be the same string. Without this, they're not, and the
-- unique constraint silently stops doing its job for mixed-case input.
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  symbol text not null check (symbol = upper(symbol)),
  -- shares > 0 means a fully-closed position must DELETE this row, not
  -- update shares to 0 - the stage 3 sell path needs to do that, and this
  -- constraint is what turns a bug there into a loud failed write instead
  -- of a silent zero-share row sitting in the table.
  shares numeric(20, 8) not null check (shares > 0),
  avg_cost numeric(14, 6) not null check (avg_cost >= 0),
  updated_at timestamptz not null default now(),
  constraint holdings_portfolio_id_symbol_unique unique (portfolio_id, symbol)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  symbol text not null check (symbol = upper(symbol)),
  type text not null check (type in ('buy', 'sell')),
  shares numeric(20, 8) not null check (shares > 0),
  price numeric(14, 6) not null check (price >= 0),
  total numeric(14, 2) not null check (total >= 0),
  executed_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
-- Postgres does NOT automatically index foreign key columns - only the
-- primary key side of a relationship gets one for free. Every FK below is
-- indexed explicitly so lookups and cascading deletes stay fast as tables grow.
--
-- No separate index on portfolios.user_id: the unique constraint added above
-- already creates one for free (unique constraints are backed by a unique
-- btree index). A second, non-unique index on the same column would be dead
-- weight.

create index holdings_portfolio_id_idx on public.holdings (portfolio_id);
create index transactions_portfolio_id_idx on public.transactions (portfolio_id);
create index transactions_executed_at_idx on public.transactions (executed_at desc);
create index conversations_user_id_idx on public.conversations (user_id);
create index conversations_updated_at_idx on public.conversations (updated_at desc);
create index messages_conversation_id_idx on public.messages (conversation_id);

-- ----------------------------------------------------------------------------
-- updated_at auto-maintenance
-- ----------------------------------------------------------------------------
-- Having an updated_at column only means something if it's actually kept
-- current. This trigger function sets it to now() on every UPDATE, so
-- application code never has to remember to do it manually.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Every auth.uid() call below is wrapped as (select auth.uid()) rather than
-- called bare. This is Postgres's scalar-subquery caching at work: wrapped
-- in a select, the planner can recognize the result doesn't depend on the
-- row currently being checked, evaluate it once per statement, and reuse
-- that value - instead of invoking the function fresh for every row a scan
-- touches. Bare auth.uid() is not wrong, just slower on any query that
-- scans many rows. This is Supabase's own documented RLS performance
-- recommendation, not a speculative micro-optimization.

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- profiles: a user can see and edit only their own row. There is no insert
-- policy on purpose - profile rows are created by the handle_new_user
-- trigger below, not by client code.
create policy "profiles_select_own" on public.profiles
  for select
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- portfolios: same shape as profiles - read and update own row, no client
-- insert (trigger-created) or delete.
create policy "portfolios_select_own" on public.portfolios
  for select
  using ((select auth.uid()) = user_id);

create policy "portfolios_update_own" on public.portfolios
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- holdings: no user_id column here - ownership is proven by joining up to
-- the portfolio that owns this holding. Full CRUD, since the app actively
-- creates, adjusts, and removes holding rows as trades happen.
create policy "holdings_all_own" on public.holdings
  for all
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = holdings.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = holdings.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  );

-- transactions: an append-only audit trail. Select and insert only - no
-- update or delete policy, so a trade record can never be edited or erased
-- once written, even by its own owner.
create policy "transactions_select_own" on public.transactions
  for select
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  );

create policy "transactions_insert_own" on public.transactions
  for insert
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = (select auth.uid())
    )
  );

-- conversations: owned directly via user_id. Full CRUD - matches the
-- existing app, which already lets a user rename (retitle) and delete chats.
create policy "conversations_all_own" on public.conversations
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- messages: ownership proven by joining up to the owning conversation.
-- Select and insert only - messages aren't edited or individually deleted;
-- deleting a conversation cascades to its messages via the foreign key.
create policy "messages_select_own" on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

create policy "messages_insert_own" on public.messages
  for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- New user provisioning
-- ----------------------------------------------------------------------------
-- Fires once, right after Supabase Auth inserts a row into auth.users (i.e.
-- right after a successful Google sign-in for a brand new account). Creates
-- the matching profile and a starting portfolio funded with the same
-- $100,000 virtual cash the app already uses in lib/PortfolioContext.tsx.
--
-- Google's OAuth payload isn't perfectly consistent about key names across
-- flows - some populate raw_user_meta_data->>'full_name', others
-- ->>'name'; same story for ->>'avatar_url' vs ->>'picture'. Coalescing
-- across both means we don't silently end up with a null name or avatar
-- just because a particular sign-in flow used the other key. Worth
-- double-checking against a real raw_user_meta_data payload once Google
-- sign-in is actually wired up in a later stage.
--
-- Both inserts end in "on conflict do nothing" so this function is safe to
-- re-run against a user who already has a profile/portfolio. Without that,
-- a retried or duplicate trigger firing would throw a unique-violation that
-- Supabase surfaces to the client as an opaque "Database error saving new
-- user" - "on conflict do nothing" turns that failure mode into a no-op.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.portfolios (user_id, cash)
  values (new.id, 100000.00)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
