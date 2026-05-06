const ADJECTIVES = [
  "Gorgeous",
  "Clever",
  "Brave",
  "Silent",
  "Rapid",
  "Golden",
  "Crystal",
  "Cosmic",
  "Electric",
  "Velvet",
  "Ancient",
  "Crimson",
  "Sapphire",
  "Jade",
  "Neon",
  "Shadow",
  "Solar",
  "Thunder",
  "Wild",
  "Amber",
];

const NOUNS = [
  "Wolf",
  "Fox",
  "Hawk",
  "Bear",
  "Tiger",
  "Falcon",
  "Raven",
  "Lynx",
  "Puma",
  "Otter",
  "Crane",
  "Viper",
  "Bison",
  "Moose",
  "Kite",
  "Mink",
  "Ibis",
  "Colt",
  "Swan",
  "Drake",
];

/**
 * Deterministic — same visitor_id always produces the same name.
 */
export function generateAnonymousName(visitorId: string): string {
  let hash = 0;
  for (let i = 0; i < visitorId.length; i++) {
    hash = (hash * 31 + visitorId.charCodeAt(i)) >>> 0;
  }
  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length];
  return `${adj} ${noun}`;
}
