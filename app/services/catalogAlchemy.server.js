/**
 * CatalogAlchemy AI Copilot Server Engine
 * Handles database seeding from real Shopify store products and publishing mutations.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { calculateCatalogQualityScore, healCatalogItem } from "./catalogAlchemy";
import { healCatalogItemWithGroq, fetchRealStoreProducts } from "./groqAi.server";

export { calculateCatalogQualityScore, healCatalogItem, healCatalogItemWithGroq, executeCatalogPublish as publishHealedItemToShopify };

/**
 * Seeds initial catalog items by importing REAL Shopify store products.
 * Falls back to demo items if the store currently has 0 products.
 */
export async function seedInitialCatalogItems(prisma, shop, admin = null) {
  const count = await prisma.catalogItemProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  // Try fetching real products from the merchant's Shopify store
  if (admin) {
    const realProducts = await fetchRealStoreProducts(admin, 12);
    if (realProducts && realProducts.length > 0) {
      for (const p of realProducts) {
        itemsToSeed.push({
          shop,
          productId: p.id,
          rawTitle: p.title || "Untitled Shopify SKU",
          rawDescription: p.description || "Basic product description needing SEO optimization and bulleted formatting.",
          rawVendor: p.vendor || "Store Catalog",
          status: "NEEDS_HEALING",
          isRealStoreItem: true,
        });
      }
    }
  }

  // Fallback to demo items if the store has no products
  if (itemsToSeed.length === 0) {
    itemsToSeed = [
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
  }

  for (const item of itemsToSeed) {
    // Try Groq Llama 3 AI healing first
    let healed = await healCatalogItemWithGroq({
      rawTitle: item.rawTitle,
      rawDescription: item.rawDescription,
      rawVendor: item.rawVendor,
    });

    // Fallback to local heuristic alchemy if Groq failed
    if (!healed) {
      healed = healCatalogItem({
        rawTitle: item.rawTitle,
        rawDescription: item.rawDescription,
        rawVendor: item.rawVendor,
      });
    }

    const scoreRawObj = calculateCatalogQualityScore({
      rawTitle: item.rawTitle,
      rawDescription: item.rawDescription,
      vendor: item.rawVendor,
      metafieldsCount: 0,
    });

    const scoreHealedObj = calculateCatalogQualityScore({
      title: healed.healedTitle,
      description: healed.healedDescription,
      vendor: healed.healedVendor || "Exclusive Collection",
      metafieldsCount: 5,
    });

    await prisma.catalogItemProfile.create({
      data: {
        shop,
        productId: item.productId,
        rawTitle: item.rawTitle,
        healedTitle: healed.healedTitle,
        rawDescription: item.rawDescription,
        healedDescription: healed.healedDescription,
        rawVendor: item.rawVendor,
        healedVendor: healed.healedVendor || item.rawVendor,
        seoTitle: healed.seoTitle || healed.healedTitle,
        seoDescription: healed.seoDescription || "Shop our premium collection.",
        extractedMetafields: typeof healed.extractedMetafields === "string" ? healed.extractedMetafields : JSON.stringify(healed.extractedMetafields, null, 2),
        aiHealingStatus: item.status,
        aiQualityScoreRaw: scoreRawObj.score,
        aiQualityScoreHealed: scoreHealedObj.score,
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
 * If admin is provided and item is a real Shopify product, publishes changes via GraphQL API!
 */
export async function executeCatalogPublish(prisma, itemId, actionType = "PUBLISH", admin = null) {
  const newStatus = actionType === "PUBLISH" ? "AUTO_PUBLISHED" : "REJECTED";

  const item = await prisma.catalogItemProfile.findUnique({ where: { id: itemId } });
  if (!item) return null;

  // If publishing and we have real admin access, push update to Shopify Store!
  if (actionType === "PUBLISH" && admin && item.productId && item.productId.startsWith("gid://shopify/Product/") && !item.productId.includes("/2001") && !item.productId.includes("/2002") && !item.productId.includes("/2003") && !item.productId.includes("/2004") && !item.productId.includes("/2005")) {
    try {
      await admin.graphql(
        `#graphql
        mutation updateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id title }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            input: {
              id: item.productId,
              title: item.healedTitle,
              descriptionHtml: `<p>${item.healedDescription.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`,
              vendor: item.healedVendor || item.rawVendor,
            },
          },
        }
      );
    } catch (err) {
      console.warn("Failed to push real product update to Shopify:", err.message);
    }
  }

  const updated = await prisma.catalogItemProfile.update({
    where: { id: itemId },
    data: { aiHealingStatus: newStatus },
  });

  return updated;
}
