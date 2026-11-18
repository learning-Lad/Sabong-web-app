import { test, expect, type Page } from "@playwright/test";
const farmId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const sessionId = "30000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  app_metadata: { provider: "email" },
  user_metadata: { farm_name: "Browser Farm" },
  created_at: new Date().toISOString(),
};
const token =
  [
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      role: "authenticated",
      session_id: sessionId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".") + ".test-signature";
async function mockCloud(page: Page) {
  const rows: Record<string, any[]> = {
    birds: [],
    pens: [],
    breeding: [],
    health: [],
    reminders: [],
    supplies: [],
  };
  let recoveryRequests = 0;
  await page.route("**/storage/v1/object/**", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=",
          "base64",
        ),
        contentType: "image/png",
      });
    return route.fulfill({ json: { Key: "farm-bird-photos/test-upload" } });
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("**/auth/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/token"))
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    if (path.endsWith("/recover")) {
      recoveryRequests++;
      return route.fulfill({ json: {} });
    }
    if (path.endsWith("/signup"))
      return route.fulfill({ json: { user, session: null } });
    return route.fulfill({ status: 204 });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method(),
      body = request.postDataJSON();
    if (url.pathname.includes("/rpc/")) {
      const fn = url.pathname.split("/").pop();
      if (fn === "app_adjust_supply") {
        const item = rows.supplies.find((row) => row.id === body.p_id);
        if (!item || item.quantity + body.p_delta < 0)
          return route.fulfill({
            status: 400,
            json: { message: "Stock cannot fall below zero.", code: "23514" },
          });
        item.quantity += body.p_delta;
        item.version++;
        return route.fulfill({ json: item });
      }
      if (fn === "app_log_care") {
        const item = rows.supplies.find((row) => row.id === body.p_supply_id);
        if (body.p_supply_id && (!item || item.quantity < body.p_quantity))
          return route.fulfill({
            status: 400,
            json: { message: "Stock cannot fall below zero.", code: "23514" },
          });
        if (item) {
          item.quantity -= body.p_quantity;
          item.version++;
        }
        const row = { ...body.p_record, version: 1 };
        rows.health.push(row);
        return route.fulfill({ json: row });
      }
      return route.fulfill({ json: null });
    }
    const table = url.pathname.split("/").pop()!.replace("app_", "");
    if (table === "farms")
      return route.fulfill({ json: { id: farmId, name: "Browser Farm" } });
    const records = rows[table];
    if (!records) throw new Error("Unexpected table: " + table);
    let selected = records.filter((row) =>
      ["id", "version"].every(
        (key) =>
          !url.searchParams.has(key) ||
          String(row[key]) === url.searchParams.get(key)!.replace("eq.", ""),
      ),
    );
    if (method === "POST") {
      const row = { ...body, version: 1, farm_id: farmId };
      records.push(row);
      selected = [row];
    }
    if (method === "PATCH")
      selected.forEach((row) => {
        Object.assign(row, body);
        row.version++;
      });
    if (method === "DELETE")
      rows[table] = records.filter((row) => !selected.includes(row));
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    return route.fulfill({ json: single ? (selected[0] ?? null) : selected });
  });
  await page.route("**/api/farm-assistant", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "The AI service is unavailable. Continue with manual care records.",
      },
    }),
  );
  return {
    rows,
    get recoveryRequests() {
      return recoveryRequests;
    },
  };
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Cloud connected")).toBeVisible();
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
async function createBird(page: Page, name = "Test bird") {
  await nav(page, "Bird directory");
  await page
    .getByRole("button", { name: "Register bird", exact: true })
    .click();
  await page.getByLabel("Bird name").fill(name);
  await page.getByLabel("Bloodline").selectOption("Kelso");
  await page.getByLabel("Color / markings").fill("White");
  await page.getByLabel("Hatch date").fill("2025-01-01");
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test("cloud bird records persist on reload; edit, unassign pen and validation work", async ({
  page,
}) => {
  const backend = await mockCloud(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await nav(page, "Bird directory");
  await page
    .getByRole("button", { name: "Register bird", exact: true })
    .click();
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await createBird(page);
  expect(backend.rows.birds).toHaveLength(1);
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByRole("button", { name: "Add a new pen" }).click();
  await page.getByLabel("Pen name").fill("New pen");
  await page.getByRole("button", { name: "Add pen", exact: true }).click();
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  expect(backend.rows.birds[0].penId).toBe(backend.rows.pens[0].id);
  await page.reload();
  await expect(page.getByText("Cloud connected")).toBeVisible();
  await nav(page, "Bird directory");
  await expect(
    page.getByRole("heading", { name: "Test bird", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Test bird/ }).click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Bird name").fill("Updated bird");
  await page.getByRole("dialog").getByLabel(/^Pen/).selectOption("");
  await page.getByLabel("Status").selectOption("Sold");
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated bird" }),
  ).toBeVisible();
  expect(backend.rows.birds[0].status).toBe("Sold");
  expect(backend.rows.birds[0].penId).toBe(null);
  expect(errors).toEqual([]);
});
test("care stock deductions, reminders, reports and AI failure keep manual records available", async ({
  page,
}) => {
  const backend = await mockCloud(page);
  await login(page);
  await createBird(page);
  await nav(page, "Supply tracker");
  await page.getByRole("button", { name: "Add supply", exact: true }).click();
  await page.getByLabel("Item name").fill("Farm feed");
  await page.getByLabel("Starting quantity").fill("10");
  await page.getByRole("button", { name: "Save supply", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Farm feed" })).toBeVisible();
  await nav(page, "Care & schedule");
  await page.getByRole("button", { name: "Log care", exact: true }).click();
  await page.getByLabel("Notes").fill("Routine care recorded");
  await page
    .getByLabel("Deduct supply")
    .selectOption(backend.rows.supplies[0].id);
  await page.getByLabel("Quantity used").fill("2.5");
  await page.getByRole("button", { name: "Save care log" }).click();
  await expect(
    page.getByText("Routine care recorded", { exact: true }),
  ).toBeVisible();
  expect(backend.rows.supplies[0].quantity).toBe(7.5);
  await page.getByRole("button", { name: "Set reminder", exact: true }).click();
  await page.getByLabel("Care task").fill("Weekly check");
  await page
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark Weekly check done" }).click();
  await expect(
    page.getByText("Weekly check", { exact: true }),
  ).not.toBeVisible();
  expect(backend.rows.reminders[0].done).toBe(true);
  await nav(page, "Reports");
  await expect(
    page.getByText("Browser Farm · Generated", { exact: false }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toContain("farm-birds");
  await nav(page, "Care assistant");
  await page.getByLabel("Your observations").fill("Routine observations");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Review observations", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("manual care records");
  await nav(page, "Care & schedule");
  await expect(page.getByText("Routine care recorded")).toBeVisible();
});
test("registration and recovery contact the auth service and show honest confirmation", async ({
  page,
}) => {
  const backend = await mockCloud(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  expect(backend.recoveryRequests).toBe(1);
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Farm name").fill("New Farm");
  await page.getByLabel("Email address").fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Create farm", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
});
test("demo and account data stay separate on sign-out", async ({ page }) => {
  await mockCloud(page);
  await login(page);
  await createBird(page, "Private bird");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the UI demo" }).click();
  await nav(page, "Bird directory");
  await expect(
    page.getByRole("heading", { name: "Private bird", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".roster-card")).toHaveCount(6);
});
test("mobile navigation, modal entry and report access fit the screen", async ({
  page,
}) => {
  await mockCloud(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the UI demo" }).click();
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobile
    .getByRole("button", { name: "Register bird", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await mobile.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("button", { name: /Reports Printable farm records/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-reports.png",
    fullPage: true,
  });
});

test("email recovery link accepts a new password and returns to sign-in", async ({
  page,
}) => {
  await mockCloud(page);
  await page.goto(
    "/#access_token=" +
      token +
      "&refresh_token=test-refresh&type=recovery&expires_in=3600&token_type=bearer",
  );
  await expect(
    page.getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("replacement123");
  await page
    .getByRole("button", { name: "Save new password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByText("Password updated. Sign in with your new password."),
  ).toBeVisible();
});

test("private photo upload survives profile reload without a public URL", async ({
  page,
}) => {
  const backend = await mockCloud(page);
  await login(page);
  await createBird(page, "Photo bird");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page
    .locator('dialog input[type="file"]')
    .first()
    .setInputFiles({
      name: "bird.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(page.locator(".profile-hero img")).toBeVisible();
  expect(backend.rows.birds[0].photoPath).toMatch(
    new RegExp("^" + farmId + "/"),
  );
  expect(backend.rows.birds[0].photo).toBeUndefined();
  await page.reload();
  await expect(page.getByText("Cloud connected")).toBeVisible();
  await nav(page, "Bird directory");
  await page.getByRole("button", { name: /Photo bird/ }).click();
  const image = page.locator(".profile-hero img");
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(1);
  await expect(image).toHaveAttribute("src", /^blob:/);
});

test("the local API bridge returns real HTTP method and authentication responses", async ({
  request,
}) => {
  const get = await request.get("/api/farm-assistant");
  expect(get.status()).toBe(405);
  expect(get.headers().allow).toBe("POST");
  const post = await request.post("/api/farm-assistant", {
    data: { observations: "Routine observations", consent: true },
  });
  expect(post.status()).toBe(401);
  expect((await post.json()).error).toContain("Sign in");
});
