/**
 * InventoryOracle AI Copilot Server Engine
 * Handles database seeding from real Shopify products and PO dispatch mutations.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { calculateInventoryForecast, evaluateInventoryHealth } from "./inventoryOracle";
import { predictInventoryActionWithGroq, fetchRealStoreProducts } from "./groqAi.server";

export { calculateInventoryForecast, evaluateInventoryHealth };

/**
 * Seeds initial inventory forecasts from REAL Shopify store products.
 */
export async function seedInitialInventoryForecasts(prisma, shop, admin = null) {
  const count = await prisma.inventoryForecastProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  if (admin) {
    const realProducts = await fetchRealStoreProducts(admin, 15);
    if (realProducts && realProducts.length > 0) {
      for (const p of realProducts) {
        const stockVal = p.totalInventory !== undefined && p.totalInventory !== null ? p.totalInventory : 15;
        const velVal = Math.round((stockVal < 10 ? 2.5 : 0.8) * 10) / 10;

        itemsToSeed.push({
          shop,
          productId: p.id,
          productTitle: p.title || "Untitled SKU",
          currentStock: stockVal,
          dailySalesVelocity: velVal,
          supplierLeadTimeDays: 14,
        });
      }
    }
  }

  for (const item of itemsToSeed) {
    let aiPred = await predictInventoryActionWithGroq({
      productTitle: item.productTitle,
      currentStock: item.currentStock,
      salesVelocity: item.dailySalesVelocity,
      leadTime: item.supplierLeadTimeDays,
    });

    const evalResult = evaluateInventoryHealth({
      productTitle: item.productTitle,
      currentStock: item.currentStock,
      dailySalesVelocity: item.dailySalesVelocity,
      supplierLeadTimeDays: item.supplierLeadTimeDays,
    });

    const statusVal = aiPred ? aiPred.stockStatus : evalResult.stockStatus;
    const poUnitsVal = aiPred ? aiPred.recommendedPoUnits : evalResult.recommendedPoUnits;
    const recVal = aiPred ? aiPred.aiActionRecommendation : evalResult.aiActionRecommendation;

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
        recommendedPoUnits: poUnitsVal,
        stockStatus: statusVal,
        aiActionRecommendation: recVal,
        poStatus: statusVal.includes("CRITICAL") ? "DRAFT_AI" : "NONE",
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
export async function executeInventoryAction(prisma, forecastId, actionType = "APPROVE_PO") {
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
    newStock = item.currentStock + item.recommendedPoUnits;
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
