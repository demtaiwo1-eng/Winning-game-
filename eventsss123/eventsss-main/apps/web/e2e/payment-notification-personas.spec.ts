import { expect, test, type Page, type Route } from "@playwright/test";

type Persona = { index: number; role: "CLIENT" | "VENDOR"; email: string; };

const personas: Persona[] = Array.from({ length: 100 }, (_, index) => ({
  index: index + 1,
  role: index < 50 ? "CLIENT" : "VENDOR",
  email: `qa-payment-persona-${String(index + 1).padStart(3, "0")}@example.test`,
}));

async function unlock(page: Page) {
  const dialog = page.getByRole("dialog", { name: /Set your device PIN|App locked/ });
  await expect(dialog).toBeVisible();
  const heading = await dialog.locator("h1").textContent();
  await dialog.getByLabel("Six-digit PIN").fill("482731");
  if (heading?.includes("Set your device PIN")) {
    await page.waitForTimeout(150);
    await page.locator("#ephinta-device-pin-confirm").fill("482731", { force: true });
    await dialog.getByRole("button", { name: "Set PIN and continue" }).click();
  } else {
    await dialog.getByRole("button", { name: "Unlock EPHINTA" }).click();
  }
  await expect(dialog).toBeHidden();
}

async function mockApi(page: Page, persona: Persona) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(body),
    });

    if (path.endsWith("/auth/login") && req.method() === "POST") {
      return json({
        user: {
          id: `payment-persona-${persona.index}`,
          name: `Payment QA ${persona.index}`,
          email: persona.email,
          role: persona.role,
          country: "NG",
          currency: "NGN",
          locale: "en",
        },
        accessToken: `qa-payment-token-${persona.index}`,
        refreshToken: `qa-payment-refresh-${persona.index}`,
        expiresIn: 900,
      });
    }
    if (path.endsWith("/wallet") && req.method() === "GET") {
      return json({ items: [{ id: `wallet-${persona.index}`, currency: "NGN", availableMinor: "2500000", escrowMinor: "0", pendingMinor: "0" }] });
    }
    if (path.endsWith("/payments/payouts/banks")) return json({ items: [{ name: "QA Bank", code: "058", currency: "NGN" }] });
    if (path.endsWith("/payments/payouts") && req.method() === "GET") return json({ items: [] });
    if (path.endsWith("/payments/payouts/resolve-account")) {
      return json({ accountName: `QA Vendor ${persona.index}`, accountNumber: "******6789", bankCode: "058" });
    }
    if (path.endsWith("/payments/payouts") && req.method() === "POST") {
      const body = req.postDataJSON() as { amountMinor: string };
      const gross = BigInt(body.amountMinor);
      const fee = gross * 2n / 100n;
      return json({
        replayed: false,
        message: "Sandbox payout submitted",
        payout: {
          id: `payout-${persona.index}`,
          reference: `qa-payout-${persona.index}`,
          provider: "opay",
          amountMinor: gross.toString(),
          feeMinor: fee.toString(),
          netAmountMinor: (gross - fee).toString(),
          currency: "NGN",
          bankName: "QA Bank",
          accountName: `QA Vendor ${persona.index}`,
          accountNumber: "******6789",
          status: "PROCESSING",
          createdAt: "2026-11-13T00:00:00.000Z",
          updatedAt: "2026-11-13T00:00:00.000Z",
        },
      }, 202);
    }
    if (path.endsWith("/payments/intents") && req.method() === "POST") {
      return json({
        intent: { id: `intent-${persona.index}`, provider: "opay" },
        checkoutUrl: `https://sandbox-checkout.opayweb.com/qa/${persona.index}`,
        mode: "sandbox",
      }, 201);
    }
    if (path.endsWith("/notifications/preferences") && req.method() === "GET") {
      return json({ preferences: { inAppEnabled: true, pushEnabled: true, messages: true, bookings: true, payments: true, marketing: false } });
    }
    if (path.endsWith("/notifications/preferences") && req.method() === "PATCH") {
      return json({ preferences: { inAppEnabled: true, pushEnabled: true, messages: true, bookings: true, payments: true, marketing: false } });
    }
    if (path.includes("/notifications/") && req.method() === "PATCH") return json({ ok: true });
    if (path.endsWith("/notifications") || path.includes("/notifications?")) {
      return json({ items: [{
        id: `notice-${persona.index}`,
        type: "PAYMENT",
        title: "Payment status update",
        body: `QA payment event for persona ${persona.index}: awaiting provider confirmation.`,
        readAt: null,
        archivedAt: null,
        createdAt: "2026-11-13T00:00:00.000Z",
        deliveryStatus: "NOT_CONFIGURED",
      }] });
    }
    return json({ items: [], total: 0, pages: 0, summary: [] });
  });
}

