import { expect, test, type Page } from "@playwright/test";

async function unlockDeviceGate(page: Page) {
  const securityDialog = page.getByRole("dialog", { name: /Set your device PIN|App locked/ });
  await expect(securityDialog).toBeVisible();
  const title = await securityDialog.locator("h1").textContent();
  await securityDialog.getByLabel("Six-digit PIN").fill("123456");
  if (title?.includes("Set your device PIN")) {
    await securityDialog.getByLabel("Confirm PIN").fill("123456");
    await securityDialog.getByRole("button", { name: "Set PIN and continue" }).click();
  } else {
    await securityDialog.getByRole("button", { name: "Unlock EPHINTA" }).click();
  }
  await expect(securityDialog).toBeHidden();
}

test("startup shows only the EPHINTA logo until the app is ready", async ({ page }) => {
  let releaseLogo!: () => void;
  const logoGate = new Promise<void>((resolve) => {
    releaseLogo = resolve;
  });
  await page.route("**/brand/ephinta_logo2.png", async (route) => {
    await logoGate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const splash = page.locator("[data-ephinta-intro-splash]");
  try {
    await expect(splash).toBeVisible();
    await expect(splash).toHaveText("");
    await expect(splash.locator("img")).toHaveAttribute("src", /brand\/ephinta_logo2\.png/);
    await expect(page.getByRole("heading", { name: /Plan the event you imagine/i })).toBeVisible();
    await expect(splash).toBeVisible();
  } finally {
    releaseLogo();
  }
  await expect(splash).toBeHidden();
});

test("static-host deep links load the React app on a fresh navigation", async ({ page }) => {
  await page.goto("/auth/signin?role=CLIENT");
  await expect(page.getByRole("dialog", { name: "Event Planner sign in" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  await page.goto("/plan");
  await expect(page.locator(".ess-builder-card")).toBeVisible();
  await expect(page.getByLabel("Event name")).toBeVisible();
});

test("legacy sign-in and registration URLs resolve to the active authentication flow", async ({ page }) => {
  await page.goto("/login?role=VENDOR");
  await expect(page).toHaveURL(/\/auth\/signin\?role=VENDOR$/);
  await expect(page.locator("#eph-auth-dialog")).toBeVisible();

  await page.goto("/register/vendor");
  await expect(page).toHaveURL(/\/auth\/signup\?role=VENDOR$/);
  await expect(page.locator("#eph-auth-dialog")).toHaveAttribute("data-role", "vendor");

  await page.goto("/register");
  await expect(page).toHaveURL(/\/auth\/signup\?role=CLIENT$/);
  await expect(page.locator("#eph-auth-dialog")).toBeVisible();
});

test("legacy forgot-password and planner continuation URLs resolve to active screens", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page).toHaveURL(/\/auth\/forgot\?role=CLIENT$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

  await page.goto("/plan/review");
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.locator(".ess-builder-card")).toBeVisible();

  await page.goto("/plan/create-account");
  await expect(page).toHaveURL(/\/auth\/signup\?role=CLIENT$/);
  await expect(page.locator("#eph-auth-dialog")).toBeVisible();
});

test("signed-out marketplace deep links return to the marketplace after sign-in", async ({ page }) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "marketplace-return-e2e",
          name: "Marketplace Return Test",
          email: "marketplace-return@example.test",
          role: "CLIENT",
          country: "NG",
          currency: "NGN",
          locale: "en",
        },
        accessToken: "e2e-access-token",
        refreshToken: "e2e-refresh-token",
        expiresIn: 900,
      }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem("ess_onboard_v2_client_default", "1");
  });
  await page.goto("/marketplace");
  await expect(page).toHaveURL(/\/auth\/signin\?role=CLIENT&returnTo=%2Fmarketplace$/);
  await page.getByLabel("Email").fill("marketplace-return@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill("QaOnlyPassword123!");
  await page.getByRole("button", { name: /Continue securely/ }).click();
  await unlockDeviceGate(page);
  await expect(page).toHaveURL(/\/dashboard\/client(?:\?tab=marketplace)?$/);
  await expect(page.getByRole("heading", { name: /Explore the EPHINTA Marketplace/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to your event marketplace." })).toBeVisible();
});

test("marketplace deep links open the marketplace tab in an authenticated customer workspace", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "marketplace-route-e2e",
      email: "marketplace-route@example.test",
      name: "Marketplace Route Test",
      role: "CLIENT",
    }));
    localStorage.setItem("ess_access_token", "e2e-access-token");
    localStorage.setItem("ess_refresh_token", "e2e-refresh-token");
    localStorage.setItem("ess_onboard_v2_client_default", "1");
  });

  await page.goto("/marketplace");
  await unlockDeviceGate(page);
  await expect(page).toHaveURL(/\/dashboard\/client\?tab=marketplace$/);
  await expect(page.getByRole("heading", { name: "Welcome to your event marketplace." })).toBeVisible();
});

