/**
 * InventoryOracle AI Copilot Server Engine
 * Handles database seeding and supply chain Purchase Order (PO) dispatch mutations.
 */
import { calculateInventoryForecast, evaluateInventoryHealth } from "./inventoryOracle";

export { calculateInventoryForecast, evaluateInventoryHealth };

/**
 * Seeds initial demo inventory forecasts if the database is empty for the shop.
 */
export async function seedInitialInventoryForecasts(prisma, shop) {
  const count = await prisma.inventoryForecastProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoItems = [
    {
      shop,
      productId: "gid://shopify/Product/2005",
      productTitle: "Heavyweight Organic Cotton Fleece Hoodie",
      currentStock: 12,
      dailySalesVelocity: 4.5,
      supplierLeadTimeDays: 14,
      statusOverride: "CRITICAL_STOCKOUT_IMMINENT",
      poOverride: "DRAFT_AI",
    },
    {
      shop,
      productId: "gid://shopify/Product/2001",
      productTitle: "AeroMesh Lightweight Performance Running Sneaker",
      currentStock: 320,
      dailySalesVelocity: 0.4,
      supplierLeadTimeDays: 21,
      statusOverride: "OVERSTOCKED_DEAD_CAPITAL",
      poOverride: "NONE",
    },
    {
      shop,
      productId: "gid://shopify/Product/2004",
      productTitle: "HydraGlow Advanced Vitamin C Radiance Serum",
      currentStock: 180,
      dailySalesVelocity: 8.2,
      supplierLeadTimeDays: 14,
      statusOverride: "HEALTHY_BUFFER",
      poOverride: "NONE",
    },
    {
      shop,
      productId: "gid://shopify/Product/2002",
      productTitle: "Silk Velvet Evening Gown — Midnight Edition",
      currentStock: 15,
      dailySalesVelocity: 1.2,
      supplierLeadTimeDays: 10,
      statusOverride: "REORDER_PLACED",
      poOverride: "APPROVED_DISPATCHED",
    },
    {
      shop,
      productId: "gid://shopify/Product/2003",
      productTitle: "Titanium Magnetic Smart Watch Band",
      currentStock: 45,
      dailySalesVelocity: 3.5,
      supplierLeadTimeDays: 14,
      statusOverride: "CRITICAL_STOCKOUT_IMMINENT",
      poOverride: "DRAFT_AI",
    }
  ];

  for (const item of demoItems) {
    const evalResult = evaluateInventoryHealth({
      productTitle: item.productTitle,
      currentStock: item.currentStock,
      dailySalesVelocity: item.dailySalesVelocity,
      supplierLeadTimeDays: item.supplierLeadTimeDays,
    });

    await prisma.inventoryForecastProfile.create({
      data: {
        shop,
        productId: item.productId,
        productTitle: item.productTitle,
        currentStock: item.currentStock,
        dailySalesVelocity: item.dailySalesVelocity,
        supplierLeadTimeDays: item.supplierLeadTimeDays,
        predictedStockoutDays: evalResult.predictedStockoutDays,
        reorderPointUnits: evalResult.reorderPointUnits,
        recommendedPoUnits: evalResult.recommendedPoUnits,
        stockStatus: item.statusOverride || evalResult.stockStatus,
        aiActionRecommendation: evalResult.aiActionRecommendation,
        poStatus: item.poOverride || evalResult.poStatus,
      },
    });
  }

  await prisma.inventoryPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      bufferStockDays: 14,
      autoDraftPurchaseOrders: true,
      enableDeadStockBundling: true,
      leadTimeSafetyMarginPercent: 20,
    },
  });

  return true;
}

/**
 * Autonomously executes PO dispatch, delivery restock, or dead stock clearance actions.
 */
export async function executeInventoryAction(prisma, forecastId, actionType = "DISPATCH_PO") {
  const item = await prisma.inventoryForecastProfile.findUnique({ where: { id: forecastId } });
  if (!item) return null;

  let newStatus = "REORDER_PLACED";
  let newRec = "AWAITING_SUPPLIER";
  let newPo = "APPROVED_DISPATCHED";
  let newStock = item.currentStock;

  if (actionType === "DISPATCH_PO") {
    newStatus = "REORDER_PLACED";
    newRec = "AWAITING_SUPPLIER";
    newPo = "APPROVED_DISPATCHED";
  } else if (actionType === "DELIVERED") {
    newStatus = "HEALTHY_BUFFER";
    newRec = "MAINTAIN_CURRENT_STOCK";
    newPo = "DELIVERED";
    newStock = item.currentStock + item.recommendedPoUnits; // Add PO shipment to stock
  } else if (actionType === "CLEARANCE") {
    newStatus = "OVERSTOCKED_DEAD_CAPITAL";
    newRec = "INITIATE_CLEARANCE_BUNDLE";
    newPo = "NONE";
  }

  const updated = await prisma.inventoryForecastProfile.update({
    where: { id: forecastId },
    data: {
      stockStatus: newStatus,
      aiActionRecommendation: newRec,
      poStatus: newPo,
      currentStock: newStock,
    },
  });

  return updated;
}
