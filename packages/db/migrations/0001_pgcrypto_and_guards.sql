-- Password hashing lives in Postgres: bcrypt via pgcrypto, so the Worker's 10 ms CPU budget isn't spent
-- on it (decision 0018). Passwords reach the database over TLS only and are never stored or logged.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION eec_hash_password(pw text) RETURNS text
LANGUAGE sql VOLATILE AS $$ SELECT crypt(pw, gen_salt('bf', 10)) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION eec_verify_password(pw text, hash text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT hash IS NOT NULL AND crypt(pw, hash) = hash $$;
--> statement-breakpoint
-- At least one active super admin must always exist: refuse to remove the last one.
CREATE OR REPLACE FUNCTION eec_other_active_super_admins(excluded uuid) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT ur.user_id)::int
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id AND r.key = 'super-admin'
  JOIN profiles p ON p.user_id = ur.user_id AND p.status = 'active'
  WHERE ur.user_id <> excluded AND (ur.expires_at IS NULL OR ur.expires_at > now())
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION eec_guard_last_super_admin_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE id = OLD.role_id AND key = 'super-admin')
     AND eec_other_active_super_admins(OLD.user_id) = 0 THEN
    RAISE EXCEPTION 'last_super_admin' USING ERRCODE = 'P0001', HINT = 'At least one active super admin must remain.';
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER user_roles_guard_last_super_admin
  BEFORE DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION eec_guard_last_super_admin_role();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION eec_guard_last_super_admin_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active'
     AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id AND r.key = 'super-admin' WHERE ur.user_id = OLD.user_id)
     AND eec_other_active_super_admins(OLD.user_id) = 0 THEN
    RAISE EXCEPTION 'last_super_admin' USING ERRCODE = 'P0001', HINT = 'At least one active super admin must remain.';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER profiles_guard_last_super_admin
  BEFORE UPDATE OF status ON profiles FOR EACH ROW EXECUTE FUNCTION eec_guard_last_super_admin_status();
