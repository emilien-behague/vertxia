/**
 * Vertxia /app — dashboard SaaS principale.
 * Incr 6 : Hero stage (100vh, clipped) + ProjectsSection (sous, scrollable).
 */

import { HeroStage } from "@/components/app/hero-stage";
import { ProjectsSection } from "@/components/app/projects-section";

export default function AppDashboardPage() {
  return (
    <>
      <div className="relative h-screen overflow-hidden">
        <HeroStage />
      </div>
      <ProjectsSection />
    </>
  );
}
