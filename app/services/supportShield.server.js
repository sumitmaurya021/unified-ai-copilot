/**
 * SupportShield AI Copilot Server Engine
 * Handles database seeding and ticket resolution mutations.
 */
import { analyzeCustomerSentiment, generateSupportResponse } from "./supportShield";

export { analyzeCustomerSentiment, generateSupportResponse };

/**
 * Seeds initial demo support tickets if the database is empty for the shop.
 */
export async function seedInitialSupportTickets(prisma, shop) {
  const count = await prisma.supportTicketProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoTickets = [
    {
      shop,
      ticketId: "TKT-8801",
      customerEmail: "sarah.jenkins@example.com",
      orderId: "#1042",
      customerQuery: "Where is my order? Can you give me the tracking link or tell me when it will arrive?",
      statusOverride: "RESOLVED_AUTONOMOUSLY",
    },
    {
      shop,
      ticketId: "TKT-8802",
      customerEmail: "alex.miller@example.com",
      orderId: "#1039",
      customerQuery: "Hi, the dress size is a bit too small. How do I start an exchange or return for a larger size?",
      statusOverride: "RESOLVED_AUTONOMOUSLY",
    },
    {
      shop,
      ticketId: "TKT-8803",
      customerEmail: "david.c@example.com",
      orderId: "#1038",
      customerQuery: "I am furious!! My hoodie arrived with a broken zipper and looks damaged! This is terrible quality, I want a refund right now or I am calling my lawyer!",
      statusOverride: "ESCALATED_TO_HUMAN",
    },
    {
      shop,
      ticketId: "TKT-8804",
      customerEmail: "emily.watson@example.com",
      orderId: "#1034",
      customerQuery: "Hi, I accidentally typed the wrong apartment number on my shipping address! Can you please change it to Apt 4B before it ships?",
      statusOverride: "RESOLVED_AUTONOMOUSLY",
    },
    {
      shop,
      ticketId: "TKT-8805",
      customerEmail: "marcus.v@example.com",
      orderId: "#1029",
      customerQuery: "Do you guys offer express international shipping to Canada and how long does it take?",
      statusOverride: "RESOLVED_AUTONOMOUSLY",
    }
  ];

  for (const t of demoTickets) {
    const generated = generateSupportResponse({
      customerEmail: t.customerEmail,
      orderId: t.orderId,
      queryText: t.customerQuery,
      orderStatus: t.ticketId === "TKT-8801" ? "Out for Delivery Today" : "In Transit",
    });

    await prisma.supportTicketProfile.create({
      data: {
        shop,
        ticketId: t.ticketId,
        customerEmail: t.customerEmail,
        orderId: t.orderId,
        queryCategory: generated.queryCategory,
        customerQuery: t.customerQuery,
        aiResponse: generated.aiResponse,
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
