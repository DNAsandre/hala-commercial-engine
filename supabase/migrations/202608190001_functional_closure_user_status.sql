alter table public.users
  add column if not exists status text;

update public.users as profile
set status = case
  when auth_user.banned_until is not null and auth_user.banned_until > now() then 'inactive'
  else 'active'
end
from auth.users as auth_user
where profile.auth_id = auth_user.id;

update public.users
set status = 'active'
where status is null;

alter table public.users
  alter column status set default 'active',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_status_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_status_check check (status in ('active', 'inactive'));
  end if;
end
$$;
