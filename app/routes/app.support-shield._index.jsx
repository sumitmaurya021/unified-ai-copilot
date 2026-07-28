import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialSupportTickets,
  executeSupportAction,
} from "../services/supportShield.server";
import {
  analyzeCustomerSentiment,
  generateSupportResponse,
} from "../services/supportShield";

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

export default function SupportShieldRoute() {
  const { tickets, stats } = useLoaderData();
  const fetcher = useFetcher();

  const [simMessage, setSimMessage] = useState("Where is my order #1084? It has been 3 days and I haven't received tracking.");

  const simSentiment = analyzeCustomerSentiment(simMessage);
  const simResponse = generateSupportResponse({
    customerEmail: "sim@example.com",
    orderId: "#1084",
    queryText: simMessage,
    orderStatus: "Out for Delivery Today",
  });

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
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🛡️ SupportShield AI — Autonomous L1 Support Agent
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Sentiment analysis, instant WISMO tracking, ReturnGuard self-service integration & VIP escalation.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Customer Support Simulator
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Type a customer inquiry below to test AI sentiment scoring, intent detection, and automated response generation:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Customer Message Input</label>
              <textarea rows={4} value={simMessage} onChange={(e) => setSimMessage(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button onClick={() => setSimMessage("Where is my order #1084? It has been 3 days.")} className="saas-btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>📦 WISMO Check</button>
              <button onClick={() => setSimMessage("I want to return my dress it doesn't fit properly.")} className="saas-btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>🔄 Return Link</button>
              <button onClick={() => setSimMessage("THIS IS A SCAM! I will report your store to my lawyer!")} className="saas-btn btn-danger" style={{ padding: "4px 8px", fontSize: "11px" }}>🚨 Furious Complaint</button>
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>🧠 AI Customer Telemetry</span>
                <span className={`saas-badge ${simSentiment.score < -0.3 ? "badge-danger" : "badge-success"}`}>
                  Sentiment: {simSentiment.label} ({simSentiment.score})
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                • <strong>Detected Intent:</strong> {simResponse.intent}<br />
                • <strong>AI Confidence:</strong> {(simResponse.confidence * 100).toFixed(0)}%<br />
                • <strong>Generated Response Preview:</strong>
                <div style={{ background: "var(--bg-subtle)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-light)", marginTop: "4px", fontSize: "11px", color: "var(--text-main)" }}>
                  "{simResponse.suggestedReply}"
                </div>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "var(--danger-bg)" : "var(--info-bg)", border: "1px solid", borderColor: simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "var(--danger-border)" : "var(--info-border)", fontSize: "11px", fontWeight: "800", color: simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "var(--danger-main)" : "var(--info-main)" }}>
              Action: {simResponse.actionNeeded === "ESCALATE_TO_HUMAN" ? "🚨 Priority Escalation Required" : "🚀 Auto-Send Reply"}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Live Customer Support Tickets Queue
      </h2>

      {tickets.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>No Support Tickets Available</div>
          <div style={{ fontSize: "13px" }}>Inbound customer inquiries and WISMO tickets will automatically appear here for autonomous AI sentiment triage and response drafting.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {tickets.map((t) => {
            let isResolved = t.resolutionStatus === "RESOLVED_AUTONOMOUSLY";
            let isEscalated = t.resolutionStatus === "ESCALATED_TO_HUMAN";

            return (
              <div key={t.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>👤 {t.customerEmail}</span>
                    <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Order #{t.orderId} • Intent: {t.queryCategory}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`saas-badge ${t.aiSentimentScore < 0 ? "badge-danger" : "badge-success"}`}>
                      Sentiment: {t.aiSentimentScore}
                    </span>
                    <span className={`saas-badge ${isResolved ? "badge-success" : isEscalated ? "badge-danger" : "badge-warning"}`}>
                      {t.resolutionStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>CUSTOMER INQUIRY</div>
                    <div style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: "1.4" }}>"{t.customerQuery}"</div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>🤖 AI DRAFTED RESPONSE ({t.aiConfidenceScore}% Confidence)</div>
                    <div style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: "1.4" }}>{t.aiDraftedResponse}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => handleResolve(t.id, "ESCALATE")}
                    disabled={fetcher.state !== "idle" || isEscalated}
                    className="saas-btn btn-danger"
                  >
                    ⚠️ Escalate to Human Support
                  </button>

                  <button
                    onClick={() => handleResolve(t.id, "APPROVE_SEND")}
                    disabled={fetcher.state !== "idle" || isResolved}
                    className="saas-btn btn-primary"
                  >
                    {isResolved ? "✓ Auto-Resolved & Sent" : "🚀 Approve & Send Response"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
