/**
 * MarginGuard AI Copilot Shared Logic
 * Handles real-time unit economics calculations, CAC attribution analysis,
 * and AI price elasticity / inventory-aware repricing heuristics.
 */

/**
 * Calculates exact net contribution margin per unit/SKU.
 */
export function calculateSkuMargin({
  price,
  cogs,
  averageShippingCost,
  currentCac,
  paymentProcessingFeePercent = 2.9,
  paymentProcessingFeeFixed = 0.30,
}) {
  const p = parseFloat(price) || 0;
  const cost = parseFloat(cogs) || 0;
  const ship = parseFloat(averageShippingCost) || 0;
  const cac = parseFloat(currentCac) || 0;
  const feePct = parseFloat(paymentProcessingFeePercent) || 2.9;
  const feeFix = parseFloat(paymentProcessingFeeFixed) || 0.30;

  const paymentFee = (p * (feePct / 100)) + feeFix;
  const totalCosts = cost + ship + cac + paymentFee;
  const netMarginDollar = p - totalCosts;
  const netMarginPercent = p > 0 ? (netMarginDollar / p) * 100 : 0;
  const grossMarginDollar = p - cost;

  return {
    price: p.toFixed(2),
    cogs: cost.toFixed(2),
    averageShippingCost: ship.toFixed(2),
    currentCac: cac.toFixed(2),
    paymentFee: paymentFee.toFixed(2),
    totalCosts: totalCosts.toFixed(2),
    grossMarginDollar: grossMarginDollar.toFixed(2),
    netMarginDollar: netMarginDollar.toFixed(2),
    netMarginPercent: netMarginPercent.toFixed(2),
  };
}

/**
 * AI pricing engine that evaluates SKU health, inventory scarcity, and ad spend CAC
 * to generate dynamic repricing recommendations.
 */
export function analyzePriceElasticity({
  price,
  cogs,
  averageShippingCost,
  currentCac,
  inventoryLevel = 50,
  restockLeadTimeDays = 14,
  minTargetMarginPercent = 20.0,
}) {
  const p = parseFloat(price) || 0;
  const cost = parseFloat(cogs) || 0;
  const ship = parseFloat(averageShippingCost) || 0;
  const cac = parseFloat(currentCac) || 0;

  const margin = calculateSkuMargin({
    price: p,
    cogs: cost,
    averageShippingCost: ship,
    currentCac: cac,
  });

  const netPct = parseFloat(margin.netMarginPercent);
  const netDlr = parseFloat(margin.netMarginDollar);

  // Target price formula to hit minTargetMarginPercent
  // p - cost - ship - cac - (p * 0.029 + 0.30) = p * (target / 100)
  // p * (1 - 0.029 - target/100) = cost + ship + cac + 0.30
  const targetPrice = (cost + ship + cac + 0.30) / Math.max(0.1, 1 - 0.029 - (minTargetMarginPercent / 100));
  const roundedTarget = Math.ceil(targetPrice * 2) / 2 - 0.01; // format like $X.99 or $X.49

  let status = "OPTIMAL";
  let recommendedPrice = p;
  let rationale = `HEALTHY MARGIN: Net profit margin is ${netPct.toFixed(1)}% ($${netDlr.toFixed(2)}/order), exceeding target threshold.`;

  if (netDlr < 0) {
    status = "LOW_MARGIN_ALERT";
    recommendedPrice = Math.max(p + 5.0, roundedTarget);
    rationale = `🚨 CRITICAL LOSS: Customer Acquisition Cost ($${cac.toFixed(2)}) and shipping exceed gross margin. You are losing -$${Math.abs(netDlr).toFixed(2)} per unit sold! Recommend raising price to $${recommendedPrice.toFixed(2)} or pausing high-CAC ad campaigns immediately.`;
  } else if (netPct < minTargetMarginPercent) {
    status = "LOW_MARGIN_ALERT";
    recommendedPrice = Math.max(p * 1.06, roundedTarget);
    rationale = `⚠️ SUBPAR MARGIN: Net margin is ${netPct.toFixed(1)}%, which is below your ${minTargetMarginPercent}% target. Recommend raising price to $${recommendedPrice.toFixed(2)} to restore unit profitability.`;
  } else if (inventoryLevel <= 15 && restockLeadTimeDays >= 14) {
    status = "INVENTORY_PROTECTION_ACTIVE";
    recommendedPrice = Math.ceil((p * 1.05) * 2) / 2 - 0.01;
    rationale = `📦 SCARCITY ALERT: Only ${inventoryLevel} units in stock with a ${restockLeadTimeDays}-day restock lead time. Autonomously raising price by 5% ($${recommendedPrice.toFixed(2)}) slows sales velocity to prevent stockouts while capturing higher profit per unit.`;
  } else {
    status = "ELASTICITY_TEST_ACTIVE";
    recommendedPrice = Math.ceil((p + 1.50) * 2) / 2 - 0.01;
    rationale = `🔬 PROFIT OPTIMAL: Healthy margin of ${netPct.toFixed(1)}%. AI Copilot recommends initiating a micro-price elasticity A/B test at $${recommendedPrice.toFixed(2)} to test consumer price sensitivity and maximize Gross Margin Dollar Volume (GMDV).`;
  }

  return {
    status,
    recommendedPrice: recommendedPrice.toFixed(2),
    rationale,
    marginBreakdown: margin,
  };
}
