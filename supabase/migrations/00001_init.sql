-- Wealth Dashboard — initial schema (v2)
-- Money is bigint IDR (no decimals). Dates are day-granular.
-- Every table is RLS-locked to the owning user.
--
-- v2 notes:
-- - No allocation matrix: every income row carries its own split in
--   income_allocations (amounts must sum exactly to the income amount —
--   enforced in app code, both server action and form).
-- - budget_types.kind separates spending envelopes from the investment
--   envelope. Investment-kind envelopes are deployed via the investments
--   module, never via expenses.
-- - Investments: asset_classes with per-budget-year target percents,
--   investment_items (the buyable things), investment_transactions
--   (buy/sell, total IDR, optional quantity; unit price never stored).

-- ============================================================
-- Tables
-- ============================================================

create table public.income_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  cadence text not null default 'yearly' check (cadence in ('monthly', 'yearly')),
  is_active boolean not null default true,
  unique (user_id, name)
);

create table public.budget_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  kind text not null default 'spending' check (kind in ('spending', 'investment')),
  is_active boolean not null default true
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  default_budget_type_id uuid null references public.budget_types(id) on delete set null,
  is_active boolean not null default true
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  starts_on date null,
  ends_on date null,
  notes text null
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  amount bigint not null check (amount > 0),
  date date not null,
  income_type_id uuid not null references public.income_types(id) on delete restrict,
  notes text null
);

-- Per-income envelope split. Only non-zero cells are stored; the app
-- guarantees sum(amount) = incomes.amount for each income.
create table public.income_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  income_id uuid not null references public.incomes(id) on delete cascade,
  budget_type_id uuid not null references public.budget_types(id) on delete restrict,
  amount bigint not null check (amount > 0),
  unique (user_id, income_id, budget_type_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  -- Negative expenses are legal (surplus/refund refills the budget); only 0 is invalid.
  amount bigint not null check (amount <> 0),
  date date not null,
  budget_type_id uuid not null references public.budget_types(id) on delete restrict,
  expense_category_id uuid not null references public.expense_categories(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  notes text null
);

-- Investment risk buckets (Commodities, Stocks, Fixed, ...).
create table public.asset_classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  is_active boolean not null default true,
  sort integer not null default 0,
  unique (user_id, name)
);

-- Target percent per class per BUDGET year (label like '2026' = 25 Dec 2025 – 24 Dec 2026).
-- Changing targets applies to the whole year. Sum ≠ 100 warns in the UI, never blocks.
create table public.asset_class_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  asset_class_id uuid not null references public.asset_classes(id) on delete cascade,
  year text not null,
  percent numeric(5,2) not null check (percent >= 0 and percent <= 100),
  unique (user_id, asset_class_id, year)
);

-- The buyable things (BBCA, BTC, Deposito Superbank...). Archive, never hard-delete.
create table public.investment_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  asset_class_id uuid not null references public.asset_classes(id) on delete restrict,
  name text not null,
  is_active boolean not null default true
);

-- Buy/sell ledger. amount = total IDR of the transaction; quantity optional
-- (unit price = amount/quantity, derived in app code, never stored).
create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  item_id uuid not null references public.investment_items(id) on delete restrict,
  side text not null check (side in ('buy', 'sell')),
  amount bigint not null check (amount > 0),
  quantity numeric null check (quantity is null or quantity > 0),
  date date not null,
  notes text null
);

-- Yield/dividend incomes (v2.2): an income attributed to an investment item.
-- Recording a yield in the investments module creates a normal income (with an
-- envelope split) that carries this link for per-holding attribution. Declared
-- via alter because investment_items is created after incomes.
alter table public.incomes
  add column investment_item_id uuid null references public.investment_items(id) on delete restrict;

create index incomes_user_date_idx on public.incomes (user_id, date);
create index incomes_user_item_idx on public.incomes (user_id, investment_item_id)
  where investment_item_id is not null;
