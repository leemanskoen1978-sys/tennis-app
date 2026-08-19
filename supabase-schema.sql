-- Tennisclub Racso — Supabase schema (voor later).
-- Voer dit uit in de SQL-editor van je Supabase-project, kopieer daarna de
-- project-URL + anon key naar .env (zie .env.example). De app draait nu nog op
-- de in-memory mock en heeft dit niet nodig.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role text not null check (role in ('player','coach','parent')),
  phone text,
  bio text,
  preferred_court_id uuid,
  working_hours jsonb,
  working_days jsonb,
  notification_settings jsonb,
  created_at timestamptz default now()
);

create table if not exists courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number int not null,
  indoor boolean not null default false,
  hourly_rate numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references users(id) on delete cascade,
  coach_id uuid references users(id) on delete cascade,
  court_id uuid references courts(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null check (status in ('pending','confirmed','cancelled','completed','synchronized')),
  payment_status text check (payment_status in ('paid','unpaid','invoice')),
  notes text,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  created_at timestamptz default now()
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  description text,
  uploaded_by uuid references users(id) on delete set null,
  student_id uuid references users(id) on delete set null,
  coach_id uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references users(id) on delete cascade,
  coach_id uuid references users(id) on delete set null,
  training_type text check (training_type in ('techniek','tactiek','fysiek','mentaal','match')),
  notes text,
  rating int,
  skills jsonb,
  homework text,
  voice_memo_uri text,
  created_at timestamptz default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Seed alleen als de tabellen leeg zijn (idempotent).
insert into users (name, email, role)
select * from (values
  ('Koen','koen@racso.be','coach'),
  ('Mathis','mathis@racso.be','player'),
  ('Test','test@racso.be','player')
) as v(name,email,role)
where not exists (select 1 from users);

insert into courts (name, number, indoor, hourly_rate)
select * from (values
  ('Baan 1',1,false,30),
  ('Baan 2',2,true,35)
) as v(name,number,indoor,hourly_rate)
where not exists (select 1 from courts);

-- RLS: permissief voor lokale test (later verstrengen).
alter table users enable row level security;
alter table courts enable row level security;
alter table bookings enable row level security;
alter table lessons enable row level security;
alter table student_progress enable row level security;
alter table settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['users','courts','bookings','lessons','student_progress','settings'] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format('create policy %I_all on %I for all using (true) with check (true)', t, t);
  end loop;
end $$;
