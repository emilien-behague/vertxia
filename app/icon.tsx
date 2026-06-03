import { ImageResponse } from "next/og";

// Favicon Vertxia — onglet navigateur, raccourcis.
// Logo : 3 branches gold (#A16207) a 120°, fond noir #111. Identique a
// apple-icon mais plus petit. Remplace l'ancien icon.png (gros V blanc)
// pour cohérence brand avec le logo 2026 valide par Emilien 04/06/2026.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          width={48}
          height={48}
          fill="none"
          stroke="#A16207"
          strokeWidth="13"
          strokeLinecap="round"
        >
          <line x1="50" y1="50" x2="50" y2="14" />
          <line x1="50" y1="50" x2="81.2" y2="68" />
          <line x1="50" y1="50" x2="18.8" y2="68" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
