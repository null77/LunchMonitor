/**
 * LunchMoney API Types (v2)
 * Based on https://lunchmoney.dev/ (API root https://api.lunchmoney.dev/v2) and the
 * `@lunch-money/v2-api-spec` OpenAPI spec. Money values are in the account's primary
 * currency, in major units (e.g. dollars, not cents).
 */

// Category types (`GET /categories?format=flattened`)
export interface Category {
  id: number;
  name: string;
  description: string | null;
  is_income: boolean;
  exclude_from_budget: boolean;
  exclude_from_totals: boolean;
  archived: boolean;
  archived_at: string | null;
  updated_at: string;
  created_at: string;
  is_group: boolean;
  group_id: number | null;
  order: number | null;
  collapsed?: boolean;
  children?: Category[];
}

// Summary types (`GET /summary`)
export interface SummaryCategoryTotals {
  other_activity: number;
  recurring_activity: number;
  recurring_remaining: number;
  recurring_expected: number;
  /** Omitted when the response is not aligned to budget periods. */
  budgeted?: number | null;
  available?: number | null;
}

export interface SummaryCategory {
  category_id: number;
  totals: SummaryCategoryTotals;
}

export interface GetSummaryResponse {
  /** True when the range matches the account's budget periods; budget data is only complete then. */
  aligned: boolean;
  categories: SummaryCategory[];
}

// LunchMonitor's per-category budget view, built from `/summary` + `/categories`.
export interface BudgetDataEntry {
  budget_month: string; // "YYYY-MM-DD", start of the period
  budget_to_base: number;
  budget_amount: number | null;
  budget_currency: string | null;
  spending_to_base: number;
  num_transactions?: number;
}

export interface BudgetConfigEntry {
  config_id: number;
  cadence: string;
  amount: number;
  currency: string;
  to_base: number;
  auto_suggest: string;
}

export interface Budget {
  category_name: string;
  category_id: number;
  category_group_name: string | null;
  group_id: number | null;
  is_group: boolean;
  is_income: boolean;
  exclude_from_budget: boolean;
  exclude_from_totals: boolean;
  data: BudgetDataEntry[];
  config: BudgetConfigEntry | null;
  order: number;
  archived: boolean;
  recurring: RecurringExpense[] | null;
}

export interface RecurringExpense {
  id: number;
  start_date: string;
  end_date: string | null;
  cadence: string;
  payee: string;
  amount: number;
  currency: string;
  to_base: number;
}

// User info (`GET /me`)
export interface User {
  id: number;
  name: string;
  email: string;
  account_id: number;
  budget_name: string;
  primary_currency: string;
  api_key_label: string | null;
}

// API error response
export interface ApiError {
  message: string;
  errors?: { errMsg?: string }[];
}

// API response types
export interface GetCategoriesResponse {
  categories: Category[];
}

export interface GetUserResponse extends User {}
