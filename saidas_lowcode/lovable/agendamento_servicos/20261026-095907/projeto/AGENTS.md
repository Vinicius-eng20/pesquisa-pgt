<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Data access goes directly through the browser Supabase client; security is enforced by RLS and DB triggers (bookings_guard), so no server functions are needed for CRUD.
- The first account ever created becomes admin (handle_new_user trigger); roles live only in public.user_roles.
- slots.booked is maintained by a trigger from bookings; never write it from the app.
- Live updates come from one realtime hook (useLiveUpdates) that invalidates queries.
