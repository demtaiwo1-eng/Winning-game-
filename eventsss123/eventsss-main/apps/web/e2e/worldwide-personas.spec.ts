import { expect, test } from "@playwright/test";

type Persona = { country: string; city: string; occasion: string; index: number };
const locations: Array<[string, string]> = [
  [
    "Nigeria",
    "Lagos"
  ],
  [
    "Ghana",
    "Accra"
  ],
  [
    "Kenya",
    "Nairobi"
  ],
  [
    "South Africa",
    "Cape Town"
  ],
  [
    "Egypt",
    "Cairo"
  ],
  [
    "Morocco",
    "Casablanca"
  ],
  [
    "Senegal",
    "Dakar"
  ],
  [
    "Ethiopia",
    "Addis Ababa"
  ],
  [
    "Uganda",
    "Kampala"
  ],
  [
    "Tanzania",
    "Dar es Salaam"
  ],
  [
    "Rwanda",
    "Kigali"
  ],
  [
    "Cameroon",
    "Douala"
  ],
  [
    "Côte d’Ivoire",
    "Abidjan"
  ],
  [
    "Zambia",
    "Lusaka"
  ],
  [
    "Zimbabwe",
    "Harare"
  ],
  [
    "Botswana",
    "Gaborone"
  ],
  [
    "Namibia",
    "Windhoek"
  ],
  [
    "Angola",
    "Luanda"
  ],
  [
    "Mozambique",
    "Maputo"
  ],
  [
    "Mauritius",
    "Port Louis"
  ],
  [
    "United Kingdom",
    "London"
  ],
  [
    "Ireland",
    "Dublin"
  ],
  [
    "France",
    "Paris"
  ],
  [
    "Germany",
    "Berlin"
  ],
  [
    "Spain",
    "Madrid"
  ],
  [
    "Portugal",
    "Lisbon"
  ],
  [
    "Italy",
    "Rome"
  ],
  [
    "Netherlands",
    "Amsterdam"
  ],
  [
    "Belgium",
    "Brussels"
  ],
  [
    "Switzerland",
    "Zurich"
  ],
  [
    "Austria",
    "Vienna"
  ],
  [
    "Sweden",
    "Stockholm"
  ],
  [
    "Norway",
    "Oslo"
  ],
  [
    "Denmark",
    "Copenhagen"
  ],
  [
    "Finland",
    "Helsinki"
  ],
  [
    "Poland",
    "Warsaw"
  ],
  [
    "Czechia",
    "Prague"
  ],
  [
    "Greece",
    "Athens"
  ],
  [
    "Romania",
    "Bucharest"
  ],
  [
    "Ukraine",
    "Kyiv"
  ],
  [
    "Turkey",
    "Istanbul"
  ],
  [
    "Saudi Arabia",
    "Riyadh"
  ],
  [
    "United Arab Emirates",
    "Dubai"
  ],
  [
    "Qatar",
    "Doha"
  ],
  [
    "Israel",
    "Tel Aviv"
  ],
  [
    "Jordan",
    "Amman"
  ],
  [
    "India",
    "Mumbai"
  ],
  [
    "Pakistan",
    "Lahore"
  ],
  [
    "Bangladesh",
    "Dhaka"
  ],
  [
    "Sri Lanka",
    "Colombo"
  ],
  [
    "Nepal",
    "Kathmandu"
  ],
  [
    "Thailand",
    "Bangkok"
  ],
  [
    "Vietnam",
    "Ho Chi Minh City"
  ],
  [
    "Cambodia",
    "Phnom Penh"
  ],
  [
    "Malaysia",
    "Kuala Lumpur"
  ],
  [
    "Singapore",
    "Singapore"
  ],
  [
    "Indonesia",
    "Jakarta"
  ],
  [
    "Philippines",
    "Manila"
  ],
  [
    "Japan",
    "Tokyo"
  ],
  [
    "South Korea",
    "Seoul"
  ],
  [
    "China",
    "Shanghai"
  ],
  [
    "Mongolia",
    "Ulaanbaatar"
  ],
  [
    "Kazakhstan",
    "Almaty"
  ],
  [
    "Uzbekistan",
    "Tashkent"
  ],
  [
    "Australia",
    "Sydney"
  ],
  [
    "New Zealand",
    "Auckland"
  ],
  [
    "Fiji",
    "Suva"
  ],
  [
    "Papua New Guinea",
    "Port Moresby"
  ],
  [
    "Samoa",
    "Apia"
  ],
  [
    "Tonga",
    "Nuku'alofa"
  ],
  [
    "United States",
    "New York"
  ],
  [
    "Canada",
    "Toronto"
  ],
  [
    "Mexico",
    "Mexico City"
  ],
  [
    "Guatemala",
    "Guatemala City"
  ],
  [
    "Costa Rica",
    "San José"
  ],
  [
    "Panama",
    "Panama City"
  ],
  [
    "Jamaica",
    "Kingston"
  ],
  [
    "Trinidad and Tobago",
    "Port of Spain"
  ],
  [
    "Barbados",
    "Bridgetown"
  ],
  [
    "Bahamas",
    "Nassau"
  ],
  [
    "Dominican Republic",
    "Santo Domingo"
  ],
  [
    "Haiti",
    "Port-au-Prince"
  ],
  [
    "Cuba",
    "Havana"
  ],
  [
    "Brazil",
    "São Paulo"
  ],
  [
    "Argentina",
    "Buenos Aires"
  ],
  [
    "Chile",
    "Santiago"
  ],
  [
    "Peru",
    "Lima"
  ],
  [
    "Colombia",
    "Bogotá"
  ],
  [
    "Ecuador",
    "Quito"
  ],
  [
    "Uruguay",
    "Montevideo"
  ],
  [
    "Paraguay",
    "Asunción"
  ],
  [
    "Bolivia",
    "La Paz"
  ],
  [
    "Venezuela",
    "Caracas"
  ],
  [
    "Guyana",
    "Georgetown"
  ],
  [
    "Suriname",
    "Paramaribo"
  ],
  [
    "Iceland",
    "Reykjavik"
  ],
  [
    "Luxembourg",
    "Luxembourg City"
  ],
  [
    "Estonia",
    "Tallinn"
  ],
  [
    "Latvia",
    "Riga"
  ],
  [
    "Lithuania",
    "Vilnius"
  ]
];
const occasions = [
  "multicultural family wedding",
  "traditional engagement celebration",
  "community naming ceremony",
  "milestone birthday dinner",
  "children’s outdoor birthday festival",
  "university graduation reception",
  "school leavers’ celebration",
  "corporate annual summit",
  "regional product launch",
  "startup investor showcase",
  "charity fundraising gala",
  "hospital benefit concert",
  "community food festival",
  "heritage and culture festival",
  "independent film premiere",
  "live music showcase",
  "sports club awards night",
  "youth football tournament",
  "international trade exhibition",
  "small business market fair",
  "professional skills workshop",
  "teacher development seminar",
  "technology hackathon",
  "academic research symposium",
  "women in leadership forum",
  "faith community celebration",
  "interfaith community dinner",
  "memorial remembrance gathering",
  "celebration of life reception",
  "baby shower brunch",
  "first birthday family gathering",
  "silver wedding anniversary",
  "golden anniversary dinner",
  "retirement appreciation ceremony",
  "promotion celebration",
  "team-building retreat",
  "customer appreciation event",
  "employee recognition gala",
  "board strategy dinner",
  "nonprofit volunteer appreciation",
  "book launch and author talk",
  "art gallery opening",
  "fashion collection runway",
  "culinary tasting evening",
  "destination beach wedding",
  "garden wedding reception",
  "private chef dinner party",
  "neighborhood block party",
  "school fundraising carnival",
  "museum family day",
  "science discovery fair",
  "career networking evening",
  "community health awareness day",
  "blood donation campaign",
  "environmental clean-up kickoff",
  "tree planting community day",
  "inclusive accessibility forum",
  "senior citizens social afternoon",
  "cultural dance showcase",
  "local craft demonstration",
  "photography exhibition opening",
  "dance academy recital",
  "theatre opening night",
  "choir anniversary concert",
  "orchestra benefit performance",
  "e-sports championship",
  "marathon awards ceremony",
  "cycling club season launch",
  "swimming gala",
  "martial arts grading showcase",
  "regional farmers’ conference",
  "sustainable food conference",
  "real estate investor forum",
  "women entrepreneurs’ expo",
  "digital creators’ meetup",
  "customer product training",
  "corporate compliance workshop",
  "leadership planning offsite",
  "graduation alumni reunion",
  "school reunion banquet",
  "community library reopening",
  "public park reopening",
  "new clinic opening",
  "hotel grand opening",
  "restaurant launch celebration",
  "retail store opening",
  "religious building dedication",
  "community peace dialogue",
  "local heritage restoration fundraiser",
  "disaster relief benefit",
  "winter holiday market",
  "spring cultural picnic",
  "summer waterfront festival",
  "harvest thanksgiving dinner",
  "new year community celebration",
  "regional tourism showcase",
  "international student welcome",
  "exchange student farewell",
  "family reunion weekend",
  "cross-border business mixer"
];
const formats = ["PERSONAL", "CORPORATE", "SOCIAL", "CULTURAL", "ENTERTAINMENT", "EDUCATIONAL"];
const goals = ["Celebrate", "Launch a product", "Build community", "Raise funds", "Train or educate", "Host an unforgettable guest experience"];
const priorities = ["Guest experience", "Brand impression", "Budget control", "Speed and simplicity", "Accessibility and inclusion"];
const venues = ["Still deciding", "Venue selected", "Private residence", "Outdoor or public space", "Virtual", "Hybrid"];
const foods = ["Mixed menu", "Local cuisine", "International menu", "Vegetarian or vegan focused", "Not sure yet"];
const atmospheres = ["Warm and social", "Premium and editorial", "High-energy and entertaining", "Calm and intimate", "Professional and focused"];

