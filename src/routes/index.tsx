import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Landing } from "@/components/Landing";
import { MorningIntent } from "@/components/MorningIntent";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyBandhu — Forgiving Study Tracker for Exam Aspirants" },
      { name: "description", content: "A calming, forgiving syllabus tracker and spaced-repetition companion for competitive exam aspirants (RAS, UPSC, SSC, and more)." },
      { property: "og:title", content: "StudyBandhu — Forgiving Study Tracker" },
      { property: "og:description", content: "AI syllabus parser, forgiving revision engine, morning intent planner, and study squads for exam prep." },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Landing />;
  return <MorningIntent />;
}
