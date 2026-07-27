/**
 * GlobalReach AI Copilot Server Engine
 * Handles database seeding from real Shopify products and cross-border publishing.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { calculateCulturalNuanceScore, localizeProductContent } from "./globalReach";
import { translateListingWithGroq, fetchRealStoreProducts } from "./groqAi.server";

export { calculateCulturalNuanceScore, localizeProductContent };

/**
 * Seeds initial localization profiles from REAL Shopify store products.
 */
export async function seedInitialLocalizationProfiles(prisma, shop, admin = null) {
  const count = await prisma.localizationProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  if (admin) {
    const realProducts = await fetchRealStoreProducts(admin, 10);
    if (realProducts && realProducts.length > 0) {
      const markets = ["GERMANY_EU", "JAPAN_APAC", "FRANCE_EU", "MEXICO_LATAM", "UK_EMEA"];

      for (let i = 0; i < realProducts.length; i++) {
        const p = realProducts[i];
        const mkt = markets[i % markets.length];
        const priceVal = parseFloat(p.variants?.nodes?.[0]?.price) || 89.99;

        itemsToSeed.push({
          shop,
          productId: p.id,
          originalTitle: p.title || "Untitled SKU",
          originalPrice: priceVal,
          targetMarket: mkt,
          originalDescription: p.description || "Premium product crafted for excellence and durability.",
          statusOverride: "DRAFT_AI",
        });
      }
    }
  }

  // Fallback if no real products exist in store
  if (itemsToSeed.length === 0) {
    itemsToSeed = [
      {
        shop,
        productId: "gid://shopify/Product/2005",
        originalTitle: "Heavyweight Organic Cotton Fleece Hoodie",
        originalPrice: 110.0,
        targetMarket: "GERMANY_EU",
        originalDescription: "Heavyweight fleece hoodie sweater winter warm pullover streetwear.",
        statusOverride: "REVIEWED_APPROVED",
      },
      {
        shop,
        productId: "gid://shopify/Product/2004",
        originalTitle: "HydraGlow Advanced Vitamin C Radiance Serum",
        originalPrice: 85.0,
        targetMarket: "JAPAN_APAC",
        originalDescription: "Vitamin C serum face whitening moisture hyaluronic acid liquid.",
        statusOverride: "PUBLISHED_STOREFRONT",
      },
      {
        shop,
        productId: "gid://shopify/Product/2002",
        originalTitle: "Silk Velvet Evening Gown — Midnight Edition",
        originalPrice: 320.0,
        targetMarket: "FRANCE_EU",
        originalDescription: "Velvet dress formal gown long dress elegant style.",
        statusOverride: "PUBLISHED_STOREFRONT",
      }
    ];
  }

  for (const item of itemsToSeed) {
    let aiTrans = await translateListingWithGroq({
      originalTitle: item.originalTitle,
      originalDescription: item.originalDescription || "High quality product.",
      targetRegion: item.targetMarket,
      usdPrice: item.originalPrice,
    });

    const generated = localizeProductContent({
      originalTitle: item.originalTitle,
      originalPrice: item.originalPrice,
      targetMarket: item.targetMarket,
    });

    const transTitle = aiTrans ? aiTrans.translatedTitle : generated.localizedTitle;
    const transDesc = aiTrans ? aiTrans.translatedDescription : generated.localizedDescription;
    const transPrice = aiTrans ? aiTrans.localFormattedPrice : generated.localizedPriceDisplay;
    const scoreVal = aiTrans ? aiTrans.culturalNuanceScore : generated.culturalNuanceScore;

    await prisma.localizationProfile.create({
      data: {
        shop,
        productId: item.productId,
        originalTitle: item.originalTitle,
        originalPrice: item.originalPrice,
        targetMarket: item.targetMarket,
        targetLanguage: generated.targetLanguage,
        localizedTitle: transTitle,
        localizedDescription: transDesc,
        localizedPriceDisplay: transPrice,
        unitConversionNote: generated.unitConversionNote,
        culturalNuanceScore: scoreVal,
        publishingStatus: item.statusOverride || "DRAFT_AI",
      },
    });
  }

  await prisma.localizationPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      autoConvertUnits: true,
      applyPsychologicalRounding: true,
      enableCulturalHolidayHooks: true,
    },
  });

  return true;
}

/**
 * Autonomously publishes or approves a cross-border market listing.
 */
export async function executeLocalizationAction(prisma, locId, actionType = "PUBLISH", admin = null) {
  let newStatus = "PUBLISHED_STOREFRONT";
  if (actionType === "APPROVE") newStatus = "REVIEWED_APPROVED";
  if (actionType === "ARCHIVE") newStatus = "ARCHIVED";

  const updated = await prisma.localizationProfile.update({
    where: { id: locId },
    data: { publishingStatus: newStatus },
  });

  return updated;
}
