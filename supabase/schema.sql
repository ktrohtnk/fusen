create table public.users (
  id text primary key,
  name text not null,
  color text not null
);

-- Insert initial users
insert into public.users (id, name, color) values
  ('user-k', 'K', '#88ccff'),
  ('user-h', 'H', '#ffbbaa'),
  ('user-a', 'A', '#aaddaa');

create table public.notes (
  id uuid primary key,
  user_id text references public.users(id),
  text text not null,
  url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  x float not null,
  y float not null,
  z float not null,
  rotation_x float not null,
  rotation_y float not null,
  rotation_z float not null
);

create table public.connections (
  id uuid primary key,
  from_note_id uuid references public.notes(id),
  to_note_id uuid references public.notes(id)
);

-- Enable RLS and create policies (allow all for MVP)
alter table public.users enable row level security;
alter table public.notes enable row level security;
alter table public.connections enable row level security;

create policy "Allow all on users" on public.users for all using (true) with check (true);
create policy "Allow all on notes" on public.notes for all using (true) with check (true);
create policy "Allow all on connections" on public.connections for all using (true) with check (true);
