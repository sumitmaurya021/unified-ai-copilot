/**
 * MarginGuard AI Copilot Server Engine
 * Handles database seeding from real Shopify store products and repricing execution.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { calculateSkuMargin, analyzePriceElasticity } from "./marginGuard";
import { recommendRepricingWithGroq, fetchRealStoreProducts } from "./groqAi.server";

export { calculateSkuMargin, analyzePriceElasticity };

/**
 * Seeds initial margin profiles from REAL Shopify store products.
 */
export async function seedInitialMarginProfiles(prisma, shop, admin = null) {
  const count = await prisma.productMarginProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  if (admin) {
    const realProducts = await fetchRealStoreProducts(admin, 15);
    if (realProducts && realProducts.length > 0) {
      for (const p of realProducts) {
        const priceVal = parseFloat(p.variants?.nodes?.[0]?.price) || 49.99;
        const cogsVal = Math.round(priceVal * 0.35);
        const cacVal = Math.round(priceVal * 0.20);
        const stockVal = p.totalInventory || 15;

        itemsToSeed.push({
          shop,
          productId: p.variants?.nodes?.[0]?.id || p.id,
          productTitle: p.title || "Untitled SKU",
          sku: p.handle ? `SKU-${p.handle.slice(0, 10).toUpperCase()}` : "SKU-001",
          price: priceVal,
          cogs: cogsVal,
          averageShippingCost: 10.00,
          currentCac: cacVal,
          inventoryLevel: stockVal,
          restockLeadTimeDays: 14,
        });
      }
    }
  }

  // Fallback if no real products exist in store
  if (itemsToSeed.length === 0) {
    itemsToSeed = [
      {
        shop,
        productId: "gid://shopify/Product/1001",
        productTitle: "AeroBoost Running Sneaker - Volts",
        sku: "SNK-AERO-01",
        price: 149.99,
        cogs: 42.00,
        averageShippingCost: 14.50,
        currentCac: 68.00,
        inventoryLevel: 120,
        restockLeadTimeDays: 10,
      },
      {
        shop,
        productId: "gid://shopify/Product/1002",
        productTitle: "Organic Cashmere Sweater - Oatmeal",
        sku: "SWT-CASH-04",
        price: 220.00,
        cogs: 55.00,
        averageShippingCost: 12.00,
        currentCac: 45.00,
        inventoryLevel: 8,
        restockLeadTimeDays: 28,
      },
      {
        shop,
        productId: "gid://shopify/Product/1003",
        productTitle: "ProFit Bluetooth Smart Scale",
        sku: "SCL-PRO-09",
        price: 69.99,
        cogs: 22.00,
        averageShippingCost: 16.00,
        currentCac: 34.00,
        inventoryLevel: 45,
        restockLeadTimeDays: 14,
      }
    ];
  }

  for (const item of itemsToSeed) {
    let aiRec = await recommendRepricingWithGroq({
      productTitle: item.productTitle,
      currentPrice: item.price,
      cogs: item.cogs,
      adSpendCac: item.currentCac,
      stock: item.inventoryLevel,
    });

    const aiElasticity = analyzePriceElasticity({
      price: item.price,
      cogs: item.cogs,
      averageShippingCost: item.averageShippingCost,
      currentCac: item.currentCac,
      inventoryLevel: item.inventoryLevel,
      restockLeadTimeDays: item.restockLeadTimeDays,
    });

    const recPrice = aiRec ? aiRec.recommendedPrice : parseFloat(aiElasticity.recommendedPrice);
    const recRationale = aiRec ? aiRec.aiRationale : aiElasticity.rationale;
    const newStatus = parseFloat(aiElasticity.marginBreakdown.netMarginDollar) < 0 ? "UNPROFITABLE_BLEED" : (recPrice !== item.price ? "SCARCITY_PRICE_BUMP" : "OPTIMAL");

    await prisma.productMarginProfile.create({
      data: {
        ...item,
        netMarginDollar: parseFloat(aiElasticity.marginBreakdown.netMarginDollar),
        netMarginPercent: parseFloat(aiElasticity.marginBreakdown.netMarginPercent),
        aiRepricingStatus: newStatus,
        aiRecommendedPrice: recPrice,
        aiRepricingRationale: recRationale,
      },
    });
  }

  await prisma.marginPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      minTargetMarginPercent: 20.0,
      autoNudgePriceOnLowStock: true,
      lowStockThreshold: 15,
    },
  });

  return true;
}

/**
 * Autonomously executes AI recommended price modification for a SKU.
 * If admin is provided, updates real variant price in Shopify Store!
 */
export async function executeAiRepricing(prisma, profileId, newPrice, rationale = "", admin = null) {
  const profile = await prisma.productMarginProfile.findUnique({ where: { id: profileId } });
  if (!profile) return null;

  const priceVal = parseFloat(newPrice) || profile.price;

  // Push live price update to Shopify variant if real ID!
  if (admin && profile.productId && profile.productId.startsWith("gid://shopify/ProductVariant/")) {
    try {
      await admin.graphql(
        `#graphql
        mutation updateVariant($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant { id price }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            input: {
              id: profile.productId,
              price: priceVal.toString(),
            },
          },
        }
      );
    } catch (err) {
      console.warn("Failed to update real Shopify variant price:", err.message);
    }
  }

  const ai = analyzePriceElasticity({
    price: priceVal,
    cogs: profile.cogs,
    averageShippingCost: profile.averageShippingCost,
    currentCac: profile.currentCac,
    inventoryLevel: profile.inventoryLevel,
    restockLeadTimeDays: profile.restockLeadTimeDays,
  });

  const newStatus = ai.marginBreakdown.netMarginDollar < 0 ? "UNPROFITABLE_BLEED" : "OPTIMAL";

  const updated = await prisma.productMarginProfile.update({
    where: { id: profileId },
    data: {
      price: priceVal,
      netMarginDollar: parseFloat(ai.marginBreakdown.netMarginDollar),
      netMarginPercent: parseFloat(ai.marginBreakdown.netMarginPercent),
      aiRepricingStatus: newStatus,
      aiRecommendedPrice: priceVal,
      aiRepricingRationale: rationale || `✅ AI Copilot applied price adjustment to $${priceVal.toFixed(2)}. Net margin: ${ai.marginBreakdown.netMarginPercent}%.`,
    },
  });

  return updated;
}
