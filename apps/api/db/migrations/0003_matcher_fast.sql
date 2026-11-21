-- Faster, same answers (NFR-02 < 500 ms). Two changes, neither alters any result:
--  1. haqdaar_eval becomes plain SQL expressions, which the planner inlines, instead of a
--     PL/pgSQL function called once per predicate.
--  2. A scheme whose (first) hard state rule excludes the citizen's state is skipped before
--     its predicates are evaluated. That rule would fail anyway, so the result set is
--     identical; only the work is smaller (a citizen's state has ~100-600 of the 4,000+
--     state-level schemes).

-- Outcome of one predicate for a non-null profile value v.
create or replace function haqdaar_raw(pred jsonb, v jsonb)
returns text
language sql immutable parallel safe as $$
  select case pred->>'op'
    when 'in' then
      case when coalesce(
             case when jsonb_typeof(v) = 'array'
                  -- profile lists are short (caste ["pvtg","st"], occupation [...]): check each
                  then (pred->'value') ? (v->>0) or (pred->'value') ? (v->>1)
                    or (pred->'value') ? (v->>2) or (pred->'value') ? (v->>3)
                  else (pred->'value') ? (v #>> '{}')
             end, false)
           then 'pass' else 'fail' end
    when 'eq' then
      case when v = pred->'value' then 'pass' else 'fail' end
    when 'gte' then
      case when (v #>> '{}')::numeric >= coalesce((pred->>'strict')::numeric, (pred->>'value')::numeric) then 'pass'
           when (v #>> '{}')::numeric >= (pred->>'value')::numeric then 'unknown'
           else 'fail' end
    when 'lte' then
      case when (v #>> '{}')::numeric <= coalesce((pred->>'strict')::numeric, (pred->>'value')::numeric) then 'pass'
           when (v #>> '{}')::numeric <= (pred->>'value')::numeric then 'unknown'
           else 'fail' end
    when 'between' then
      case when (v #>> '{}')::numeric between coalesce((pred->'strict'->>0)::numeric, (pred->'value'->>0)::numeric)
                                          and coalesce((pred->'strict'->>1)::numeric, (pred->'value'->>1)::numeric) then 'pass'
           when (v #>> '{}')::numeric between (pred->'value'->>0)::numeric and (pred->'value'->>1)::numeric then 'unknown'
           else 'fail' end
    else 'unknown'
  end
$$;

-- Same contract as before: 'pass' | 'fail' | 'unknown'; soft predicates never fail.
create or replace function haqdaar_eval(pred jsonb, doc jsonb)
returns text
language sql immutable parallel safe as $$
  select case
    when doc -> (pred->>'field') is null or jsonb_typeof(doc -> (pred->>'field')) = 'null' then 'unknown'
    when pred->>'strength' = 'soft' and haqdaar_raw(pred, doc -> (pred->>'field')) = 'fail' then 'unknown'
    else haqdaar_raw(pred, doc -> (pred->>'field'))
  end
$$;

-- The states allowed by a scheme's first hard state rule (null when it has none).
create or replace function haqdaar_rule_states(rules jsonb)
returns text[]
language sql immutable parallel safe as $$
  select array(select jsonb_array_elements_text(p->'value'))
  from jsonb_array_elements(rules->'all') p
  where p->>'field' = 'state' and p->>'op' = 'in' and coalesce(p->>'strength', 'hard') = 'hard'
  limit 1
$$;

alter table schemes add column if not exists rule_states text[]
  generated always as (haqdaar_rule_states(rules)) stored;

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
    and (s.rule_states is null or doc->>'state' is null or doc->>'state' = any(s.rule_states))
  group by s.id
  having count(*) filter (where e.outcome = 'fail') = 0
$$;