for (const persona of personas) {
  test(`payment + notification click journey: persona ${String(persona.index).padStart(3, "0")} (${persona.role})`, async ({ page }) => {
    await mockApi(page, persona);
    await page.addInitScript((personaId) => {
      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element
          ? event.target.closest("button, a, input, select, label")
          : null;
        if (!target) return;
        const label = target.getAttribute("aria-label")
          || target.textContent?.trim().replace(/\\s+/g, " ").slice(0, 80)
          || target.tagName;
        console.log(`[QA-CLICK] persona ${personaId} -> ${label}`);
      }, true);
    }, persona.index);
    page.on("console", (message) => {
      if (message.type() === "log" && message.text().startsWith("[QA-CLICK]")) {
        console.log(message.text());
      }
    });
    await page.route("https://sandbox-checkout.opayweb.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>OPay sandbox checkout</title><main>Sandbox checkout test page</main>" }),
    );

    await page.goto(`/auth/signin?role=${persona.role}`);
    await page.getByLabel("Email").fill(persona.email);
    await page.getByRole("textbox", { name: "Password" }).fill("QaOnlyPassword123!");
    const login = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/auth/login"));
    await page.getByRole("textbox", { name: "Password" }).press("Enter");
    await login;
    await unlock(page);

    if (persona.role === "CLIENT") {
      await expect(page).toHaveURL(/\/dashboard\/client$/);
      await page.getByRole("button", { name: "Open payments and wallet" }).click();
      await expect(page.getByText("OPay deposit · 2% platform fee", { exact: false })).toBeVisible();
      await page.getByLabel("Amount (major units)").fill("10000");
      await expect(page.getByText(/2% platform fee/)).toBeVisible();
      await expect(page.getByText(/Wallet credit after fee/)).toBeVisible();
      await page.getByRole("button", { name: "Deposit to wallet with OPay" }).click();
      await expect(page.getByText(/Redirecting to OPay secure checkout/)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`sandbox-checkout\\.opayweb\\.com/qa/${persona.index}$`));
      // A redirect is not a settlement. Return to the app and verify the
      // wallet has not been optimistically credited before provider confirmation.
      await page.goto("/dashboard/client");
      await page.getByRole("button", { name: "Open Notifications" }).click();
    } else {
      await expect(page).toHaveURL(/\/dashboard\/vendor$/);
      await page.getByRole("button", { name: "Open Wallet & escrow" }).click();
      await expect(page.getByText(/2% platform fee is deducted from the gross amount/)).toBeVisible();
      await page.getByLabel("Withdrawal amount (NGN)").fill("10000");
      await page.getByLabel("Destination bank").selectOption("058");
      await page.getByLabel("Account number").fill("0482731789");
      await page.getByRole("button", { name: "Verify bank account" }).click();
      await expect(page.getByText(`QA Vendor ${persona.index}`)).toBeVisible();
      await page.getByLabel("I confirm this is the correct bank account.").check();
      await expect(page.getByText(/Estimated fee:/)).toBeVisible();
      await page.getByRole("button", { name: "Withdraw to bank" }).click();
      await expect(page.getByText(/Withdrawal processing:/)).toBeVisible();
      await expect(page.getByText(/98/)).toBeVisible();
      await page.getByRole("button", { name: "Open Notifications" }).click();
    }

    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText(`QA payment event for persona ${persona.index}: awaiting provider confirmation.`)).toBeVisible();
    await expect(page.getByText(/Push status: not configured/)).toBeVisible();
    await page.getByRole("button", { name: "Mark read" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Marked as read." })).toBeVisible();
  });
}
