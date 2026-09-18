# Keelworks Bridge Handoff

This document gives a new contributor the shortest path to understanding the current project and the work completed so far.

## Current Status

- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase.
- Branch: `filter` (tracking `origin/filter`).
- The latest committed work is dated 2026-09-08.
- There are local, uncommitted changes in `.env.example`, `README.md`, `src/app/page.tsx`, and `src/app/developers/page.tsx`.
- There are also two untracked API routes: `src/app/api/developers/route.ts` and `src/app/api/projects/route.ts`.
- No automated test suite is currently configured. The available checks are `npm run lint` and `npm run build`.

Before starting new work, review `git status` and decide whether the local admin/project changes should be committed as one feature or split into smaller commits.

## What The Application Does

The app is an internal bridge for managing projects, developers, and incoming requests.

- `/` displays projects from the Supabase `projects` table.
- `/login` signs users in with Supabase authentication, currently using Google OAuth.
- `/admin` is the admin-only dashboard and links to project and developer management.
- `/developers` displays a searchable/filterable developer directory and developer profile details.
- `/queue` displays authenticated users' request queue and project/request status information.
- `/api/form-submission` accepts a form submission, resolves the project by name, and inserts a request.

The main data entities referenced by the app are `projects`, `developers`, `requests`, and the `developer_overview` view.

## Change History

### 2026-02-17: Dependency alignment

- Updated Next.js-related dependency versions and refreshed the lockfile.

### 2026-04-01: Login page introduced

- Added the first login page and its styling.
- Added the initial login image asset.

### 2026-06-17: Form submission workflow

- Added the `/api/form-submission` endpoint.
- Changed submissions to insert records into `requests`.
- Switched that server route to a Supabase service-role client.
- Added request status handling and fixed the login suspense boundary.

### 2026-06-18: Authentication and login design

- Replaced the original login flow with Google OAuth.
- Required authentication for the queue page.
- Refreshed the login page design.

### 2026-06-22: Developer data in requests and queue

- Added developer skills to the form-submission data path.
- Added developer names to queue records.

### 2026-07-17: Read-only developer directory

- Added the developers page with Supabase-backed developer data.
- Added developer profile viewing.

### 2026-08-10: Expanded developer information

- Added skills and project information to the developer view.

### 2026-08-26: UI refresh and filtering

- Reworked the shared UI across the home, login, queue, and developers pages.
- Added light/dark mode support through the navigation UI and global styles.
- Added filters to the queue and developers pages.
- Expanded developer profile and queue presentation.

### 2026-09-08: Stability and configuration cleanup

