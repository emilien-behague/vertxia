/**
 * Mock projects pour la Floating Gallery V0.1.
 *
 * 8 projets premium fictifs pour habiter le workspace en attendant que les users
 * generent leurs vrais sites. Categories : luxury hotel, automotive, watch, fashion,
 * editorial, yacht, beauty, hospitality.
 *
 * Images = Unsplash CDN (crossOrigin compatible avec drei <Image>).
 * Slug = optional, pointe vers /lite/[slug] si vraie demo dispo.
 */

export type MockProject = {
  id: string;
  label: string;
  category: string;
  hint: string;
  imageUrl: string;
  /** Position 3D (X, Y, Z). Z négatif = plus loin de la camera. */
  position: [number, number, number];
  /** Scale (width, height) du Plane R3F en unites world. */
  scale: [number, number];
  /** Lien vers une vraie demo si existante, sinon null. */
  liveSlug?: string;
};

// Picsum.photos avec seeds deterministes — garanti dispo + CORS open
// V0.2 : remplacer par vraies images Unsplash curees ou screenshots reels des productions Vertxia
const u = (seed: string) => `https://picsum.photos/seed/${seed}/640/400`;

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: "aman-svetistefan",
    label: "Aman Sveti Stefan",
    category: "Hospitality",
    hint: "Boutique resort · Cinematic narrative",
    // Photo : luxury resort architecture
    imageUrl: u("aman-resort"),
    position: [-3.4, 1.8, -1.2],
    scale: [2.0, 1.25],
  },
  {
    id: "porsche-heritage",
    label: "Porsche Heritage",
    category: "Automotive",
    hint: "Launch campaign · Performance specs",
    // Photo : car detail
    imageUrl: u("porsche-heritage"),
    position: [1.2, 2.4, -2.2],
    scale: [2.4, 1.5],
  },
  {
    id: "cartier-tank",
    label: "Cartier Tank Solo",
    category: "Luxury Watch",
    hint: "Macro editorial · Brand storytelling",
    // Photo : watch macro
    imageUrl: u("cartier-watch"),
    position: [-4.2, -0.4, -0.6],
    scale: [1.6, 1.0],
  },
  {
    id: "margiela-edition",
    label: "Margiela · Édition",
    category: "Fashion Editorial",
    hint: "Lookbook · Drop culture",
    // Photo : fashion model
    imageUrl: u("margiela-edition"),
    position: [3.6, 0.4, -1.8],
    scale: [1.8, 2.4],
  },
  {
    id: "loom-vestiaire",
    label: "Loom · Vestiaire",
    category: "Fashion",
    hint: "Cinematic narrative · Film grain",
    // Photo : minimal clothing flat lay (cream/beige)
    imageUrl: u("loom-vestiaire"),
    position: [-1.4, -1.6, -0.8],
    scale: [1.7, 1.1],
    liveSlug: "loom_fr",
  },
  {
    id: "allbirds-sugar",
    label: "Allbirds · Sugar",
    category: "Editorial",
    hint: "Halftone print · Sugar collection",
    imageUrl: u("allbirds-sugar"),
    position: [2.6, -0.9, -0.4],
    scale: [1.5, 0.95],
    liveSlug: "allbirds_com",
  },
  {
    id: "riva-aquariva",
    label: "Riva Aquariva Super",
    category: "Yacht · Luxury",
    hint: "Heritage storytelling · Italian crafted",
    // Photo : yacht / boat sea
    imageUrl: u("riva-yacht"),
    position: [-3.4, -1.7, -1.6],
    scale: [1.9, 1.2],
  },
  {
    id: "fenty-launch",
    label: "Fenty · Launch",
    category: "Beauty Campaign",
    hint: "Drop culture · Editorial cinematic",
    // Photo : beauty model close-up
    imageUrl: u("fenty-launch"),
    position: [1.3, -1.85, -1.0],
    scale: [1.3, 1.6],
  },
];
