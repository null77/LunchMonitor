import { describe, test, expect, afterEach } from "bun:test";
import {
  getCurrentMonthRange,
  calculateBudgetUtilization,
  summaryToBudgets,
  withoutRedundantGroups,
  resolveBaseUrl,
  DEFAULT_BASE_URL,
  LunchMoneyClient,
  LunchMoneyApiError,
} from "./lunchmoney";
import type { Budget, Category, SummaryCategory } from "./types";

describe("getCurrentMonthRange", () => {
  test("returns valid date range", () => {
    const { startDate, endDate } = getCurrentMonthRange("UTC");

    // Check format YYYY-MM-DD
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("start date is first of month", () => {
    const { startDate } = getCurrentMonthRange("UTC");
    expect(startDate.endsWith("-01")).toBe(true);
  });

  test("end date is after start date", () => {
    const { startDate, endDate } = getCurrentMonthRange("UTC");
    expect(new Date(endDate) >= new Date(startDate)).toBe(true);
  });

  test("works with different timezones", () => {
    const utc = getCurrentMonthRange("UTC");
    const ny = getCurrentMonthRange("America/New_York");
    const tokyo = getCurrentMonthRange("Asia/Tokyo");

    // All should return valid ranges
    expect(utc.startDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(ny.startDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(tokyo.startDate).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe("calculateBudgetUtilization", () => {
  const createBudget = (budgetAmount: number, spentAmount: number): Budget => ({
    category_name: "Test Category",
    category_id: 1,
    category_group_name: null,
    group_id: null,
    is_group: false,
    is_income: false,
    exclude_from_budget: false,
    exclude_from_totals: false,
    data: [
      {
        budget_month: "2024-01-01",
        budget_to_base: budgetAmount,
        budget_amount: budgetAmount,
        budget_currency: "USD",
        spending_to_base: spentAmount,
        num_transactions: 5,
      },
    ],
    config: null,
    order: 0,
    archived: false,
    recurring: null,
  });

  test("calculates 50% utilization", () => {
    const budget = createBudget(10000, 5000); // $100 budget, $50 spent
    const result = calculateBudgetUtilization(budget);

    expect(result.budgetAmount).toBe(10000);
    expect(result.spentAmount).toBe(5000);
    expect(result.percentUsed).toBe(50);
    expect(result.remaining).toBe(5000);
  });

  test("calculates 100% utilization", () => {
    const budget = createBudget(10000, 10000);
    const result = calculateBudgetUtilization(budget);

    expect(result.percentUsed).toBe(100);
    expect(result.remaining).toBe(0);
  });

  test("calculates over 100% utilization", () => {
    const budget = createBudget(10000, 15000); // $100 budget, $150 spent
    const result = calculateBudgetUtilization(budget);

    expect(result.percentUsed).toBe(150);
    expect(result.remaining).toBe(-5000);
  });

  test("handles zero budget", () => {
    const budget = createBudget(0, 5000);
    const result = calculateBudgetUtilization(budget);

    expect(result.budgetAmount).toBe(0);
    expect(result.spentAmount).toBe(5000);
    expect(result.percentUsed).toBe(0);
    expect(result.remaining).toBe(0);
  });

  test("handles zero spending", () => {
    const budget = createBudget(10000, 0);
    const result = calculateBudgetUtilization(budget);

    expect(result.percentUsed).toBe(0);
    expect(result.remaining).toBe(10000);
  });

  test("handles empty data array", () => {
    const budget: Budget = {
      category_name: "Empty",
      category_id: 1,
      category_group_name: null,
      group_id: null,
      is_group: false,
      is_income: false,
      exclude_from_budget: false,
      exclude_from_totals: false,
      data: [],
      config: null,
      order: 0,
      archived: false,
      recurring: null,
    };

    const result = calculateBudgetUtilization(budget);
    expect(result.budgetAmount).toBe(0);
    expect(result.percentUsed).toBe(0);
  });
});

const category = (id: number, name: string, options: Partial<Category> = {}): Category => ({
  id,
  name,
  description: null,
  is_income: false,
  exclude_from_budget: false,
  exclude_from_totals: false,
  archived: false,
  archived_at: null,
  updated_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  is_group: false,
  group_id: null,
  order: 0,
  ...options,
});

const row = (category_id: number, budgeted: number | null, other: number, recurring = 0): SummaryCategory => ({
  category_id,
  totals: {
    other_activity: other,
    recurring_activity: recurring,
    recurring_remaining: 0,
    recurring_expected: recurring,
    budgeted,
    available: (budgeted ?? 0) - other - recurring,
  },
});

const CATEGORIES = [
  category(10, "Food", { is_group: true }),
  category(11, "Groceries", { group_id: 10 }),
  category(20, "Salary", { is_income: true }),
];

describe("summaryToBudgets", () => {
  test("maps summary rows to budgets with names, groups and flags", () => {
    const budgets = summaryToBudgets(
      [row(10, 500, 300, 100), row(11, 500, 300, 100), row(20, null, -4000)],
      CATEGORIES,
      "2026-11-01"
    );

    expect(budgets).toHaveLength(3);
    const groceries = budgets.find((b) => b.category_id === 11)!;
    expect(groceries.category_name).toBe("Groceries");
    expect(groceries.category_group_name).toBe("Food");
    expect(groceries.group_id).toBe(10);
    expect(groceries.data[0]).toMatchObject({
      budget_month: "2026-11-01",
      budget_to_base: 500,
      budget_amount: 500,
      spending_to_base: 400, // other + recurring activity
    });
    expect(budgets.find((b) => b.category_id === 10)!.is_group).toBe(true);
    expect(budgets.find((b) => b.category_id === 20)!.is_income).toBe(true);
  });

  test("treats a null budget as no budget", () => {
    const [budget] = summaryToBudgets([row(11, null, 250)], CATEGORIES, "2026-11-01");
    expect(budget.data[0].budget_amount).toBeNull();
    expect(calculateBudgetUtilization(budget)).toMatchObject({
      budgetAmount: 0,
      spentAmount: 250,
      percentUsed: 0,
    });
  });

  test("computes utilization from summary amounts (decimal dollars)", () => {
    const [budget] = summaryToBudgets([row(11, 400, 340.5, 19.5)], CATEGORIES, "2026-11-01");
    expect(calculateBudgetUtilization(budget)).toEqual({
      budgetAmount: 400,
      spentAmount: 360,
      percentUsed: 90,
      remaining: 40,
    });
  });

  test("skips summary rows for unknown categories", () => {
    expect(summaryToBudgets([row(999, 100, 50)], CATEGORIES, "2026-11-01")).toEqual([]);
  });

  test("treats an omitted budget (non-aligned response) as null, not undefined", () => {
    const unaligned: SummaryCategory = {
      category_id: 11,
      totals: { other_activity: 10, recurring_activity: 0, recurring_remaining: 0, recurring_expected: 0 },
    };
    const [budget] = summaryToBudgets([unaligned], CATEGORIES, "2026-11-01");
    expect(budget.data[0].budget_amount).toBeNull();
    expect(budget.data[0].budget_to_base).toBe(0);
  });
});

describe("withoutRedundantGroups", () => {
  const budgets = summaryToBudgets(
    [row(10, 500, 400), row(11, 500, 400), row(30, 200, 50), row(40, 100, 20)],
    [...CATEGORIES, category(30, "Travel", { is_group: true }), category(40, "Gifts")],
    "2026-11-01"
  );

  test("drops a group whose children are present and keeps the rest", () => {
    expect(withoutRedundantGroups(budgets).map((b) => b.category_id)).toEqual([11, 30, 40]);
  });

  test("keeps a group when its children were filtered out", () => {
    const onlyGroup = budgets.filter((b) => b.category_id !== 11);
    expect(withoutRedundantGroups(onlyGroup).map((b) => b.category_id)).toEqual([10, 30, 40]);
  });
});

describe("resolveBaseUrl", () => {
  test("defaults to v2", () => {
    expect(resolveBaseUrl(undefined)).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl("")).toBe(DEFAULT_BASE_URL);
  });

  test("maps legacy v1 hosts to v2", () => {
    for (const legacy of ["https://dev.lunchmoney.app", "https://dev.lunchmoney.app/", "https://dev.lunchmoney.app/v1"]) {
      expect(resolveBaseUrl(legacy)).toBe(DEFAULT_BASE_URL);
    }
  });

  test("keeps other URLs, minus trailing slashes", () => {
    expect(resolveBaseUrl("https://example.test/v2//")).toBe("https://example.test/v2");
  });
});

describe("LunchMoneyClient (v2)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const stubFetch = (responses: Record<string, unknown>, calls: string[], auth: (string | null)[] = []) => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      auth.push(new Headers(init?.headers).get("Authorization"));
      const path = new URL(url).pathname.replace(/^\/v2/, "");
      if (!(path in responses)) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(responses[path]), { status: 200 });
    }) as typeof fetch;
  };

  test("getBudgets calls v2 /summary and flattened /categories", async () => {
    const calls: string[] = [];
    const auth: (string | null)[] = [];
    stubFetch(
      {
        "/summary": { aligned: true, categories: [row(11, 500, 450)] },
        "/categories": { categories: CATEGORIES },
      },
      calls,
      auth
    );

    const client = new LunchMoneyClient({ apiToken: "test" });
    const budgets = await client.getBudgets("2026-11-01", "2026-11-30");

    expect(calls.sort()).toEqual([
      "https://api.lunchmoney.dev/v2/categories?format=flattened",
      "https://api.lunchmoney.dev/v2/summary?start_date=2026-11-01&end_date=2026-11-30",
    ]);
    expect(auth).toEqual(["Bearer test", "Bearer test"]);
    expect(budgets).toHaveLength(1);
    expect(calculateBudgetUtilization(budgets[0]).percentUsed).toBe(90);
  });

  test("getUser calls v2 /me and honours a custom base URL", async () => {
    const calls: string[] = [];
    stubFetch({ "/me": { id: 1, name: "Test", budget_name: "Budget" } }, calls);

    const client = new LunchMoneyClient({ apiToken: "test", baseUrl: "https://example.test/v2/" });
    const user = await client.getUser();

    expect(calls).toEqual(["https://example.test/v2/me"]);
    expect(user.name).toBe("Test");
  });

  test("getBudgets throws when the summary is not aligned to budget periods", async () => {
    stubFetch(
      { "/summary": { aligned: false, categories: [] }, "/categories": { categories: CATEGORIES } },
      []
    );
    const client = new LunchMoneyClient({ apiToken: "test" });
    await expect(client.getBudgets("2026-11-01", "2026-11-30")).rejects.toThrow(/do not line up/);
  });

  test("throws LunchMoneyApiError with status and body on non-2xx", async () => {
    stubFetch({}, []);
    const client = new LunchMoneyClient({ apiToken: "test" });
    const error = await client.getUser().catch((e) => e);
    expect(error).toBeInstanceOf(LunchMoneyApiError);
    expect(error).toMatchObject({ status: 404, body: "not found" });
  });
});
