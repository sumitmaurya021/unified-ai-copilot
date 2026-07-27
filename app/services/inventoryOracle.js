/**
 * InventoryOracle AI Copilot Shared Logic
 * Handles supply chain stockout forecasting, reorder point calculation,
 * and autonomous purchase order (PO) generation heuristics.
 */

/**
 * Calculates stockout days, reorder point units, and recommended PO sizes.
 */
export function calculateInventoryForecast({
  currentStock = 12,
  dailySalesVelocity = 4.5,
  supplierLeadTimeDays = 14,
  bufferStockDays = 14,
}) {
  const predictedStockoutDays = dailySalesVelocity > 0 ? Math.round(currentStock / dailySalesVelocity) : 999;
  const reorderPointUnits = Math.round(dailySalesVelocity * (supplierLeadTimeDays + bufferStockDays));
  const recommendedPoUnits = Math.round(dailySalesVelocity * 60); // 60 days supply restock
  const workingCapitalUsd = Math.round(currentStock * 35.0); // estimated at avg $35 COGS per unit

  return {
    predictedStockoutDays,
    reorderPointUnits,
    recommendedPoUnits,
    workingCapitalUsd,
  };
}

/**
 * Autonomously categorizes inventory health and recommends PO dispatch or clearance sales.
 */
export function evaluateInventoryHealth({
  productTitle = "",
  currentStock = 12,
  dailySalesVelocity = 4.5,
  supplierLeadTimeDays = 14,
}) {
  const forecast = calculateInventoryForecast({
    currentStock,
    dailySalesVelocity,
    supplierLeadTimeDays,
  });

  let stockStatus = "HEALTHY_BUFFER";
  let aiActionRecommendation = "MAINTAIN_CURRENT_STOCK";
  let poStatus = "NONE";
  let rationale = `✅ HEALTHY BUFFER: Current stock (${currentStock} units) covers ${forecast.predictedStockoutDays} days of sales. Reorder threshold is set at ${forecast.reorderPointUnits} units.`;

  if (forecast.predictedStockoutDays <= supplierLeadTimeDays) {
    stockStatus = "CRITICAL_STOCKOUT_IMMINENT";
    aiActionRecommendation = "EMERGENCY_PO_DISPATCH";
    poStatus = "DRAFT_AI";
    rationale = `🚨 STOCKOUT ALERT: At current velocity (${dailySalesVelocity} units/day), stockout will occur in ${forecast.predictedStockoutDays} days—before the ${supplierLeadTimeDays}-day supplier lead time! Emergency PO of ${forecast.recommendedPoUnits} units ($${forecast.recommendedPoUnits * 35}) generated to prevent ad spend bleed and SEO ranking collapse.`;
  } else if (currentStock >= forecast.reorderPointUnits * 3 || (forecast.predictedStockoutDays > 90 && dailySalesVelocity < 0.5)) {
    stockStatus = "OVERSTOCKED_DEAD_CAPITAL";
    aiActionRecommendation = "INITIATE_CLEARANCE_BUNDLE";
    poStatus = "NONE";
    rationale = `📦 DEAD STOCK DETECTED: Over ${forecast.predictedStockoutDays} days of inventory (${currentStock} units tying up $${forecast.workingCapitalUsd} capital). Recommending an immediate 20% bundle discount via PulseAI & MarginGuard to free up warehouse shelves.`;
  }

  return {
    ...forecast,
    stockStatus,
    aiActionRecommendation,
    poStatus,
    rationale,
  };
}
