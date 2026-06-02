/**
 * Layout /lite/* — Canvas global + Lenis smooth scroll.
 *
 * Architecture basement.studio (pattern #1) :
 *  - UN seul <Canvas> R3F monte ici, persistant sur toutes les routes /lite/*
 *  - Chaque page (template) injecte ses meshes via <WebGlTunnelIn>
 *  - 0 re-mount WebGL inter-route => 0 flash blanc + GPU libre
 *
 * Lenis = signature scroll fluide (Studio Freight) utilise par Vercel/Apple/
 * Polestar. Free upgrade visuel pour les sites generes Vertxia Lite.
 */

import type { PropsWithChildren } from "react";
import { LenisProvider } from "@/components/lite-templates/lenis-provider";
import { Scene } from "@/components/canvas";
import {
  MotionProvider,
  CustomCursor,
  ScrollProgress,
} from "@/components/motion-primitives";

export default function LiteLayout({ children }: PropsWithChildren) {
  return (
    <MotionProvider>
      <LenisProvider>
        <Scene />
        <ScrollProgress />
        <CustomCursor />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </LenisProvider>
    </MotionProvider>
  );
}
