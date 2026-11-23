import type { LunchMoneyConfig } from "../config/schema";
import type {
  Budget,
  Category,
  User,
  GetCategoriesResponse,
  GetSummaryResponse,
  GetUserResponse,
  SummaryCategory,
} from "./types";
import { resolveBaseUrl } from "./base-url";

export { DEFAULT_BASE_URL, resolveBaseUrl } from "./base-url";

export class LunchMoneyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`LunchMoney API error (${status}): ${body}`);
    this.name = "LunchMoneyApiError";
  }
}

export class LunchMoneyClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: LunchMoneyConfig) {
    this.baseUrl = resolveBaseUrl(config.baseUrl);
    this.token = config.apiToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new LunchMoneyApiError(response.status, body);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get current user information.
   * Useful for testing API connection.
   */
  async getUser(): Promise<User> {
    return this.request<GetUserResponse>("/me");
  }

  /**
   * Get all categories as a flat list (groups and their children side by side).
   */
  async getCategories(): Promise<Category[]> {
    const response = await this.request<GetCategoriesResponse>(
      "/categories?format=flattened"
    );
    return response.categories;
  }

  /**
   * Get the budget summary for a date range (v2 `/summary`).
   */
  async getSummary(startDate: string, endDate: string): Promise<GetSummaryResponse> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    return this.request<GetSummaryResponse>(`/summary?${params.toString()}`);
  }

  /**
   * Get per-category budgets for a date range.
   *
   * v2 has no `/budgets` read endpoint: budgeted amounts and activity come from
   * `/summary`, and names and flags from `/categories`.
   *
   * Throws if the range does not line up with the account's budget periods
   * (`aligned: false`): the API then omits budget amounts, and every category
   * would silently look unbudgeted. A calendar month is aligned for monthly
   * budgets anchored on the 1st.
   *
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   */
  async getBudgets(startDate: string, endDate: string): Promise<Budget[]> {
    const [summary, categories] = await Promise.all([
      this.getSummary(startDate, endDate),
      this.getCategories(),
    ]);
    if (!summary.aligned) {
      throw new Error(
        `Lunch Money budget periods do not line up with ${startDate}..${endDate}, so the API ` +
          "returned no budget amounts. LunchMonitor checks calendar months; set the budget " +
          "period in Lunch Money to monthly, starting on the 1st."
      );
    }
    return summaryToBudgets(summary.categories, categories, startDate);
  }

  /**
   * Get budgets for the current month.
   */
  async getCurrentMonthBudgets(timezone: string = "UTC"): Promise<Budget[]> {
    const { startDate, endDate } = getCurrentMonthRange(timezone);
    return this.getBudgets(startDate, endDate);
  }

  /**
   * Test the API connection.
   * Returns user info if successful, throws on failure.
   */
  async testConnection(): Promise<{ success: true; user: User }> {
    const user = await this.getUser();
    return { success: true, user };
  }
}

/**
 * Combine v2 summary rows with category metadata into Budget objects.
 *
 * Spending is `other_activity + recurring_activity`, in the primary currency's
 * major unit (e.g. dollars), positive for money out. A group row's activity and
 * budget are the sums of its children's.
 */
export function summaryToBudgets(
  rows: SummaryCategory[],
  categories: Category[],
  periodStart: string
): Budget[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const budgets: Budget[] = [];

  for (const row of rows) {
    const category = byId.get(row.category_id);
    if (!category) continue;
    const group = category.group_id != null ? byId.get(category.group_id) : undefined;
    const { totals } = row;

    budgets.push({
      category_name: category.name,
      category_id: category.id,
      category_group_name: group?.name ?? null,
      group_id: category.group_id,
      is_group: category.is_group,
      is_income: category.is_income,
      exclude_from_budget: category.exclude_from_budget,
      exclude_from_totals: category.exclude_from_totals,
      archived: category.archived,
      order: category.order ?? 0,
      data: [
        {
          budget_month: periodStart,
          budget_to_base: totals.budgeted ?? 0,
          budget_amount: totals.budgeted ?? null,
          budget_currency: null,
          spending_to_base: totals.other_activity + totals.recurring_activity,
        },
      ],
      config: null,
      recurring: null,
    });
  }

  return budgets;
}

/**
 * Drop group rows that have at least one child row in `budgets`.
 *
 * A group's row is the sum of its children, so counting or alerting on both
 * reports the same money twice. Groups whose children are all absent (e.g.
 * filtered out as unbudgeted) are kept.
 */
export function withoutRedundantGroups<T extends Budget>(budgets: T[]): T[] {
  const parents = new Set(budgets.map((b) => b.group_id).filter((id) => id != null));
  return budgets.filter((b) => !(b.is_group && parents.has(b.category_id)));
}

/**
 * Get the date range for the current month.
 */
export function getCurrentMonthRange(timezone: string = "UTC"): {
  startDate: string;
  endDate: string;
} {
  // Get current date in the specified timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? now.getFullYear().toString();
  const month = parts.find((p) => p.type === "month")?.value ?? (now.getMonth() + 1).toString().padStart(2, "0");

  // First day of current month
  const startDate = `${year}-${month}-01`;

  // Last day of current month
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month}-${lastDay.toString().padStart(2, "0")}`;

  return { startDate, endDate };
}

/**
 * Calculate budget utilization percentage.
 */
export function calculateBudgetUtilization(budget: Budget): {
  budgetAmount: number;
  spentAmount: number;
  percentUsed: number;
  remaining: number;
} {
  // Get the first (and usually only) data entry for the month
  const data = budget.data[0];

  if (!data || data.budget_to_base === 0) {
    return {
      budgetAmount: 0,
      spentAmount: data?.spending_to_base ?? 0,
      percentUsed: 0,
      remaining: 0,
    };
  }

  const budgetAmount = data.budget_to_base;
  const spentAmount = data.spending_to_base;
  const percentUsed = (spentAmount / budgetAmount) * 100;
  const remaining = budgetAmount - spentAmount;

  return {
    budgetAmount,
    spentAmount,
    percentUsed,
    remaining,
  };
}
