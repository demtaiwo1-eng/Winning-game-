import { describe, expect, it } from "vitest";
import { getKycProfile, isSupportedKycDocument } from "./kyc-countries";

describe("KYC country document guidance", () => {
  it("returns a market profile as recommendations, not legal certification", () => {
    const profile = getKycProfile("NG");
    expect(profile.code).toBe("NG");
    expect(profile.identityDocs).toContain("NATIONAL_ID");
    expect(profile.assurance).toBe("STANDARD");
  });

  it("does not reject a platform-supported identity document merely because a country's hint omits it", () => {
    expect(getKycProfile("US").identityDocs).not.toContain("VOTER_ID");
    expect(isSupportedKycDocument("IDENTITY", "VOTER_ID")).toBe(true);
  });

  it("accepts supported business registration and tax document types", () => {
    expect(isSupportedKycDocument("BUSINESS", "BUSINESS_REGISTRATION")).toBe(true);
    expect(isSupportedKycDocument("BUSINESS", "TAX_ID")).toBe(true);
  });

  it("rejects unsupported document categories and arbitrary values", () => {
    expect(isSupportedKycDocument("IDENTITY", "NOT_A_DOCUMENT")).toBe(false);
    expect(isSupportedKycDocument("BUSINESS", "PASSPORT")).toBe(false);
  });
});
