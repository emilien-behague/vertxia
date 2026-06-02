import { ImageResponse } from "next/og";

// Apple touch icon — affiché sur l'écran d'accueil iOS après "Ajouter à l'écran d'accueil".
// 180×180 px est la taille officielle attendue par Safari iOS depuis iOS 7.
// On reproduit le vertex mark (3 axes isométriques + point) sur fond noir Vertxia.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          viewBox="0 0 64 64"
          width={128}
          height={128}
          fill="none"
          stroke="#A16207"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="32" y1="32" x2="32" y2="7" />
          <line x1="32" y1="32" x2="55" y2="45.5" />
          <line x1="32" y1="32" x2="9" y2="45.5" />
          <circle cx="32" cy="32" r="3.2" fill="#A16207" stroke="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
