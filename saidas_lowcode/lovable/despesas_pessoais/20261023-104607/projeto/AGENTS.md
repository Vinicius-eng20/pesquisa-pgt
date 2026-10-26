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

- Data access uses the browser Supabase client with RLS; admin-only aggregates go through the `admin_user_totals` security-definer RPC, which checks `has_role` — keeps privileged reads in the database.
- Signed-in pages live under `src/routes/_authenticated/`; the layout blocks deactivated profiles (`profiles.active`) and RLS on expenses also requires an active profile.
