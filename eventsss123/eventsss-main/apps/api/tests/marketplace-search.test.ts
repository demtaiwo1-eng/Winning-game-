import { describe, expect, it } from "vitest";
import { marketplaceSearchTerms, marketplaceTermFilter } from "../src/modules/marketplace/marketplace.search";

describe("marketplace natural-language search", () => {
  it("matches the meaningful words in a natural request", () => {
    expect(marketplaceSearchTerms("I need an affordable wedding photographer in Ibadan"))
      .toEqual(["photographer", "ibadan"]);
  });


  it("ignores guest counts and event-context filler in natural requests", () => {
    expect(marketplaceSearchTerms("I need a wedding photographer in Ibadan for 150 guests"))
      .toEqual(["photographer", "ibadan"]);
    expect(marketplaceSearchTerms("Find catering for 200 people at my event"))
      .toEqual(["catering"]);
  });

  it("removes repeated words, punctuation and common filler words", () => {
    expect(marketplaceSearchTerms("Please find a DJ, DJ and MC for me!"))
      .toEqual(["dj", "mc"]);
  });

  it("supports non-English letters and caps the number of search terms", () => {
    expect(marketplaceSearchTerms("Décor in Lagos for a naming ceremony"))
      .toEqual(["décor", "lagos", "naming", "ceremony"]);
    expect(marketplaceSearchTerms("one two three four five six seven eight nine ten"))
      .toHaveLength(8);
  });

  it("returns no restrictive filter for an empty or filler-only request", () => {
    expect(marketplaceSearchTerms("")).toEqual([]);
    expect(marketplaceSearchTerms("find a service for me")).toEqual(["service"]);
    expect(marketplaceTermFilter([])).toEqual({});
  });

  it("requires each meaningful word to match a listing, vendor, category or city", () => {
    const filter = marketplaceTermFilter(["photographer", "ibadan"]) as {
      AND: Array<{ OR: Array<Record<string, unknown>> }>;
    };
    expect(filter.AND).toHaveLength(2);
    expect(filter.AND[0].OR.length).toBeGreaterThanOrEqual(5);
    expect(filter.AND[0].OR).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: { contains: "photographer", mode: "insensitive" } }),
      expect.objectContaining({ title: { contains: "photography", mode: "insensitive" } }),
      expect.objectContaining({ description: expect.any(Object) }),
      expect.objectContaining({ city: expect.any(Object) }),
      expect.objectContaining({ category: expect.any(Object) }),
      expect.objectContaining({ vendor: expect.any(Object) }),
    ]));
  });
});
