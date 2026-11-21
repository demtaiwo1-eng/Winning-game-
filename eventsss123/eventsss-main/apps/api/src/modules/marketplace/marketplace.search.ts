const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "around", "at", "can", "for", "find", "get",
  "i", "in", "is", "looking", "me", "my", "near", "of", "on", "please",
  "the", "to", "want", "with", "need", "book", "hire", "some", "any",
]);

export export function marketplaceSearchTerms(query?: string): string[] {
  if (!query) return [];
  return [...new Set(
    (query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term)),
  )].slice(0, 8);
}

export function marketplaceTermFilter(terms: string[]) {
  return terms.length ? {
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
        { city: { contains: term, mode: "insensitive" as const } },
        { category: { name: { contains: term, mode: "insensitive" as const } } },
        { vendor: { businessName: { contains: term, mode: "insensitive" as const } } },
      ],
    })),
  } : {};
}
