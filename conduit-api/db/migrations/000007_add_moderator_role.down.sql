-- Revert moderator role addition. This down migration will fail if any rows use 'moderator'.

-- Create a temporary enum without 'moderator'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role_old') THEN
        RETURN;
    END IF;
    CREATE TYPE membership_role_old AS ENUM ('admin', 'member', 'collector');
    ALTER TABLE memberships ALTER COLUMN role TYPE membership_role_old USING role::text::membership_role_old;
    DROP TYPE membership_role;
    ALTER TYPE membership_role_old RENAME TO membership_role;
END$$;
