"use client";

/**
 * /app/assets — bibliotheque brand assets (logos, photos, polices, refs).
 *
 * V0.1 : 3 tabs (Brand · References · Documents), drop zone, grille assets mock.
 * Pas d'upload reel (V0.2 = endpoint /api/assets/upload + S3/R2 storage).
 */

import { motion } from "framer-motion";
import { useState } from "react";
import {
  PageShell,
  PrimaryButton,
  GhostButton,
  EmptyState,
  SectionTitle,
} from "@/components/app/page-shell";
import {
  IconImage,
  IconType,
  IconFile,
  IconPlus,
  IconPalette,
} from "@/components/app/icons";

type TabKey = "brand" | "references" | "documents";

type AssetCard = {
  id: string;
  type: "image" | "color" | "font" | "doc";
  label: string;
  meta: string;
  preview?: string;
  color?: string;
  font?: string;
};

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "brand",       label: "Brand",       icon: <IconPalette size={14} /> },
  { key: "references",  label: "References",  icon: <IconImage size={14} /> },
  { key: "documents",   label: "Documents",   icon: <IconFile size={14} /> },
];

const BRAND_ASSETS: AssetCard[] = [
  { id: "logo-1",    type: "image", label: "Vertxia · Logo wordmark",  meta: "SVG · 12 ko",   preview: "https://picsum.photos/seed/asset-logo-1/400/300" },
  { id: "logo-2",    type: "image", label: "Vertxia · Logo monogram",  meta: "SVG · 4 ko",    preview: "https://picsum.photos/seed/asset-logo-2/400/300" },
  { id: "color-1",   type: "color", label: "Studio Gold",              meta: "#D6B96E",       color: "#D6B96E" },
  { id: "color-2",   type: "color", label: "Cosmic Indigo",            meta: "#4F7DFF",       color: "#4F7DFF" },
  { id: "color-3",   type: "color", label: "Onyx",                     meta: "#050505",       color: "#050505" },
  { id: "font-1",    type: "font",  label: "Inter",                    meta: "Display · UI",  font: "Inter" },
  { id: "font-2",    type: "font",  label: "Fraunces",                 meta: "Editorial",     font: "Fraunces, serif" },
];

const REFERENCE_ASSETS: AssetCard[] = [
  { id: "ref-1", type: "image", label: "Aman Sveti Stefan · architecture",  meta: "Unsplash · 4.2 Mo",  preview: "https://picsum.photos/seed/ref-aman/400/300" },
  { id: "ref-2", type: "image", label: "Porsche 911 Heritage · campaign",   meta: "Reference · 2.8 Mo", preview: "https://picsum.photos/seed/ref-porsche/400/300" },
  { id: "ref-3", type: "image", label: "Margiela · runway frame",           meta: "Reference · 3.1 Mo", preview: "https://picsum.photos/seed/ref-margiela/400/300" },
  { id: "ref-4", type: "image", label: "Cartier · macro detail",            meta: "Reference · 1.9 Mo", preview: "https://picsum.photos/seed/ref-cartier/400/300" },
];

const DOC_ASSETS: AssetCard[] = [
  { id: "doc-1", type: "doc", label: "Brand book Vertxia.pdf", meta: "PDF · 8 pages · 1.2 Mo" },
  { id: "doc-2", type: "doc", label: "Voice & Tone guide.md",  meta: "Markdown · 4 ko" },
];

const TAB_DATA: Record<TabKey, AssetCard[]> = {
  brand:      BRAND_ASSETS,
  references: REFERENCE_ASSETS,
  documents:  DOC_ASSETS,
};

export default function AssetsPage() {
  const [tab, setTab] = useState<TabKey>("brand");
  const assets = TAB_DATA[tab];

  return (
    <PageShell
      eyebrow="Library"
      title="Assets"
      description="Tes references creatives, logos, polices et palettes. Tout ce qui nourrit l'identite de tes generations."
      actions={
        <>
          <GhostButton>
            <IconImage size={14} /> Import depuis URL
          </GhostButton>
          <PrimaryButton>
            <IconPlus size={14} /> Upload
          </PrimaryButton>
        </>
      }
    >
      {/* Tabs */}
      <div className="mb-8 inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "inline-flex items-center gap-2 h-8 px-3.5 rounded-lg text-[12.5px] transition",
                isActive
                  ? "bg-white text-black font-medium"
                  : "text-white/65 hover:text-white",
              ].join(" ")}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10 border border-dashed border-white/[0.10] rounded-2xl py-9 px-6 text-center bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.18] transition cursor-pointer"
      >
        <p className="text-[13.5px] text-white/65">
          Glisse-depose des fichiers ici, ou{" "}
          <span className="text-white underline underline-offset-2 decoration-white/30 hover:decoration-white">
            parcours ton disque
          </span>
        </p>
        <p className="mt-1.5 text-[11.5px] text-white/35">
          PNG, JPG, SVG, MP4, PDF jusqu'a 50 Mo
        </p>
      </motion.div>

      {/* Grid d'assets */}
      <SectionTitle>{assets.length} elements</SectionTitle>

      {assets.length === 0 ? (
        <EmptyState
          icon={<IconImage size={20} />}
          title="Rien ici pour le moment"
          description="Upload tes premiers fichiers pour les referencer dans tes generations."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {assets.map((a, i) => (
            <motion.button
              key={a.id}
              type="button"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: 0.03 * i,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
              className="group text-left rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition"
            >
              <div className="relative aspect-square bg-black/40 overflow-hidden">
                {a.type === "image" && a.preview && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={a.preview}
                    alt={a.label}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                )}
                {a.type === "color" && (
                  <div
                    className="w-full h-full"
                    style={{ background: a.color }}
                  />
                )}
                {a.type === "font" && (
                  <div
                    className="w-full h-full grid place-items-center text-white"
                    style={{
                      fontFamily: a.font,
                      fontSize: "44px",
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)",
                    }}
                  >
                    Aa
                  </div>
                )}
                {a.type === "doc" && (
                  <div className="w-full h-full grid place-items-center text-white/30">
                    <IconFile size={28} />
                  </div>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[12.5px] font-medium text-white truncate">
                  {a.label}
                </p>
                <p className="mt-0.5 text-[11px] text-white/40 truncate">
                  {a.meta}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
