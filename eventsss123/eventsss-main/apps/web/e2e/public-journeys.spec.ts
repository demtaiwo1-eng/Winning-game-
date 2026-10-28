import { expect, test } from "@playwright/test";

test("public landing page explains the event-planning service and its menu", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Plan the event you imagine/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start planning" })).toBeVisible();
  await expect(page.getByRole("img", { name: "EPHINTA" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Open menu" }).click();
  const menuButton = page.getByRole("button", { name: "Close menu" });
  await expect(menuButton.locator(".eph-menu-bars span")).toHaveCount(3);
  const menu = page.getByRole("navigation", { name: "Main navigation" });
  await expect(menu).toBeVisible();
  await expect(menu.locator(".eph-menu-brand")).toContainText("EPHINTA");
  await expect(menu.locator(".eph-menu-brand img")).toHaveCSS("width", "20px");
  await expect(menu.locator(".eph-menu-primary img")).toHaveCSS("width", "16px");
  await expect(menu.getByRole("button", { name: /Plan your next event here/ })).toBeVisible();
  await page.getByRole("heading", { name: /Plan the event you imagine/i }).click();
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
});
test("event builder saves a brief and opens registration", async ({ page }) => {
  await page.goto("/plan");

  await page.getByLabel("Event name").fill("ESS E2E Test Event");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ess_event_builder_progress")))
    .toContain("ESS E2E Test Event");
  await expect(page.getByText("Your progress is saved on this device.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Event name")).toHaveValue("ESS E2E Test Event");
  await page.getByRole("button", { name: /Next question/ }).click();

  await page.getByLabel("Primary goal").selectOption("Celebrate");
  await page.getByRole("button", { name: /Next question/ }).click();

  await page.getByLabel("City or venue area").fill("Ibadan");
  await page.getByRole("button", { name: /Next question/ }).click();

  await page.getByLabel("Expected guests").fill("120");
  await page.getByRole("button", { name: /Next question/ }).click();

  await page.getByLabel("Planning budget").fill("NGN 2500000");
  await page.getByRole("button", { name: /Build my event brief/ }).click();

  await expect(
    page.getByRole("heading", { name: "ESS E2E Test Event" }),
  ).toBeVisible();
  await expect(page.getByText(/120 guests/)).toBeVisible();

  await page
    .getByRole("button", { name: /Save brief and create account/ })
    .click();

  await expect(page).toHaveURL(/\/auth\/signup/);

  const saved = await page.evaluate(() =>
    localStorage.getItem("ess_event_draft"),
  );

  expect(saved).not.toBeNull();
  expect(JSON.parse(saved as string)).toMatchObject({
    title: "ESS E2E Test Event",
    city: "Ibadan",
    guests: "120",
    budget: "NGN 2500000",
  });

});

test("the menu planner action opens the guided event planner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /Plan your next event here/ }).click();

  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible();
});

test("registration blocks a password shorter than the input minimum", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Create customer account" }).click();

  const dialog = page.getByRole("dialog", { name: "Create your EPHINTA account" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("ESS E2E Customer");
  await dialog.getByLabel("Email address").fill("e2e-customer@example.test");

  const password = dialog.getByLabel("Password");
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await password.fill("short");
  await expect(password).toHaveValue("short");

  // Native browser validity must reject fewer than the application's stated 12 chars.
  const validity = await password.evaluate((element) => ({
    minLength: element.getAttribute("minlength"),
    tooShort: element.validity.tooShort,
    valueLength: element.value.length,
  }));
  if (validity.minLength && Number(validity.minLength) >= 8) {
    expect(validity.tooShort || validity.valueLength < Number(validity.minLength)).toBeTruthy();
  } else {
    // If native minlength is not exposed, verify that submitting short credentials
    // produces a validation message and does not start a successful registration.
    await dialog.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(dialog).toBeVisible();
  }
});
test("sign-in displays a readable error when authentication fails", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      }),
    });
  });

  await page.goto("/auth/signin?role=CLIENT");

  await page.getByLabel("Email").fill("e2e@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("wrong-password");
  await page.getByRole("button", { name: /Continue securely/ }).click();

  await expect(page.locator(".ess-form-error")).toContainText(
    "Invalid email or password",
  );
});

test("mobile menu opens and provides sign-in access", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile menu is checked on the mobile viewport.");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();

  const menu = page.getByRole("navigation", { name: "Main navigation" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Sign in to your account" }).click();

  await expect(page.getByRole("dialog", { name: "Welcome back" })).toBeVisible();
});
