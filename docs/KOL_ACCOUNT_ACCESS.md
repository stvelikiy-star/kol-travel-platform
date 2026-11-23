# KÖL account access — 22 November 2026

The application login is the user's **email** (not a separate username).
Supabase Auth stores password hashes, not retrievable plaintext passwords.
Never print, distribute, email, or save passwords in application tables.

Implemented (current release branch):
- `/login` has a password recovery link for clients and all staff roles.
- `/forgot-password` requests a Supabase Auth recovery link, without
  revealing whether the email is registered.
- `/account/security` displays the signed-in user's Auth email, allows a
  password update, and requests a verified email change.
- The link is visible from client, partner, courier, admin, content editor
  and owner workspaces. None of these changes alter role or commercial data.
- Auth callback handles `/account/security` redirects without accidentally
  starting a client registration or assigning another role.
- After confirmed email change, the SQL trigger synchronizes the email in
  `public.user_profiles`. No password is copied to PostgreSQL.

## Before email recovery works for real customers

1. Configure a verified **custom SMTP** in the Supabase project Auth SMTP
   settings (the default Supabase sender restricts recipients).
2. Set the Supabase Auth Site URL and approved Redirect URLs for the actual
   KÖL deployment, including `/auth/callback`; the production domain is
   `https://kol.on.kg` only after its DNS and HTTPS are corrected.
3. `NEXT_PUBLIC_SITE_URL` must contain the corresponding trusted HTTPS origin.
4. Check email templates for password reset and email change (the default
   sender must not remain the production sender).
5. On QA, validate email delivery only with an opted-in test mailbox.
   Never reset or rotate real users' passwords during code acceptance.

There are no production login accounts in the new production Supabase yet.
Do not import test Auth users or distribute test passwords to customers.
Do not disable existing Vercel Preview protection.
