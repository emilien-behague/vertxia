/**
 * Tunnel rats — pattern basement.studio.
 *
 * Permet d'injecter des elements 3D (R3F) ou DOM dans le Canvas global
 * depuis n'importe quelle page, sans monter un nouveau Canvas.
 *
 * Usage WebGL (composants R3F dans le Canvas) :
 *   <WebGlTunnelIn>
 *     <mesh>...</mesh>
 *   </WebGlTunnelIn>
 *
 * Usage HTML (composants DOM rendus apres le Canvas) :
 *   <HtmlTunnelIn>
 *     <div className="overlay">...</div>
 *   </HtmlTunnelIn>
 *
 * Le rendu final se fait dans Scene/HtmlTunnelOut.
 */

import tunnel from "tunnel-rat";

const webgl = tunnel();
const html = tunnel();

export const WebGlTunnelIn = webgl.In;
export const WebGlTunnelOut = webgl.Out;

export const HtmlTunnelIn = html.In;
export const HtmlTunnelOut = html.Out;
