/**
 * GlobalReach AI Copilot Server Engine
 * Handles database seeding and cross-border storefront publishing mutations.
 */
import { calculateCulturalNuanceScore, localizeProductContent } from "./globalReach";

export { calculateCulturalNuanceScore, localizeProductContent };

/**
 * Seeds initial demo localization profiles if the database is empty for the shop.
 */
export async function seedInitialLocalizationProfiles(prisma, shop) {
  const count = await prisma.localizationProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoListings = [
    {
      shop,
      productId: "gid://shopify/Product/2005",
      originalTitle: "Heavyweight Organic Cotton Fleece Hoodie",
      originalPrice: 110.0,
      targetMarket: "GERMANY_EU",
      statusOverride: "REVIEWED_APPROVED",
    },
    {
      shop,
      productId: "gid://shopify/Product/2004",
      originalTitle: "HydraGlow Advanced Vitamin C Radiance Serum",
      originalPrice: 85.0,
      targetMarket: "JAPAN_APAC",
      statusOverride: "PUBLISHED_STOREFRONT",
    },
    {
      shop,
      productId: "gid://shopify/Product/2002",
      originalTitle: "Silk Velvet Evening Gown — Midnight Edition",
      originalPrice: 320.0,
      targetMarket: "FRANCE_EU",
      statusOverride: "PUBLISHED_STOREFRONT",
    },
    {
      shop,
      productId: "gid://shopify/Product/2001",
      originalTitle: "AeroMesh Lightweight Performance Running Sneaker",
      originalPrice: 150.0,
      targetMarket: "MEXICO_LATAM",
      statusOverride: "DRAFT_AI",
    },
    {
      shop,
      productId: "gid://shopify/Product/2003",
      originalTitle: "Titanium Magnetic Smart Watch Band",
      originalPrice: 95.0,
      targetMarket: "UK_EMEA",
      statusOverride: "REVIEWED_APPROVED",
    }
  ];

  for (const item of demoListings) {
    const generated = localizeProductContent({
      originalTitle: item.originalTitle,
      originalPrice: item.originalPrice,
      targetMarket: item.targetMarket,
    });

    await prisma.localizationProfile.create({
      data: {
        shop,
        productId: item.productId,
        originalTitle: item.originalTitle,
        originalPrice: item.originalPrice,
        targetMarket: item.targetMarket,
        targetLanguage: generated.targetLanguage,
        localizedTitle: generated.localizedTitle,
        localizedDescription: generated.localizedDescription,
        localizedPriceDisplay: generated.localizedPriceDisplay,
        unitConversionNote: generated.unitConversionNote,
        culturalNuanceScore: generated.culturalNuanceScore,
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
export async function executeLocalizationAction(prisma, locId, actionType = "PUBLISH") {
  let newStatus = "PUBLISHED_STOREFRONT";
  if (actionType === "APPROVE") newStatus = "REVIEWED_APPROVED";
  if (actionType === "ARCHIVE") newStatus = "ARCHIVED";

  const updated = await prisma.localizationProfile.update({
    where: { id: locId },
    data: { publishingStatus: newStatus },
  });

  return updated;
}
