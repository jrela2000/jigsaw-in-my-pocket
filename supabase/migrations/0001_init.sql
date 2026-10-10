-- Jigsaw In My Pocket schema. Run with `supabase db push` (see SETUP_CHECKLIST.md).
--
-- Privacy by design: there is no user database. The only per-person rows are print orders,
-- and those hold no name, address, email or photo title: Stripe and Printify hold the delivery
-- details. An order row exists so the app can show "printing / shipped / tracking".

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

create table if not exists print_orders (
  id uuid primary key default gen_random_uuid(),
  -- Anonymous device identity only; no profile is attached to it.
  user_id uuid references auth.users(id) on delete cascade,
  stripe_payment_intent_id text unique,
  printify_order_id text,
  status text not null default 'pending_payment',
  piece_count integer not null,
  shipping_tier text not null default 'standard',
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

-- One private bucket for print files. A device may only write into its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('print_uploads', 'print_uploads', false, 52428800, array['image/jpeg'])
on conflict (id) do nothing;

create policy "upload own print images" on storage.objects for insert
  with check (bucket_id = 'print_uploads' and (storage.foldername(name))[1] = auth.uid()::text);
