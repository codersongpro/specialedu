alter table public.personal_drafts drop constraint personal_drafts_tool_check;
alter table public.personal_drafts add constraint personal_drafts_tool_check
  check (tool in ('lesson_adapt', 'video_kit', 'document_checklist', 'trip_plan', 'meeting_notes'));
