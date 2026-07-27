/**
 * AdSpend Guardian AI Copilot Server Engine
 * Handles database seeding and ad spend pausing/scaling mutations.
 */
import { calculateTrueAdEconomics, evaluateAdCampaign } from "./adSpendGuardian";

export { calculateTrueAdEconomics, evaluateAdCampaign };

/**
 * Seeds initial demo ad campaigns if the database is empty for the shop.
 */
export async function seedInitialAdCampaigns(prisma, shop) {
  const count = await prisma.adCampaignProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoCampaigns = [
    {
      shop,
      campaignId: "camp_meta_101",
      campaignName: "META_Conv_Hoodie_Retargeting",
      platform: "META_ADS",
      mappedProductId: "gid://shopify/Product/2005",
      mappedProductTitle: "Heavyweight Organic Cotton Fleece Hoodie",
      dailyBudgetUsd: 250.0,
      platformRoas: 2.60,
      cogsPercent: 35.0,
      returnRatePercent: 18.0,
      statusOverride: "ACTIVE_RUNNING",
    },
    {
      shop,
      campaignId: "camp_goog_202",
      campaignName: "GOOGLE_PMax_Sneakers_USA",
      platform: "GOOGLE_PMAX",
      mappedProductId: "gid://shopify/Product/2001",
      mappedProductTitle: "AeroMesh Lightweight Performance Running Sneaker",
      dailyBudgetUsd: 350.0,
      platformRoas: 1.80,
      cogsPercent: 45.0,
      returnRatePercent: 24.0,
      statusOverride: "PAUSED_AUTONOMOUSLY",
    },
    {
      shop,
      campaignId: "camp_tiktok_303",
      campaignName: "TIKTOK_Spark_Serum_GenZ",
      platform: "TIKTOK_ADS",
      mappedProductId: "gid://shopify/Product/2004",
      mappedProductTitle: "HydraGlow Advanced Vitamin C Radiance Serum",
      dailyBudgetUsd: 150.0,
      platformRoas: 3.80,
      cogsPercent: 20.0,
      returnRatePercent: 4.0,
      statusOverride: "SCALED_AUTONOMOUSLY",
    },
    {
      shop,
      campaignId: "camp_pint_404",
      campaignName: "PINTEREST_Gown_OldMoney",
      platform: "PINTEREST_ADS",
      mappedProductId: "gid://shopify/Product/2002",
      mappedProductTitle: "Silk Velvet Evening Gown — Midnight Edition",
      dailyBudgetUsd: 300.0,
      platformRoas: 2.40,
      cogsPercent: 40.0,
      returnRatePercent: 12.0,
      statusOverride: "ACTIVE_RUNNING",
    },
    {
      shop,
      campaignId: "camp_meta_505",
      campaignName: "META_Prospecting_WatchBand",
      platform: "META_ADS",
      mappedProductId: "gid://shopify/Product/2003",
      mappedProductTitle: "Titanium Magnetic Smart Watch Band",
      dailyBudgetUsd: 180.0,
      platformRoas: 1.50,
      cogsPercent: 30.0,
      returnRatePercent: 22.0,
      statusOverride: "PAUSED_AUTONOMOUSLY",
    }
  ];

  for (const item of demoCampaigns) {
    const evalResult = evaluateAdCampaign({
      campaignName: item.campaignName,
      dailyBudgetUsd: item.dailyBudgetUsd,
      platformRoas: item.platformRoas,
      cogsPercent: item.cogsPercent,
      returnRatePercent: item.returnRatePercent,
    });

    await prisma.adCampaignProfile.create({
      data: {
        shop,
        campaignId: item.campaignId,
        campaignName: item.campaignName,
        platform: item.platform,
        mappedProductId: item.mappedProductId,
        mappedProductTitle: item.mappedProductTitle,
        dailyBudgetUsd: item.dailyBudgetUsd,
        platformRoas: item.platformRoas,
        trueNetRoas: evalResult.trueNetRoas,
        netProfitContributionUsd: evalResult.netProfitContributionUsd,
        aiRecommendation: evalResult.aiRecommendation,
        campaignStatus: item.statusOverride || evalResult.statusOverride,
      },
    });
  }

  await prisma.adPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      minTrueNetRoas: 1.20,
      autoPauseBleedingAds: true,
      autoScaleWinners: true,
      maxDailyScalePercent: 20,
    },
  });

  return true;
}

/**
 * Autonomously executes ad spend pauses, scales, or maintenance actions.
 */
export async function executeAdAction(prisma, campaignId, actionType = "PAUSE") {
  const campaign = await prisma.adCampaignProfile.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;

  let newStatus = "ACTIVE_RUNNING";
  let newRec = "MAINTAIN_MONITOR";
  let newBudget = campaign.dailyBudgetUsd;

  if (actionType === "PAUSE") {
    newStatus = "PAUSED_AUTONOMOUSLY";
    newRec = "PAUSE_IMMEDIATELY";
  } else if (actionType === "SCALE") {
    newStatus = "SCALED_AUTONOMOUSLY";
    newRec = "SCALE_BUDGET_20X";
    newBudget = Math.round(campaign.dailyBudgetUsd * 1.2 * 100) / 100; // Boost 20%
  } else if (actionType === "MAINTAIN") {
    newStatus = "ACTIVE_RUNNING";
    newRec = "MAINTAIN_MONITOR";
  }

  const updated = await prisma.adCampaignProfile.update({
    where: { id: campaignId },
    data: {
      campaignStatus: newStatus,
      aiRecommendation: newRec,
      dailyBudgetUsd: newBudget,
    },
  });

  return updated;
}