- Fixed a navigation hydration issue.
- Moved login styles into `src/app/globals.css` and removed the invalid page-level global CSS import.
- Updated login behavior to redirect already-authenticated users.
- Added validation so login redirect targets must be relative paths.
- Formatted array-based skills with comma separators in the developer table and profile dialog.
- Standardized on `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, while retaining anon-key fallback support in server code.
- Made the server-side Supabase client lazy so builds do not require `SUPABASE_SERVICE_ROLE_KEY` at module import time.
- Added `.env.example` and documented the server-only service-role key.

## Current Local Feature: Admin Management

The uncommitted changes add admin-only create/delete workflows for developers and projects.

### Admin authentication

- The browser obtains the current Supabase access token and sends it as `Authorization: Bearer <token>`.
- Server routes validate the token with Supabase `auth.getUser()`.
- The authenticated email is compared case-insensitively with the allowlist in `src/lib/adminEmails.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` is used only inside server routes for privileged inserts and deletes.
- The single admin address is configured through the server-only `ADMIN_EMAIL` environment variable. That account can add and delete projects and developers.

### Next steps: move admin access to a Supabase role

The current implementation uses `src/lib/adminEmails.ts`, so adding a `role` column in Supabase alone will not change who can add or delete developers and projects. To make authorization database-driven, complete these steps.

1. In Supabase SQL Editor, create a profile table linked to Supabase Auth users:

	 ```sql
	 create table if not exists public.profiles (
		 id uuid primary key references auth.users(id) on delete cascade,
		 role text not null default 'user' check (role in ('user', 'admin')),
		 created_at timestamptz not null default now()
	 );

	 alter table public.profiles enable row level security;

	 create policy "Users can read their own profile"
	 on public.profiles for select
	 to authenticated
	 using (auth.uid() = id);
	 ```

2. Backfill profiles for users who already signed in, then promote the intended administrators. Replace the email addresses with the real admin accounts:

	 ```sql
	 insert into public.profiles (id)
	 select id from auth.users
	 on conflict (id) do nothing;

	 update public.profiles
	 set role = 'admin'
	 where id in (
		 select id from auth.users
		 where lower(email) in ('admin1@keelworks.org', 'admin2@keelworks.org')
	 );
	 ```

3. Add a database trigger so every new Google/Auth user receives a profile automatically:

	 ```sql
	 create or replace function public.handle_new_user()
	 returns trigger
	 language plpgsql
	 security definer set search_path = public
	 as $$
	 begin
		 insert into public.profiles (id) values (new.id)
		 on conflict (id) do nothing;
		 return new;
	 end;
	 $$;

	 drop trigger if exists on_auth_user_created on auth.users;
	 create trigger on_auth_user_created
		 after insert on auth.users
		 for each row execute procedure public.handle_new_user();
	 ```

4. Update the server authorization path in `src/app/api/developers/route.ts` and `src/app/api/projects/route.ts`. After `auth.getUser(accessToken)` returns the user, query `public.profiles` for that user id and allow the request only when `role = 'admin'`. Use the same helper for `GET`, `POST`, and `DELETE`; do not trust a role sent by the browser.

5. Update the client admin check to use the API response, as it already does. No role value should be stored in local storage or sent in the request body. Once the API uses the profile role, remove `src/lib/adminEmails.ts` and the email-based checks.

6. Verify the workflow with two accounts: an admin profile with `role = 'admin'` should see the admin dashboard and successfully add/delete developers and projects; a `user` profile should be able to browse but receive `403 Admin access is required` for mutations.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. The service-role client bypasses RLS for the protected insert/delete operations, while the bearer token and the profile-role check decide whether the caller is allowed to use it.

### Developer management

`src/app/api/developers/route.ts` now supports:

- `GET`: returns `{ isAdmin: boolean }` for the current authenticated user.
- `POST`: allows an admin to create a developer with name, email, skills, location, availability hours, and status.
- `DELETE`: allows the configured `ADMIN_EMAIL` account to delete a developer by id.

`src/app/developers/page.tsx` now:

- Detects whether the signed-in user is an admin.
- Shows an admin-only add-developer form.
- Sends comma-separated skills as an array.
- Shows an admin-only delete action with confirmation.

### Project management

`src/app/api/projects/route.ts` now supports admin-only:

- `POST`: creates a project with name, summary, status, RAG status, and tech stack.
- `DELETE`: allows the configured `ADMIN_EMAIL` account to delete a project by id.

`src/app/page.tsx` is being expanded to load project details, detect admins, and submit project create/delete requests through this route rather than directly performing privileged writes from the browser.

### Login routing

- Google OAuth returns users to `/login` first so the app can inspect the authenticated session.
- Admin users listed in `src/lib/adminEmails.ts` are redirected to `/admin`.
- Regular authenticated users are redirected to their requested path, or `/queue` by default.
- The navbar shows an `Admin dashboard` link only after the current session is confirmed to belong to an admin.
- `/admin` performs its own server-backed admin check and redirects unauthorized users to `/queue`.

## Environment Setup

Create `.env.local` from `.env.example` and fill in real values:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_EMAIL=your_admin_email
```

Important rules:

- Never commit `.env.local`.
- Never expose or send `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Add or remove admin addresses only in `src/lib/adminEmails.ts`; do not put them in client-side code.
- Confirm the Supabase schema contains the columns used by the forms and API routes before testing writes.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run build
```

Use `npm run dev -- -p 3001` if port 3000 is already occupied.

## Where To Look First

- `src/app/page.tsx`: project dashboard and project interactions.
- `src/app/developers/page.tsx`: developer directory, filters, profiles, and admin controls.
- `src/app/queue/page.tsx`: authenticated request queue.
- `src/app/login/page.tsx`: Google OAuth login and redirect handling.
- `src/app/api/form-submission/route.ts`: public form-to-request server workflow.
- `src/app/api/developers/route.ts`: admin authorization and developer mutations.
- `src/app/api/projects/route.ts`: admin authorization and project mutations.
- `src/lib/supabaseClient.ts`: browser Supabase client configuration.
- `src/components/Navbar.tsx`: navigation and theme behavior.
- `src/app/globals.css`: shared and login styling.

## Follow-up Before Calling The Feature Complete

- Run lint and a production build with the intended environment configuration.
- Manually test admin and non-admin behavior for project and developer create/delete actions.
- Test expired or missing bearer tokens and confirm they cannot perform mutations.
- Confirm delete behavior against foreign-key relationships, especially projects with requests.
- Add automated route/page coverage when the project has a test framework.
- Commit the current local changes once the admin workflows and schema assumptions are verified.