create index income_allocations_user_income_idx on public.income_allocations (user_id, income_id);
create index expenses_user_date_idx on public.expenses (user_id, date);
create index expenses_user_event_idx on public.expenses (user_id, event_id);
create index investment_transactions_user_date_idx on public.investment_transactions (user_id, date);
create index investment_transactions_user_item_idx on public.investment_transactions (user_id, item_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.income_types enable row level security;
alter table public.budget_types enable row level security;
alter table public.expense_categories enable row level security;
alter table public.events enable row level security;
alter table public.incomes enable row level security;
alter table public.income_allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.asset_classes enable row level security;
alter table public.asset_class_targets enable row level security;
alter table public.investment_items enable row level security;
alter table public.investment_transactions enable row level security;

create policy "own rows" on public.income_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.budget_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.expense_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.income_allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.asset_classes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.asset_class_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.investment_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.investment_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Seed defaults for a new user (fires when the account is created)
-- ============================================================

create or replace function public.seed_user_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invest uuid;
  v_cash   uuid;
  v_life   uuid;
  v_fun    uuid;
  v_giving uuid;
  v_stocks uuid;
  v_crypto uuid;
  v_fixed  uuid;
  v_class  record;
  -- Budget year of "today" in WIB: day >= 25 rolls into next month, so
  -- adding 7 days then truncating to month gives the budget month; its
  -- year is the budget-year label ('2026' = 25 Dec 2025 – 24 Dec 2026).
  v_year text := to_char(date_trunc('month', (now() at time zone 'Asia/Jakarta')::date + 7), 'YYYY');
begin
  insert into budget_types (user_id, name, kind) values (new.id, 'Invest', 'investment') returning id into v_invest;
  insert into budget_types (user_id, name) values (new.id, 'Cash')   returning id into v_cash;
  insert into budget_types (user_id, name) values (new.id, 'Life')   returning id into v_life;
  insert into budget_types (user_id, name) values (new.id, 'Fun')    returning id into v_fun;
  insert into budget_types (user_id, name) values (new.id, 'Giving') returning id into v_giving;

  insert into income_types (user_id, name, cadence) values (new.id, 'Salary', 'monthly');
  insert into income_types (user_id, name, cadence)
    select new.id, t.name, 'yearly'
    from (values ('THR'), ('Yield'), ('Bonus'), ('Angpao'), ('TCG Yield'), ('Others')) as t(name);

  insert into expense_categories (user_id, name, default_budget_type_id) values
    (new.id, 'Food',       v_life),
    (new.id, 'Daily',      v_life),
    (new.id, 'Extra',      v_fun),
    (new.id, 'Transport',  v_life),
    (new.id, 'Jajan',      v_fun),
    (new.id, 'Give',       v_giving),
    (new.id, 'Cigarettes', v_life),
    (new.id, 'Kolekte',    v_giving),
    (new.id, 'Kado',       v_life),
    (new.id, 'Cash',       v_cash);

  -- Asset classes with default risk split (percent targets for the current budget year).
  insert into asset_classes (user_id, name, sort) values (new.id, 'Commodities', 0);
  insert into asset_classes (user_id, name, sort) values (new.id, 'Stocks', 1) returning id into v_stocks;
  insert into asset_classes (user_id, name, sort) values (new.id, 'Fixed', 2) returning id into v_fixed;
  insert into asset_classes (user_id, name, sort) values (new.id, 'Crypto', 3) returning id into v_crypto;
  insert into asset_classes (user_id, name, sort) values (new.id, 'Others', 4);
  insert into asset_classes (user_id, name, sort) values (new.id, 'Business', 5);
  insert into asset_classes (user_id, name, sort) values (new.id, 'Buffer', 6);

  for v_class in select id, name from asset_classes where user_id = new.id loop
    insert into asset_class_targets (user_id, asset_class_id, year, percent)
      values (new.id, v_class.id, v_year,
        case v_class.name
          when 'Commodities' then 5
          when 'Stocks'      then 45
          when 'Fixed'       then 25
          when 'Crypto'      then 5
          when 'Others'      then 12.5
          when 'Business'    then 5
          when 'Buffer'      then 2.5
        end);
  end loop;

  insert into investment_items (user_id, asset_class_id, name) values
    (new.id, v_stocks, 'BBCA'),
    (new.id, v_stocks, 'CDIA'),
    (new.id, v_stocks, 'BMRI'),
    (new.id, v_stocks, 'AAPL'),
    (new.id, v_crypto, 'BTC'),
    (new.id, v_crypto, 'ETH'),
    (new.id, v_crypto, 'SOL'),
    (new.id, v_fixed,  'Deposito Superbank'),
    (new.id, v_fixed,  'Pasar Uang BRI');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_user_defaults();
