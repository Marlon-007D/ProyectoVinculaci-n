-- Apply after institutional_registration.sql and decentralized_roles.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.registration_attempt_limits (
  key_hash TEXT PRIMARY KEY, window_start TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL
);
ALTER TABLE public.registration_attempt_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_attempt_limits FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.consume_registration_attempt(ip_hash TEXT, email_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  key_value TEXT;
  attempt_count INTEGER;
  max_allowed INTEGER;
BEGIN
  FOREACH key_value IN ARRAY ARRAY['ip:' || ip_hash, 'email:' || email_hash] LOOP
    IF key_value LIKE 'ip:%' THEN
      max_allowed := 10;
    ELSE
      max_allowed := 3;
    END IF;

    INSERT INTO public.registration_attempt_limits AS limits (key_hash, window_start, attempts)
    VALUES (key_value, now(), 1)
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN limits.window_start < now() - interval '1 hour' THEN 1 ELSE limits.attempts + 1 END,
      window_start = CASE WHEN limits.window_start < now() - interval '1 hour' THEN now() ELSE limits.window_start END
    RETURNING attempts INTO attempt_count;
    IF attempt_count > max_allowed THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  DELETE FROM public.registration_attempt_limits WHERE window_start < now() - interval '2 days';
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_registration_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_registration_attempt(TEXT, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.membership_approval_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(institution_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(role_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), sent_at TIMESTAMPTZ
);
ALTER TABLE public.membership_approval_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS membership_approval_notifications_lookup
  ON public.membership_approval_notifications(institution_id, profile_id, created_at DESC);
REVOKE ALL ON public.membership_approval_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.membership_approval_notifications TO service_role;
CREATE OR REPLACE FUNCTION public.queue_membership_approval_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_active AND OLD.role_id IS NOT DISTINCT FROM NEW.role_id THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.membership_approval_notifications(institution_id, profile_id, role_id)
  VALUES (NEW.institution_id, NEW.profile_id, NEW.role_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_membership_approval_notification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS membership_approval_notification ON public.memberships;
CREATE TRIGGER membership_approval_notification AFTER INSERT OR UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.queue_membership_approval_notification();
NOTIFY pgrst, 'reload schema';
COMMIT;
