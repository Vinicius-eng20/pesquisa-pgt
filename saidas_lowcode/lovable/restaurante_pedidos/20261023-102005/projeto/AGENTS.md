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

- Data access goes straight from the browser client with RLS; order placement uses the `place_order` SQL function so prices are read server-side. Why: keeps totals trustworthy without extra server code.
- The first account ever created becomes the manager (admin role in `user_roles`, set by the signup trigger). Why: no external admin setup.
