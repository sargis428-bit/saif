# PetCare Advice Hub & Health Log
Build 2 plan: CONFIRMED by Build 2 Planner on October 4, 2026.

## What the app does and who it's for
A pet care platform for pet owners (like Apoorva) to keep private health logs/documents for their pets and participate in a community advice hub categorized by animal type (e.g., Dogs, Cats, Exotics). Owners can share questions, attach photos/videos/docs, and receive crowdsourced solutions from experienced pet owners.

## Sign-in
- Email + Password sign-in
- GitHub OAuth sign-in
- Password rules: Minimum 8 characters, with lowercase, uppercase, and a number enforced in Supabase
- Keeps users signed in across refreshes, with sign-out functionality
- Change password page for email users

## Tables
1. **profiles**
   - `id` (uuid, primary key, references auth.users)
   - `username` (text, unique)
   - `created_at` (timestamp)

2. **posts**
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users)
   - `title` (text)
   - `content` (text)
   - `category` (text - e.g., 'dog', 'cat', 'general')
   - `visibility` (text - 'private', 'group', 'public')
   - `file_url` (text, optional)
   - `created_at` (timestamp)

3. **replies**
   - `id` (uuid, primary key)
   - `post_id` (uuid, references posts.id)
   - `user_id` (uuid, references auth.users)
   - `content` (text)
   - `file_url` (text, optional)
   - `created_at` (timestamp)

## Who can see what
- **profiles:** Read public to all authenticated users; insert/update restricted to owner (`auth.uid() = id`).
- **posts:**
  - `visibility = 'private'`: Select, Update, Delete restricted strictly to owner (`auth.uid() = user_id`).
  - `visibility = 'group'` or `'public'`: Read access permitted for all authenticated users; Insert, Update, Delete restricted to post owner (`auth.uid() = user_id`).
- **replies:** Read access permitted for all authenticated users; Insert, Update, Delete restricted to reply owner (`auth.uid() = user_id`).

## Buckets
- **Bucket name:** `pet-attachments`
- **File size limit:** 50 MB
- **Allowed MIME types:** `image/jpeg`, `image/png`, `video/mp4`, `application/pdf`, `application/zip`
- **Bucket rules:**
  - Upload/Delete: Restricted to file owner.
  - Read: Public for community post attachments; private folder access restricted to post owner.

## Screens
1. **Sign-In / Sign-Up Screen:** Email/password forms, GitHub OAuth button.
2. **Username Setup & Settings / Change Password Screen:** Set unique username on first sign-in, change password for email accounts, sign out button.
3. **Private Pet Health Log Screen:** View and upload private medical records, adoption papers, and private notes.
4. **Community Advice Feed Screen (Subdivided by Groups):** Filter posts by animal category (Dogs, Cats, etc.), search issues, create public posts with attachments, and post/view replies.

## Code files
- `index.html`: Contains all HTML structures and CSS styles; loads `config.js` before `app.js`.
- `app.js`: Contains all application logic, Supabase authentication, database queries, storage uploads, and DOM manipulation.
- `config.js`: Contains only the Supabase project URL and publishable key.

## Rules for every chat
- This app uses exactly three code files: index.html, app.js, config.js. Do not create more.
- index.html contains the HTML and CSS, and loads config.js before app.js.
- config.js contains only the Supabase URL and the publishable key.
- When you change code, name the file and give me the whole file, not a snippet.
- Change nothing I did not ask you to change.
- Never put a secret key in any file.

## Addresses
- GitHub Pages URL: to fill in

## Secrets
- GitHub client secret: stored in Supabase Dashboard only (under Auth > Providers > GitHub). Never in code.

## Where we are right now
Planning complete, nothing built yet.

## NOT doing, on purpose
- AI diagnosis or automated pet advice (Build 4 feature).
- External Vet API integration (Build 3 feature).

## Next thing I want to add
Set up Supabase sign-in settings, then email + password sign-in.

## Change log
- October 4, 2026: Planning session with Build 2 Planner. Plan confirmed.