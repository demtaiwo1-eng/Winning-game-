const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "around", "at", "can", "for", "find", "get",
  "i", "in", "is", "looking", "me", "my", "near", "of", "on", "please",
  "the", "to", "want", "with", "need", "book", "hire", "some", "any",
  "affordable", "cheap", "budget", "luxury", "premium", "best", "top",
  "wedding", "celebration", "event", "events", "occasion",
  "guest", "guests", "people", "person", "persons", "attendee", "attendees", "pax",
]);

export function marketplaceSearchTerms(query?: string): string[] {
  if (!query) return [];
  return [...new Set(
    (query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .filter((term) => term.length > 1 && !/^\d+$/.test(term) && !SEARCH_STOP_WORDS.has(term)),
  )].slice(0, 8);
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  photographer: ["photography", "photo"],
  photography: ["photographer", "photo"],
  videographer: ["videography", "video"],
  videography: ["videographer", "video"],
  caterer: ["catering"],
  catering: ["caterer"],
  decorator: ["décor", "decor", "decoration"],
  decoration: ["décor", "decor", "decorator"],
  decor: ["décor", "decoration", "decorator"],
  venue: ["venues", "hall", "space"],
  venues: ["venue", "hall", "space"],
  dj: ["music", "disc jockey"],
  disc: ["dj", "music"],
  rental: ["rentals", "hire"],
  rentals: ["rental", "hire"],
};

function searchVariants(term: string): string[] {
  return [term, ...(SEARCH_SYNONYMS[term] || [])];
}

export function marketplaceTermFilter(terms: string[]) {
  return terms.length ? {
    AND: terms.map((term) => ({
      OR: searchVariants(term).flatMap((variant) => [
        { title: { contains: variant, mode: "insensitive" as const } },
        { description: { contains: variant, mode: "insensitive" as const } },
        { city: { contains: variant, mode: "insensitive" as const } },
        { category: { name: { contains: variant, mode: "insensitive" as const } } },
        { vendor: { businessName: { contains: variant, mode: "insensitive" as const } } },
      ]),
    })),
  } : {};
}
