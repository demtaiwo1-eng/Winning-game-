#!/usr/bin/env node
/**
 * Country-aware KYC provider research.
 *
 * Reads EPHINTA's live country catalogue and checks provider-published country
 * coverage pages. A provider is NOT marked country-verified from a global
 * coverage-count claim alone. This is a procurement shortlist, not legal advice.
 *
 * Usage:
 *   node scripts/research-kyc-providers.mjs --country NG
 *   node scripts/research-kyc-providers.mjs --country NG --format json
 *   KYC_COUNTRIES_API_URL=https://.../api/v1/kyc/countries node scripts/research-kyc-providers.mjs
 */
import process from "node:process";

const args = Object.fromEntries(process.argv.slice(2).reduce((out, value, index, all) => {
  if (value.startsWith("--")) out.push([value.slice(2), all[index + 1]?.startsWith("--") ? "true" : (all[index + 1] ?? "true")]);
  return out;
}, []));
const API = process.env.KYC_COUNTRIES_API_URL || "http://localhost:5000/api/v1/kyc/countries";
const PROVIDERS = [
  {
    id: "smile-id",
    name: "Smile ID",
    url: "https://smile.id/supported-documents",
    strengths: ["country-specific African identity documents", "document verification", "regional identity rails"],
    regionalFocus: ["AFRICA"],
    evidence: "The provider publishes a country-by-country supported-document list.",
    confidence: "country-page",
    capabilitiesToContract: ["liveness", "face match", "AML/PEP screening", "business KYB", "data residency"],
  },
  {
    id: "veriff",
    name: "Veriff",
    url: "https://www.veriff.com/supported-countries",
    strengths: ["broad international document coverage", "document and biometric verification"],
    regionalFocus: [],
    evidence: "The provider publishes a country/document coverage table and claims 230+ countries and territories.",
    confidence: "country-page",
    capabilitiesToContract: ["AML/PEP screening", "business KYB", "data residency", "local data-source checks"],
  },
  {
    id: "sumsub",
    name: "Sumsub",
    url: "https://docs.sumsub.com/docs/identity-verification",
    strengths: ["broad international document coverage", "configurable verification levels", "NFC and database options"],
    regionalFocus: [],
    evidence: "The provider claims 220+ countries and territories and 14,000+ document types; this page alone is not a per-country document matrix.",
    confidence: "global-claim",
    capabilitiesToContract: ["country/document matrix", "AML/PEP screening", "business KYB", "data residency", "retention controls"],
  },
];

function plainText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, " ").toLowerCase();
}
function normalise(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "EPHINTA-KYC-Provider-Research/1.0" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return plainText(await response.text());
}
async function loadCountries() {
  const response = await fetch(API, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Could not load EPHINTA country catalogue (${response.status}) from ${API}`);
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error("Country API response did not contain an items array.");
  return data.items;
}
function hasCountry(text, name) {
  const needle = normalise(name);
  if (!needle || needle.length < 3) return false;
  // Require word boundaries after normalisation to avoid partial-name matches.
  const haystack = normalise(text);
  return (` ${haystack} `).includes(` ${needle} `);
}
function score(provider, exactCountryMatch, region) {
  let value = exactCountryMatch ? 65 : provider.confidence === "global-claim" ? 30 : 0;
  if (provider.regionalFocus.includes(region)) value += 15;
  if (provider.id === "veriff") value += 12;
  if (provider.id === "sumsub") value += 12;
  if (provider.id === "smile-id" && region === "AFRICA") value += 18;
  return Math.min(100, value);
}
async function main() {
  const countries = await loadCountries();
  const wanted = String(args.country || "").toUpperCase();
  const selected = wanted ? countries.filter((item) => item.code === wanted) : countries;
  if (wanted && !selected.length) throw new Error(`Country ${wanted} is not in EPHINTA's country catalogue.`);
  const coverage = await Promise.all(PROVIDERS.map(async (provider) => {
    try { return { ...provider, text: await fetchText(provider.url), sourceStatus: "reachable" }; }
    catch (error) { return { ...provider, text: "", sourceStatus: "unavailable", sourceError: error.message }; }
  }));
  const report = [];
  for (const country of selected) {
    const ranked = coverage.map((provider) => {
      const exactCountryMatch = provider.confidence === "country-page" && hasCountry(provider.text, country.name);
      return {
        provider: provider.name,
        score: score(provider, exactCountryMatch, country.region),
        countryCoverage: exactCountryMatch ? "country-listed-on-official-page" :
          provider.confidence === "global-claim" ? "global-coverage-claim-country-not-individually-confirmed" : "not-found-on-fetched-official-page",
        sourceStatus: provider.sourceStatus,
        source: provider.url,
        evidence: provider.evidence,
        strengths: provider.strengths,
        capabilitiesToContract: provider.capabilitiesToContract,
        sourceError: provider.sourceError,
      };
    }).filter((item) => item.sourceStatus === "reachable")
      .sort((a, b) => b.score - a.score);
    const verified = ranked.filter((item) => item.countryCoverage === "country-listed-on-official-page");
    report.push({
      country: { code: country.code, name: country.name, region: country.region },
      recommendationStatus: verified.length ? "SHORTLIST_REQUIRES_COMMERCIAL_AND_COMPLIANCE_DUE_DILIGENCE" : "NO_COUNTRY_VERIFIED_PROVIDER_FOUND",
      candidates: ranked,
      recommendedFirstCall: verified[0]?.provider || null,
      note: "A country appearing on a provider coverage page is not proof that every ID type, API feature, or EPHINTA use case is enabled in your contract. Confirm document type, local legal basis, consent, sanctions/PEP coverage, liveness, retention, subprocessors, data residency, SLA, pricing and production credentials before selection.",
    });
  }
  const result = { generatedAt: new Date().toISOString(), source: API, providerSources: PROVIDERS.map(({ id, name, url }) => ({ id, name, url })), countriesChecked: report.length, results: report };
  if (args.format === "json") console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`EPHINTA KYC provider research — ${report.length} country/countries\n`);
    for (const item of report) {
      console.log(`${item.country.name} (${item.country.code}) — ${item.recommendationStatus}`);
      for (const candidate of item.candidates) console.log(`  ${candidate.score.toString().padStart(3)}  ${candidate.provider} | ${candidate.countryCoverage} | ${candidate.source}`);
      console.log(`  First call: ${item.recommendedFirstCall || "None — verify provider coverage manually"}`);
      console.log(`  ${item.note}\n`);
    }
    console.log(`Full machine-readable report: rerun with --format json`);
  }
}
if (args["self-test"] === "true") {
  const cases = [
    ["Nigeria", "Nigeria", true],
    ["nigeria passport identity card", "Nigeria", true],
    ["Côte d'Ivoire identity documents", "Cote d'Ivoire", true],
    ["United Kingdom supported documents", "United Kingdom", true],
    ["Kenya and Uganda", "Tanzania", false],
  ];
  for (const [source, country, expected] of cases) {
    if (hasCountry(normalise(source), country) !== expected) {
      throw new Error(`Country matching self-test failed for ${country}`);
    }
  }
  if (score(PROVIDERS[0], true, "AFRICA") <= score(PROVIDERS[0], false, "AFRICA")) {
    throw new Error("Country-verified coverage must outrank unverified coverage.");
  }
  console.log(`KYC provider research self-test passed (${cases.length} country matching cases).`);
} else {
  main().catch((error) => { console.error(`KYC research failed: ${error.message}`); process.exitCode = 1; });
}