const personas: Persona[] = locations.map(([country, city], index) => ({
  country,
  city,
  occasion: occasions[index],
  index: index + 1,
}));

test.describe("Worldwide event-planner personas (100 countries)", () => {
  // Run sequentially so the visible headed run is easy to follow and does not
  // overwhelm the local API or browser with 100 simultaneous journeys.
  test.describe.configure({ mode: "serial" });

  for (const persona of personas) {
    test(`persona ${String(persona.index).padStart(3, "0")} — ${persona.country}: ${persona.occasion}`, async ({ page }) => {
      const eventName = `QA ${String(persona.index).padStart(3, "0")} — ${persona.occasion} — ${persona.country}`;
      const guests = String(35 + ((persona.index * 37) % 1465));
      const budget = String(5000 + persona.index * 1750);
      const format = formats[(persona.index - 1) % formats.length];
      const goal = goals[(persona.index - 1) % goals.length];
      const priority = priorities[(persona.index - 1) % priorities.length];
      const venue = venues[(persona.index - 1) % venues.length];
      const food = foods[(persona.index - 1) % foods.length];
      const atmosphere = atmospheres[(persona.index - 1) % atmospheres.length];
      const city = `${persona.city}, ${persona.country}`;

      // Fresh page context per test gives every persona independent local storage.
      await page.goto("/plan");
      await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible();
      await expect(page.getByText("Your progress is saved on this device.")).toBeVisible();

      await page.getByLabel("Event name").fill(eventName);
      await page.getByLabel("Event format").selectOption(format);
      await page.getByRole("button", { name: /Next question/ }).click();

      await expect(page.getByRole("heading", { name: "What should it achieve?" })).toBeVisible();
      await page.getByLabel("Primary goal").selectOption(goal);
      await page.getByLabel("What matters most?").selectOption(priority);
      await page.getByRole("button", { name: /Next question/ }).click();

      await expect(page.getByRole("heading", { name: "Where and when?" })).toBeVisible();
      await page.getByLabel("City or venue area").fill(city);
      await page.getByLabel("Venue status").selectOption(venue);
      await page.getByRole("button", { name: /Next question/ }).click();

      await expect(page.getByRole("heading", { name: "Who is coming?" })).toBeVisible();
      await page.getByLabel("Expected guests").fill(guests);
      await page.getByLabel("Food direction").selectOption(food);
      await page.getByRole("button", { name: /Next question/ }).click();

      await expect(page.getByRole("heading", { name: "What is the guardrail?" })).toBeVisible();
      await page.getByLabel("Planning budget").fill(budget);
      await page.getByLabel("Atmosphere").selectOption(atmosphere);
      await page.getByRole("button", { name: /Build my event brief/ }).click();

      await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
      await expect(page.locator(".ess-builder-lead")).toContainText(city);
      await expect(page.locator(".ess-builder-lead")).toContainText(`${guests} guests`);
      await expect(page.getByText(goal, { exact: true })).toBeVisible();
      await expect(page.getByText(priority, { exact: true })).toBeVisible();

      // Intentionally stop at the local-only event brief. Never create accounts,
      // send notifications, book vendors, or initiate any payment.
      await expect(page.getByRole("button", { name: /Save brief and create account/ })).toBeVisible();
      await expect(page).toHaveURL(/\/plan$/);
    });
  }
});

test("@mobile worldwide persona responsive smoke journey", async ({ page }) => {
  const persona = personas[0];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible();
  await page.getByLabel("Event name").fill("Mobile QA — Nigerian family wedding");
  await page.getByLabel("Event format").selectOption("PERSONAL");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Primary goal").selectOption("Celebrate");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("City or venue area").fill(`${persona.city}, ${persona.country}`);
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Expected guests").fill("180");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Planning budget").fill("850000");
  await page.getByRole("button", { name: /Build my event brief/ }).click();
  await expect(page.getByRole("heading", { name: "Mobile QA — Nigerian family wedding" })).toBeVisible();
  const card = page.locator(".ess-builder-card");
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
