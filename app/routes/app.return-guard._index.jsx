import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateUnitEconomics } from "../services/returnGuard";
import {
  seedInitialReturnRequests,
  processAIResolution,
} from "../services/returnGuard.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Seed demo data if table is empty
  await seedInitialReturnRequests(prisma, shop);

  const returnRequests = await prisma.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  const config = await prisma.returnPolicyConfig.findUnique({
    where: { shop },
  });

  // Calculate summary KPI stats
  let totalDeflected = 0;
  let totalProfitSaved = 0;
  let fraudCaught = 0;

  for (const req of returnRequests) {
    const economics = calculateUnitEconomics({
      itemPrice: req.itemPrice,
      cogs: req.cogs,
      returnShippingFee: req.returnShippingFee,
    });

    if (req.resolutionStatus === "DEFLECTED") {
      totalDeflected++;
      totalProfitSaved += parseFloat(economics.profitSavedByDeflection || 0);
    }
    if (req.aiInspectionStatus === "WARDROBING_SUSPECTED") {
      fraudCaught++;
    }
  }

  return {
    returnRequests,
    config,
    stats: {
      totalDeflected,
      totalProfitSaved: totalProfitSaved.toFixed(2),
      fraudCaught,
      totalRequests: returnRequests.length,
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
    const resolution = formData.get("resolution"); // DEFLECT, EXCHANGE, APPROVE, REJECT
    await processAIResolution(prisma, id, resolution);
    return { success: true, action: "RESOLVE" };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.returnRequest.deleteMany({ where: { shop } });
    await seedInitialReturnRequests(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function ReturnGuardDashboard() {
  const { returnRequests, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive simulator
  const [simPrice, setSimPrice] = useState("120");
  const [simCogs, setSimCogs] = useState("30");
  const [simShipping, setSimShipping] = useState("18");
  const simEconomics = calculateUnitEconomics({
    itemPrice: simPrice,
    cogs: simCogs,
    returnShippingFee: simShipping,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        shopify.toast.show("AI Copilot Resolution Executed!");
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo data reset successfully!");
      }
    }
  }, [fetcher.data, shopify]);

  const handleResolve = (id, resolution) => {
    fetcher.submit(
      { actionType: "RESOLVE", id, resolution },
      { method: "POST" }
    );
  };

  const handleResetDemo = () => {
    fetcher.submit({ actionType: "RESET_DEMO" }, { method: "POST" });
  };

  return (
    <s-page heading="🛡️ ReturnGuard AI — Autonomous Returns Copilot">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Demo Data
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="AI Copilot Loss Prevention Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>💰 NET PROFIT PRESERVED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalProfitSaved}</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Saved via autonomous keep-it deflection</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🛡️ RETURNS DEFLECTED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalDeflected} / {stats.totalRequests}</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Converted to instant store credit offers</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚨 FRAUD & WARDROBING CAUGHT</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.fraudCaught} Flagged</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Cross-merchant behavioral anomaly detection</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Simulator Section */}
      <s-section heading="🧮 Live Unit Economics & AI Deflection Simulator">
        <s-paragraph>
          Test how ReturnGuard AI computes unit profitability in real-time. If physical return shipping and inspection depreciation erode your margin, the Copilot autonomously negotiates a "Keep-It" discount to preserve cash flow.
        </s-paragraph>
        
        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#1e293b" }}>1. Input Order Variables</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Item Retail Price ($)</label>
                <input
                  type="number"
                  value={simPrice}
                  onChange={(e) => setSimPrice(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Item COGS (Cost of Goods Sold $) </label>
                <input
                  type="number"
                  value={simCogs}
                  onChange={(e) => setSimCogs(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Inbound Return Shipping Fee ($)</label>
                <input
                  type="number"
                  value={simShipping}
                  onChange={(e) => setSimShipping(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>2. AI Unit Economic Analysis</span>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "700",
                  backgroundColor: simEconomics.recommendation === "DEFLECT" ? "#d1fae5" : "#dbeafe",
                  color: simEconomics.recommendation === "DEFLECT" ? "#065f46" : "#1e40af"
                }}>
                  Verdict: {simEconomics.recommendation}
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                  <span>Gross Margin (Price - COGS):</span>
                  <strong>${simEconomics.grossMargin}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "4px 0" }}>
                  <span>Physical Return Cost (Ship + 15% Restock):</span>
                  <strong style={{ color: "#ef4444" }}>-${simEconomics.totalReturnCost}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "4px 0" }}>
                  <span>Net Profit if Returned Physically:</span>
                  <strong>${simEconomics.netProfitWithReturn}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "4px 0" }}>
                  <span>AI Deflection Offer (40% Keep-It Discount):</span>
                  <strong style={{ color: "#10b981" }}>${simEconomics.keepItRefundAmount} Refund</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                  <span>Net Profit if Deflected:</span>
                  <span style={{ color: "#10b981" }}>${simEconomics.netProfitWithDeflection}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "4px solid #3b82f6", fontSize: "13px", color: "#334155" }}>
              <strong>AI Copilot Strategy:</strong> {simEconomics.reason}
            </div>
          </div>
        </div>
      </s-section>

      {/* Live RMA Queue Section */}
      <s-section heading="⚡ Live Autonomous RMA Queue & Vision Quality Inspection">
        <s-paragraph>
          Real-time feed of customer return requests. ReturnGuard AI inspects uploaded photos, analyzes customer fraud graphs, and computes whether to deflect or exchange.
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
          {returnRequests.map((req) => {
            const economics = calculateUnitEconomics({
              itemPrice: req.itemPrice,
              cogs: req.cogs,
              returnShippingFee: req.returnShippingFee,
            });

            // Status styling
            let badgeBg = "#f3f4f6";
            let badgeColor = "#374151";
            if (req.aiInspectionStatus === "VERIFIED_DEFECT") { badgeBg = "#fee2e2"; badgeColor = "#991b1b"; }
            if (req.aiInspectionStatus === "WARDROBING_SUSPECTED") { badgeBg = "#fef3c7"; badgeColor = "#92400e"; }
            if (req.aiInspectionStatus === "NORMAL_WEAR") { badgeBg = "#e0e7ff"; badgeColor = "#3730a3"; }

            let resBg = "#f1f5f9";
            let resColor = "#475569";
            if (req.resolutionStatus === "DEFLECTED") { resBg = "#d1fae5"; resColor = "#065f46"; }
            if (req.resolutionStatus === "EXCHANGED") { resBg = "#dbeafe"; resColor = "#1e40af"; }
            if (req.resolutionStatus === "REJECTED_FRAUD") { resBg = "#fee2e2"; resColor = "#991b1b"; }

            return (
              <div key={req.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "18px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>{req.itemTitle}</span>
                    <span style={{ marginLeft: "10px", fontSize: "13px", color: "#64748b" }}>({req.orderName} • {req.customerEmail})</span>
                  </div>
                  <div>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: resBg, color: resColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Status: {req.resolutionStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: "20px", alignItems: "center" }}>
                  {/* Photo & Price */}
                  <div>
                    {req.photoUrl && (
                      <img src={req.photoUrl} alt="Return Item" style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "8px" }} />
                    )}
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      <strong>Price:</strong> ${req.itemPrice} | <strong>COGS:</strong> ${req.cogs} | <strong>Ship:</strong> ${req.returnShippingFee}
                    </div>
                  </div>

                  {/* AI Vision & Notes */}
                  <div>
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", backgroundColor: badgeBg, color: badgeColor }}>
                        AI VISION: {req.aiInspectionStatus}
                      </span>
                      <span style={{ marginLeft: "8px", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                        Reason: "{req.returnReason}"
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", background: "#f8fafc", padding: "10px", borderRadius: "6px", borderLeft: "3px solid #64748b", lineHeight: "1.5" }}>
                      <strong>AI Analysis:</strong> {req.aiInspectionNotes}
                    </div>
                    {req.deflectionOffer && (
                      <div style={{ marginTop: "8px", fontSize: "13px", fontWeight: "600", color: "#059669" }}>
                        💡 Autonomous Offer: {req.deflectionOffer}
                      </div>
                    )}
                  </div>

                  {/* Actions Panel */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", textAlign: "center", marginBottom: "4px" }}>
                      {economics.recommendation === "DEFLECT" ? `💡 Deflecting saves $${economics.profitSavedByDeflection} profit` : "📦 Recommend Physical Return"}
                    </div>

                    {req.resolutionStatus === "PENDING" ? (
                      <>
                        <s-button onClick={() => handleResolve(req.id, "DEFLECT")}>
                          🎁 Approve AI Deflection (40% Off)
                        </s-button>
                        <s-button onClick={() => handleResolve(req.id, "EXCHANGE")}>
                          🔄 Execute Instant Exchange
                        </s-button>
                        <s-button onClick={() => handleResolve(req.id, "REJECT")}>
                          🚫 Reject Fraud / Suspect
                        </s-button>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", fontSize: "13px", color: "#64748b", padding: "8px 0" }}>
                        ✅ Case Resolved as <strong>{req.resolutionStatus}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </s-section>
    </s-page>
  );
}
