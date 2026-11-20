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
    flocks: [],
    flock_tasks: [],
    flock_checks: [],
    egg_collections: [],
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
  await page.getByRole("combobox", { name: "Breed *", exact: true }).selectOption("Mixed / Crossbreed");
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
  expect(backend.rows.birds[0]).toMatchObject({ breed: "Mixed / Crossbreed", bloodline: "", flockId: null });
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
  await page.getByRole("combobox", { name: "Breed *", exact: true }).selectOption({ label: "Other" });
  const breedName = page.getByRole("textbox", { name: /^Breed name/ });
  await expect(breedName).toHaveValue("");
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(breedName).toHaveAttribute("aria-invalid", "true");
  await breedName.fill("Silkie");
  await page.getByRole("dialog").getByLabel(/^Pen/).selectOption("");
  await page.getByLabel("Status").selectOption("Sold");
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated bird" }),
  ).toBeVisible();
  expect(backend.rows.birds[0]).toMatchObject({ status: "Sold", breed: "Silkie" });
  expect(backend.rows.birds[0].penId).toBe(null);
  expect(errors).toEqual([]);
});
test("flocks and custom breed records survive reload and filter the dashboard and directory", async ({ page }) => {
  const { rows } = await mockCloud(page);
  rows.birds.push({
    id: "LEGACY", name: "Legacy bird", breed: "Gamefowl", bloodline: "Sweater × Kelso",
    sex: "Male", color: "Brown", hatchDate: "2024-01-01", status: "Active", weight: 1,
    version: 1,
  });
  await login(page);
  await nav(page, "Bird directory");
  await page.getByRole("button", { name: "Add flock", exact: true }).click();
  await page.getByLabel("Flock name").fill("Backyard");
  await page.getByRole("button", { name: "Save flock" }).click();
  await expect(page.getByLabel("Filter by flock")).toHaveValue(/^F-/);
  await expect(page.getByRole("heading", { name: "Legacy bird" })).toHaveCount(0);
  await page.getByLabel("Filter by flock").selectOption({ label: "Unassigned birds" });
  await page.getByRole("button", { name: /Legacy bird/ }).click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page.getByRole("textbox", { name: "Breed name *", exact: true })).toHaveValue("Gamefowl");
  await expect(page.getByLabel("Strain or bloodline")).toHaveValue("Sweater × Kelso");
  await page.getByRole("combobox", { name: "Flock (optional)", exact: true }).selectOption({ label: "Backyard" });
  await page.getByRole("button", { name: "Save bird", exact: true }).click();
  await expect(page.getByText("Backyard", { exact: true })).toBeVisible();
  expect(rows.birds[0]).toMatchObject({ breed: "Gamefowl", bloodline: "Sweater × Kelso", flockId: rows.flocks[0].id });
  await page.reload();
  await expect(page.getByText("Cloud connected")).toBeVisible();
  await page.getByLabel("Filter by flock").selectOption({ label: "Backyard" });
  await expect(page.getByRole("button", { name: /Legacy bird/ })).toBeVisible();
  await page.getByRole("button", { name: /View all/ }).click();
  await expect(page.getByLabel("Filter by flock")).toHaveValue(rows.flocks[0].id);
  await page.getByRole("button", { name: "Rename flock" }).click();
  await page.getByLabel("Flock name").fill("Home flock");
  await page.getByRole("button", { name: "Save flock" }).click();
  await expect(page.getByRole("button", { name: /Legacy bird.*Home flock/ })).toBeVisible();
  expect(rows.flocks[0].name).toBe("Home flock");
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
test("flock checklist and egg counts save, reload, and stay scoped to the chosen flock", async ({ page }) => {
  const { rows } = await mockCloud(page);
  await login(page);
  await nav(page, "Care & schedule");
  await page.getByRole("button", { name: "Open checklist" }).click();
  await page.getByRole("button", { name: "Add flock", exact: true }).click();
  await page.getByLabel("Flock name").fill("Layers");
  await page.getByRole("button", { name: "Save flock" }).click();
  const firstFlock = page.getByRole("combobox", { name: "Flock", exact: true });
  await expect(firstFlock).toHaveValue(/^F-/);
  rows.flocks.push({ id: "F2", name: "Backyard" });
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("textbox", { name: /Task name/ }).fill("Check water");
  await page.getByRole("button", { name: "Save task" }).click();
  const task = page.getByRole("button", { name: "Check water completed today" });
  await task.click();
  await expect(task).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Log eggs" }).click();
  await page.getByRole("spinbutton", { name: /Eggs collected/ }).fill("0");
  await page.getByRole("button", { name: "Save collection" }).click();
  await expect(page.getByRole("button", { name: "Edit count" })).toBeVisible();
  await page.getByRole("button", { name: "Edit count" }).click();
  await page.getByRole("spinbutton", { name: /Eggs collected/ }).fill("7");
  await page.getByRole("textbox", { name: "Notes (optional)" }).fill("Morning round");
  await page.getByRole("button", { name: "Save collection" }).click();
  await expect(page.getByText("7 eggs recorded in the last 7 days")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cloud connected")).toBeVisible();
  await nav(page, "Flock records");
  await expect(task).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Morning round")).toBeVisible();
  await task.click();
  await expect(task).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("combobox", { name: "Flock", exact: true }).selectOption("F2");
  await expect(task).toHaveCount(0);
  await expect(page.getByText("0 eggs recorded in the last 7 days")).toBeVisible();
  expect(rows.egg_collections).toHaveLength(1);
  expect(rows.egg_collections[0]).toMatchObject({ flockId: rows.flocks[0].id, count: 7 });
});

test("bird care printing includes all individual records and excludes unrelated care", async ({ page }) => {
  await page.addInitScript(() => { window.print = () => document.body.setAttribute("data-print-invoked", "yes"); });
  const { rows } = await mockCloud(page);
  await login(page);
  await createBird(page, "Print bird");
  for (let i = 1; i <= 4; i++) rows.health.push({
    id: "H" + i, targetType: "bird", targetId: rows.birds[0].id, category: "Routine care",
    date: "2025-02-0" + i, notes: "Care note " + i,
  });
  rows.health.push({ id: "H5", targetType: "pen", targetId: "P1", category: "Routine care", date: "2025-02-05", notes: "Pen-only note" });
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByText("Care note 4").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Print care history" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-invoked", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: "Care history for Print bird" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(5);
  await expect(page.getByRole("row", { name: /Pen-only note/ })).toHaveCount(0);
});

test("notification bell counts low stock and links to the inventory", async ({ page }) => {
  const { rows } = await mockCloud(page);
  rows.supplies.push({ id: "FEED", name: "Feed", quantity: 2, reorderLevel: 2, unit: "kg", category: "Feed", version: 1 });
  rows.reminders.push({ id: "CARE", birdId: "UNKNOWN", description: "Care reminder", dueDate: "2025-02-01", done: false });
  await login(page);
  const supplyBadge = page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Supply tracker" }).locator(".nav-count");
  await expect(supplyBadge).toHaveText("1");
  const bell = page.getByLabel("Notifications (2)");
  await expect(bell.locator(".notification-count")).toHaveText("2");
  await bell.click();
  await expect(page.getByRole("button", { name: "1 open care reminder" })).toBeVisible();
  await page.getByRole("button", { name: "1 item needs restocking" }).click();
  await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "1 item needs restocking" })).not.toBeVisible();
  rows.supplies[0].quantity = 6;
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByLabel("Notifications (1)").locator(".notification-count")).toHaveText("1");
  await expect(supplyBadge).toHaveCount(0);
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
  await mobile.getByRole("button", { name: "Care", exact: true }).click();
  await page.getByRole("button", { name: "Open checklist" }).click();
  await expect(page.getByRole("heading", { name: "Flock care checklist" })).toBeVisible();
  await mobile.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("button", { name: /Supply tracker/ }).locator(".nav-count")).toHaveText("2");
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
