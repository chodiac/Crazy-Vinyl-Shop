/* ==========================================================================
   Admin configuration.

   Both values below are PUBLIC by design. The anon key identifies the project,
   it does not grant anything: every table is behind row level security that
   requires an admin profile (see supabase/migrations/0001_cms.sql). The
   service-role key must NEVER appear in this file or anywhere else the browser
   can read — it belongs only in GitHub Actions secrets.

   Fill these in after creating the Supabase project:
   Supabase dashboard → Project Settings → API.
   ========================================================================== */

export const SUPABASE_URL = 'https://vydkiarqaphuamuzybhe.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZGtpYXJxYXBodWFtdXp5YmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1Njk4OTAsImV4cCI6MjEwNzE0NTg5MH0.rwB1NBderyn0b19XAkhaSGmy2GwtbB78oVzaTahLkFE';

/* Where the public site lives, used by the preview pane. Leave as '..' when
   the admin is served from the site itself (…/admin/), which is the default. */
export const SITE_BASE = '..';
