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

- Data access goes through the browser Supabase client with RLS; checkout runs in the `place_order` SQL function so totals/stock are computed server-side.
- Store owner = `admin` row in `user_roles`; the first account to sign up is made admin by the signup trigger.
- Product photos are stored as URLs (public storage buckets are blocked in this workspace).
