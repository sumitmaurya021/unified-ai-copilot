/**
 * CatalogAlchemy AI Copilot Server Engine
 * Handles database seeding and publishing mutations.
 */
import { calculateCatalogQualityScore, healCatalogItem } from "./catalogAlchemy";

export { calculateCatalogQualityScore, healCatalogItem };

/**
 * Seeds initial demo catalog items if the database is empty for the shop.
 */
export async function seedInitialCatalogItems(prisma, shop) {
  const count = await prisma.catalogItemProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoItems = [
    {
      shop,
      productId: "gid://shopify/Product/2001",
      rawTitle: "HOT SALE!! 2024 Newest Men Womens Running Shoes Breathable Mesh Sport Sneakers Size 36-45 CHEAP",
      rawDescription: "good quality running shoes mesh breathable comfortable sport shoes for men women outdoor gym running cheap price factory direct sale size 36 37 38 39 40 41 42 43 44 45 buy now fast shipping!",
      rawVendor: "AliExpress Dropship",
      status: "NEEDS_HEALING",
    },
    {
      shop,
      productId: "gid://shopify/Product/2002",
      rawTitle: "WOMENS ELEGANTS VELVET EVENING GOWN DRESS MIDNIGHT BLUE FORMAL LONG DRESSES 2024",
      rawDescription: "velvet dress formal gown long dress elegant style dry clean only made in china polyester and velvet good for party wedding.",
      rawVendor: "Wholesale Fashion Hub",
      status: "HEALED_READY_FOR_REVIEW",
    },
    {
      shop,
      productId: "gid://shopify/Product/2003",
      rawTitle: "TITANIUM MAGNETIC WATCH STRAP BAND FOR APLE WATCH SERIES 9 8 7 6 SE ULTRA 49MM 45MM 44MM 42MM 41MM",
      rawDescription: "magnetic strap titanium metal band watch replacement accessories durable luxury.",
      rawVendor: "Shenzhen Electronics Direct",
      status: "AUTO_PUBLISHED",
    },
    {
      shop,
      productId: "gid://shopify/Product/2004",
      rawTitle: "HYDRAGLOW VITAMIN C SERUM 30ML FACE LIQUID ANTI AGING WRINKLE MOISTURIZING SKIN CARE CHEAP",
      rawDescription: "vitamin c serum face whitening moisture hyaluronic acid liquid skin repair.",
      rawVendor: "Cosmetics Wholesale direct",
      status: "NEEDS_HEALING",
    },
    {
      shop,
      productId: "gid://shopify/Product/2005",
      rawTitle: "HEAVYWEIGHT FLEECE HOODIE SWEATER MEN WOMEN WINTER WARM PULLOVER STREETWEAR 100% COTTON",
      rawDescription: "hoodie heavyweight fleece thick winter sweater pullover pocket long sleeve cotton comfortable.",
      rawVendor: "Apparel Factory Outlet",
      status: "HEALED_READY_FOR_REVIEW",
    }
  ];

  for (const item of demoItems) {
    const healed = healCatalogItem({
      rawTitle: item.rawTitle,
      rawDescription: item.rawDescription,
      rawVendor: item.rawVendor,
    });

    await prisma.catalogItemProfile.create({
      data: {
        shop,
        productId: item.productId,
        rawTitle: healed.rawTitle,
        healedTitle: healed.healedTitle,
        rawDescription: healed.rawDescription,
        healedDescription: healed.healedDescription,
        rawVendor: item.rawVendor,
        healedVendor: healed.healedVendor,
        seoTitle: healed.seoTitle,
        seoDescription: healed.seoDescription,
        extractedMetafields: healed.extractedMetafields,
        aiHealingStatus: item.status,
        aiQualityScoreRaw: healed.scoreRaw,
        aiQualityScoreHealed: healed.scoreHealed,
      },
    });
  }

  await prisma.catalogPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      autoPublishThresholdScore: 90,
      targetTone: "Premium & Minimalist",
      autoExtractMetafields: true,
    },
  });

  return true;
}

/**
 * Autonomously applies or rejects a healed listing.
 */
export async function executeCatalogPublish(prisma, itemId, actionType = "PUBLISH") {
  const newStatus = actionType === "PUBLISH" ? "AUTO_PUBLISHED" : "REJECTED";

  const updated = await prisma.catalogItemProfile.update({
    where: { id: itemId },
    data: { aiHealingStatus: newStatus },
  });

  return updated;
}
