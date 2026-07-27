/**
 * ReturnGuard AI Copilot Server Engine
 * Handles database seeding and resolution processing.
 */
import { calculateUnitEconomics, analyzeReturnPhoto, generateDeflectionOffer } from "./returnGuard";

export { calculateUnitEconomics, analyzeReturnPhoto, generateDeflectionOffer };

/**
 * Seeds the database with realistic demo return requests if the shop has no data.
 */
export async function seedInitialReturnRequests(prisma, shop) {
  const existingCount = await prisma.returnRequest.count({ where: { shop } });
  if (existingCount > 0) {
    return false;
  }

  const demoRequests = [
    {
      shop,
      orderId: "#1042",
      orderName: "Order #1042",
      customerEmail: "sarah.jenkins@example.com",
      itemTitle: "Neon Crimson Runner Sneaker",
      itemPrice: 140.0,
      cogs: 35.0,
      returnShippingFee: 18.0,
      returnReason: "Defective sole stitching",
      photoUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
      aiInspectionStatus: "VERIFIED_DEFECT",
      aiInspectionNotes: "Vision LLM detected 1.2cm sole separation at right toe box matching manufacturing defect signature. Auto-authorized replacement.",
      deflectionOffer: "Instant Replacement Dispatched (No RMA required)",
      resolutionStatus: "EXCHANGED",
    },
    {
      shop,
      orderId: "#1039",
      orderName: "Order #1039",
      customerEmail: "alex.miller@example.com",
      itemTitle: "Velvet Evening Gown - Midnight Blue",
      itemPrice: 280.0,
      cogs: 60.0,
      returnShippingFee: 22.0,
      returnReason: "Size too small / Fit issue",
      photoUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80",
      aiInspectionStatus: "WARDROBING_SUSPECTED",
      aiInspectionNotes: "Cross-merchant behavioral graph anomaly: Customer has returned 4 formal dresses post-weekend across participating stores. Mandatory warehouse inspection required.",
      deflectionOffer: "Standard Return (Physical Inspection Required)",
      resolutionStatus: "PENDING",
    },
    {
      shop,
      orderId: "#1038",
      orderName: "Order #1038",
      customerEmail: "david.c@example.com",
      itemTitle: "Heavyweight Fleece Hoodie",
      itemPrice: 85.0,
      cogs: 20.0,
      returnShippingFee: 16.0,
      returnReason: "Changed mind",
      photoUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&q=80",
      aiInspectionStatus: "NORMAL_WEAR",
      aiInspectionNotes: "Return shipping ($16) + restock cost erodes 65% of item gross margin. AI Deflection Engine triggered.",
      deflectionOffer: "🎁 Keep this item for 40% OFF ($34.00 instant refund) without shipping it back!",
      resolutionStatus: "PENDING",
    },
    {
      shop,
      orderId: "#1034",
      orderName: "Order #1034",
      customerEmail: "emily.watson@example.com",
      itemTitle: "Wireless Noise-Canceling Headphones",
      itemPrice: 199.0,
      cogs: 85.0,
      returnShippingFee: 15.0,
      returnReason: "Left earbud intermittent static",
      photoUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
      aiInspectionStatus: "VERIFIED_DEFECT",
      aiInspectionNotes: "Vision LLM verified serial number and condition. Auto-authorized replacement dispatch to preserve customer LTV.",
      deflectionOffer: "Instant Replacement Dispatched (No RMA required)",
      resolutionStatus: "EXCHANGED",
    },
    {
      shop,
      orderId: "#1029",
      orderName: "Order #1029",
      customerEmail: "marcus.v@example.com",
      itemTitle: "Organic Cotton Yoga Pants",
      itemPrice: 75.0,
      cogs: 18.0,
      returnShippingFee: 14.0,
      returnReason: "Color slightly darker than photo",
      photoUrl: "https://images.unsplash.com/photo-1506634572416-48cdfe530110?w=400&q=80",
      aiInspectionStatus: "NORMAL_WEAR",
      aiInspectionNotes: "Return shipping erodes 78% of margin. AI Deflection negotiated 40% keep-it discount.",
      deflectionOffer: "🎁 Keep this item for 40% OFF ($30.00 instant refund) without shipping it back!",
      resolutionStatus: "DEFLECTED",
    }
  ];

  for (const req of demoRequests) {
    await prisma.returnRequest.create({ data: req });
  }

  // Ensure policy config exists
  await prisma.returnPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      autoDeflectThresholdPercent: 20.0,
      defaultKeepItDiscountPercent: 40.0,
      autoFlagWardrobing: true,
    },
  });

  return true;
}

/**
 * Autonomously resolves a return request (Deflect, Approve, Reject).
 */
export async function processAIResolution(prisma, returnRequestId, actionType, notes = "") {
  let status = "PENDING";
  if (actionType === "DEFLECT") status = "DEFLECTED";
  if (actionType === "EXCHANGE") status = "EXCHANGED";
  if (actionType === "APPROVE") status = "RETURN_APPROVED";
  if (actionType === "REJECT") status = "REJECTED_FRAUD";

  const updated = await prisma.returnRequest.update({
    where: { id: returnRequestId },
    data: {
      resolutionStatus: status,
      ...(notes ? { aiInspectionNotes: notes } : {}),
    },
  });

  return updated;
}