test("guest RSVP deep links are public and show a safe unavailable state for an invalid token", async ({ page }) => {
  await page.route("**/api/v1/rsvp/qa-invalid-token", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Invitation not found" } }),
    });
  });

  await page.goto("/rsvp/qa-invalid-token");
  await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/invitation/i);
});

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
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
});
test("event builder inherits the global parent theme and saves a brief", async ({ page }) => {
  await page.goto("/plan");

  const builderCard = page.locator(".ess-builder-card");
  await expect(builderCard).toBeVisible();
  await expect(builderCard).toHaveCSS("color", "rgb(33, 29, 55)");
  const cardBackground = await builderCard.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(cardBackground).toContain("linear-gradient");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCard = await builderCard.boundingBox();
  expect(mobileCard).not.toBeNull();
  expect(mobileCard!.x).toBeGreaterThanOrEqual(0);
  expect(mobileCard!.x + mobileCard!.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });

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

  const planningBudget = page.getByLabel("Planning budget");
  await planningBudget.fill("NGN 2500000");
  await expect(planningBudget).toHaveValue("2,500,000");
  await page.getByRole("button", { name: /Build my event brief/ }).click();
  await expect(page.getByText("2,500,000.00")).toBeVisible();

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
    budget: "2,500,000.00",
  });

});

test("signed-in event planners can open the modern planner route", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "planner-route-e2e",
      email: "planner-route@example.test",
      name: "Planner Route Test",
      role: "CLIENT",
    }));
    localStorage.setItem("ess_access_token", "e2e-access-token");
  });

  await page.goto("/plan");
  await unlockDeviceGate(page);
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible();
  await expect(page.locator(".eph-modal")).toHaveCount(0);
});

test("the menu planner action opens the guided event planner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /Plan your next event here/ }).click();

  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { name: "What are you creating?" })).toBeVisible();
  await expect(page.locator(".eph-modal")).toHaveCount(0);

  await page.getByLabel("Event name").fill("Header Planner Flow");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("City or venue area").fill("Ibadan");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Expected guests").fill("80");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("button", { name: /Build my event brief/ }).click();
  await page.getByRole("button", { name: /Save brief and create account/ }).click();

  await expect(page).toHaveURL(/\/auth\/signup\?role=CLIENT$/);
  await expect(page.locator("#eph-auth-dialog")).toBeVisible();
  await expect(page.locator(".eph-modal")).toHaveCount(0);
});

