create table if not exists ai_provider_configs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  provider text not null,
  base_url text not null,
  model text not null,
  generation_prompt text,
  api_key_ciphertext text not null,
  key_hint text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

create index if not exists idx_ai_provider_configs_workspace_id on ai_provider_configs(workspace_id);

alter table ai_provider_configs
  add column if not exists generation_prompt text;
