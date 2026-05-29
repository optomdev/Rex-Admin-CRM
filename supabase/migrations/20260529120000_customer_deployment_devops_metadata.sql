alter table public.customer_deployments
  add column if not exists app_provider text,
  add column if not exists app_provider_project text,
  add column if not exists git_repo text,
  add column if not exists git_branch text,
  add column if not exists git_tag text,
  add column if not exists git_commit text,
  add column if not exists latest_migration_version text,
  add column if not exists latest_migration_name text,
  add column if not exists edge_functions_commit text,
  add column if not exists deploy_status text not null default 'unknown'
    check (deploy_status in ('unknown', 'building', 'deployed', 'failed', 'rolled_back')),
  add column if not exists last_deployed_at timestamptz,
  add column if not exists last_smoke_tested_at timestamptz;

create index if not exists customer_deployments_git_branch_idx
  on public.customer_deployments(git_branch)
  where git_branch is not null;

create index if not exists customer_deployments_git_tag_idx
  on public.customer_deployments(git_tag)
  where git_tag is not null;

create index if not exists customer_deployments_git_commit_idx
  on public.customer_deployments(git_commit)
  where git_commit is not null;

comment on column public.customer_deployments.app_provider is 'Hosting provider for this Rex deployment, for example AWS Amplify.';
comment on column public.customer_deployments.app_provider_project is 'Provider-side app, project, or environment identifier.';
comment on column public.customer_deployments.git_repo is 'GitHub repository used by this deployment.';
comment on column public.customer_deployments.git_branch is 'Git branch currently tracked by this deployment.';
comment on column public.customer_deployments.git_tag is 'Git tag currently associated with this deployment.';
comment on column public.customer_deployments.git_commit is 'Git commit currently deployed.';
comment on column public.customer_deployments.latest_migration_version is 'Latest Supabase migration version confirmed for this deployment.';
comment on column public.customer_deployments.latest_migration_name is 'Latest Supabase migration name confirmed for this deployment.';
comment on column public.customer_deployments.edge_functions_commit is 'Source commit used for Supabase Edge Functions in this deployment.';
comment on column public.customer_deployments.deploy_status is 'Latest hosting deployment status tracked by CRM.';
comment on column public.customer_deployments.last_deployed_at is 'When this deployment was last confirmed deployed.';
comment on column public.customer_deployments.last_smoke_tested_at is 'When this deployment was last smoke-tested.';
