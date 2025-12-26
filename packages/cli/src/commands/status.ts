import {
  loadConfig,
  getDefaultConfigPath,
  LunchMoneyClient,
  calculateBudgetUtilization,
} from "@lunchmonitor/core";

export interface StatusOptions {
  configPath?: string;
  showAll?: boolean;
}

export async function status(options: StatusOptions): Promise<number> {
  const configPath = options.configPath ?? getDefaultConfigPath();
  const { showAll = false } = options;

  try {
    console.log(`Loading config from: ${configPath}`);
    const config = await loadConfig(configPath);

    const client = new LunchMoneyClient(config.lunchmoney);

    console.log("Fetching budgets from LunchMoney...\n");
    const budgets = await client.getCurrentMonthBudgets(config.settings.timezone);

    // Filter and sort budgets
    const activeBudgets = budgets
      .filter((b) => !b.is_income && !b.exclude_from_budget && !b.archived)
      .map((b) => ({
        ...b,
        utilization: calculateBudgetUtilization(b),
      }))
      .filter((b) => showAll || b.utilization.budgetAmount > 0)
      .sort((a, b) => b.utilization.percentUsed - a.utilization.percentUsed);

    if (activeBudgets.length === 0) {
      console.log("No active budgets found.");
      return 0;
    }

    // Format currency
    const formatCurrency = (cents: number): string => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: config.settings.currency ?? "USD",
      }).format(cents / 100);
    };

    // Print header
    console.log("Category".padEnd(25) + "Spent".padStart(12) + "Budget".padStart(12) + "Used".padStart(8) + " Status");
    console.log("-".repeat(65));

    for (const budget of activeBudgets) {
      const { percentUsed, spentAmount, budgetAmount } = budget.utilization;

      // Determine status
      let status = "";
      if (budgetAmount === 0) {
        status = "No budget";
      } else if (percentUsed >= 100) {
        status = "🚨 EXCEEDED";
      } else if (percentUsed >= 80) {
        status = "⚠️  Warning";
      } else {
        status = "✓ OK";
      }

      const name = budget.category_name.substring(0, 24).padEnd(25);
      const spent = formatCurrency(spentAmount).padStart(12);
      const budgetStr = budgetAmount > 0 ? formatCurrency(budgetAmount).padStart(12) : "-".padStart(12);
      const pctStr = budgetAmount > 0 ? `${percentUsed.toFixed(0)}%`.padStart(8) : "-".padStart(8);

      console.log(`${name}${spent}${budgetStr}${pctStr} ${status}`);
    }

    console.log("-".repeat(65));

    // Summary
    const total = activeBudgets.reduce(
      (acc, b) => ({
        spent: acc.spent + b.utilization.spentAmount,
        budget: acc.budget + b.utilization.budgetAmount,
      }),
      { spent: 0, budget: 0 }
    );

    const totalPct = total.budget > 0 ? ((total.spent / total.budget) * 100).toFixed(0) : "N/A";
    console.log(
      `${"Total".padEnd(25)}${formatCurrency(total.spent).padStart(12)}${formatCurrency(total.budget).padStart(12)}${(totalPct + "%").padStart(8)}`
    );

    // Count warnings/exceeded
    const exceeded = activeBudgets.filter((b) => b.utilization.percentUsed >= 100).length;
    const warnings = activeBudgets.filter(
      (b) => b.utilization.percentUsed >= 80 && b.utilization.percentUsed < 100
    ).length;

    if (exceeded > 0 || warnings > 0) {
      console.log(`\n${exceeded} exceeded, ${warnings} warning(s)`);
    }

    return 0;
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    return 1;
  }
}
