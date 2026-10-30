-- Adapted from the official Supabase init for the three enabled DB clients.
-- Optional Functions/Pooler roles are not created or altered by this stack.
SET log_statement = 'none';
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

