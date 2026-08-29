-- ============================================================================
-- AI Paper Trader — Stage 4: separate chat surfaces, explicit message order
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001 and 0002.

-- ----------------------------------------------------------------------------
-- conversations.surface
-- ----------------------------------------------------------------------------
-- Distinguishes the two chat surfaces that used to be separate Redis keys
-- (chat:<email> for the /ai page, history:<email>:trading-chat for
-- TradingAssistant) - without this they'd merge into one undifferentiated
-- list. No default: conversations is empty right now (chat has been
-- Redis-only through stage 3), so there's no existing-row backfill that
-- needs one, and every insert going forward - live writes and the Redis
-- import - should name this explicitly. A default would turn a future
-- "forgot to pass surface" bug into a silent wrong-bucket instead of a loud
-- NOT NULL failure at the exact insert that's wrong.
alter table public.conversations
  add column surface text not null check (surface in ('ai', 'trading'));

-- The composite index below serves user_id-alone queries too (leftmost
-- prefix of a B-tree index), so the old single-column index is now dead
-- weight - same cleanup as dropping the redundant plain index on
-- portfolios.user_id in 0002 once its unique constraint already provided one.
drop index if exists conversations_user_id_idx;
create index conversations_user_id_surface_idx on public.conversations (user_id, surface);

-- ----------------------------------------------------------------------------
-- messages.ordinal
-- ----------------------------------------------------------------------------
-- Named ordinal rather than position: legal as a bare Postgres column name
-- either way (the SQL-standard POSITION(x IN y) function syntax is what's
-- actually reserved, not the identifier on its own), but ordinal reads
-- unambiguously and there's never a reason to wonder whether a stray
-- "position" in a query is this column or the built-in function.
--
-- Redis stored each conversation's messages as a plain ordered array with
-- no per-message timestamp - only Conversation.updatedAt existed, one per
-- conversation. Reconstructing per-message order from created_at (which
-- would default to the same import instant for every row in a batch)
-- would scramble it. This column instead encodes the one fact actually
-- available - array order - directly and honestly, rather than
-- synthesizing timestamps that would look real without being real.
--
-- No default, same reasoning as surface above: every insert, live or
-- imported, computes and states its own ordinal explicitly.
alter table public.messages
  add column ordinal integer not null;

-- Mirrors holdings_portfolio_id_symbol_unique: without this, two messages
-- could claim the same slot in the same conversation and ordering would be
-- ambiguous again. It also means the live insert path's
-- "select coalesce(max(ordinal), -1) + 1" fails loudly with a unique
-- violation under a race condition instead of silently duplicating a slot.
alter table public.messages
  add constraint messages_conversation_id_ordinal_unique unique (conversation_id, ordinal);

-- This unique constraint's backing index already covers conversation_id
-- alone as its leading column, so the plain index from 0001 is now
-- redundant - same leftmost-prefix reasoning as conversations_user_id_idx
-- above, just applied to messages instead.
drop index if exists messages_conversation_id_idx;

-- ----------------------------------------------------------------------------
-- Unrelated to stage 4 - found while checking the pattern above against the
-- rest of the schema, not something you asked for this stage. Flagging
-- rather than folding in silently: holdings_portfolio_id_symbol_unique
-- (0001) has made this index redundant since the day it was added - both
-- were introduced in the same migration and I didn't cross-check them
-- against each other at the time.
drop index if exists holdings_portfolio_id_idx;
