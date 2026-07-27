/**
 * AdSpend Guardian AI Copilot Server Engine
 * Handles database seeding from real Shopify products and ad attribution mutations.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { calculateTrueAdEconomics, evaluateAdCampaign } from "./adSpendGuardian";
import { auditAdSpendWithGroq, fetchRealStoreProducts } from "./groqAi.server";

export { calculateTrueAdEconomics, evaluateAdCampaign };

/**
 * Seeds initial ad campaigns from REAL Shopify store products.
 */
export async function seedInitialAdCampaigns(prisma, shop, admin = null) {
  const count = await prisma.adCampaignProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  if (admin) {
    const realProducts = await fetchRealStoreProducts(admin, 10);
    if (realProducts && realProducts.length > 0) {
      const platforms = ["META_ADS", "GOOGLE_PMAX", "TIKTOK_ADS", "PINTEREST_ADS", "META_ADS"];

      for (let i = 0; i < realProducts.length; i++) {
        const p = realProducts[i];
        const plat = platforms[i % platforms.length];
        const priceVal = parseFloat(p.variants?.nodes?.[0]?.price) || 99.99;
        const roasVal = Math.round((Math.random() * 2.5 + 1.2) * 100) / 100;

        itemsToSeed.push({
          shop,
          campaignId: `camp_${plat.toLowerCase().slice(0, 4)}_${Math.floor(100 + Math.random() * 900)}`,
          campaignName: `${plat.split("_")[0]}_Conv_${p.handle || "item"}_Retargeting`,
          platform: plat,
          mappedProductId: p.id,
          mappedProductTitle: p.title || "Untitled SKU",
          dailyBudgetUsd: 150.0 + (i * 50),
          platformRoas: roasVal,
          cogsPercent: 35.0,
          returnRatePercent: 15.0,
          statusOverride: roasVal < 1.6 ? "PAUSED_AUTONOMOUSLY" : "ACTIVE_RUNNING",
        });
      }
    }
  }

  // Fallback if no real products exist in store
  if (itemsToSeed.length === 0) {
    itemsToSeed = [
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
      }
    ];
  }

  for (const item of itemsToSeed) {
    let aiAudit = await auditAdSpendWithGroq({
      campaignName: item.campaignName,
      platform: item.platform,
      budget: item.dailyBudgetUsd,
      roas: item.platformRoas,
      cogsPct: item.cogsPercent,
      returnRate: item.returnRatePercent,
    });

    const evalResult = evaluateAdCampaign({
      campaignName: item.campaignName,
      dailyBudgetUsd: item.dailyBudgetUsd,
      platformRoas: item.platformRoas,
      cogsPercent: item.cogsPercent,
      returnRatePercent: item.returnRatePercent,
    });

    const recVal = aiAudit ? aiAudit.aiRecommendation : evalResult.aiRecommendation;
    const statVal = item.statusOverride || evalResult.statusOverride;

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
        aiRecommendation: recVal,
        campaignStatus: statVal,
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
export async function executeAdAction(prisma, campaignId, actionType = "PAUSE", admin = null) {
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
    newBudget = Math.round(campaign.dailyBudgetUsd * 1.2 * 100) / 100;
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
