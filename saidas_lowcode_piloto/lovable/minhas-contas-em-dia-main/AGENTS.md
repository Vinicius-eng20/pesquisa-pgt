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

- Signed-in pages live under src/routes/_authenticated/ (client-only gate); data access goes through the browser client with RLS doing authorization — keeps rules enforced server-side.
- Roles live in public.user_roles checked via has_role(); deactivated users are blocked by is_active() in expense RLS policies.
