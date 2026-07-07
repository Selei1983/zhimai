create table if not exists topic_nodes (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  page_id text unique references wiki_pages(id) on delete set null,
  name text not null,
  slug text not null,
  summary text,
  level text not null default 'topic',
  status text not null default 'active',
  aliases_json jsonb not null default '[]'::jsonb,
  tags_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, slug)
);

create table if not exists knowledge_atoms (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  capture_id text not null references captures(id) on delete cascade,
  topic_id text references topic_nodes(id) on delete set null,
  atom_type text not null,
  title text not null,
  content text not null,
  quote text,
  confidence double precision,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists category_planning_runs (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  capture_id text not null references captures(id) on delete cascade,
  topic_id text references topic_nodes(id) on delete set null,
  action text not null,
  target_title text not null,
  reason text not null,
  confidence double precision,
  atom_ids_json jsonb not null default '[]'::jsonb,
  recommended_actions_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists synthesis_runs (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  topic_id text references topic_nodes(id) on delete set null,
  page_id text references wiki_pages(id) on delete set null,
  capture_id text references captures(id) on delete set null,
  action text not null,
  model text,
  status text not null default 'confirmed',
  diff_json jsonb not null default '{}'::jsonb,
  quality_notes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_topic_nodes_workspace_id on topic_nodes(workspace_id);
create index if not exists idx_knowledge_atoms_workspace_id on knowledge_atoms(workspace_id);
create index if not exists idx_knowledge_atoms_capture_id on knowledge_atoms(capture_id);
create index if not exists idx_category_planning_runs_workspace_id on category_planning_runs(workspace_id);
create index if not exists idx_category_planning_runs_capture_id on category_planning_runs(capture_id);
create index if not exists idx_synthesis_runs_workspace_id on synthesis_runs(workspace_id);
