import { describe, test, expect } from "bun:test";
import {
  getCurrentMonthRange,
  calculateBudgetUtilization,
} from "./lunchmoney";
import type { Budget } from "./types";

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
