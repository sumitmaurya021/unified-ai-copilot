/**
 * AdSpend Guardian AI Copilot Shared Logic
 * Handles true net ROAS math (integrating COGS from MarginGuard and returns from ReturnGuard)
 * and autonomous ad budget allocation heuristics across Meta, Google, and TikTok.
 */

/**
 * Calculates true net ad economics after subtracting return losses, COGS, and processing fees.
 */
export function calculateTrueAdEconomics({
  dailyBudgetUsd = 200.0,
  platformRoas = 1.8,
  cogsPercent = 35.0,
  returnRatePercent = 18.0,
  processingFeePercent = 3.0,
}) {
  const grossRevenue = dailyBudgetUsd * platformRoas;
  const returnsLoss = grossRevenue * (returnRatePercent / 100.0);
  const netRevenue = grossRevenue - returnsLoss;
  const cogsCost = netRevenue * (cogsPercent / 100.0);
  const processingFee = netRevenue * (processingFeePercent / 100.0);
  
  const totalOperatingCosts = cogsCost + processingFee + dailyBudgetUsd;
  const netProfitContributionUsd = netRevenue - totalOperatingCosts;
  const trueNetRoas = dailyBudgetUsd > 0 ? (netRevenue - cogsCost - processingFee) / dailyBudgetUsd : 0;

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    returnsLoss: Math.round(returnsLoss * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    cogsCost: Math.round(cogsCost * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    netProfitContributionUsd: Math.round(netProfitContributionUsd * 100) / 100,
    trueNetRoas: Math.round(trueNetRoas * 100) / 100,
  };
}

/**
 * Autonomously evaluates ad campaign economics and recommends pause, scale, or maintain actions.
 */
export function evaluateAdCampaign({
  campaignName = "",
  dailyBudgetUsd = 200.0,
  platformRoas = 1.8,
  cogsPercent = 35.0,
  returnRatePercent = 18.0,
}) {
  const econ = calculateTrueAdEconomics({
    dailyBudgetUsd,
    platformRoas,
    cogsPercent,
    returnRatePercent,
  });

  let aiRecommendation = "MAINTAIN_MONITOR";
  let statusOverride = "ACTIVE_RUNNING";
  const campaignPrefix = campaignName ? `[${campaignName}] ` : "";
  let rationale = `✅ STABLE PERFORMER: ${campaignPrefix}True Net ROAS is ${econ.trueNetRoas}x (+$$${econ.netProfitContributionUsd} daily net contribution). Maintaining current daily budget.`;

  if (econ.trueNetRoas < 1.0 || econ.netProfitContributionUsd < 0) {
    aiRecommendation = "PAUSE_IMMEDIATELY";
    statusOverride = "PAUSED_AUTONOMOUSLY";
    rationale = `🚨 BLEEDING ALERT: ${campaignPrefix}Platform reports ${platformRoas}x ROAS, but after ${cogsPercent}% COGS and ${returnRatePercent}% return rate (from ReturnGuard), this campaign loses -$${Math.abs(econ.netProfitContributionUsd)} every day! Autonomously paused to stop loss.`;
  } else if (econ.trueNetRoas >= 2.0 && econ.netProfitContributionUsd >= 100) {
    aiRecommendation = "SCALE_BUDGET_20X";
    statusOverride = "SCALED_AUTONOMOUSLY";
    rationale = `🚀 SCALING WINNER: ${campaignPrefix}True Net ROAS is ${econ.trueNetRoas}x (+$$${econ.netProfitContributionUsd} daily net contribution) with low returns (${returnRatePercent}%). Autonomously boosting daily spend +20% to capture market share!`;
  }

  return {
    ...econ,
    aiRecommendation,
    statusOverride,
    rationale,
  };
}
