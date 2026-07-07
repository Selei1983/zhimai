create extension if not exists pgcrypto;

create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists libraries (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, name)
);

create table if not exists folders (
  id text primary key,
  library_id text not null references libraries(id) on delete cascade,
  parent_id text references folders(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(library_id, parent_id, name)
);

create table if not exists captures (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  source_type text not null,
  source_title text,
  source_url text,
  selected_text text,
  raw_content text not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists processing_results (
  id text primary key default gen_random_uuid()::text,
  capture_id text not null references captures(id) on delete cascade,
  model text not null,
  summary text not null,
  content_type text not null,
  topics_json jsonb not null default '[]'::jsonb,
  suggested_action text not null,
  suggested_title text,
  key_points_json jsonb not null default '[]'::jsonb,
  wiki_draft_markdown text not null,
  related_pages_json jsonb not null default '[]'::jsonb,
  quality_notes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists wiki_pages (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  library_id text not null references libraries(id) on delete cascade,
  folder_id text references folders(id) on delete set null,
  title text not null,
  slug text not null,
  type text not null,
  summary text,
  content_markdown text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(library_id, slug)
);

create table if not exists page_versions (
  id text primary key default gen_random_uuid()::text,
  page_id text not null references wiki_pages(id) on delete cascade,
  content_markdown text not null,
  change_note text,
  created_at timestamptz not null default now()
);

create table if not exists page_sources (
  id text primary key default gen_random_uuid()::text,
  page_id text not null references wiki_pages(id) on delete cascade,
  capture_id text not null references captures(id) on delete cascade,
  quote text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists page_links (
  id text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  from_page_id text not null references wiki_pages(id) on delete cascade,
  to_page_id text not null references wiki_pages(id) on delete cascade,
  relation_type text not null,
  reason text,
  confidence double precision,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_libraries_workspace_id on libraries(workspace_id);
create index if not exists idx_folders_library_id on folders(library_id);
create index if not exists idx_captures_workspace_id on captures(workspace_id);
create index if not exists idx_ai_provider_configs_workspace_id on ai_provider_configs(workspace_id);
create index if not exists idx_wiki_pages_workspace_id on wiki_pages(workspace_id);
create index if not exists idx_wiki_pages_library_folder on wiki_pages(library_id, folder_id);
create index if not exists idx_topic_nodes_workspace_id on topic_nodes(workspace_id);
create index if not exists idx_knowledge_atoms_workspace_id on knowledge_atoms(workspace_id);
create index if not exists idx_knowledge_atoms_capture_id on knowledge_atoms(capture_id);
create index if not exists idx_category_planning_runs_workspace_id on category_planning_runs(workspace_id);
create index if not exists idx_category_planning_runs_capture_id on category_planning_runs(capture_id);
create index if not exists idx_synthesis_runs_workspace_id on synthesis_runs(workspace_id);

alter table ai_provider_configs
  add column if not exists generation_prompt text;

insert into workspaces (id, name) values ('demo-workspace', '知脉个人空间')
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into libraries (id, workspace_id, name, sort_order) values
  ('library-个人 Wiki', 'demo-workspace', '个人 Wiki', 1),
  ('library-知脉产品设计', 'demo-workspace', '知脉产品设计', 2),
  ('library-AI 资料库', 'demo-workspace', 'AI 资料库', 3),
  ('library-方法与模板', 'demo-workspace', '方法与模板', 4)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, updated_at = now();

insert into folders (id, library_id, name, sort_order) values
  ('folder-个人 Wiki/知识管理', 'library-个人 Wiki', '知识管理', 1),
  ('folder-个人 Wiki/方法沉淀', 'library-个人 Wiki', '方法沉淀', 2),
  ('folder-知脉产品设计/产品方案', 'library-知脉产品设计', '产品方案', 1),
  ('folder-知脉产品设计/浏览器插件', 'library-知脉产品设计', '浏览器插件', 2),
  ('folder-AI 资料库/AI 质量', 'library-AI 资料库', 'AI 质量', 1),
  ('folder-方法与模板/模板', 'library-方法与模板', '模板', 1)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, updated_at = now();
