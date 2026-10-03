-- Studio Jigsaw schema. Run with `supabase db push` (see SETUP_CHECKLIST.md).
-- Every table has row-level security; anything sensitive is only reachable through Edge Functions.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  birth_year integer,
  ump_consent_status text default 'unknown',
  att_status text default 'not_determined',
  streak_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- A generated column cannot depend on the current date, so under-13 status is a function.
create or replace function is_under_13(p profiles) returns boolean language sql stable as $$
  select p.birth_year is not null and p.birth_year > extract(year from current_date)::int - 13
$$;

create table if not exists daily_puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date unique not null,
  title text not null,
  artist text not null,
  museum_source text not null,
  credit_line text not null,
  license text not null default 'CC0',
  image_url text not null,
  piece_count integer default 110,
  created_at timestamptz default now()
);
alter table daily_puzzles enable row level security;
create policy "public read daily puzzles" on daily_puzzles for select using (true);

create table if not exists unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null,
  unlocked_piece_count integer not null,
  used boolean default false,
  created_at timestamptz default now()
);
alter table unlocks enable row level security;
create policy "own unlocks" on unlocks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists gifts (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  sender_id uuid references auth.users(id) on delete cascade,
  sender_name text not null,
  recipient_name text not null,
  personal_note text check (char_length(personal_note) <= 200),
  title text not null default 'A puzzle for you',
  piece_count integer not null,
  rotation boolean default false,
  storage_path text not null,
  is_prepaid_print boolean default false,
  print_order_id uuid,
  expires_at timestamptz default (now() + interval '90 days'),
  created_at timestamptz default now()
);
alter table gifts enable row level security;
-- Senders can create and see their own gifts. Recipients never query this table directly:
-- they go through the get-gift function, which looks up exactly one unguessable token.
create policy "senders create gifts" on gifts for insert with check (auth.uid() = sender_id and is_prepaid_print = false);
create policy "senders read own gifts" on gifts for select using (auth.uid() = sender_id);

create table if not exists print_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stripe_payment_intent_id text unique,
  printify_order_id text,
  status text not null default 'pending_payment',
  title text,
  piece_count integer not null,
  shipping_tier text not null default 'standard',
  shipping_address jsonb,
  personalization jsonb,
  gift_token text,
  tracking_number text,
  tracking_url text,
  storage_upload_path text not null,
  total_amount_cents integer not null,
  delivered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table print_orders enable row level security;
-- Read-only for the buyer. All writes happen in Edge Functions with the service role.
create policy "own print orders" on print_orders for select using (auth.uid() = user_id);

-- Private buckets. Users may only write into a folder named after their own user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('puzzle_gifts', 'puzzle_gifts', false, 15728640, array['image/jpeg']),
       ('print_uploads', 'print_uploads', false, 52428800, array['image/jpeg'])
on conflict (id) do nothing;

create policy "upload own gift images" on storage.objects for insert
  with check (bucket_id = 'puzzle_gifts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own print images" on storage.objects for insert
  with check (bucket_id = 'print_uploads' and (storage.foldername(name))[1] = auth.uid()::text);
