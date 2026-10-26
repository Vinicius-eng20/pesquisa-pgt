import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function LoginPrompt({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Entre na sua conta</h1>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <Button asChild className="mt-6">
        <Link to="/entrar">Entrar ou criar conta</Link>
      </Button>
    </div>
  );
}