test("public signup choices open role-specific introductions before account creation", async ({ page }) => {
  const choices = [
    { button: "Create customer account", route: "/plan", heading: "What are you creating?" },
    { button: "Create vendor account", route: "/join/vendor", heading: "Tell us about your services" },
    { button: "Create organizer account", route: "/join/organization", heading: "Tell us about your organization" },
    { button: "Create affiliate account", route: "/join/affiliate", heading: "Tell us about your community" },
    { button: "Create verifier account", route: "/join/verifier", heading: "Tell us about your verification experience" },
    { button: "Create consultant account", route: "/join/consultant", heading: "Tell us about your event expertise" },
  ];

  for (const choice of choices) {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: choice.button }).click();
    await expect(page).toHaveURL(new RegExp(`${choice.route.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: choice.heading })).toBeVisible();
  }
});

test("vendor introduction carries profile answers into signup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Create vendor account" }).click();

  await page.getByLabel("Business name").fill("Bright Day Catering");
  await page.getByLabel("Primary service").selectOption("Catering");
  await page.getByLabel("Main service city").fill("Lagos");
  await page.getByLabel("What do you provide?").fill("Seasonal event menus");
  await page.getByRole("button", { name: /Continue to signup/ }).click();

  await expect(page).toHaveURL(/\/auth\/signup\?role=VENDOR$/);
  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toHaveAttribute("data-role", "vendor");
  await dialog.getByLabel("Full name").fill("Vendor Registration");
  await dialog.getByLabel("Email address").fill("vendor-intro@example.test");
  await dialog.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByLabel("Business name")).toHaveValue("Bright Day Catering");
  await expect(dialog.getByLabel("Operating city")).toHaveValue("Lagos");
  await expect(dialog.getByLabel("What do you provide?")).toHaveValue("Seasonal event menus");
});

test("affiliate introduction preselects a matching referral channel during signup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Create affiliate account" }).click();

  await page.getByLabel("What is your primary referral channel?").selectOption("Social media");
  await page.getByLabel("Who do you expect to refer?").selectOption("Event planners");
  await page.getByRole("button", { name: /Continue to signup/ }).click();

  const dialog = page.locator("#eph-auth-dialog");
  await dialog.getByLabel("Full name").fill("Affiliate Registration");
  await dialog.getByLabel("Email address").fill("affiliate-intro@example.test");
  await dialog.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByLabel("Primary referral channel")).toHaveValue("Social media");
});

test("registration blocks a password shorter than the input minimum", async ({ page }) => {
  await page.goto("/auth/signup?role=CLIENT");

  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("ESS E2E Customer");
  await dialog.getByLabel("Email address").fill("e2e-customer@example.test");

  const password = dialog.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await password.fill("short");
  await expect(password).toHaveValue("short");

  // The first step must reject a short password before advancing.
  const validity = await password.evaluate((element) => ({
    minLength: element.getAttribute("minlength"),
    tooShort: element.validity.tooShort,
    valueLength: element.value.length,
  }));
  expect(validity.minLength).toBe("8");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible();
  await expect(password).toBeVisible();

  await password.fill("LongPassword123");
  expect(await password.evaluate((element) => element.validity.valid)).toBe(false);
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible();

  await password.fill("StrongPass123!");
  expect(await password.evaluate((element) => element.validity.valid)).toBe(true);
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible();
});
test("registration supports back and next navigation across the shared role-specific steps", async ({ page }) => {
  await page.goto("/auth/signup?role=CLIENT");

  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("Mobile Registration Test");
  await dialog.getByLabel("Email address").fill("mobile-registration@example.test");
  await dialog.getByLabel("Password", { exact: true }).fill("StrongPass123!");

  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible();
  await expect(dialog.getByText("Your event-planning workspace is next.")).toBeVisible();

  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByLabel("Full name")).toHaveValue("Mobile Registration Test");

  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 3 of 3")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Choose your preferences" })).toBeVisible();
  await expect(dialog.getByLabel("Country")).toBeVisible();
  await expect(dialog.getByLabel("Currency")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create account" })).toBeVisible();

  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByRole("button", { name: "Event Planner" })).toHaveClass(/active/);
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByLabel("Full name")).toHaveValue("Mobile Registration Test");
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog).toBeHidden();
});

test("each self-registering role gets its own signup dialog and profile fields", async ({ page }) => {
  const registrations = [
    { role: "CLIENT", label: "Event Planner", profile: "Your event-planning workspace is next." },
    { role: "ORGANIZATION", label: "Organizer", profile: "How will your organization use ESS?" },
    { role: "VENDOR", label: "Vendor", profile: "Business name" },
    { role: "AFFILIATE", label: "Affiliate", profile: "Primary referral channel" },
    { role: "VERIFIER", label: "Verifier", profile: "For event readiness professionals." },
    { role: "CONSULTANT", label: "Consultant", profile: "For event operations consultants." },
  ];

  for (const [index, registration] of registrations.entries()) {
    await page.goto(`/auth/signup?role=${registration.role}`);
    const dialog = page.locator(".ess-auth-modal");
    await expect(dialog).toHaveAttribute("data-role", registration.role.toLowerCase());
    await expect(dialog.getByRole("heading", { name: `Create your ${registration.label.toLowerCase()} account` })).toBeVisible();
    await expect(dialog.getByRole("button", { name: registration.label })).toHaveClass(/active/);
    await expect(dialog.locator(".ess-auth-roles button")).toHaveCount(6);

    await dialog.getByLabel("Full name").fill(`Account ${index + 1}`);
    await dialog.getByLabel("Email address").fill(`account${index + 1}@example.test`);
    await dialog.getByLabel("Password", { exact: true }).fill("StrongPass123!");
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByText(registration.profile)).toBeVisible();
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
  const password = page.getByRole("textbox", { name: "Password" });
  await expect(password).not.toHaveAttribute("minlength");
  await password.fill("short");
  await page.getByRole("button", { name: /Continue securely/ }).click();

  await expect(page.locator(".ess-form-error")).toHaveAttribute("role", "alert");
  await expect(page.locator(".ess-form-error")).toContainText(
    "That email and password do not match",
  );
  await expect(page.locator(".ess-form-error")).toContainText("Forgot password");
});

test("landing-page registration explains when an email or phone number is already in use", async ({ page }) => {
  await page.route("**/api/v1/auth/register", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "ALREADY_EXISTS",
          message: "Email or phone already registered",
        },
      }),
    });
  });

  await page.goto("/auth/signup?role=CLIENT");
  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("Existing Account Test");
  await dialog.getByLabel("Email address").fill("existing@example.test");
  await dialog.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await dialog.getByRole("button", { name: /Next/ }).click();
  await dialog.getByRole("button", { name: /Next/ }).click();
  await dialog.getByRole("button", { name: /Create account/ }).click();

  await expect(dialog.locator(".ess-form-error")).toHaveAttribute("role", "alert");
  await expect(dialog.locator(".ess-form-error")).toContainText("already exists");
  await expect(dialog.locator(".ess-form-error")).toContainText("Sign in");
});

test("landing-page sign-in explains incorrect passwords and accepts legacy password lengths", async ({ page }) => {
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

  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Sign in to your account" }).click();
  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email address").fill("legacy@example.test");
  const password = dialog.getByLabel("Password", { exact: true });
  await expect(password).not.toHaveAttribute("minlength");
  await password.fill("short");
  await dialog.getByRole("button", { name: /Continue securely/ }).click();

  await expect(dialog.locator(".ess-form-error")).toHaveAttribute("role", "alert");
  await expect(dialog.locator(".ess-form-error")).toContainText("That email and password do not match");
  await expect(dialog.locator(".ess-form-error")).toContainText("Forgot password");
});

test("forgot-password flow gives a privacy-safe confirmation", async ({ page }) => {
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Sign in to your account" }).click();
  const dialog = page.locator("#eph-auth-dialog");
  await dialog.getByRole("button", { name: "Forgot password?" }).click();
  await expect(dialog.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await dialog.getByLabel("Email address").fill("reset@example.test");
  await dialog.getByRole("button", { name: "Send reset link" }).click();
  await expect(dialog.locator(".ess-auth-notice")).toContainText(
    "If an account exists for that email, a reset link has been sent",
  );
});

test("switching from registration to sign-in clears signup-only password validation", async ({ page }) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }),
    });
  });

  await page.goto("/auth/signup?role=CLIENT");
  const dialog = page.locator("#eph-auth-dialog");
  await dialog.getByLabel("Full name").fill("Password Mode Switch Test");
  await dialog.getByLabel("Email address").fill("switch@example.test");
  const signupPassword = dialog.getByLabel("Password", { exact: true });
  await signupPassword.fill("short");
  await expect(signupPassword).toHaveAttribute("minlength", "8");
  expect(await signupPassword.evaluate((element) => element.validity.valid)).toBe(false);

  await dialog.locator(".ess-auth-mode-switch").getByRole("button", { name: "Sign in" }).click();
  await expect(dialog.getByRole("heading", { name: "Event Planner sign in" })).toBeVisible();
  const signinPassword = dialog.getByLabel("Password", { exact: true });
  await expect(signinPassword).not.toHaveAttribute("minlength");
  await expect(signinPassword).toHaveValue("");
  await signinPassword.fill("short");
  await dialog.getByRole("button", { name: /Continue securely/ }).click();

  await expect(dialog.locator(".ess-form-error")).toContainText("That email and password do not match");
});

test("music consent prompt fits the phone screen and stays in the corner @mobile", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  const viewport = page.viewportSize();
  const bounds = await page.locator(".eph-audio__backdrop").boundingBox();
  expect(viewport).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
  await expect(prompt.getByRole("button", { name: "Yes, play music" })).toBeVisible();
  await expect(prompt.getByRole("button", { name: "No, thanks" })).toBeVisible();
});

test("mobile menu opens and provides sign-in access @mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile menu is checked on the mobile viewport.");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();

  const menu = page.getByRole("navigation", { name: "Main navigation" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Sign in to your account" }).click();

  await expect(page.getByRole("dialog", { name: "Event Planner sign in" })).toBeVisible();
});

test("authenticated planner can add a checklist task to an owned event", async ({ page }) => {
  const event = {
    id: "event-e2e-001", title: "Authenticated E2E Event", type: "CORPORATE",
    status: "DRAFT", city: "Ibadan", country: "NG", currency: "NGN",
    expectedGuests: 80, startsAt: null, endsAt: null,
  };
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "planner-e2e", email: "planner@example.test", name: "E2E Planner", role: "CLIENT",
    }));
    localStorage.setItem("ess_access_token", "e2e-access-token");
  });
  // Keep ancillary dashboard requests deterministic while specific fixtures
  // below continue to provide the owned event and task responses.
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [], tasks: [], answers: {}, summary: [] }),
  }));
  await page.route("**/api/v1/events", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [event] }),
  }));
  await page.route("**/api/v1/readiness/mine", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/events/event-e2e-001", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ event }),
  }));
  await page.route("**/api/v1/events/event-e2e-001/tasks", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks: [] }) });
    }
    expect(route.request().headers().authorization).toBe("Bearer e2e-access-token");
    expect(route.request().postDataJSON()).toMatchObject({ title: "Confirm event venue" });
    return route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ task: { id: "task-e2e-001", title: "Confirm event venue", tier: "ESSENTIAL", status: "TODO" } }),
    });
  });
  await page.route("**/api/v1/events/event-e2e-001/guests**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0 }),
  }));
  await page.route("**/api/v1/events/event-e2e-001/guests/check-ins", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/events/event-e2e-001/budget", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/payments/bookings**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/events/event-e2e-001/plan-answers", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ answers: {} }),
  }));
  await page.route("**/api/v1/readiness/events/event-e2e-001", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ readiness: { status: "NOT_STARTED", totalChecks: 0, greenCount: 0, amberCount: 0, redCount: 0, pendingCount: 0 }, checks: [] }),
  }));

  await page.goto("/dashboard/client?tab=planner");
  await unlockDeviceGate(page);
  await expect(page.getByRole("heading", { name: /Welcome back, E2E/ })).toBeVisible();
  // Auth/session restoration can normalize the dashboard URL and reset its tab.
  // Exercise the visible navigation instead of relying on a query-string tab state.
  const plannerNavigation = page.getByRole("navigation", { name: "Planner dashboard sections" });
  await expect(plannerNavigation).toBeVisible();
  const eventWorkspaceTab = plannerNavigation.getByRole("button", { name: "Open Event workspace" });
  await eventWorkspaceTab.dispatchEvent("click");
  await expect(eventWorkspaceTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Complete event workspace" })).toBeVisible();

  const paymentsTab = plannerNavigation.getByRole("button", { name: "Open Payments & finances" });
  await paymentsTab.click();
  await expect(paymentsTab).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/tab=payments/);
  await page.goBack();
  await expect(eventWorkspaceTab).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(paymentsTab).toHaveAttribute("aria-current", "page");
  await eventWorkspaceTab.click();
  await expect(page.getByRole("heading", { name: "Complete event workspace" })).toBeVisible();
  await expect(page.locator('select option[value="event-e2e-001"]')).toHaveText(event.title);
  const taskInput = page.locator('section[aria-labelledby="event-workspace-title"] label').filter({ hasText: /^Task$/ }).locator("input");
  await expect(taskInput).toBeVisible();
  await taskInput.fill("Confirm event venue");
  // Submit with the keyboard: the sticky branded header can overlap the button in CI.
  await taskInput.press("Enter");
  await expect(page.getByText("Confirm event venue")).toBeVisible();
  await expect(page.getByText("Task added to the event timeline.")).toBeVisible();
});

test("authenticated planner receives no private event data outside the owned event list", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "planner-other", email: "other@example.test", name: "Other Planner", role: "CLIENT",
    }));
    localStorage.setItem("ess_access_token", "e2e-access-token");
  });
  await page.route("**/api/v1/events", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/readiness/mine", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));

  await page.goto("/dashboard/client?tab=overview");
  await unlockDeviceGate(page);
  await expect(page.getByRole("heading", { name: /Welcome back, Other/ })).toBeVisible();
  await expect(page.getByText("Another Owner's Private Event")).toHaveCount(0);
});


test("branded intro shows its loaded logo and clears after startup", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  const splash = page.locator("[data-ephinta-intro-splash]");
  await expect(splash).toBeVisible({ timeout: 5000 });
  const logo = splash.locator("img");
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(splash).toHaveText("");
  await expect(splash.locator(":scope > *")).toHaveCount(1);
  await expect(splash).toBeHidden({ timeout: 5000 });
});

test("background music starts only after consent and advances automatically", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __ephintaAudioUserGesture?: boolean; __ephintaAudioPlayCalls?: number; __ephintaAudioPauseCalls?: number };
    state.__ephintaAudioUserGesture = false;
    state.__ephintaAudioPlayCalls = 0;
    state.__ephintaAudioPauseCalls = 0;
    document.addEventListener("pointerdown", () => { state.__ephintaAudioUserGesture = true; }, true);
    document.addEventListener("keydown", () => { state.__ephintaAudioUserGesture = true; }, true);
    HTMLMediaElement.prototype.play = function () {
      state.__ephintaAudioPlayCalls! += 1;
      if (!state.__ephintaAudioUserGesture) {
        return Promise.reject(new DOMException("User gesture required", "NotAllowedError"));
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () { state.__ephintaAudioPauseCalls! += 1; };
  });
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __ephintaAudioPlayCalls?: number }).__ephintaAudioPlayCalls)).toBe(0);
  await prompt.getByRole("button", { name: "Yes, play music" }).click();
  expect(await page.evaluate(() => (window as Window & { __ephintaAudioUserGesture?: boolean }).__ephintaAudioUserGesture)).toBe(true);
  await expect(prompt).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("on");
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __ephintaAudioPlayCalls?: number }).__ephintaAudioPlayCalls,
  )).toBe(1);
  const audio = page.locator("audio");
  await audio.evaluate((element: HTMLAudioElement) => element.dispatchEvent(new Event("ended")));
  await expect(audio).toHaveAttribute("src", /Here%20we%20are-2/);
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __ephintaAudioPlayCalls?: number }).__ephintaAudioPlayCalls,
  )).toBe(2);
});

test("music player respects a saved sound-off choice after reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ephinta:sound", "off"));
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Enjoy background music?" })).toHaveCount(0);
  await expect(page.locator("audio")).toHaveJSProperty("paused", true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("off");
});

test("production app loads the bundled music track and plays after consent", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  const audio = page.locator("audio");
  const audioUrl = await audio.evaluate((element: HTMLAudioElement) => element.src);
  expect(decodeURIComponent(audioUrl)).toContain("Here we are");
  const asset = await page.request.get(audioUrl);
  expect(asset.ok()).toBeTruthy();
  expect(asset.headers()["content-type"]).toContain("audio/mpeg");
  expect(Number(asset.headers()["content-length"] || 0)).toBeGreaterThan(100_000);
  await prompt.getByRole("button", { name: "Yes, play music" }).click();
  await expect(prompt).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("on");
});

test("mobile registration keeps compact branding and reachable navigation without audio prompt overlap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/billing/public-promotions", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [] }),
  }));
  await page.goto("/auth/signup?role=CLIENT", { waitUntil: "networkidle" });

  const dialog = page.locator(".ess-auth-modal");
  await expect(dialog).toBeVisible();
  await expect(page.locator(".eph-audio__prompt")).toHaveCount(0);

  const logo = dialog.locator("img").first();
  const logoBox = await logo.boundingBox();
  expect(logoBox).not.toBeNull();
  expect(logoBox!.width).toBeLessThanOrEqual(72);
  expect(logoBox!.height).toBeLessThanOrEqual(72);

  const back = dialog.getByRole("button", { name: /Back/ });
  const next = dialog.getByRole("button", { name: /Next/ });
  await expect(back).toBeVisible();
  await expect(next).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
});

test("planner registration keeps the logo visible and opens the saved follow-up questionnaire", async ({ page }) => {
  // Keep unrelated background API calls deterministic in browser CI. Specific
  // route fixtures registered below take precedence over this fallback.
  await page.route("**/api/v1/billing/public-promotions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ promotions: [], items: [], data: [] }),
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], data: [], unreadCount: 0 }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, items: [] }) });
  });
  await page.route("**/api/v1/auth/register", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "planner-e2e-access",
        refreshToken: "planner-e2e-refresh",
        user: {
          id: "planner-followup-e2e",
          email: "planner-followup@example.test",
          name: "Planner Followup",
          role: "CLIENT",
        },
      }),
    });
  });

  await page.route("**/api/v1/events**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/plan-answers")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ answers: {}, complete: false }),
      });
      return;
    }
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          event: {
            id: "planner-followup-event",
            title: "Planner Follow-up Event",
            city: "Ibadan",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route("**/api/v1/readiness/mine", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto("/plan");
  await page.getByLabel("Event name").fill("Planner Follow-up Event");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("City or venue area").fill("Ibadan");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByLabel("Expected guests").fill("90");
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("button", { name: /Build my event brief/ }).click();
  await page.getByRole("button", { name: /Save brief and create account/ }).click();

  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  const brand = dialog.locator(".ess-auth-brand");
  await expect(brand).toBeVisible();
  await expect(brand).toHaveCSS("justify-content", "flex-start");
  await expect(brand.locator(".ess-auth-brand-mark")).toBeVisible();
  await expect(brand.locator(".ess-auth-brand-name")).toHaveText("EPHINTA");

  await dialog.getByLabel("Full name").fill("Planner Followup");
  await dialog.getByLabel("Email address").fill("planner-followup@example.test");
  await dialog.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await dialog.getByRole("button", { name: /Next/ }).click();
  await expect(dialog.locator(".ess-registration-progress")).toContainText("Step 2 of 3");
  await dialog.getByRole("button", { name: /Next/ }).click();
  await expect(dialog.locator(".ess-registration-progress")).toContainText("Step 3 of 3");
  const createAccount = dialog.getByRole("button", { name: /Create account/ });
  await expect(createAccount).toBeVisible();
  await expect(createAccount).toBeEnabled();
  // Submit through the native button activation after the step transition.
  // This avoids Playwright waiting indefinitely on the animated dialog layout.
  await createAccount.evaluate((button) => (button as HTMLButtonElement).click());

  // New authenticated devices must create and confirm a local six-digit PIN
  // before any planner or communication workspace is rendered.
  const deviceSecurity = page.getByRole("dialog", { name: "Set your device PIN" });
  await expect(deviceSecurity).toBeVisible();
  await deviceSecurity.getByLabel("Six-digit PIN").fill("482615");
  await deviceSecurity.getByLabel("Confirm PIN").fill("482615");
  await deviceSecurity.getByRole("button", { name: "Set PIN and continue" }).click();

  const onboarding = page.getByRole("dialog", { name: "client onboarding" });
  await expect(onboarding).toBeVisible();
  await onboarding.getByRole("button", { name: "Continue" }).click();
  await onboarding.getByRole("button", { name: "Continue" }).click();
  await onboarding.getByRole("button", { name: "Continue" }).click();
  await onboarding.getByRole("button", { name: "Open my planner" }).click();

  // The first planner workspace should be a full marketplace welcome session,
  // not a blank-looking overview or a tiny block of text in the page corner.
  await expect(page.getByRole("heading", { name: "Welcome to your event marketplace." })).toBeVisible();
  await expect(page.getByRole("region", { name: "What you can do with EPHINTA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan with confidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find the right people" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Book with clarity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stay in control" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore the marketplace" })).toBeVisible();

  // The planner workspace uses a responsive dashboard menu grid that keeps
  // every destination visible without forcing horizontal page scrolling.
  const plannerShell = page.locator(".ess-content > .ess-portal-stack");
  await expect(plannerShell).toHaveCSS("display", "grid");
  const plannerTabs = plannerShell.locator(":scope > .ess-filter-row").first();
  await expect(plannerTabs).toBeVisible();
  await expect(plannerTabs).toHaveCSS("display", "grid");
  await expect(plannerTabs).toHaveCSS("overflow-x", "visible");
  await expect(plannerTabs.locator(".ess-chip-active")).toBeVisible();
  await expect(plannerTabs.locator(".ess-chip-active")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(plannerTabs).toBeVisible();
  const mobileLayoutFits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(mobileLayoutFits).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });

  // The saved follow-up questionnaire remains available in Overview.
  await page.getByRole("button", { name: "Open Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plan the details for Planner Follow-up Event" }),
  ).toBeVisible();
  await expect(page.getByText("What would make this event a success for you?")).toBeVisible();
});

test("Plan a Burial opens the burial planner and selects the burial soundtrack", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ephinta:sound", "off");
    localStorage.setItem("ess_event_builder_progress", JSON.stringify({
      title: "Old wedding draft",
      type: "PERSONAL",
      goal: "Celebrate",
      date: "",
      city: "Ibadan",
      guests: "120",
      budget: "",
      atmosphere: "Warm and social",
      food: "Mixed menu",
      venue: "Still deciding",
      priorities: "Guest experience",
    }));
  });
  await page.route("**/data/wale-waves-playlists.json", async (route) => {
    await route.fulfill({ status: 404, body: "not synced yet" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Plan a Burial" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByLabel("Event name")).toHaveValue("Burial celebration");
  await expect(page.getByLabel("Event format")).toHaveValue("CULTURAL");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:music-category"))).toBe("burial");
  await expect(page.locator("audio")).toHaveAttribute("src", /Burials/);
});

test("Plan a Naming Ceremony selects the naming soundtrack", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ephinta:sound", "off");
  });
  await page.route("**/data/wale-waves-playlists.json", async (route) => {
    await route.fulfill({ status: 404, body: "not synced yet" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Plan a Naming Ceremony" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByLabel("Event name")).toHaveValue("Naming ceremony celebration");
  await expect(page.getByLabel("Event format")).toHaveValue("PERSONAL");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:music-category"))).toBe("naming");
  await expect(page.locator("audio")).toHaveAttribute("src", /Naming/);
});


test("EPHINTA Guide opens, maximizes, restores and minimizes accessibly", async ({ page }) => {
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Open EPHINTA Guide" });
  await expect(launcher).toBeVisible();
  await launcher.click();

  const chat = page.getByRole("region", { name: "EPHINTA Guide chat" });
  await expect(chat).toBeVisible();
  await expect(chat.getByText("I’m EPHINTA Guide")).toBeVisible();

  await chat.getByRole("button", { name: "Maximize chat" }).click();
  await expect(page.locator(".ephinta-guide-root")).toHaveClass(/is-maximized/);

  await chat.getByRole("button", { name: "Restore chat size" }).click();
  await expect(page.locator(".ephinta-guide-root")).not.toHaveClass(/is-maximized/);

  await chat.getByRole("button", { name: "Minimize chat" }).click();
  await expect(chat).toBeHidden();
  await expect(launcher).toBeVisible();
});
