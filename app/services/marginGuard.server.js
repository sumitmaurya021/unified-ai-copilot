/**
 * MarginGuard AI Copilot Server Engine
 * Handles database seeding and repricing execution.
 */
import { calculateSkuMargin, analyzePriceElasticity } from "./marginGuard";

export { calculateSkuMargin, analyzePriceElasticity };

/**
 * Seeds initial demo margin profiles if the database is empty for the shop.
 */
export async function seedInitialMarginProfiles(prisma, shop) {
  const count = await prisma.productMarginProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoProfiles = [
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
    },
    {
      shop,
      productId: "gid://shopify/Product/1004",
      productTitle: "HydraGlow Vitamin C Serum (30ml)",
      sku: "SRM-GLOW-02",
      price: 48.00,
      cogs: 6.50,
      averageShippingCost: 5.50,
      currentCac: 14.00,
      inventoryLevel: 210,
      restockLeadTimeDays: 14,
    },
    {
      shop,
      productId: "gid://shopify/Product/1005",
      productTitle: "Titanium Magnetic Watch Band",
      sku: "WCH-BND-11",
      price: 39.99,
      cogs: 4.50,
      averageShippingCost: 4.00,
      currentCac: 11.00,
      inventoryLevel: 340,
      restockLeadTimeDays: 14,
    }
  ];

  for (const item of demoProfiles) {
    const ai = analyzePriceElasticity({
      price: item.price,
      cogs: item.cogs,
      averageShippingCost: item.averageShippingCost,
      currentCac: item.currentCac,
      inventoryLevel: item.inventoryLevel,
      restockLeadTimeDays: item.restockLeadTimeDays,
    });

    await prisma.productMarginProfile.create({
      data: {
        ...item,
        netMarginDollar: parseFloat(ai.marginBreakdown.netMarginDollar),
        netMarginPercent: parseFloat(ai.marginBreakdown.netMarginPercent),
        aiRepricingStatus: ai.status,
        aiRecommendedPrice: parseFloat(ai.recommendedPrice),
        aiRepricingRationale: ai.rationale,
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
 */
export async function executeAiRepricing(prisma, profileId, newPrice, rationale = "") {
  const profile = await prisma.productMarginProfile.findUnique({ where: { id: profileId } });
  if (!profile) return null;

  const priceVal = parseFloat(newPrice) || profile.price;

  const ai = analyzePriceElasticity({
    price: priceVal,
    cogs: profile.cogs,
    averageShippingCost: profile.averageShippingCost,
    currentCac: profile.currentCac,
    inventoryLevel: profile.inventoryLevel,
    restockLeadTimeDays: profile.restockLeadTimeDays,
  });

  // When applied, set status to OPTIMAL or ELASTICITY_TEST_ACTIVE
  const newStatus = ai.marginBreakdown.netMarginDollar < 0 ? "LOW_MARGIN_ALERT" : "OPTIMAL";

  const updated = await prisma.productMarginProfile.update({
    where: { id: profileId },
    data: {
      price: priceVal,
      netMarginDollar: parseFloat(ai.marginBreakdown.netMarginDollar),
      netMarginPercent: parseFloat(ai.marginBreakdown.netMarginPercent),
      aiRepricingStatus: newStatus,
      aiRecommendedPrice: priceVal,
      aiRepricingRationale: rationale || `✅ AI Copilot executed price adjustment to $${priceVal.toFixed(2)}. Net margin restored to ${ai.marginBreakdown.netMarginPercent}%.`,
    },
  });

  return updated;
}
