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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialSupportTickets(prisma, shop);

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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESOLVE") {
    const id = formData.get("id");
    const resolution = formData.get("resolution"); // APPROVE_SEND, ESCALATE, CLOSE
    await executeSupportAction(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.supportTicketProfile.deleteMany({ where: { shop } });
    await seedInitialSupportTickets(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function SupportShieldDashboard() {
  const { tickets, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive simulator
  const [simQuery, setSimQuery] = useState("Where is my order #1042? Can you send me the tracking link?");
  const simResult = generateSupportResponse({
    customerEmail: "live.test@example.com",
    orderId: "#1042",
    queryText: simQuery,
    orderStatus: "Out for Delivery Today",
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "AI Reply sent to customer!";
        if (fetcher.data.resolution === "ESCALATE") msg = "Ticket escalated to Senior Human Manager!";
        if (fetcher.data.resolution === "CLOSE") msg = "Support ticket marked as closed!";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo support ticket queue reset successfully!");
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
    <s-page heading="🛡️ SupportShield AI — Autonomous L1 Support & Policy Enforcement Agent">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Demo Queue
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="Autonomous Customer Experience (CX) Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🛡️ AUTONOMOUS L1 DEFLECTION RATE</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.deflectionRate}% <span style={{ fontSize: "18px", color: "#bfdbfe" }}>({stats.totalAutonomous} / {stats.totalTickets})</span></div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Instantly resolved without staff intervention</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>⚡ AVERAGE RESOLUTION SPEED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>&lt; 2.4 sec</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Compared to 4.2 hours manual staff average</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚨 ESCALATED VIP COMPLAINTS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalEscalated} Tickets</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>High friction or damage flagged for human review</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Support Simulator Section */}
      <s-section heading="🔬 Live SupportShield AI Simulator & Sentiment Engine">
        <s-paragraph>
          Test the autonomous support agent in real-time! Type any customer inquiry or select a preset below to see how SupportShield evaluates emotion, computes confidence, and formulates empathetic replies or escalations.
        </s-paragraph>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => setSimQuery("Where is my order #1042? Can you send me the tracking link?")}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            📦 WISMO Tracking Check
          </button>
          <button
            onClick={() => setSimQuery("Hi, the hoodie size is too small. How do I start an exchange or return for a larger size?")}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🔄 ReturnGuard Portal Link
          </button>
          <button
            onClick={() => setSimQuery("I am furious!! My item arrived broken and damaged! This is terrible quality, I want a refund immediately or I am calling my lawyer!")}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#fee2e2", color: "#991b1b", fontSize: "12px", cursor: "pointer", fontWeight: "700" }}
          >
            😡 Furious Damage Complaint (Trigger Escalation)
          </button>
          <button
            onClick={() => setSimQuery("I accidentally typed the wrong apartment number on my shipping address! Can you change it to Apt 4B before it ships?")}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🏠 Address Modification
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
              👤 Customer Inquiry Message
            </label>
            <textarea
              rows="6"
              value={simQuery}
              onChange={(e) => setSimQuery(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #94a3b8", fontSize: "13px", fontFamily: "inherit" }}
            />
            <div style={{ marginTop: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Detected Intent:</span>
              <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#e0e7ff", color: "#3730a3" }}>
                {simResult.queryCategory}
              </span>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>🤖 AI Formulated Reply & Action</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: simResult.aiSentimentScore < 0 ? "#fee2e2" : "#d1fae5", color: simResult.aiSentimentScore < 0 ? "#991b1b" : "#065f46" }}>
                    Sentiment: {simResult.aiSentimentScore} ({simResult.aiSentimentScore < 0 ? "😡 Angry" : "😊 Calm"})
                  </span>
                  <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#f1f5f9", color: "#334155" }}>
                    Confidence: {simResult.aiConfidenceScore}%
                  </span>
                </div>
              </div>

              <div style={{ fontSize: "13px", color: "#334155", marginBottom: "12px", background: "#f8fafc", padding: "12px", borderRadius: "6px", maxHeight: "160px", overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: "1.5", border: "1px solid #e2e8f0" }}>
                {simResult.aiResponse}
              </div>

              <div style={{ fontSize: "12px", color: "#475569", background: "#f1f5f9", padding: "8px 12px", borderRadius: "6px" }}>
                <strong>⚡ AI Action Taken:</strong> {simResult.aiActionTaken}
              </div>
            </div>

            <div style={{ marginTop: "16px", padding: "10px", backgroundColor: simResult.resolutionStatus === "ESCALATED_TO_HUMAN" ? "#fef2f2" : "#f0fdf4", borderRadius: "6px", borderLeft: `4px solid ${simResult.resolutionStatus === "ESCALATED_TO_HUMAN" ? "#ef4444" : "#10b981"}`, fontSize: "12px", color: simResult.resolutionStatus === "ESCALATED_TO_HUMAN" ? "#991b1b" : "#065f46" }}>
              <strong>Policy Decision:</strong> {simResult.reason}
            </div>
          </div>
        </div>
      </s-section>

      {/* Live L1 Support Ticket Queue Section */}
      <s-section heading="⚡ Live L1 Customer Support Queue">
        <s-paragraph>
          Manage incoming tickets. SupportShield AI autonomously drafts responses and executes 1-click workflows (like sending carrier tracking links or ReturnGuard portal authorizations).
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {tickets.map((t) => {
            let statusBg = "#f1f5f9";
            let statusColor = "#475569";
            if (t.resolutionStatus === "RESOLVED_AUTONOMOUSLY") { statusBg = "#d1fae5"; statusColor = "#065f46"; }
            if (t.resolutionStatus === "ESCALATED_TO_HUMAN") { statusBg = "#fee2e2"; statusColor = "#991b1b"; }
            if (t.resolutionStatus === "CLOSED") { statusBg = "#e2e8f0"; statusColor = "#64748b"; }

            return (
              <div key={t.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                {/* Top Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{t.ticketId} — {t.customerEmail}</span>
                    <span style={{ marginLeft: "12px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#f3f4f6", color: "#475569" }}>
                      Order {t.orderId}
                    </span>
                    <span style={{ marginLeft: "6px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#e0e7ff", color: "#3730a3" }}>
                      {t.queryCategory}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: t.aiSentimentScore < 0 ? "#fee2e2" : "#d1fae5", color: t.aiSentimentScore < 0 ? "#991b1b" : "#065f46" }}>
                      {t.aiSentimentScore < 0 ? "😡 High Friction" : "😊 Positive / Neutral"}
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: statusBg, color: statusColor, textTransform: "uppercase" }}>
                      {t.resolutionStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Grid Content */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {/* Left: Customer Query */}
                  <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                      💬 Customer Message:
                    </div>
                    <div style={{ fontSize: "14px", color: "#1e293b", fontStyle: "italic", lineHeight: "1.5" }}>
                      "{t.customerQuery}"
                    </div>
                  </div>

                  {/* Right: AI Proposed Reply */}
                  <div style={{ background: "#f0fdf4", padding: "14px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#065f46", textTransform: "uppercase" }}>
                        🤖 AI Formulated Reply (Confidence: {t.aiConfidenceScore}%)
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#064e3b", maxHeight: "110px", overflowY: "auto", whiteSpace: "pre-wrap", marginBottom: "8px", lineHeight: "1.4" }}>
                      {t.aiResponse}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#047857", background: "#d1fae5", padding: "4px 8px", borderRadius: "4px" }}>
                      ⚡ Action: {t.aiActionTaken}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {t.resolutionStatus !== "CLOSED" ? (
                    <>
                      <s-button onClick={() => handleResolve(t.id, "APPROVE_SEND")}>
                        🚀 Approve & Send AI Reply
                      </s-button>
                      <s-button onClick={() => handleResolve(t.id, "ESCALATE")}>
                        👤 Take Over (Human VIP Escalation)
                      </s-button>
                      <s-button onClick={() => handleResolve(t.id, "CLOSE")}>
                        ✅ Mark Resolved & Close
                      </s-button>
                    </>
                  ) : (
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#64748b", padding: "4px 0" }}>
                      ✅ Ticket Closed & Archived
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </s-section>
    </s-page>
  );
}
