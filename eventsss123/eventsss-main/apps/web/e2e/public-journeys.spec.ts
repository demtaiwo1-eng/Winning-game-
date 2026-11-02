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
  await page.keyboard.press("Escape");
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

  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("ESS E2E Customer");
  await dialog.getByLabel("Email address").fill("e2e-customer@example.test");

  const password = dialog.getByLabel("Password");
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await password.fill("short");
  await expect(password).toHaveValue("short");

  // The first step must reject a short password before advancing.
  const validity = await password.evaluate((element) => ({
    minLength: element.getAttribute("minlength"),
    tooShort: element.validity.tooShort,
    valueLength: element.value.length,
  }));
  expect(validity.minLength).toBe("12");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 1 of 3")).toBeVisible();
  await expect(password).toBeVisible();
});
test("registration supports back and next navigation and a review step", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Create customer account" }).click();

  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill("Mobile Registration Test");
  await dialog.getByLabel("Email address").fill("mobile-registration@example.test");
  await dialog.getByLabel("Password").fill("StrongPass123!");

  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible();
  await expect(dialog.getByText("Event planner account")).toBeVisible();

  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByLabel("Full name")).toHaveValue("Mobile Registration Test");

  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Step 3 of 3")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Review your account" })).toBeVisible();
  await expect(dialog.getByText("mobile-registration@example.test")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create account" })).toBeVisible();

  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByLabel("Account type")).toHaveValue("CLIENT");
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.getByLabel("Full name")).toHaveValue("Mobile Registration Test");
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog).toBeHidden();
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
  await page.route("**/api/v1/payments/bookings", (route) => route.fulfill({
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
  await expect(page.getByRole("heading", { name: /Welcome back, E2E/ })).toBeVisible();
  // Auth/session restoration can normalize the dashboard URL and reset its tab.
  // Exercise the visible navigation instead of relying on a query-string tab state.
  const eventWorkspaceTab = page.getByRole("button", { name: "Event workspace", exact: true });
  await eventWorkspaceTab.dispatchEvent("click");
  await expect(page.getByRole("heading", { name: "Complete event workspace" })).toBeVisible();
  await expect(page.locator('select option[value="event-e2e-001"]')).toHaveText(event.title);
  const taskInput = page.getByLabel("Task", { exact: true });
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
  await expect(page.getByRole("heading", { name: /Welcome back, Other/ })).toBeVisible();
  await expect(page.getByText("Another Owner's Private Event")).toHaveCount(0);
});

test("mobile registration keeps its logo compact and navigation reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Create customer account" }).click();

  const dialog = page.locator("#eph-auth-dialog");
  await expect(dialog).toBeVisible();
  const logo = dialog.locator(".eph-modal-brand img");
  const logoBox = await logo.boundingBox();
  expect(logoBox).not.toBeNull();
  expect(logoBox!.width).toBeLessThanOrEqual(36);
  expect(logoBox!.height).toBeLessThanOrEqual(36);

  const back = dialog.getByRole("button", { name: "Back" });
  const next = dialog.getByRole("button", { name: "Next" });
  await expect(back).toBeVisible();
  await expect(next).toBeVisible();
  const navigationBox = await dialog.locator(".eph-registration-navigation").boundingBox();
  expect(navigationBox).not.toBeNull();
  expect(navigationBox!.x).toBeGreaterThanOrEqual(0);
  expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(390);

  await dialog.getByLabel("Full name").fill("Mobile Layout Check");
  await dialog.getByLabel("Email address").fill("mobile-layout@example.test");
  await dialog.getByLabel("Password").fill("StrongPass123!");
  await next.click();
  await expect(dialog.getByText("Step 2 of 3")).toBeVisible();
  await expect(back).toBeVisible();
  await expect(next).toBeVisible();
});

test("signed-in dashboard navigation remains usable on narrow mobile screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "planner-mobile-nav", email: "mobile-nav@example.test", name: "Mobile Planner", role: "CLIENT",
    }));
    localStorage.setItem("ess_access_token", "mobile-nav-token");
  });
  await page.route("**/api/v1/events", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/readiness/mine", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }),
  }));
  await page.goto("/dashboard/client?tab=overview");

  const navigation = page.locator(".ess-filter-row").first();
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Overview" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Wallet & escrow" })).toBeAttached();

  const dimensions = await navigation.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    bodyClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThanOrEqual(dimensions.clientWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.bodyClientWidth + 1);

  await navigation.getByRole("button", { name: "Wallet & escrow" }).click();
  await expect(page.getByRole("heading", { name: /Funds & protection/i })).toBeVisible();
  await expect(page.locator(".ess-wallet-panel")).toBeVisible();
});


