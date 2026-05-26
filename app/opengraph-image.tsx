import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Vertxia — L'IA qui transforme ton Shopify en site 3D cinéma";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#F5F4F0",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#111",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: V logo + tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              background: "#111",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: "white",
                lineHeight: 1,
              }}
            >
              V
            </span>
          </div>
          <span
            style={{
              fontSize: 18,
              fontFamily: "monospace",
              letterSpacing: "0.3em",
              color: "rgba(0,0,0,0.4)",
              textTransform: "uppercase",
            }}
          >
            Build in Public · Day 1
          </span>
        </div>

        {/* Middle: titre principal */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            URL Shopify.
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: "rgba(0,0,0,0.38)",
            }}
          >
            Site 3D cinéma.
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            En 30 minutes.
          </div>
        </div>

        {/* Bottom: nav + URL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 24,
            borderTop: "1px solid rgba(0,0,0,0.1)",
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.35em",
              color: "#111",
            }}
          >
            VERTXIA
          </span>
          <span
            style={{
              fontSize: 22,
              color: "rgba(0,0,0,0.4)",
            }}
          >
            vertxia.com
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
