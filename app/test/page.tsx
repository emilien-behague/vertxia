// Page de diagnostic minimale — zéro React, zéro framer-motion.
// Si JS marche sur l'iPhone, le bouton change de couleur + onClick déclenche un compteur.

export default function TestPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F4F0",
        color: "#111",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 22, margin: "8px 0 16px" }}>
        🔬 Test JavaScript Safari iPhone
      </h1>
      <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5 }}>
        Cette page n&apos;utilise pas de React state/hooks/framer-motion. Elle teste
        si Safari iPhone exécute du JavaScript de base sur ton réseau local.
      </p>

      <div
        style={{
          marginTop: 24,
          padding: 24,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "#999",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Statut JavaScript
        </div>
        <div
          id="js-status"
          style={{ fontSize: 18, fontWeight: 500, color: "#DC2626" }}
        >
          ❌ JS NON CHARGÉ (si tu vois ce texte rouge après 5s)
        </div>
        <div
          id="js-info"
          style={{
            display: "none",
            padding: 12,
            background: "#F5F4F0",
            borderRadius: 8,
            marginTop: 10,
            fontSize: 12,
            wordBreak: "break-all",
          }}
        >
          User-Agent : <span id="ua"></span>
          <br />
          Heure : <span id="time"></span>
          <br />
          URL : <span id="url"></span>
        </div>

        <button
          id="test-btn"
          type="button"
          style={{
            display: "block",
            width: "100%",
            padding: 16,
            marginTop: 16,
            background: "#111",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            letterSpacing: "0.05em",
            fontWeight: 500,
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          APPUIE ICI POUR TESTER UN CLIC
        </button>
        <div
          id="click-result"
          style={{
            display: "none",
            padding: 12,
            background: "#ECFDF5",
            color: "#065F46",
            borderRadius: 8,
            marginTop: 10,
            fontSize: 13,
          }}
        >
          ✅ Clic enregistré ! Le bouton a été appuyé{" "}
          <span id="click-count">0</span> fois.
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 24,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "#999",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Test fetch CDN externe
        </div>
        <div
          id="fetch-status"
          style={{ fontSize: 16, fontWeight: 500, color: "#999" }}
        >
          ⏳ Test en cours...
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              function run() {
                try {
                  var statusEl = document.getElementById('js-status');
                  if (statusEl) {
                    statusEl.textContent = '✅ JAVASCRIPT FONCTIONNE';
                    statusEl.style.color = '#059669';
                  }
                  var infoEl = document.getElementById('js-info');
                  if (infoEl) {
                    infoEl.style.display = 'block';
                    document.getElementById('ua').textContent = navigator.userAgent;
                    document.getElementById('time').textContent = new Date().toLocaleTimeString('fr-FR');
                    document.getElementById('url').textContent = window.location.href;
                  }
                  var count = 0;
                  var btn = document.getElementById('test-btn');
                  if (btn) {
                    btn.addEventListener('click', function() {
                      count++;
                      var r = document.getElementById('click-result');
                      r.style.display = 'block';
                      document.getElementById('click-count').textContent = String(count);
                    });
                  }
                  fetch('https://cdn.jsdelivr.net/npm/eruda/package.json', { mode: 'cors' })
                    .then(function(res) {
                      var fs = document.getElementById('fetch-status');
                      fs.textContent = '✅ CDN ACCESSIBLE (HTTP ' + res.status + ')';
                      fs.style.color = '#059669';
                    })
                    .catch(function(err) {
                      var fs = document.getElementById('fetch-status');
                      fs.textContent = '❌ CDN BLOQUÉ : ' + (err && err.message ? err.message : 'err');
                      fs.style.color = '#DC2626';
                    });
                } catch (e) {
                  document.body.insertAdjacentHTML('beforeend',
                    '<div style="background:#FEE;padding:16px;margin-top:16px;border-radius:8px;color:#900;font-size:13px;">Erreur JS : ' +
                    (e.message || e).toString().replace(/</g, '&lt;') + '</div>');
                }
              }
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', run);
              } else {
                run();
              }
            })();
          `,
        }}
      />
    </div>
  );
}
