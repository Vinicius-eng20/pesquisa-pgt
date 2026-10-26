/*
# Update trigger to support manager registration code

1. Changes
- Updates the `handle_new_user()` trigger function to check for a `manager_code` in user metadata.
- If the code matches the secret value "GRAND2024", the new user's profile is created with role 'manager'.
- Otherwise, the profile is created as 'guest' (unchanged behavior).

2. Security
- The manager code lives only in the SECURITY DEFINER function body (server-side), not in client code.
- Users cannot arbitrarily set their own role — the trigger validates the code.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'manager_code' = 'GRAND2024' THEN 'manager'
      ELSE 'guest'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
