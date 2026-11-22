-- Tutup akses anon pada fungsi RPC; hanya pengguna login (authenticated) yang boleh memanggilnya.
-- Catatan: migration ini sudah dijalankan manual di Supabase SQL Editor; file ini ada agar setup dari nol ikut aman.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('mark_wage_paid', 'cancel_wage_payment', 'is_owner', 'get_week_start', 'get_week_end')
  loop
    execute format('revoke all on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;
