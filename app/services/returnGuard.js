/**
 * ReturnGuard AI Copilot Shared Logic
 * Handles unit economics calculations, AI vision inspection heuristics,
 * and dynamic deflection offer generation (safe for both client and server).
 */

/**
 * Calculates the exact unit economic profit impact of processing a physical return
 * versus offering an autonomous "Keep-It" retention discount.
 */
export function calculateUnitEconomics({ itemPrice, cogs, returnShippingFee }) {
  const price = parseFloat(itemPrice) || 0;
  const cost = parseFloat(cogs) || 0;
  const shipping = parseFloat(returnShippingFee) || 0;

  // Standard gross margin without return
  const grossMargin = price - cost;

  // Cost of processing physical return (shipping + 15% restock/inspection depreciation)
  const restockLoss = cost * 0.15;
  const totalReturnCost = shipping + restockLoss;
  const netProfitWithReturn = grossMargin - totalReturnCost;

  // AI Deflection model: Offer a 40% Keep-It discount store credit/refund
  const keepItDiscountPercent = 40;
  const keepItRefundAmount = price * (keepItDiscountPercent / 100);
  const netProfitWithDeflection = price - keepItRefundAmount - cost;

  // Net dollar savings by deflecting instead of returning
  const profitSavedByDeflection = netProfitWithDeflection - netProfitWithReturn;

  let recommendation = "ACCEPT_RETURN";
  let reason = "Item has high gross margin and low return shipping fee; profitable to restock.";

  if (profitSavedByDeflection > 0) {
    recommendation = "DEFLECT";
    reason = `Return shipping ($${shipping.toFixed(2)}) and inspection depreciation erode ${((totalReturnCost / grossMargin) * 100).toFixed(0)}% of margin. Deflecting with 40% discount saves $${profitSavedByDeflection.toFixed(2)} net profit.`;
  }

  return {
    itemPrice: price,
    cogs: cost,
    returnShippingFee: shipping,
    grossMargin: grossMargin.toFixed(2),
    totalReturnCost: totalReturnCost.toFixed(2),
    netProfitWithReturn: netProfitWithReturn.toFixed(2),
    keepItDiscountPercent,
    keepItRefundAmount: keepItRefundAmount.toFixed(2),
    netProfitWithDeflection: netProfitWithDeflection.toFixed(2),
    profitSavedByDeflection: profitSavedByDeflection.toFixed(2),
    recommendation,
    reason,
  };
}

/**
 * Simulates multi-modal AI Vision inspection (e.g. GPT-4o / Claude 3.5 Sonnet Vision)
 * on customer uploaded return photos to verify defects or detect wardrobing fraud.
 */
export function analyzeReturnPhoto({ itemTitle = "", returnReason = "", photoUrl = "" }) {
  const titleLower = itemTitle.toLowerCase();
  const reasonLower = returnReason.toLowerCase();

  if (reasonLower.includes("defect") || reasonLower.includes("damage") || reasonLower.includes("broken")) {
    return {
      status: "VERIFIED_DEFECT",
      confidence: 0.94,
      notes: `Vision LLM detected physical anomaly in ${itemTitle}. High probability (94%) of manufacturing defect matching quality assurance error signatures. Authorized for instant replacement or full refund without RMA return required.`,
    };
  }

  if (titleLower.includes("gown") || titleLower.includes("dress") || titleLower.includes("formal") || titleLower.includes("suit")) {
    return {
      status: "WARDROBING_SUSPECTED",
      confidence: 0.88,
      notes: `High wardrobing risk flagged (88%). Cross-merchant behavioral graph indicates customer has returned 4 high-value apparel items post-weekend across participating stores. Recommended action: Require mandatory physical warehouse inspection before issuing refund.`,
    };
  }

  return {
    status: "NORMAL_WEAR",
    confidence: 0.91,
    notes: `Vision LLM verified item condition as clean with original tags attached. Standard buyer remorse / sizing mismatch. Unit economics engine triggered for automatic deflection negotiation.`,
  };
}

/**
 * Generates a dynamic customer retention offer tailored to preserve unit profit.
 */
export function generateDeflectionOffer({ itemPrice, cogs, returnShippingFee, returnReason }) {
  const economics = calculateUnitEconomics({ itemPrice, cogs, returnShippingFee });
  
  if (economics.recommendation === "DEFLECT") {
    return `🎁 AI Copilot Exclusive: Keep this item for ${economics.keepItDiscountPercent}% OFF ($${economics.keepItRefundAmount} instant refund) without the hassle of shipping it back!`;
  }

  return `🔄 Instant Exchange: Ship back for free and get an extra $10 store credit bonus toward your next size or style!`;
}
