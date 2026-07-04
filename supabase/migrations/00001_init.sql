-- Wealth Dashboard — initial schema
-- Money is bigint IDR (no decimals). Dates are day-granular.
-- Every table is RLS-locked to the owning user.

-- ============================================================
-- Tables
-- ============================================================

create table public.income_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  cadence text not null default 'yearly' check (cadence in ('monthly', 'yearly')),
  allocation_mode text not null default 'percent' check (allocation_mode in ('percent', 'amount')),
  is_active boolean not null default true,
  unique (user_id, name)
);

create table public.budget_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  is_active boolean not null default true
  -- No percentage column: percentages live in budget_allocations.
);

create table public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  income_type_id uuid not null references public.income_types(id) on delete cascade,
  budget_type_id uuid not null references public.budget_types(id) on delete cascade,
  -- percent used when income_type.allocation_mode = 'percent';
  -- amount used when allocation_mode = 'amount'.
  -- Derived % for amount mode is computed in app code, not stored.
  percent numeric(5,2) null check (percent is null or (percent >= 0 and percent <= 100)),
  amount bigint null check (amount is null or amount >= 0),
  unique (user_id, income_type_id, budget_type_id)
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

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  amount bigint not null check (amount > 0),
  date date not null,
  budget_type_id uuid not null references public.budget_types(id) on delete restrict,
  expense_category_id uuid not null references public.expense_categories(id) on delete restrict,
  event_id uuid null references public.events(id) on delete restrict,
  notes text null
);

create index incomes_user_date_idx on public.incomes (user_id, date);
create index expenses_user_date_idx on public.expenses (user_id, date);
create index expenses_user_event_idx on public.expenses (user_id, event_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.income_types enable row level security;
alter table public.budget_types enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.expense_categories enable row level security;
alter table public.events enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;

create policy "own rows" on public.income_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.budget_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.budget_allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.expense_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.expenses
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
  v_salary uuid;
  v_thr    uuid;
  v_invest uuid;
  v_cash   uuid;
  v_life   uuid;
  v_fun    uuid;
  v_giving uuid;
  v_other  record;
begin
  insert into budget_types (user_id, name) values (new.id, 'Invest') returning id into v_invest;
  insert into budget_types (user_id, name) values (new.id, 'Cash')   returning id into v_cash;
  insert into budget_types (user_id, name) values (new.id, 'Life')   returning id into v_life;
  insert into budget_types (user_id, name) values (new.id, 'Fun')    returning id into v_fun;
  insert into budget_types (user_id, name) values (new.id, 'Giving') returning id into v_giving;

  insert into income_types (user_id, name, cadence, allocation_mode)
    values (new.id, 'Salary', 'monthly', 'amount') returning id into v_salary;
  insert into income_types (user_id, name, cadence, allocation_mode)
    values (new.id, 'THR', 'yearly', 'percent') returning id into v_thr;
  insert into income_types (user_id, name, cadence, allocation_mode)
    select new.id, t.name, 'yearly', 'percent'
    from (values ('Yield'), ('Bonus'), ('Angpao'), ('TCG Yield'), ('Others')) as t(name);

  -- Salary: amount mode on a 10jt base (derived 20/10/50/15/5)
  insert into budget_allocations (user_id, income_type_id, budget_type_id, amount) values
    (new.id, v_salary, v_invest, 2000000),
    (new.id, v_salary, v_cash,   1000000),
    (new.id, v_salary, v_life,   5000000),
    (new.id, v_salary, v_fun,    1500000),
    (new.id, v_salary, v_giving,  500000);

  -- THR: percent mode 20/0/50/30/0
  insert into budget_allocations (user_id, income_type_id, budget_type_id, percent) values
    (new.id, v_thr, v_invest, 20),
    (new.id, v_thr, v_cash,    0),
    (new.id, v_thr, v_life,   50),
    (new.id, v_thr, v_fun,    30),
    (new.id, v_thr, v_giving,  0);

  -- Remaining income types: percent mode seeded with Salary's derived split
  for v_other in
    select id from income_types
    where user_id = new.id and name in ('Yield', 'Bonus', 'Angpao', 'TCG Yield', 'Others')
  loop
    insert into budget_allocations (user_id, income_type_id, budget_type_id, percent) values
      (new.id, v_other.id, v_invest, 20),
      (new.id, v_other.id, v_cash,   10),
      (new.id, v_other.id, v_life,   50),
      (new.id, v_other.id, v_fun,    15),
      (new.id, v_other.id, v_giving,  5);
  end loop;

  insert into expense_categories (user_id, name, default_budget_type_id) values
    (new.id, 'Food',       v_life),
    (new.id, 'Daily',      v_life),
    (new.id, 'Extra',      v_fun),
    (new.id, 'Transport',  v_life),
    (new.id, 'Jajan',      v_fun),
    (new.id, 'Give',       v_giving),
    (new.id, 'Cigarettes', v_life),
    (new.id, 'Kolekte',    v_giving),
    (new.id, 'Invest',     v_invest),
    (new.id, 'Kado',       v_life),
    (new.id, 'Cash',       v_cash);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_user_defaults();
