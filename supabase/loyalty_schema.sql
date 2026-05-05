-- ─────────────────────────────────────────────
-- Loyalty & customer tables
-- Run once in your Supabase SQL editor
-- ─────────────────────────────────────────────

-- Customer profiles (keyed by phone)
create table if not exists customers (
  id             uuid primary key default gen_random_uuid(),
  phone          text unique not null,          -- digits only, e.g. 60123456789
  name           text,
  email          text,
  points_balance integer not null default 0,
  credit_balance numeric(10,2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Single-row config: how many points per RM spent, minimum order, on/off switch
create table if not exists loyalty_settings (
  id                    text primary key,         -- always 'main'
  points_per_rm         numeric(8,4) not null default 1,
  min_spend_for_points  numeric(8,2) not null default 0,
  is_active             boolean not null default true,
  updated_at            timestamptz not null default now()
);

insert into loyalty_settings (id, points_per_rm, min_spend_for_points, is_active)
values ('main', 1, 0, true)
on conflict (id) do nothing;

-- Configurable reward tiers / promos
create table if not exists loyalty_redemptions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  points_required integer not null,
  reward_type     text not null
                    check (reward_type in ('free_item','discount_percent','discount_fixed','credit')),
  reward_value    numeric(10,2) not null default 0,
  reward_item_id  uuid,                           -- references products(id) if free_item
  is_active       boolean not null default true,
  valid_from      timestamptz,
  valid_until     timestamptz,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Immutable audit log — every earn / redeem / adjustment is one row
create table if not exists customer_points_ledger (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  order_id     text,                              -- references online_orders(id)
  redemption_id uuid references loyalty_redemptions(id),
  points_delta integer not null,                 -- positive = earn, negative = spend
  reason       text not null,                    -- 'order_earn' | 'redemption' | 'admin_adjust' | 'promo' | 'expiry'
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_cpl_customer on customer_points_ledger(customer_id);
create index if not exists idx_cpl_order    on customer_points_ledger(order_id);
