import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/CourseCard";
import { fetchCourses, fetchMyEnrollmentIds } from "@/lib/courses";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cursos")({
  head: () => ({
    meta: [
      { title: "Cursos disponíveis — Saber+" },
      { name: "description", content: "Todos os cursos disponíveis para matrícula." },
      { property: "og:title", content: "Cursos disponíveis — Saber+" },
      { property: "og:description", content: "Todos os cursos disponíveis para matrícula." },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const mine = useQuery({ queryKey: ["my-enrollments"], queryFn: fetchMyEnrollmentIds });

  const enroll = useMutation({
    mutationFn: async (courseId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("enrollments").insert({ course_id: courseId, user_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula realizada!");
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
    onError: () => toast.error("Não foi possível fazer a matrícula."),
  });

  return (
    <div>
      <h1 className="text-4xl font-semibold">Cursos disponíveis</h1>
      <p className="mt-2 text-muted-foreground">Escolha um curso e faça sua matrícula.</p>
      {courses.isLoading ? (
        <p className="mt-10 text-muted-foreground">Carregando…</p>
      ) : courses.data?.length === 0 ? (
        <p className="mt-10 text-muted-foreground">Nenhum curso cadastrado ainda.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data?.map((c) => {
            const enrolled = mine.data?.includes(c.id);
            return (
              <CourseCard
                key={c.id}
                course={c}
                action={
                  enrolled ? (
                    <span className="flex items-center gap-2 font-semibold text-success">
                      <CheckCircle2 className="h-5 w-5" /> Você está matriculado
                    </span>
                  ) : (
                    <Button className="w-full" disabled={enroll.isPending} onClick={() => enroll.mutate(c.id)}>
                      Matricular-se
                    </Button>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
