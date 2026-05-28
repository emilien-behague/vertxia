/**
 * SSRF guard pour les routes API qui font fetch() sur une URL fournie
 * par l'utilisateur (scrape, upscale, optimize-glb).
 *
 * Bloque :
 *   - schemes autres que http/https
 *   - hostnames qui résolvent en IPs privées / loopback / link-local
 *   - IP metadata cloud (169.254.169.254 AWS/GCP/Azure)
 *   - hostnames suspects (localhost, *.local, *.internal)
 *
 * Usage dans une route :
 *   const guard = await validateExternalUrl(userUrl);
 *   if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 400 });
 *   const res = await fetch(userUrl, { redirect: "error" }); // refuse redirects
 */

import { promises as dns } from "node:dns";
import net from "node:net";

export type GuardResult =
  | { ok: true; hostname: string; resolvedIp: string }
  | { ok: false; reason: string };

const BLOCKED_HOSTNAME_SUFFIXES = [
  "localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
];

function isPrivateOrSpecialIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local + metadata cloud (AWS/GCP/Azure)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 100.64.0.0/10 carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // multicast 224.0.0.0/4 + reserved 240.0.0.0/4
  if (a >= 224) return true;
  return false;
}

function isPrivateOrSpecialIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // loopback
  if (lower === "::1") return true;
  // unspecified
  if (lower === "::") return true;
  // IPv4-mapped → check la partie IPv4
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateOrSpecialIPv4(v4mapped[1]);
  // unique-local fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // link-local fe80::/10
  if (lower.startsWith("fe8") || lower.startsWith("fe9") ||
      lower.startsWith("fea") || lower.startsWith("feb")) return true;
  // multicast ff00::/8
  if (lower.startsWith("ff")) return true;
  return false;
}

export async function validateExternalUrl(rawUrl: string): Promise<GuardResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL invalide" };
  }

  // Scheme : seulement http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Seuls http(s):// sont autorisés" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) return { ok: false, reason: "Hostname manquant" };

  // Hostnames suspects
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(suffix)) {
      return { ok: false, reason: `Hostname interne bloqué : ${hostname}` };
    }
  }

  // Si le hostname est déjà une IP littérale, check direct
  const ipFamily = net.isIP(hostname);
  if (ipFamily === 4) {
    if (isPrivateOrSpecialIPv4(hostname)) {
      return { ok: false, reason: `IP privée/réservée bloquée : ${hostname}` };
    }
    return { ok: true, hostname, resolvedIp: hostname };
  }
  if (ipFamily === 6) {
    if (isPrivateOrSpecialIPv6(hostname)) {
      return { ok: false, reason: `IP IPv6 privée/réservée bloquée : ${hostname}` };
    }
    return { ok: true, hostname, resolvedIp: hostname };
  }

  // Sinon résoudre via DNS (toutes les IPs) et vérifier qu'aucune n'est privée
  let resolved: { address: string; family: number }[];
  try {
    resolved = await dns.lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: `DNS échoué : ${hostname}` };
  }

  if (resolved.length === 0) {
    return { ok: false, reason: "Aucune IP résolue" };
  }

  for (const r of resolved) {
    const blocked = r.family === 4
      ? isPrivateOrSpecialIPv4(r.address)
      : isPrivateOrSpecialIPv6(r.address);
    if (blocked) {
      return {
        ok: false,
        reason: `Le hostname ${hostname} résout vers une IP privée/réservée (${r.address})`,
      };
    }
  }

  return { ok: true, hostname, resolvedIp: resolved[0].address };
}
