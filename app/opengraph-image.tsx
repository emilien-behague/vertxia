// Open Graph image dynamique Vertxia F-Gas.
// Next.js convention : ce fichier .tsx remplace le opengraph-image.png
// statique (prend précédence). Généré à la build, servi à /opengraph-image.
//
// Quand Vertxia repivote, on edit juste ce composant — pas besoin de
// produire un nouveau PNG dans Figma/Photoshop.

import { ImageResponse } from "next/og";

export const runtime = "edge";

// Spec OG standard (LinkedIn / Instagram / WhatsApp / Twitter)
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const alt =
  "Vertxia — La paperasse F-Gas finie en quelques secondes. Pour techniciens, climaticiens, installateurs PAC.";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F5F4F0",
          display: "flex",
          flexDirection: "column",
          padding: "60px 70px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Lockup logo + wordmark Vertxia */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Logo : 3 branches a 120° en gold #A16207 */}
            <svg width="56" height="56" viewBox="0 0 100 100" fill="none">
              <g stroke="#A16207" strokeWidth="11" strokeLinecap="round">
                <line x1="50" y1="50" x2="50" y2="14" />
                <line x1="50" y1="50" x2="81.2" y2="68" />
                <line x1="50" y1="50" x2="18.8" y2="68" />
              </g>
            </svg>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "#111",
                display: "flex",
              }}
            >
              VERTXIA
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.25em",
              color: "rgba(0,0,0,0.45)",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            · F-Gas · Techniciens
          </div>
        </div>

        {/* Headline central */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 40,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
              color: "#111",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ display: "flex" }}>La paperasse F-Gas</span>
            <span style={{ display: "flex", color: "#A16207" }}>
              finie en quelques
            </span>
            <span style={{ display: "flex" }}>secondes.</span>
          </div>

          <div
            style={{
              marginTop: 32,
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.35,
              color: "rgba(0,0,0,0.62)",
              display: "flex",
              maxWidth: 900,
            }}
          >
            Photo + voix → BSFF officiel signé Ministère, CERFA 15497*04,
            déclaration SYDEREP. Pour techniciens, climaticiens, installateurs PAC.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 20,
            borderTop: "2px solid rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 22,
              color: "#111",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                display: "flex",
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#A16207",
              }}
            />
            vertxia.com
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "rgba(0,0,0,0.5)",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            Connecté TrackDéchets · Ministère de la Transition écologique
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
