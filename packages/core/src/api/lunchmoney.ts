import type { LunchMoneyConfig } from "../config/schema";
import type {
  Budget,
  Category,
  User,
  GetBudgetsResponse,
  GetCategoriesResponse,
  GetUserResponse,
} from "./types";

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
    this.baseUrl = config.baseUrl ?? "https://dev.lunchmoney.app";
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
    return this.request<GetUserResponse>("/v1/me");
  }

  /**
   * Get all categories.
   */
  async getCategories(): Promise<Category[]> {
    const response = await this.request<GetCategoriesResponse>("/v1/categories");
    return response.categories;
  }

  /**
   * Get budgets for a date range.
   *
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   */
  async getBudgets(startDate: string, endDate: string): Promise<Budget[]> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const response = await this.request<GetBudgetsResponse>(
      `/v1/budgets?${params.toString()}`
    );

    // Convert object to array
    return Object.values(response);
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
