/**
 * PulseAI Copilot Server Engine
 * Handles database seeding from real Shopify products and trend campaign mutations.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { calculateViralFitScore, generateViralContent } from "./pulseAi";
import { generateSocialHookWithGroq, fetchRealStoreProducts } from "./groqAi.server";

export { calculateViralFitScore, generateViralContent };

/**
 * Seeds initial trend opportunities from REAL Shopify store products.
 */
export async function seedInitialTrendOpportunities(prisma, shop, admin = null) {
  const count = await prisma.trendOpportunityProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  if (admin) {
    const realProducts = await fetchRealStoreProducts(admin, 10);
    if (realProducts && realProducts.length > 0) {
      const hashtags = ["#TikTokMadeMeBuyIt", "#ShopifyFinds", "#ViralMustHaves", "#AestheticLifestyle", "#EverydayEssentials", "#HiddenGems"];
      const platforms = ["TIKTOK", "INSTAGRAM", "YOUTUBE_SHORTS", "PINTEREST", "TIKTOK"];

      for (let i = 0; i < realProducts.length; i++) {
        const p = realProducts[i];
        const tag = hashtags[i % hashtags.length];
        const plat = platforms[i % platforms.length];

        itemsToSeed.push({
          shop,
          trendId: `TRND-${Math.floor(100 + Math.random() * 900)}`,
          trendName: tag,
          platform: plat,
          viralVelocityScore: 90 + (i % 9),
          growthRatePercent: 200 + (i * 45),
          mappedProductId: p.id,
          mappedProductTitle: p.title || "Untitled SKU",
          statusOverride: "DISCOVERED",
        });
      }
    }
  }

  // Fallback if no real products exist in store
  if (itemsToSeed.length === 0) {
    itemsToSeed = [
      {
        shop,
        trendId: "TRND-901",
        trendName: "#CozyCore Streetwear",
        platform: "TIKTOK",
        viralVelocityScore: 96,
        growthRatePercent: 420,
        mappedProductId: "gid://shopify/Product/2005",
        mappedProductTitle: "Heavyweight Organic Cotton Fleece Hoodie",
        statusOverride: "DISCOVERED",
      },
      {
        shop,
        trendId: "TRND-902",
        trendName: "#MarathonTraining Prep",
        platform: "INSTAGRAM",
        viralVelocityScore: 94,
        growthRatePercent: 280,
        mappedProductId: "gid://shopify/Product/2001",
        mappedProductTitle: "AeroMesh Lightweight Performance Running Sneaker",
        statusOverride: "SCRIPT_APPROVED",
      },
      {
        shop,
        trendId: "TRND-903",
        trendName: "#OldMoneyAesthetic",
        platform: "PINTEREST",
        viralVelocityScore: 91,
        growthRatePercent: 195,
        mappedProductId: "gid://shopify/Product/2002",
        mappedProductTitle: "Silk Velvet Evening Gown — Midnight Edition",
        statusOverride: "CAMPAIGN_LAUNCHED",
      }
    ];
  }

  for (const opp of itemsToSeed) {
    let aiHook = await generateSocialHookWithGroq({
      productTitle: opp.mappedProductTitle,
      trendingHashtag: opp.trendName,
    });

    const generated = generateViralContent({
      trendName: opp.trendName,
      platform: opp.platform,
      mappedProductTitle: opp.mappedProductTitle,
    });

    const scriptVal = aiHook ? aiHook.hookScript : generated.generatedHookScript;
    const captionVal = aiHook ? aiHook.caption : generated.generatedAdCaption;

    await prisma.trendOpportunityProfile.create({
      data: {
        shop,
        trendId: opp.trendId,
        trendName: opp.trendName,
        platform: opp.platform,
        viralVelocityScore: opp.viralVelocityScore,
        growthRatePercent: opp.growthRatePercent,
        mappedProductId: opp.mappedProductId,
        mappedProductTitle: opp.mappedProductTitle,
        viralFitScore: generated.viralFitScore,
        generatedHookScript: scriptVal,
        generatedAdCaption: captionVal,
        campaignStatus: opp.statusOverride || "DISCOVERED",
      },
    });
  }

  await prisma.trendPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      minViralFitScore: 75,
      autoGenerateScripts: true,
      targetAudienceTone: "Gen-Z High Energy & Authentic",
    },
  });

  return true;
}

/**
 * Autonomously launches or archives a viral trend campaign.
 */
export async function executeTrendAction(prisma, oppId, actionType = "LAUNCH", admin = null) {
  let newStatus = "CAMPAIGN_LAUNCHED";
  if (actionType === "APPROVE") newStatus = "SCRIPT_APPROVED";
  if (actionType === "ARCHIVE") newStatus = "ARCHIVED";

  const updated = await prisma.trendOpportunityProfile.update({
    where: { id: oppId },
    data: { campaignStatus: newStatus },
  });

  return updated;
}
