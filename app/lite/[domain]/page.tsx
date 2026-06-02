/**
 * Vertxia Lite — Site genere dynamiquement depuis un brief JSON.
 *
 * Route : /lite/[domain]
 * Source : data/briefs/<domain>.json (produit par brief_llm.py)
 * Videos : public/lite/videos/<domain>/<handle>.mp4 (produites par vertxia_lite_kling.py)
 *
 * V0.2 (motion edition) : tous les templates sont des composants client
 * qui utilisent la lib `components/motion-primitives/` (regle 23).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadBrief, listBriefs } from "@/lib/brief-loader";
import { paletteColor } from "@/lib/brief";
import { CinematicNarrative } from "@/components/lite-templates/cinematic-narrative";
import { DocumentaryStory } from "@/components/lite-templates/documentary-story";
import { HorizontalSlider } from "@/components/lite-templates/horizontal-slider";
import { BrutalistTech } from "@/components/lite-templates/brutalist-tech";
import { EditorialMagazine } from "@/components/lite-templates/editorial-magazine";
import { MuseumCurated } from "@/components/lite-templates/museum-curated";
import { KineticTypography } from "@/components/lite-templates/kinetic-typography";
import { NoirMagazine } from "@/components/lite-templates/noir-magazine";
import { CyberpunkNoir } from "@/components/lite-templates/cyberpunk-noir";
import { AgenticHero } from "@/components/lite-templates/agentic-hero";
import { VisualSignature } from "@/components/lite-templates/visual-signature";
import { EditChatPanel } from "@/components/lite-templates/edit-chat-panel";

type PageProps = {
  params: Promise<{ domain: string }>;
};

export async function generateStaticParams() {
  const briefs = await listBriefs();
  return briefs.map((domain) => ({ domain }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { domain } = await params;
  const brief = await loadBrief(domain);
  if (!brief) {
    return { title: "Site non trouvé · Vertxia Lite" };
  }
  return {
    title: `${brief.brand.name} · ${brief.creative_direction.mood.split(/[.——]/)[0].trim().slice(0, 60)}`,
    description: brief.brand.positioning_one_liner,
  };
}

export default async function LiteDynamicPage({ params }: PageProps) {
  const { domain } = await params;
  const brief = await loadBrief(domain);

  if (!brief) {
    notFound();
  }

  // Accent + signature au niveau routeur — wrappe TOUS les retours pour multiplier les variations
  const signature = brief.visual_signature ?? "none";
  const routerAccent = paletteColor(brief.visual_system.palette, "accent", "#E8521A");
  // Panel d'edit chat — couleurs derivees du brief pour s'integrer visuellement
  const panelBg = paletteColor(brief.visual_system.palette, "background", "#0A0A0A");
  const panelFg = paletteColor(brief.visual_system.palette, "foreground", "#F0F0F0");

  // Route selon template_id — tous templates = composants client motion-rich
  if (brief.template_id === "cinematic-narrative") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <CinematicNarrative brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "documentary-story") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <DocumentaryStory brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "horizontal-slider") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <HorizontalSlider brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "brutalist-tech") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <BrutalistTech brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "museum-curated") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <MuseumCurated brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "kinetic-typography") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <KineticTypography brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "noir-magazine") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <NoirMagazine brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "cyberpunk-noir") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <CyberpunkNoir brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "agentic-hero") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <AgenticHero brief={brief} />
        <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
      </VisualSignature>
    );
  }

  // Default = editorial-magazine
  return (
    <VisualSignature signature={signature} accent={routerAccent}>
      <EditorialMagazine brief={brief} />
      <EditChatPanel slug={domain} accent={routerAccent} bg={panelBg} fg={panelFg} />
    </VisualSignature>
  );
}
