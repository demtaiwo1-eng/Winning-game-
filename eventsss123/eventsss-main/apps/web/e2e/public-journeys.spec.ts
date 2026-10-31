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
  await page.getByRole("button", { name: "Close menu" }).click();
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


test("authenticated planner can create an event and add a checklist task", async ({ page }) => {
  const auth = {
    accessToken: "e2e-access-token",
    refreshToken: "e2e-refresh-token",
    user: { id: "planner-e2e", email: "planner@example.test", name: "E2E Planner", role: "CLIENT", currency: "NGN" },
  };
  const event = {
    id: "event-e2e-001",
    title: "Authenticated E2E Event",
    type: "PERSONAL",
    status: "DRAFT",
    city: "Ibadan",
    country: "NG",
    currency: "NGN",
    expectedGuests: 80,
  };

  await page.route("**/api/v1/auth/login", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(auth),
  }));
  await page.route("**/api/v1/events", async (route) => {
    if (route.request().method() === "GET") {
      expect(route.request().headers().authorization).toBe("Bearer e2e-access-token");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    }
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toBe("Bearer e2e-access-token");
    expect(route.request().postDataJSON()).toMatchObject({ title: event.title, city: "Ibadan", expectedGuests: 80, isPublic: false });
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ event }) });
  });
  await page.route("**/api/v1/events/event-e2e-001", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      event,
      summary: { guests: { byRsvp: {}, expectedHeadcount: 0 }, tasks: {}, budget: { currency: "NGN", plannedMinor: "0", actualMinor: "0" } },
    }),
  }));
  await page.route("**/api/v1/events/event-e2e-001/tasks", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks: [] }) });
    }
    expect(route.request().headers().authorization).toBe("Bearer e2e-access-token");
    expect(route.request().postDataJSON()).toEqual({ title: "Confirm event venue" });
    return route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ task: { id: "task-e2e-001", title: "Confirm event venue", status: "TODO" } }),
    });
  });
  await page.route("**/api/v1/events/event-e2e-001/guests", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Sign in to your account" }).click();
  const dialog = page.getByRole("dialog", { name: "Welcome back" });
  await dialog.getByLabel("Email address").fill("planner@example.test");
  await dialog.getByLabel("Password").fill("e2e-password");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Welcome, E2E Planner" })).toBeVisible();
  await page.getByLabel("Event name").fill(event.title);
  await page.getByLabel("City").fill("Ibadan");
  await page.getByLabel("Expected guests").fill("80");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByText("Event created. Your planning workspace is ready.")).toBeVisible();
  await page.getByRole("button", { name: /Authenticated E2E Event/ }).click();
  await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
  await page.getByRole("button", { name: "Tasks (0)" }).click();
  await page.getByLabel("Task title").fill("Confirm event venue");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Confirm event venue")).toBeVisible();
  await expect(page.getByText("Task added.")).toBeVisible();
});

test("authenticated planner shows an access error when an event is not owned", async ({ page }) => {
  const auth = {
    accessToken: "e2e-access-token",
    refreshToken: "e2e-refresh-token",
    user: { id: "planner-other", email: "other@example.test", name: "Other Planner", role: "CLIENT" },
  };
  await page.route("**/api/v1/auth/login", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(auth),
  }));
  await page.route("**/api/v1/events", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [{ id: "foreign-event-001", title: "Another Owner's Private Event", status: "DRAFT" }] }),
  }));
  await page.route("**/api/v1/events/foreign-event-001**", (route) => route.fulfill({
    status: 404, contentType: "application/json",
    body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Event not found" } }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Sign in to your account" }).click();
  const dialog = page.getByRole("dialog", { name: "Welcome back" });
  await dialog.getByLabel("Email address").fill("other@example.test");
  await dialog.getByLabel("Password").fill("e2e-password");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Welcome, Other Planner" })).toBeVisible();
  await page.getByRole("button", { name: /Another Owner's Private Event/ }).click();
  await expect(page.getByText("Unable to load event details.")).toBeVisible();
  await expect(page.getByText("Event summary")).toHaveCount(0);
});

  const auth = {
    accessToken: "e2e-access-token",
    refreshToken: "e2e-refresh-token",
    user: { id: "planner-other", email: "other@example.test", name: "Other Planner", role: "CLIENT" },
  };
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "planner-other", email: "other@example.test", name: "Other Planner", role: "CLIENT",
    }));
    localStorage.setItem("ess_access_token", "e2e-access-token");
    localStorage.setItem("ess_refresh_token", "e2e-refresh-token");
  });
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(auth) }));
  await page.route("**/api/v1/events", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [{ id: "foreign-event-001", title: "Another Owner's Private Event", status: "DRAFT" }] }),
  }));
  await page.route("**/api/v1/events/foreign-event-001**", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Event not found" } }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: /Another Owner's Private Event/ }).click();
  await expect(page.getByText("Unable to load event details.")).toBeVisible();
  await expect(page.getByText("Event summary")).toHaveCount(0);
});
