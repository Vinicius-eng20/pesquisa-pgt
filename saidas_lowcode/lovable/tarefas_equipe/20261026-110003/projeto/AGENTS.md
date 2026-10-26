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

## Project rules
- Roles live in `public.user_roles` (manager/member); first signup becomes manager via `handle_new_user` trigger — keeps privileges server-side.
- Task permissions are enforced by RLS + `guard_task_update` trigger on `public.tasks`; UI only hides controls.
- Pages read/write tasks via the browser Supabase client under `_authenticated` (ssr:false); realtime on `tasks` invalidates the query.
