-- Functional Closure: remove the remaining Final Pack UAT export and brand.
-- Both identifiers are explicit UAT fixtures; neither is referenced by a live
-- document instance, template, file asset, or legacy compiled output.

begin;

delete from public.doc_compiled_outputs
where id = 'dco-1787129933997-8035wp'
  and branding_profile_id = 'uat-arv2-branding-001'
  and title = '[HALA-UAT-ARV2] Meridian Test Logistics — [HALA-UAT-ARV2] Tender and Proposal Test Pack'
  and file_asset_id is null;

delete from public.doc_branding_profiles
where id = 'uat-arv2-branding-001'
  and name = '[HALA-UAT-ARV2] Standard Brand'
  and not exists (
    select 1 from public.doc_instances
    where branding_profile_id = 'uat-arv2-branding-001'
  )
  and not exists (
    select 1 from public.doc_templates
    where default_branding_profile_id = 'uat-arv2-branding-001'
  )
  and not exists (
    select 1 from public.doc_compiled_outputs
    where branding_profile_id = 'uat-arv2-branding-001'
  )
  and not exists (
    select 1 from public.compiled_outputs
    where branding_profile_id = 'uat-arv2-branding-001'
  )
  and not exists (
    select 1 from public.doc_vault_assets
    where branding_profile_id = 'uat-arv2-branding-001'
  );

do $$
begin
  if exists (
    select 1 from public.doc_compiled_outputs
    where id = 'dco-1787129933997-8035wp'
  ) or exists (
    select 1 from public.doc_branding_profiles
    where id = 'uat-arv2-branding-001'
  ) then
    raise exception 'Final Pack UAT cleanup postcondition failed';
  end if;
end $$;

commit;
