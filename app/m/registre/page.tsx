"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import { listBouteilles, listMouvements } from "@/lib/bouteille-storage";
import { loadProfil } from "@/lib/profil";
import {
  estEntree,
  estSortie,
  type Bouteille,
  type Mouvement,
} from "@/lib/bouteille";

type Preset = "30j" | "annee" | "mois" | "custom";

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export default function RegistrePage() {
  const [preset, setPreset] = useState<Preset>("30j");
  const [dateDebut, setDateDebut] = useState(isoDateOnly(new Date(Date.now() - 30 * 86400000)));
  const [dateFin, setDateFin] = useState(isoDateOnly(new Date()));
  const [bouteilles, setBouteilles] = useState<Bouteille[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBouteilles(listBouteilles());
    setMouvements(listMouvements());
  }, []);

  function handlePreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    if (p === "30j") {
      setDateDebut(isoDateOnly(new Date(Date.now() - 30 * 86400000)));
      setDateFin(isoDateOnly(now));
    } else if (p === "mois") {
      setDateDebut(isoDateOnly(startOfMonth(now)));
      setDateFin(isoDateOnly(endOfMonth(now)));
    } else if (p === "annee") {
      setDateDebut(isoDateOnly(startOfYear(now)));
      setDateFin(isoDateOnly(now));
    }
  }

  const stats = useMemo(() => {
    const tStart = new Date(dateDebut).getTime();
    const tEnd = new Date(dateFin + "T23:59:59").getTime();
    const mvsPeriod = mouvements.filter((m) => {
      const t = new Date(m.dateMouvementISO).getTime();
      return t >= tStart && t <= tEnd;
    });
    let entrees = 0;
    let sorties = 0;
    const fluides = new Set<string>();
    const bouteilleIds = new Set<string>();
    for (const m of mvsPeriod) {
      if (estEntree(m.type)) entrees += m.quantiteKg;
      else if (estSortie(m.type)) sorties += m.quantiteKg;
      bouteilleIds.add(m.bouteilleId);
      const b = bouteilles.find((x) => x.id === m.bouteilleId);
      if (b?.fluide?.code) fluides.add(b.fluide.code);
    }
    return {
      count: mvsPeriod.length,
      entrees,
      sorties,
      fluides: Array.from(fluides),
      nbBouteilles: bouteilleIds.size,
    };
  }, [mouvements, bouteilles, dateDebut, dateFin]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setError(null);

    try {
      const profil = loadProfil();
      const res = await fetch("/api/registre/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bouteilles,
          mouvements,
          periodeDebutISO: new Date(dateDebut).toISOString(),
          periodeFinISO: new Date(dateFin + "T23:59:59").toISOString(),
          profil,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || `Erreur ${res.status}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Registre_fluides_${dateDebut}_${dateFin}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <MobileHeader title="Registre fluides" largeTitle backHref="/m/bouteilles" />

      {/* Préréglages période */}
      <InsetListSection title="Période">
        <div className="px-2 py-2 grid grid-cols-3 gap-2">
          {(["30j", "mois", "annee"] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                preset === p ? "bg-[#111] text-white" : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {p === "30j" ? "30 jours" : p === "mois" ? "Ce mois" : "Cette année"}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-black/[0.06]">
          <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
            Du
          </label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => {
              setDateDebut(e.target.value);
              setPreset("custom");
            }}
            className="input-mobile"
          />
        </div>
        <div className="px-4 py-2 border-t border-black/[0.06]">
          <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
            Au
          </label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => {
              setDateFin(e.target.value);
              setPreset("custom");
            }}
            className="input-mobile"
          />
        </div>
      </InsetListSection>

      {/* Aperçu */}
      <InsetListSection title="Aperçu sur la période">
        <div className="px-4 py-3 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] tracking-widest uppercase font-mono text-black/40">Mouvements</div>
            <div className="text-[24px] font-light text-[#111] mt-0.5">{stats.count}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest uppercase font-mono text-black/40">Bouteilles</div>
            <div className="text-[24px] font-light text-[#111] mt-0.5">{stats.nbBouteilles}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest uppercase font-mono text-emerald-700">Entrées (kg)</div>
            <div className="text-[20px] font-light text-emerald-700 mt-0.5">
              {stats.entrees.toFixed(3).replace(".", ",")}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest uppercase font-mono text-red-700">Sorties (kg)</div>
            <div className="text-[20px] font-light text-red-700 mt-0.5">
              {stats.sorties.toFixed(3).replace(".", ",")}
            </div>
          </div>
        </div>
        {stats.fluides.length > 0 && (
          <div className="px-4 py-3 border-t border-black/[0.06]">
            <div className="text-[10px] tracking-widest uppercase font-mono text-black/40 mb-2">
              Fluides manipulés
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.fluides.map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-black/[0.05] text-[#111]"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </InsetListSection>

      {/* Action */}
      <div className="px-4 mt-6 mb-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || stats.count === 0}
          className="w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium active:bg-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {downloading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Génération…</span>
            </>
          ) : (
            <>⬇ Télécharger le registre PDF</>
          )}
        </button>
        {stats.count === 0 && (
          <div className="mt-2 text-[12px] text-black/45 text-center">
            Aucun mouvement sur la période. Sélectionne une période plus large ou enregistre une intervention liée à une bouteille.
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-2 mb-3 px-4 py-3 rounded-2xl bg-red-50 ring-1 ring-red-200 text-[13px] text-red-700">
          ❌ {error}
        </div>
      )}

      <div className="mx-4 mt-2 mb-8 px-4 py-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-[12px] text-amber-900 leading-relaxed">
        <strong>Format :</strong> Le registre suit le standard métier AFCE. Aucun format n&apos;est légalement imposé (article R.543-82 + arrêté 29/02/2016) mais l&apos;attestation de capacité F-Gas exige un système de traçabilité. Ce PDF couvre les éléments attendus par les organismes certifiants.
      </div>

      <style jsx global>{`
        .input-mobile {
          width: 100%; padding: 10px 0; background: transparent; border: none;
          font-size: 16px; color: #111; outline: none; font-family: inherit;
        }
        .input-mobile::placeholder { color: rgba(0,0,0,0.3); }
      `}</style>
    </>
  );
}
