import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Landing } from "@/components/Landing";
import { MorningIntent } from "@/components/MorningIntent";

export const Route = createFileRoute("/intent")({
  head: () => ({
    meta: [
      { title: "Morning Intent — StudyBandhu" },
      { name: "description", content: "Set today's gentle intent — pick what to study from your syllabus." },
    ],
  }),
  component: IntentRoute,
});

function IntentRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Landing />;
  return <MorningIntent />;
}
