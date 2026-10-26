import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/CourseCard";
import { fetchCourses, fetchMyEnrollmentIds } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/meus-cursos")({
  head: () => ({
    meta: [
      { title: "Meus cursos — Saber+" },
      { name: "description", content: "Os cursos em que você está matriculado." },
      { property: "og:title", content: "Meus cursos — Saber+" },
      { property: "og:description", content: "Os cursos em que você está matriculado." },
    ],
  }),
  component: MyCourses,
});

function MyCourses() {
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const mine = useQuery({ queryKey: ["my-enrollments"], queryFn: fetchMyEnrollmentIds });
  const list = (courses.data ?? []).filter((c) => mine.data?.includes(c.id));
  const loading = courses.isLoading || mine.isLoading;

  return (
    <div>
      <h1 className="text-4xl font-semibold">Meus cursos</h1>
      <p className="mt-2 text-muted-foreground">Cursos em que você está matriculado.</p>
      {loading ? (
        <p className="mt-10 text-muted-foreground">Carregando…</p>
      ) : list.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Você ainda não está matriculado em nenhum curso.</p>
          <Button asChild className="mt-4"><Link to="/cursos">Ver cursos</Link></Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => <CourseCard key={c.id} course={c} />)}
        </div>
      )}
    </div>
  );
}
