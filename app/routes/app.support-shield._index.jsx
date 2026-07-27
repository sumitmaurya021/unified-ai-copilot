import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { analyzeCustomerSentiment, generateSupportResponse } from "../services/supportShield";
import {
  seedInitialSupportTickets,
  executeSupportAction,
} from "../services/supportShield.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialSupportTickets(prisma, shop, admin);

  const tickets = await prisma.supportTicketProfile.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  let totalAutonomous = 0;
  let totalEscalated = 0;
  let totalPending = 0;

  for (const t of tickets) {
    if (t.resolutionStatus === "RESOLVED_AUTONOMOUSLY") totalAutonomous++;
    else if (t.resolutionStatus === "ESCALATED_TO_HUMAN") totalEscalated++;
    else totalPending++;
  }

  const deflectionRate = tickets.length > 0 ? Math.round((totalAutonomous / tickets.length) * 100) : 0;

  return {
    tickets,
    stats: {
      deflectionRate,
      totalAutonomous,
      totalEscalated,
      totalPending,
      totalTickets: tickets.length,
    },
  };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESOLVE") {
    const id = formData.get("id");
    const resolution = formData.get("resolution"); // APPROVE_SEND, ESCALATE, CLOSE
    await executeSupportAction(prisma, id, resolution, admin);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.supportTicketProfile.deleteMany({ where: { shop } });
    await seedInitialSupportTickets(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function SupportShieldDashboard() {
  const { tickets, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simMessage, setSimMessage] = useState("Where is my order #1084? It has been 3 days and I haven't received tracking.");

  const simSentiment = analyzeCustomerSentiment(simMessage);
  const simResponse = generateSupportResponse({ customerMessage: simMessage, customerName: "Sarah Jenkins" });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Ticket action processed!";
        if (fetcher.data.resolution === "APPROVE_SEND") msg = "🚀 AI response sent & ticket resolved autonomously!";
        if (fetcher.data.resolution === "ESCALATE") msg = "🚨 Escalated to VIP Priority Human Agent!";
        if (fetcher.data.resolution === "CLOSE") msg = "✅ Ticket marked closed!";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo support tickets reset successfully!");
      }
    }
  }, [fetcher.data, shopify]);

  const handleResolve = (id, resolution) => {
    fetcher.submit({ actionType: "RESOLVE", id, resolution }, { method: "POST" });
  };

  const handleResetDemo = () => {
    fetcher.submit({ actionType: "RESET_DEMO" }, { method: "POST" });
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      
      {/* Module Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🛡️ SupportShield AI — Autonomous L1 Support Agent
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Sentiment analysis, instant WISMO tracking, ReturnGuard self-service integration & VIP escalation.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155" }}>
          🔄 Reset Support Tickets
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(6, 182, 212, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🤖 L1 AUTONOMOUS DEFLECTION RATE</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.deflectionRate}% Auto-Resolved</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>{stats.totalAutonomous} of {stats.totalTickets} inquiries handled</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚨 VIP ESCALATED TICKETS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalEscalated} Tickets</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>High emotion / legal risk escalated to humans</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #78350f 0%, #d97706 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(217, 119, 6, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>⏳ PENDING AI RESOLUTIONS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalPending} Queue</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Awaiting 1-click human verification</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Customer Support Simulator
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Type a customer inquiry below to test AI sentiment scoring, intent detection, and automated response generation:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Customer Message Input</label>
              <textarea rows={4} value={simMessage} onChange={(e) => setSimMessage(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button onClick={() => setSimMessage("Where is my order #1084? It has been 3 days.")} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>📦 WISMO Check</button>
              <button onClick={() => setSimMessage("I want to return my dress it doesn't fit properly.")} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>🔄 Return Link</button>
              <button onClick={() => setSimMessage("THIS IS A SCAM! I will report your store to my lawyer!")} style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>🚨 Furious Complaint</button>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🧠 AI Customer Telemetry</span>
                <span style={{ backgroundColor: simSentiment.score < -0.3 ? "#fef2f2" : "#ecfdf5", color: simSentiment.score < -0.3 ? "#dc2626" : "#059669", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                  Sentiment: {simSentiment.label} ({simSentiment.score})
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5" }}>
                • <strong>Detected Intent:</strong> {simResponse.intent}<br />
                • <strong>AI Confidence:</strong> {(simResponse.confidence * 100).toFixed(0)}%<br />
                • <strong>Generated Response Preview:</strong>
                <div style={{ background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "4px", fontSize: "11px", color: "#1e293b" }}>
                  "{simResponse.suggestedReply}"
                </div>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "#fef2f2" : "#f0f9ff", border: "1px solid", borderColor: simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "#fca5a5" : "#bae6fd", fontSize: "11px", fontWeight: "800", color: simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "#dc2626" : "#0369a1" }}>
              Action: {simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "🚨 Priority Escalation Required" : "🚀 Auto-Send Reply"}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Live Customer Support Tickets Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {tickets.map((t) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (t.resolutionStatus === "RESOLVED_AUTONOMOUSLY") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (t.resolutionStatus === "ESCALATED_TO_HUMAN") { statusBg = "#fef2f2"; statusColor = "#dc2626"; }
          if (t.resolutionStatus === "PENDING_REVIEW") { statusBg = "#fffbeb"; statusColor = "#b45309"; }

          return (
            <div key={t.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>👤 {t.customerName}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>Order #{t.orderId} • Intent: {t.inquiryIntent}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: t.sentimentScore < -0.3 ? "#fef2f2" : "#ecfdf5", color: t.sentimentScore < -0.3 ? "#dc2626" : "#059669" }}>
                    Sentiment: {t.sentimentLabel}
                  </span>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                    {t.resolutionStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "4px" }}>CUSTOMER MESSAGE:</div>
                  <div style={{ fontSize: "13px", color: "#1e293b" }}>"{t.customerMessage}"</div>
                </div>

                <div style={{ background: "#f0f9ff", padding: "12px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#0369a1", marginBottom: "4px" }}>AI SUGGESTED REPLY:</div>
                  <div style={{ fontSize: "12px", color: "#0f172a" }}>"{t.aiSuggestedReply}"</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {t.resolutionStatus !== "RESOLVED_AUTONOMOUSLY" && (
                  <button onClick={() => handleResolve(t.id, "APPROVE_SEND")} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    🚀 Approve & Send AI Reply
                  </button>
                )}
                {t.resolutionStatus !== "ESCALATED_TO_HUMAN" && (
                  <button onClick={() => handleResolve(t.id, "ESCALATE")} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    🚨 Escalate to VIP Human Agent
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
