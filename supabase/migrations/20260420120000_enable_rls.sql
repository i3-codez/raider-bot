-- Lock the PostgREST HTTP API off for every table in this schema.
-- The app connects as the postgres role (BYPASSRLS), so enabling RLS without
-- policies gives us: anon/authenticated get zero rows, service role still works.

alter table public.raid_posts enable row level security;
alter table public.engagement_logs enable row level security;
alter table public.raid_timing_corrections enable row level security;
alter table public.team_members enable row level security;
alter table public.team_member_owner_aliases enable row level security;
alter table public.monthly_summary_snapshots enable row level security;
alter table public.monthly_score_snapshots enable row level security;
alter table public.job_runs enable row level security;
alter table public.ops_alert_publications enable row level security;

-- Belt-and-suspenders: revoke any default grants on these tables from the
-- PostgREST-exposed roles. RLS alone would filter rows to zero, but removing
-- grants means the API returns a clean 401/permission error rather than an
-- empty set.
revoke all on public.raid_posts from anon, authenticated;
revoke all on public.engagement_logs from anon, authenticated;
revoke all on public.raid_timing_corrections from anon, authenticated;
revoke all on public.team_members from anon, authenticated;
revoke all on public.team_member_owner_aliases from anon, authenticated;
revoke all on public.monthly_summary_snapshots from anon, authenticated;
revoke all on public.monthly_score_snapshots from anon, authenticated;
revoke all on public.job_runs from anon, authenticated;
revoke all on public.ops_alert_publications from anon, authenticated;
