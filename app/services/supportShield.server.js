/**
 * SupportShield AI Copilot Server Engine
 * Handles database seeding from real Shopify orders and ticket resolution mutations.
 * Powered by Groq Llama 3 with automatic heuristic fallback.
 */
import { analyzeCustomerSentiment, generateSupportResponse } from "./supportShield";
import { analyzeSupportWithGroq, fetchRealStoreOrders } from "./groqAi.server";

export { analyzeCustomerSentiment, generateSupportResponse };

/**
 * Seeds initial support tickets from REAL Shopify store orders and customers.
 */
export async function seedInitialSupportTickets(prisma, shop, admin = null) {
  const count = await prisma.supportTicketProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  let itemsToSeed = [];

  if (admin) {
    const realOrders = await fetchRealStoreOrders(admin, 10);
    if (realOrders && realOrders.length > 0) {
      for (const o of realOrders) {
        const custEmail = o.customer?.email || "customer@shopify.com";
        const custName = o.customer?.firstName || "Valuable Customer";
        const ordName = o.name || "Order";

        itemsToSeed.push({
          shop,
          ticketId: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
          customerEmail: custEmail,
          orderId: ordName,
          customerQuery: `Hi! Where is my order ${ordName}? Can you please give me an estimated delivery update?`,
          statusOverride: "RESOLVED_AUTONOMOUSLY",
          custName,
        });
      }
    }
  }

  for (const t of itemsToSeed) {
    let aiSupport = await analyzeSupportWithGroq({
      customerName: t.custName || "Customer",
      customerMessage: t.customerQuery,
    });

    const generated = generateSupportResponse({
      customerEmail: t.customerEmail,
      orderId: t.orderId,
      queryText: t.customerQuery,
      orderStatus: "In Transit / Processing",
    });

    const reply = aiSupport ? aiSupport.suggestedReply : generated.aiResponse;
    const cat = aiSupport ? aiSupport.intent : generated.queryCategory;

    await prisma.supportTicketProfile.create({
      data: {
        shop,
        ticketId: t.ticketId,
        customerEmail: t.customerEmail,
        orderId: t.orderId,
        queryCategory: cat,
        customerQuery: t.customerQuery,
        aiResponse: reply,
        aiSentimentScore: generated.aiSentimentScore,
        resolutionStatus: t.statusOverride || generated.resolutionStatus,
        aiConfidenceScore: generated.aiConfidenceScore,
        aiActionTaken: generated.aiActionTaken,
      },
    });
  }

  await prisma.supportPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      autoResolveConfidenceThreshold: 85,
      escalateNegativeSentimentThreshold: -0.5,
      supportTone: "Empathetic & Professional",
      enableWismoAutomation: true,
    },
  });

  return true;
}

/**
 * Autonomously resolves or escalates a support ticket.
 */
export async function executeSupportAction(prisma, ticketId, actionType = "APPROVE_SEND") {
  let newStatus = "RESOLVED_AUTONOMOUSLY";
  if (actionType === "ESCALATE") newStatus = "ESCALATED_TO_HUMAN";
  if (actionType === "CLOSE") newStatus = "CLOSED";

  const updated = await prisma.supportTicketProfile.update({
    where: { id: ticketId },
    data: { resolutionStatus: newStatus },
  });

  return updated;
}
