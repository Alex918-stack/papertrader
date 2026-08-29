-- ============================================================================
-- AI Paper Trader — Stage 4: atomic Redis -> Postgres import for chat
-- ============================================================================
-- Run once in the Supabase SQL Editor, after 0001-0004. Same pattern as
-- import_legacy_portfolio (0002): idempotent, never overwrites real data,
-- security invoker so RLS still applies underneath the explicit
-- `where user_id = auth.uid()` scoping.
--
-- Called once per surface (surface = 'ai' for the old chat:<email> Redis
-- key, surface = 'trading' for history:<email>:trading-chat), not once for
-- both - each surface's "untouched" check and import are independent, the
-- same way the two Redis keys are independently checked and (eventually,
-- manually) cleared.
create or replace function public.import_legacy_conversations(
  p_surface text,
  p_conversations jsonb
)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_existing_count int;
  conv jsonb;
  msg jsonb;
  v_conversation_id uuid;
  v_ordinal int;
begin
  if p_surface not in ('ai', 'trading') then
    raise exception 'Invalid surface: %', p_surface;
  end if;

  select count(*) into v_existing_count
  from conversations
  where user_id = auth.uid() and surface = p_surface;

  -- Never overwrite: if this user already has any conversation on this
  -- surface, either the import already ran, or they started fresh on
  -- Postgres before ever triggering it. Either way, Postgres is
  -- authoritative and the legacy blob is skipped, not merged.
  if v_existing_count > 0 then
    return false;
  end if;

  for conv in select * from jsonb_array_elements(p_conversations)
  loop
    v_conversation_id := (conv ->> 'id')::uuid;

    -- created_at = updated_at as the stand-in, same reasoning as the
    -- portfolio import: the Redis blob only ever tracked one timestamp per
    -- conversation (updatedAt), so that's the one real value available for
    -- both columns - not "now," which would be flatly wrong, and not a
    -- fabricated creation time we have no basis for.
    insert into conversations (id, user_id, surface, title, created_at, updated_at)
    values (
      v_conversation_id,
      auth.uid(),
      p_surface,
      coalesce(conv ->> 'title', 'New chat'),
      to_timestamp((conv ->> 'updatedAt')::numeric / 1000.0),
      to_timestamp((conv ->> 'updatedAt')::numeric / 1000.0)
    );

    v_ordinal := 0;
    for msg in select * from jsonb_array_elements(coalesce(conv -> 'messages', '[]'::jsonb))
    loop
      -- nullif(..., 'null'::jsonb) matters here: a JSON key holding the
      -- literal null (proposedTrades was always explicitly set to null
      -- when absent, per ChatWindow.tsx's `data.proposedTrades ?? null`)
      -- is NOT the same thing as a missing key, and jsonb's -> operator
      -- returns the jsonb null value in the first case, not a real SQL
      -- NULL. Without this, proposed_trades could end up holding the
      -- literal 'null'::jsonb - a non-null jsonb value - which would
      -- silently fail messages_trade_data_assistant_only or just be
      -- wrong to read back. This makes both cases (missing key, explicit
      -- JSON null) collapse to one true SQL NULL either way.
      insert into messages (
        conversation_id, role, content, ordinal,
        proposed_trades, execution_results
      )
      values (
        v_conversation_id,
        msg ->> 'role',
        msg ->> 'content',
        v_ordinal,
        nullif(msg -> 'proposedTrades', 'null'::jsonb),
        nullif(msg -> 'executionResults', 'null'::jsonb)
      );
      v_ordinal := v_ordinal + 1;
    end loop;
  end loop;

  return true;
end;
$$;

grant execute on function public.import_legacy_conversations to authenticated;
