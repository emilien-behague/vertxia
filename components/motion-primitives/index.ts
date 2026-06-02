/**
 * motion-primitives — Lib partagee d'animations pour les templates Vertxia Lite.
 *
 * Pattern Matt Perry recommande : motion/react + LazyMotion + m (4.6KB).
 * Wrap toute /lite/* dans <MotionProvider> pour activer.
 *
 * Composants :
 *  - MotionProvider       : LazyMotion + MotionConfig (reducedMotion="user")
 *  - FadeInUp             : scroll-triggered fade + translateY
 *  - StaggerGroup         : wrapper qui propage delays incrementiels
 *  - MaskedReveal         : clip-path reveal Awwwards style
 *  - SplitMaskedReveal    : split text par mot/char avec stagger
 *  - MagneticButton       : bouton magnetique sur hover
 *  - CustomCursor         : curseur custom blob + scale on [data-cursor]
 *  - ParallaxImage        : img qui defile a vitesse differente du scroll
 *  - ParallaxBg           : meme chose en background div
 *  - ScrollProgress       : barre top fine de progression scroll
 *  - PageTransition       : overlay swipe au mount de route
 */

export { MotionProvider } from "./motion-provider";
export { FadeInUp, StaggerGroup } from "./fade-in-up";
export { MaskedReveal, SplitMaskedReveal } from "./masked-reveal";
export { MagneticButton } from "./magnetic-button";
export { CustomCursor } from "./custom-cursor";
export { ParallaxImage, ParallaxBg } from "./parallax-image";
export { ScrollProgress } from "./scroll-progress";
export { PageTransition } from "./page-transition";
