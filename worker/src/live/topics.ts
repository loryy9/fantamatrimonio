/** Topic a cui una socket puo' iscriversi (aggiornamenti live). */
export const TOPICS = ["leaderboard", "gallery", "challenges", "event"] as const;
export type Topic = (typeof TOPICS)[number];

/** Tiene solo i topic noti, senza duplicati; input non valido -> []. */
export function parseTopics(input: unknown): Topic[] {
  if (!Array.isArray(input)) return [];
  const out: Topic[] = [];
  for (const t of input) {
    if ((TOPICS as readonly unknown[]).includes(t) && !out.includes(t as Topic)) {
      out.push(t as Topic);
    }
  }
  return out;
}
