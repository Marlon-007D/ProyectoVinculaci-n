-- Honor entries have no draft workflow in the administration board. Publish the
-- existing assignments so the public, read-only board can display them.
UPDATE public.honors
SET status = 'published'
WHERE status = 'draft';
