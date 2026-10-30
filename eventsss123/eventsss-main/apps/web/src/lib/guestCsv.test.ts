import { describe, expect, it } from "vitest";
import { buildGuestCsv, parseGuestCsv } from "./guestCsv";

describe("guest CSV import/export", () => {
  it("parses quoted names, commas, optional fields and CRLF rows", () => {
    expect(parseGuestCsv('Name,Email,Phone,Plus ones\r\n"Doe, Jane",jane@example.com,+2348012345678,2\r\nSam,, ,0')).toEqual([
      { name: "Doe, Jane", email: "jane@example.com", phone: "+2348012345678", plusOnes: 2 },
      { name: "Sam", plusOnes: 0 },
    ]);
  });

  it("rejects missing headers, invalid email, invalid plus ones and overlarge lists", () => {
    expect(() => parseGuestCsv("Email\na@example.com")).toThrow("Name column");
    expect(() => parseGuestCsv("Name,Email\nSam,not-an-email")).toThrow("email is invalid");
    expect(() => parseGuestCsv("Name,Plus ones\nSam,11")).toThrow("plusOnes");
    expect(() => parseGuestCsv("Name\n" + Array.from({ length: 501 }, (_, i) => `Guest ${i}`).join("\n"))).toThrow("500 guests");
  });

  it("handles escaped quotes and rejects unclosed quoted fields", () => {
    expect(parseGuestCsv('Name\n"Sam ""The Host"""')[0].name).toBe('Sam "The Host"');
    expect(() => parseGuestCsv('Name\n"unfinished')).toThrow("unclosed");
  });

  it("exports invitation URLs and neutralizes spreadsheet formulas", () => {
    const csv = buildGuestCsv([{ name: "=1+1", email: "sam@example.com", rsvp: "PENDING", token: "abc" }], "https://ephinta.example/");
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("https://ephinta.example/rsvp/abc");
  });
});
