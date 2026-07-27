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
