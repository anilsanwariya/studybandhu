import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "StudyBandhu — Home" },
      { name: "description", content: "Landing page for StudyBandhu — a forgiving study tracker for exam aspirants." },
    ],
  }),
  component: () => <Landing />,
});
