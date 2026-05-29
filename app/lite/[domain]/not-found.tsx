/**
 * Page 404 personnalisee pour /lite/[domain] quand le brief n'existe pas encore.
 *
 * V0.1 : pipeline local Python, donc on instruit l'utilisateur sur la commande a lancer.
 * V0.2 : remplacera par un trigger pipeline serveur + page d'attente live.
 */

import Link from "next/link";

export default function LiteNotFound() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased flex items-center justify-center p-8 relative overflow-hidden">
      {/* Ambient gradient subtil */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(138,63,255,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative max-w-2xl w-full text-center space-y-8">
        {/* Badge status */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          <span className="text-white/85">Site pas encore genere</span>
        </div>

        {/* Headline */}
        <div>
          <h1
            className="text-4xl md:text-5xl font-bold tracking-[-0.025em] leading-tight"
            style={{
              fontFamily:
                "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            On n'a pas encore <br />
            <span className="bg-gradient-to-r from-[#7B61FF] via-[#FF3D8A] to-[#FF7A3D] bg-clip-text text-transparent">
              ton site cinematic.
            </span>
          </h1>
          <p className="mt-5 text-[15px] text-white/55 leading-relaxed max-w-lg mx-auto">
            Le pipeline tourne en local. Lance cette commande dans ton terminal,
            attends que les videos AI soient generees, puis reviens.
          </p>
        </div>

        {/* Commande a copier */}
        <div className="rounded-2xl bg-black/40 border border-white/[0.08] p-5 text-left">
          <p className="text-[10.5px] tracking-[0.18em] uppercase text-white/40 mb-2.5 font-mono">
            Terminal · racine du repo Vertxia
          </p>
          <pre className="font-mono text-[13px] text-white/90 overflow-x-auto">
            <code>python vertxia_lite_pipeline.py \{"\n"}
  --url https://ton-shop.com \{"\n"}
  --prompt &quot;ambiance editorial print magazine&quot;</code>
          </pre>
        </div>

        {/* Pourquoi local */}
        <div className="text-[12.5px] text-white/40 leading-relaxed max-w-xl mx-auto">
          <p>
            Le pipeline appelle Claude (brief creatif) + Kling (videos AI). Le
            cout par site est ~2€ et le temps total ~10 minutes. Le trigger via
            la dashboard arrive en V0.2.
          </p>
        </div>

        {/* CTA back to app */}
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-white text-black text-[13px] font-medium hover:scale-[1.02] transition"
          >
            Retour à la dashboard
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/lite/allbirds_com"
            className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/85 text-[13px] hover:bg-white/[0.08] transition"
          >
            Voir une demo (Allbirds)
          </Link>
        </div>
      </div>
    </main>
  );
}
