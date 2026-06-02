// Page admin seed — pattern vanilla JS pur (zéro useState, zéro framer-motion,
// zéro React handlers). Le seed/clear sont déclenchés via script inline qui
// addEventListener sur les boutons après DOMContentLoaded.
//
// Pourquoi vanilla : React 19 hydration plante silencieusement sur Safari iOS
// dans certains cas — les `onClick` ne sont pas attachés. La page /test
// confirme que vanilla JS + addEventListener marche. On copie ce pattern.
//
// IMPORTANT : import dynamique de demo-seed pour éviter SSR — les fonctions
// utilisent localStorage qui n'existe pas côté serveur.

export default function AdminSeedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F4F0",
        color: "#111",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "#DC2626",
            textTransform: "uppercase",
            marginBottom: 8,
            opacity: 0.8,
          }}
        >
          ⚠ Zone admin — usage interne
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 300, lineHeight: 1.1, letterSpacing: "-0.01em", margin: 0 }}>
          Préparation démo CAPEB
        </h1>
        <p style={{ marginTop: 12, fontSize: 14, color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>
          Cette page sert à <strong>réinitialiser l&apos;app dans un état propre + crédible</strong> avant
          une démonstration terrain (CAPEB, JL, prospects). Elle peuple localStorage avec un parc
          client réaliste qui couvre tous les statuts visuels.
        </p>

        <button
          id="vertxia-seed-btn"
          type="button"
          style={{
            display: "block",
            width: "100%",
            marginTop: 32,
            padding: "20px 24px",
            background: "#111",
            color: "white",
            border: "none",
            borderRadius: 18,
            textAlign: "left",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 9,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Action principale
          </div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 500, letterSpacing: "0.04em" }}>
            RÉINITIALISER EN MODE DÉMO CAPEB
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            1 entreprise · 5 équipements · 2 interventions historiques
          </div>
        </button>

        <button
          id="vertxia-clear-btn"
          type="button"
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            padding: "16px 24px",
            background: "white",
            border: "1px solid #FECACA",
            borderRadius: 18,
            color: "#B91C1C",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 500,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          🗑 VIDER TOUT (CLEAN STATE)
        </button>

        <div
          id="vertxia-status"
          style={{
            display: "none",
            marginTop: 20,
            padding: "16px 20px",
            borderRadius: 16,
            fontSize: 14,
          }}
        ></div>

        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <a
            href="/equipements"
            style={{
              padding: "14px 16px",
              background: "white",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 12,
              textAlign: "center",
              textDecoration: "none",
              color: "rgba(0,0,0,0.75)",
            }}
          >
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.25em", color: "rgba(0,0,0,0.4)", textTransform: "uppercase" }}>
              Vérifier
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", fontWeight: 500 }}>
              PARC ÉQUIPEMENTS
            </div>
          </a>
          <a
            href="/dashboard"
            style={{
              padding: "14px 16px",
              background: "white",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 12,
              textAlign: "center",
              textDecoration: "none",
              color: "rgba(0,0,0,0.75)",
            }}
          >
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.25em", color: "rgba(0,0,0,0.4)", textTransform: "uppercase" }}>
              Vérifier
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", fontWeight: 500 }}>
              TABLEAU DE BORD
            </div>
          </a>
        </div>

        <div style={{ marginTop: 48, fontSize: 12, color: "rgba(0,0,0,0.4)", lineHeight: 1.7 }}>
          <strong style={{ color: "rgba(0,0,0,0.6)" }}>À faire avant chaque démo</strong> :
          <ol style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Cliquer « Réinitialiser en mode démo CAPEB » sur cette page</li>
            <li>Aller sur <code style={{ color: "#A16207" }}>/equipements</code> → cliquer « STICKERS QR PDF »</li>
            <li>Imprimer les stickers, en coller 2-3 sur des équipements de démo</li>
            <li>Pendant la démo : scanner avec l&apos;iPhone, montrer le flow scan → fiche → intervention → CERFA</li>
            <li>À la fin : revenir ici et « VIDER TOUT » pour ne pas laisser les données démo</li>
          </ol>
        </div>
      </div>

      {/* Vanilla JS — attache les handlers manuellement après DOM ready.
          Ne dépend pas de React hydration → marche garantis sur Safari iOS. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              function setStatus(type, message) {
                var el = document.getElementById('vertxia-status');
                if (!el) return;
                el.style.display = 'block';
                el.textContent = message;
                if (type === 'ok') {
                  el.style.background = '#ECFDF5';
                  el.style.color = '#065F46';
                  el.style.border = '1px solid #A7F3D0';
                } else {
                  el.style.background = '#FEF2F2';
                  el.style.color = '#991B1B';
                  el.style.border = '1px solid #FECACA';
                }
              }
              function attach() {
                var seedBtn = document.getElementById('vertxia-seed-btn');
                var clearBtn = document.getElementById('vertxia-clear-btn');
                if (!seedBtn || !clearBtn) { setTimeout(attach, 100); return; }

                seedBtn.addEventListener('click', function() {
                  if (seedBtn.disabled) return;
                  seedBtn.disabled = true;
                  seedBtn.style.opacity = '0.6';
                  // Import dynamique pour éviter SSR
                  import('/' + '_next/static/chunks/lib_demo-seed.js').catch(function() {
                    // Fallback : on charge via module map Next.js
                  });
                  // Plan B universel : on inline le seed directement (pas d'import)
                  try {
                    runSeed();
                    setStatus('ok', '✅ Démo seedée : 5 équipements + 2 interventions + profil entreprise. Va sur /equipements pour vérifier.');
                  } catch (e) {
                    setStatus('err', '❌ Erreur seed : ' + (e && e.message ? e.message : String(e)));
                  } finally {
                    seedBtn.disabled = false;
                    seedBtn.style.opacity = '1';
                  }
                });

                clearBtn.addEventListener('click', function() {
                  if (clearBtn.disabled) return;
                  if (!confirm('Vider TOUT le localStorage Vertxia (équipements + interventions + profil + syderep) ? Irréversible.')) return;
                  clearBtn.disabled = true;
                  try {
                    runClear();
                    setStatus('ok', '✅ Toutes les données locales Vertxia ont été supprimées.');
                  } catch (e) {
                    setStatus('err', '❌ Erreur clear : ' + (e && e.message ? e.message : String(e)));
                  } finally {
                    clearBtn.disabled = false;
                  }
                });
              }

              // ───── SEED INLINE — autonome, pas de dépendance React/import ────────
              function uuid() {
                if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                  var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
                });
              }
              function daysAgo(d) {
                var dt = new Date();
                dt.setDate(dt.getDate() - d);
                return dt.toISOString();
              }
              function yearsAhead(y) {
                var dt = new Date();
                dt.setFullYear(dt.getFullYear() + y);
                return dt.toISOString();
              }
              function runClear() {
                ['vertxia:equipements','vertxia:interventions','vertxia:profil','vertxia:syderep:manualInputs'].forEach(function(k){localStorage.removeItem(k);});
              }
              function runSeed() {
                runClear();
                var now = new Date().toISOString();
                // Profil
                localStorage.setItem('vertxia:profil', JSON.stringify({
                  raisonSociale:'Vertxia Frigorifique',siret:'12345678901234',
                  adresseRue:'12 avenue de la République',adresseCp:'83000',adresseVille:'Toulon',
                  telephone:'04 94 00 00 00',email:'contact@vertxia-demo.fr',siteWeb:'https://vertxia.com',
                  numeroAttestation:'FR-CAT1-DEMO-2026',categorieAttestation:'I',organismeAgree:'Dekra',
                  dateExpirationAttestation:yearsAhead(3),numeroRecepisseTransport:'TVD-83-2026-0042',
                  logoDataUrl:undefined,signatureDataUrl:undefined,updatedAt:now
                }));
                // Equipements
                var eqs = [
                  {clientName:'Hôtel Le Provençal',siteAdresse:'8 boulevard de la Plage, 83000 Toulon',modele:'Daikin VRV V RWEYQ16T7Y1B',numeroSerie:'DK24VRV16001',fluide:{code:'R-410A',label:'R-410A (HFC)',gwp:2088},chargeKg:16,detecteurFixe:false,dernierControleISO:daysAgo(420),notes:'Climatisation centralisée 48 chambres — installation 2018'},
                  {clientName:'Restaurant Marius',siteAdresse:"Port d'Hyères, 83400 Hyères",modele:'Frigopol PG-FNB-080',numeroSerie:'FP25NB080034',fluide:{code:'R-404A',label:'R-404A (HFC)',gwp:3922},chargeKg:8,detecteurFixe:false,dernierControleISO:daysAgo(280),notes:'Chambre froide négative cuisine — produits de la mer'},
                  {clientName:'Cabinet Médical Saint-Roch',siteAdresse:'27 rue Saint-Roch, 83000 Toulon',modele:'Mitsubishi PUHZ-ZRP100YKA',numeroSerie:'MS25PUHZ100012',fluide:{code:'R-32',label:'R-32 (HFC)',gwp:675},chargeKg:2.8,detecteurFixe:false,dernierControleISO:undefined,notes:'Climatisation salle d\\'attente + 3 cabinets de consultation'},
                  {clientName:'Boulangerie Pain & Co',siteAdresse:'14 cours Louis Blanc, 83500 La Seyne-sur-Mer',modele:'Carrier 38VYX-040',numeroSerie:'CR25VYX040018',fluide:{code:'R-407C',label:'R-407C (HFC)',gwp:1774},chargeKg:5.5,detecteurFixe:true,dernierControleISO:daysAgo(45),notes:'Climatisation laboratoire fabrication — détecteur fixe NH3 secondaire'},
                  {clientName:'Supermarché Spar — Cap Couronne',siteAdresse:'Avenue du 8 Mai 1945, 83130 La Garde',modele:'Bitzer 4PES-15Y centrale froid commercial',numeroSerie:'BZ26FCC15022',fluide:{code:'R-449A',label:'R-449A (HFC)',gwp:1397},chargeKg:22,detecteurFixe:false,dernierControleISO:undefined,notes:'Nouveau client (mai 2026) — centrale rayon frais + meubles vitrines'}
                ].map(function(e){return Object.assign({},e,{id:uuid(),createdAt:now});});
                localStorage.setItem('vertxia:equipements', JSON.stringify(eqs));
                // Interventions historiques
                var ints = [
                  {typeIntervention:'controle_periodique',fluide:{code:'R-407C',label:'R-407C (HFC)',gwp:1774},weight:0,packagingNumero:'',clientName:'Boulangerie Pain & Co',modeleEquipement:'Carrier 38VYX-040',numeroSerieEquipement:'CR25VYX040018',lieuIntervention:'14 cours Louis Blanc, 83500 La Seyne-sur-Mer',attestation:'FR-CAT1-DEMO-2026',controleDetails:{detecteurId:'DTC-T1-007',detecteurPermanent:true,fuiteDetectee:false}},
                  {typeIntervention:'recuperation',fluide:{code:'R-22',label:'R-22 (HCFC — interdit)',gwp:1810},weight:3.2,packagingNumero:'B112026047',clientName:'Garage Auto Central — Toulon',modeleEquipement:'Climatisation atelier (matériel 1998)',numeroSerieEquipement:'OLD22-001',lieuIntervention:"5 rue de l'Artisanat, 83000 Toulon",attestation:'FR-CAT1-DEMO-2026',bsffId:'BSFF-DEMO-001',bsffSignedAt:daysAgo(15)}
                ].map(function(i){return Object.assign({},i,{id:uuid(),createdAt:now});});
                localStorage.setItem('vertxia:interventions', JSON.stringify(ints));
              }

              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', attach);
              } else {
                attach();
              }
            })();
          `,
        }}
      />
    </div>
  );
}