test("role workspaces remain readable and contained on narrow mobile screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "E2E_OFFLINE", message: "Test API unavailable" } }),
  }));

  const roleCases = [
    { role: "vendor", heading: "Sell the experience." },
    { role: "affiliate", heading: "Grow the event network." },
    { role: "verifier", heading: "Pre-event service confirmation" },
    { role: "consultant", heading: "Operations updates" },
    { role: "admin", heading: "Platform operations" },
  ];

  await page.addInitScript(() => {
    const role = location.pathname.split("/").pop() || "client";
    localStorage.setItem("ess_user", JSON.stringify({
      id: `mobile-${role}`,
      email: `${role}@example.test`,
      name: "Mobile Role Tester",
      role: role.toUpperCase(),
    }));
    localStorage.setItem("ess_access_token", "role-workspace-test-token");
  });

  for (const item of roleCases) {
    await page.goto(`/dashboard/${item.role}`);
    await expect(page.getByRole("heading", { name: item.heading, exact: true })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      content: document.querySelector(".ess-content")?.getBoundingClientRect().width ?? 0,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});


test("vendor can save availability and delete only a selected listing", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ess_user", JSON.stringify({
      id: "vendor-e2e", email: "vendor@example.test", name: "E2E Vendor", role: "VENDOR",
    }));
    localStorage.setItem("ess_access_token", "vendor-e2e-token");
  });
  const listing = {
    id: "listing-vendor-e2e", title: "E2E Catering Package", description: "Food and service",
    priceMinor: "250000", currency: "NGN", city: "Ibadan", capacity: 120,
    status: "DRAFT", type: "SERVICE", category: { id: "cat-catering", name: "Catering" },
  };
  await page.route("**/api/v1/vendor/listings", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [listing] }) });
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ listing }) });
  });
  await page.route("**/api/v1/vendor/categories", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "cat-catering", name: "Catering" }] }),
  }));
  await page.route("**/api/v1/vendor/metrics", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ listings: { DRAFT: 1 }, bookings: {}, enquiries: {}, reviews: { averageRating: null, count: 0 } }),
  }));
  await page.route("**/api/v1/vendor/listings/listing-vendor-e2e/availability", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    }
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toBe("Bearer vendor-e2e-token");
    expect(route.request().postDataJSON()).toMatchObject({ capacity: 25 });
    return route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ item: { id: "availability-e2e", startsAt: "2030-05-01T09:00:00.000Z", endsAt: "2030-05-01T17:00:00.000Z", capacity: 25 } }),
    });
  });
  let deleted = false;
  await page.route("**/api/v1/vendor/listings/listing-vendor-e2e", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    expect(route.request().headers().authorization).toBe("Bearer vendor-e2e-token");
    deleted = true;
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/dashboard/vendor");
  await expect(page.getByRole("heading", { name: "E2E Catering Package" })).toBeVisible();
  await page.getByLabel("Starts").fill("2030-05-01T09:00");
  await page.getByLabel("Ends").fill("2030-05-01T17:00");
  await page.getByLabel("Capacity").fill("25");
  await page.getByRole("button", { name: "Add time slot" }).click();
  await expect(page.getByText(/Availability saved\./)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete listing" }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(page.getByRole("heading", { name: "E2E Catering Package" })).toHaveCount(0);
});

test("affiliate referral links copy and prefill the signup code", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    // Seed the affiliate session only for the dashboard navigation. Do not
    // recreate it when the same browser later opens the public referral URL.
    if (location.pathname !== "/dashboard/affiliate") return;
    localStorage.setItem("ess_user", JSON.stringify({
      id: "affiliate-e2e", email: "affiliate@example.test", name: "E2E Affiliate", role: "AFFILIATE",
    }));
    localStorage.setItem("ess_access_token", "affiliate-e2e-token");
  });
  await page.goto("/dashboard/affiliate");
  await page.getByLabel("Referral code").fill("PARTNER2026");
  await page.getByRole("button", { name: "Copy referral link" }).click();

  const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedLink).toContain("/auth/signup?ref=PARTNER2026");

  // Simulate the referred customer opening the shared link in a signed-out browser.
  await page.evaluate(() => {
    localStorage.removeItem("ess_user");
    localStorage.removeItem("ess_access_token");
  });
  await page.goto("/auth/signup?role=CLIENT&ref=PARTNER2026");
  const signupDialog = page.locator("#eph-auth-dialog");
  await expect(signupDialog).toBeVisible();
  await signupDialog.getByLabel("Full name").fill("Referred Customer");
  await signupDialog.getByLabel("Email address").fill("referred-customer@example.test");
  await signupDialog.getByLabel("Password").fill("StrongPass123!");
  await signupDialog.getByRole("button", { name: "Next" }).click();
  await expect(signupDialog.getByText("Step 2 of 3")).toBeVisible();
  await expect(signupDialog.getByLabel("Referral or partner code")).toHaveValue("PARTNER2026");
});
