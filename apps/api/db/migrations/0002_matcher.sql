-- The deterministic matching engine (FR-05, report DFD Level 2 / process 4.0).
-- Pure SQL over JSONB rules. No language model is involved anywhere in this file, and the
-- same profile against the same corpus version always returns the same rows (NFR-01).

-- Evaluates one predicate against the citizen's match document.
-- Returns 'pass', 'fail' or 'unknown' (cannot decide: missing value, or inside an
-- uncertain band). Soft predicates (parsed from free text) never fail: they ask to verify.
create or replace function haqdaar_eval(pred jsonb, doc jsonb)
returns text
language plpgsql immutable parallel safe as $$
declare
  op      text  := pred->>'op';
  v       jsonb := doc -> (pred->>'field');
  x       numeric;
  outcome text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return 'unknown';
  end if;

  if op = 'in' then
    -- profile values may be a list (e.g. caste ["pvtg","st"]): any overlap passes
    outcome := case when exists (
                 select 1
                 from jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v else jsonb_build_array(v) end) have(val)
                 where have.val in (select jsonb_array_elements_text(pred->'value'))
               ) then 'pass' else 'fail' end;

  elsif op = 'eq' then
    outcome := case when v = pred->'value' then 'pass' else 'fail' end;

  elsif op in ('gte', 'lte', 'between') then
    x := (v #>> '{}')::numeric;
    if op = 'gte' then
      outcome := case when x >= coalesce((pred->>'strict')::numeric, (pred->>'value')::numeric) then 'pass'
                      when x >= (pred->>'value')::numeric then 'unknown'
                      else 'fail' end;
    elsif op = 'lte' then
      outcome := case when x <= coalesce((pred->>'strict')::numeric, (pred->>'value')::numeric) then 'pass'
                      when x <= (pred->>'value')::numeric then 'unknown'
                      else 'fail' end;
    else
      outcome := case when x between coalesce((pred->'strict'->>0)::numeric, (pred->'value'->>0)::numeric)
                                 and coalesce((pred->'strict'->>1)::numeric, (pred->'value'->>1)::numeric) then 'pass'
                      when x between (pred->'value'->>0)::numeric and (pred->'value'->>1)::numeric then 'unknown'
                      else 'fail' end;
    end if;

  else
    return 'unknown';
  end if;

  if outcome = 'fail' and pred->>'strength' = 'soft' then
    return 'unknown';
  end if;
  return outcome;
end $$;

-- Every live scheme the profile is not excluded from, with the predicates it passed
-- (the reasons, FR-06) and the ones the citizen still needs to verify.
--   eligible = every rule passed;  likely = nothing failed but something is undecided
create or replace function haqdaar_match(doc jsonb)
returns table (scheme_id bigint, status text, passed jsonb, verify jsonb)
language sql stable as $$
  select s.id,
         case when count(*) filter (where e.outcome = 'unknown') > 0 then 'likely' else 'eligible' end,
         coalesce(jsonb_agg(e.pred order by e.ord) filter (where e.outcome = 'pass'), '[]'::jsonb),
         coalesce(jsonb_agg(e.pred order by e.ord) filter (where e.outcome = 'unknown'), '[]'::jsonb)
  from schemes s
  left join lateral (
    select p.pred, p.ord, haqdaar_eval(p.pred, doc) as outcome
    from jsonb_array_elements(s.rules->'all') with ordinality as p(pred, ord)
  ) e on true
  where s.withdrawn_at is null
  group by s.id
  having count(*) filter (where e.outcome = 'fail') = 0
$$;

-- The corpus version a match ran against: the last successful ingest that changed rows.
create or replace function haqdaar_corpus_version()
returns integer
language sql stable as $$
  select coalesce(max(corpus_version), 0) from ingest_runs where status = 'succeeded'
$$;
