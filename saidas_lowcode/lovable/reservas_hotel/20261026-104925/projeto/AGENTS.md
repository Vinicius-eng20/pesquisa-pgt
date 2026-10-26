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

- Data access uses the browser Cloud client with RLS; roles live in public.user_roles checked via has_role(). Why: simple CRUD, security enforced in the database.
- Room availability and booking overlap/price rules live in the database (available_rooms RPC + validate_booking trigger). Why: guests can't read others' bookings, and double-booking must be impossible.
