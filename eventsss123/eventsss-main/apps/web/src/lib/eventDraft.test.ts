import { describe, expect, it } from "vitest";
import {
  eventBuilderProgressFromLandingDraft,
  eventDraftToCreateInput,
  parseEventBuilderProgress,
  parseEventDraft,
  type EventBuilderProgress,
  type EventDraft,
} from "./eventDraft";

const draft: EventDraft = {
  title: "Community celebration",
  type: "SOCIAL",
  goal: "Build community",
  date: "2027-06-01",
  city: "Abuja",
  guests: "200",
  budget: "NGN 2,500,000",
  atmosphere: "Warm and social",
  food: "Local cuisine",
  venue: "Venue selected",
  priorities: "Guest experience",
  clientRequestId: "c12a950d-56eb-42ba-8eaa-3d28f777f731",
};

const progress: EventBuilderProgress = {
  title: "Community dinner",
  type: "SOCIAL",
  goal: "Build community",
  date: "",
  city: "",
  guests: "",
  budget: "",
  atmosphere: "Warm and social",
  food: "Mixed menu",
  venue: "Still deciding",
  priorities: "Guest experience",
};

describe("planner event draft handoff", () => {
  it("restores valid in-progress answers and rejects malformed saved data", () => {
    expect(parseEventBuilderProgress(JSON.stringify(progress))).toEqual(progress);
    expect(parseEventBuilderProgress("{broken")).toBeNull();
    expect(parseEventBuilderProgress(JSON.stringify({ ...progress, guests: "-1" }))).toBeNull();
    expect(parseEventBuilderProgress(JSON.stringify({ ...progress, type: "UNKNOWN" }))).toBeNull();
  });

  it("carries the homepage event choices into the guided planner", () => {
    expect(eventBuilderProgressFromLandingDraft(JSON.stringify({
      type: "Wedding",
      guests: "150",
      date: "2027-06-01",
      vibe: "Modern",
      services: ["Venue"],
    }))).toMatchObject({
      title: "Wedding celebration",
      type: "PERSONAL",
      guests: "150",
      date: "2027-06-01",
      atmosphere: "Premium and editorial",
    });
    expect(eventBuilderProgressFromLandingDraft("{broken")).toBeNull();
  });

  it("converts the wizard answers into the existing event API shape", () => {
    expect(eventDraftToCreateInput(draft, "ng", "ngn")).toEqual({
      title: "Community celebration",
      type: "SOCIAL",
      description: "Event goal: Build community",
      startsAt: "2027-06-01T12:00:00.000Z",
      city: "Abuja",
      country: "NG",
      currency: "NGN",
      isPublic: false,
      expectedGuests: 200,
      scaleTier: "MEDIUM",
      isVirtual: false,
      format: "IN_PERSON",
      specialRequests: [
        "Primary goal: Build community",
        "Planning priority: Guest experience",
        "Budget direction: NGN 2,500,000",
        "Atmosphere: Warm and social",
        "Food direction: Local cuisine",
        "Venue status: Venue selected",
      ].join("\n"),
      autoChecklist: true,
      clientRequestId: draft.clientRequestId,
    });
  });

  it("parses only complete, valid saved drafts", () => {
    expect(parseEventDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseEventDraft("{broken")).toBeNull();
    expect(parseEventDraft(JSON.stringify({ ...draft, guests: "0" }))).toBeNull();
    expect(parseEventDraft(JSON.stringify({ ...draft, clientRequestId: "not-a-uuid" }))).toBeNull();
    expect(parseEventDraft(JSON.stringify({ ...draft, date: "2027-02-31" }))).toBeNull();
  });

  it("preserves virtual and hybrid formats without misclassifying them", () => {
    expect(eventDraftToCreateInput({ ...draft, venue: "Virtual" }, "NG", "NGN").format).toBe("VIRTUAL");
    expect(eventDraftToCreateInput({ ...draft, venue: "Hybrid" }, "NG", "NGN").format).toBe("HYBRID");
  });
});
