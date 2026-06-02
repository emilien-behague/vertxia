// UUID helper avec fallback Math.random pour Safari iOS en HTTP (insecure context).
//
// Safari iOS impose crypto.randomUUID() UNIQUEMENT en secure context :
//  - HTTPS
//  - localhost
//  - file://
// Sur une IP locale type 192.168.x.x en HTTP, crypto.randomUUID est undefined.
//
// Bug rencontré 02/06/2026 : seed CAPEB et form ajout équipement plantaient
// silencieusement sur iPhone Safari pendant les tests démo en HTTP local
// → données non écrites dans localStorage → "tout disparait quand je change de page".

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback v4 UUID basé sur Math.random — pas crypto-secure mais suffisant
  // pour des identifiants applicatifs (équipements, interventions, jobs).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
