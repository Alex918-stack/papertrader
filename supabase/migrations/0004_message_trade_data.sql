-- ============================================================================
-- AI Paper Trader — Stage 4: trade plan data on messages
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001, 0002, and 0003.

-- proposed_trades: the trade plan Brex proposed in this message, if any
-- (symbols, action, shares, rationale, summary) - what renders as the Trade
-- Plan card in the UI.
--
-- execution_results: the outcome once the user clicked Execute Plan on that
-- same card (per-trade success/failure and message) - absent until they do,
-- always absent if they never do.
--
-- Both nullable with no default, unlike surface/ordinal in 0003: NULL
-- already means exactly "absent" here, most messages have neither, and
-- there's no meaningful non-null value to require.
alter table public.messages
  add column proposed_trades jsonb,
  add column execution_results jsonb;

-- Confirmed against the actual code (components/ai/ChatWindow.tsx) before
-- adding this, not assumed: the user message object is built as
-- { role: "user", content } with neither field ever set. proposed_trades is
-- only ever attached to the object built with role: "assistant". execution_
-- results is only ever attached via handleExecuteTrades, whose messageIndex
-- always points at a message that already has proposed_trades truthy - so
-- it's assistant-only transitively, even though nothing enforces that in
-- the calling code itself. This constraint is what makes that true by
-- construction instead of by convention.
alter table public.messages
  add constraint messages_trade_data_assistant_only
  check (
    (proposed_trades is null and execution_results is null)
    or role = 'assistant'
  );

-- proposed_trades is not disposable UI state, even though it renders as one.
-- transactions records what the user actually executed; nothing else in
-- this schema records what Brex suggested and the user chose not to act on.
-- That gap - suggested vs. executed - is a direct input to any future
-- analysis of decision quality (was the advice good? was declining it the
-- right call?), which only exists if this column is treated as real data
-- worth keeping, not scratch state to prune later.
comment on column public.messages.proposed_trades is
  'The trade plan Brex proposed in this message, if any. Not disposable: alongside transactions (what was executed), this is the only record of what was suggested and passed over - a direct input to any future decision-quality analysis, not UI scratch state.';
