// Lightweight concept lexicon. Used for (1) the deterministic topic-overlap factor and
// (2) the clearly-labeled fallback retrieval when Moss credentials are not configured.
// It is NOT a substitute for Moss semantic search — the UI and integration monitor say so.
const CONCEPTS: Record<string, string[]> = {
  gardening: ["garden", "gardening", "plants", "plant", "roses", "rose", "flowers", "flower", "growing", "vegetables", "herbs", "botany", "orchids", "seeds", "soil", "greenhouse"],
  travel: ["travel", "traveling", "travelling", "trips", "trip", "journeys", "vacation", "vacations", "abroad", "coast", "road", "exploring", "countries", "places", "backpacking", "beach", "ocean"],
  cooking: ["cooking", "cook", "baking", "bake", "recipes", "recipe", "food", "meals", "kitchen", "pies", "bread", "cuisine", "dishes"],
  music: ["music", "jazz", "records", "vinyl", "piano", "guitar", "singing", "songs", "choir", "concerts", "band", "classical"],
  history: ["history", "historical", "war", "wwii", "ancient", "museums", "heritage", "past", "archives", "genealogy"],
  family: ["family", "childhood", "kids", "grandchildren", "parents", "siblings", "growing up", "hometown", "memories"],
  games: ["chess", "games", "puzzles", "crosswords", "cards", "board games", "bridge", "sudoku"],
  nature: ["nature", "birds", "birdwatching", "hiking", "walking", "outdoors", "parks", "mountains", "wildlife", "trees"],
  crafts: ["knitting", "sewing", "crafts", "quilting", "woodworking", "pottery", "blankets", "carpentry"],
  art: ["painting", "art", "drawing", "photography", "photos", "camera", "film", "sketching", "museums"],
  sports: ["soccer", "football", "baseball", "basketball", "tennis", "sports", "running", "swimming", "golf", "fitness"],
  film: ["movies", "cinema", "tv", "television", "telenovelas", "shows", "theater", "theatre"],
  books: ["books", "reading", "novels", "poetry", "literature", "writing", "stories", "storytelling"],
  trains: ["trains", "railways", "railroad", "cars", "vehicles", "engines"],
  culture: ["culture", "languages", "traditions", "festivals", "customs", "holidays"],
  technology: ["technology", "computers", "coding", "science", "space", "astronomy", "engineering"],
};

const STOP = new Set(["and", "the", "of", "a", "an", "my", "to", "in", "on", "with", "for", "about", "i", "love", "like", "old"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

export function conceptsOf(text: string): Set<string> {
  const lower = ` ${text.toLowerCase()} `;
  const toks = new Set(tokens(text));
  const out = new Set<string>();
  for (const [concept, words] of Object.entries(CONCEPTS)) {
    if (words.some((w) => (w.includes(" ") ? lower.includes(` ${w} `) : toks.has(w)))) out.add(concept);
  }
  return out;
}

/** Fallback similarity in [0,1]: concept overlap blended with token Jaccard. */
export function fallbackSimilarity(a: string, b: string): number {
  const ca = conceptsOf(a);
  const cb = conceptsOf(b);
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const jaccard = inter / Math.max(1, new Set([...ta, ...tb]).size);
  const cInter = [...ca].filter((c) => cb.has(c)).length;
  const conceptScore = ca.size && cb.size ? cInter / Math.min(ca.size, cb.size) : 0;
  return Math.min(1, 0.75 * conceptScore + 0.5 * jaccard);
}

export function topicOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let total = 0;
  for (const x of a) total += Math.max(...b.map((y) => fallbackSimilarity(x, y)));
  return total / a.length;
}
