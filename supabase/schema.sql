-- 정비핵 계정·차량 (Supabase 대시보드 > SQL Editor에 통째로 붙여 넣고 Run)
-- 사용자 = auth.users (카카오·구글 로그인). 차량은 한 사람이 여러 대.
-- 개인정보 최소화: 번호판·차대번호는 받지 않는다. 차종·연식·엔진·주행거리·교체 기록만.

create table if not exists public.vehicles (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id text not null check (char_length(car_id) <= 80),
  engine text check (char_length(engine) <= 80),
  year int check (year between 1980 and 2100),
  km int not null default 0 check (km between 0 and 3000000),
  km_date date not null default current_date,
  records jsonb not null default '{}'::jsonb check (pg_column_size(records) < 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_user_id_idx on public.vehicles (user_id);

alter table public.vehicles enable row level security;

-- 자기 차만 보고·넣고·고치고·지운다
drop policy if exists "own vehicles select" on public.vehicles;
drop policy if exists "own vehicles insert" on public.vehicles;
drop policy if exists "own vehicles update" on public.vehicles;
drop policy if exists "own vehicles delete" on public.vehicles;
create policy "own vehicles select" on public.vehicles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own vehicles insert" on public.vehicles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own vehicles update" on public.vehicles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own vehicles delete" on public.vehicles for delete to authenticated using ((select auth.uid()) = user_id);

-- 한 사람 최대 20대 (장난 방지)
create or replace function public.vehicles_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.vehicles where user_id = new.user_id) >= 20 then
    raise exception '차는 20대까지 저장할 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists vehicles_limit on public.vehicles;
create trigger vehicles_limit before insert on public.vehicles for each row execute function public.vehicles_limit();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists vehicles_touch on public.vehicles;
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();

-- 회원 탈퇴: 본인 계정 삭제 → 차량도 같이 지워짐 (on delete cascade)
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
