alter table public.ai_bot_versions
  add column if not exists knowledge_base_text text;

comment on column public.ai_bot_versions.knowledge_base_text is
  'Knowledge text authored for and stored with this specific bot version.';
