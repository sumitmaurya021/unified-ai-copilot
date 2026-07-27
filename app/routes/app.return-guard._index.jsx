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

  await seedInitialReturnRequests(prisma, shop);

  const returnRequests = await prisma.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  const config = await prisma.returnPolicyConfig.findUnique({
    where: { shop },
  });

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
    const resolution = formData.get("resolution");
    await processAIResolution(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
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

  const [simPrice, setSimPrice] = useState("80");
  const [simCogs, setSimCogs] = useState("25");
  const [simShipping, setSimShipping] = useState("12");

  const simEcon = calculateUnitEconomics({
    itemPrice: parseFloat(simPrice) || 0,
    cogs: parseFloat(simCogs) || 0,
    returnShippingFee: parseFloat(simShipping) || 0,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "RMA Status updated!";
        if (fetcher.data.resolution === "DEFLECT") msg = "🎁 Keep-It discount issued! Profit saved.";
        if (fetcher.data.resolution === "EXCHANGE") msg = "🔄 Exchange link generated!";
        if (fetcher.data.resolution === "REJECT") msg = "🚫 Wardrobing fraud rejected!";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo RMA requests reset successfully!");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🔄 ReturnGuard AI — Autonomous Returns Deflection
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Real-time unit economics calculations, Keep-It discount deflection, and Vision LLM fraud detection.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span>🔄</span> Reset Demo Requests
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(67, 56, 202, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🛡️ PROFIT SAVED BY DEFLECTION</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalProfitSaved}</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Shipping fees & inventory loss prevented</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🎁 DEFLECTED RETURNS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalDeflected} / {stats.totalRequests} RMAs</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Accepted Keep-It discount offers</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚨 FRAUD CAUGHT (VISION LLM)</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.fraudCaught} Flagged</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Wardrobing & tag manipulation blocked</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Unit Economics Simulator
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Simulate an incoming return request to see how ReturnGuard AI calculates whether a physical return loses money vs issuing a 40% Keep-It discount:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Item Price ($USD)</label>
              <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px", fontWeight: "700" }} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>COGS ($USD)</label>
              <input type="number" value={simCogs} onChange={(e) => setSimCogs(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Return Shipping Fee ($USD)</label>
              <input type="number" value={simShipping} onChange={(e) => setSimShipping(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }} />
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px" }}>
                🧠 AI Decision Analysis
              </div>
              <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.6" }}>
                • <strong>Physical Return Net Loss:</strong> -${simEcon.fullReturnLoss}<br />
                • <strong>40% Keep-It Discount Cost:</strong> ${simEcon.keepItCost}<br />
                • <strong>Profit Saved by Deflection:</strong> <span style={{ color: "#059669", fontWeight: "800" }}>+${simEcon.profitSavedByDeflection}</span>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "#ecfdf5" : "#f0f9ff", border: "1px solid", borderColor: simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "#a7f3d0" : "#bae6fd", fontSize: "12px", fontWeight: "800", color: simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "#065f46" : "#0369a1" }}>
              AI Recommendation: {simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "🎁 Offer 40% Keep-It Discount (Prevents Shipping Loss)" : "🔄 Standard Exchange"}
            </div>
          </div>
        </div>
      </div>

      {/* Live RMA Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Live RMA Requests Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {returnRequests.map((req) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (req.resolutionStatus === "DEFLECTED") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (req.resolutionStatus === "EXCHANGED") { statusBg = "#f0f9ff"; statusColor = "#0284c7"; }
          if (req.resolutionStatus === "REJECTED_FRAUD") { statusBg = "#fef2f2"; statusColor = "#dc2626"; }

          return (
            <div key={req.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>📦 {req.customerName}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>Order #{req.orderId} • {req.itemTitle}</span>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                  {req.resolutionStatus}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5", minWidth: 0 }}>
                  <strong>Reason:</strong> "{req.returnReason}"<br />
                  <strong>Item Price:</strong> ${req.itemPrice} | <strong>COGS:</strong> ${req.cogs} | <strong>Shipping Fee:</strong> ${req.returnShippingFee}<br />
                  <strong>Vision LLM Scan:</strong> <span style={{ fontWeight: "700", color: req.aiInspectionStatus === "WARDROBING_SUSPECTED" ? "#dc2626" : "#059669" }}>{req.aiInspectionStatus}</span>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#475569", minWidth: 0 }}>
                  <strong>AI Rationale:</strong><br />
                  {req.aiRationale}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {req.resolutionStatus !== "DEFLECTED" && (
                  <button onClick={() => handleResolve(req.id, "DEFLECT")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🎁</span> Approve Keep-It Offer
                  </button>
                )}
                {req.resolutionStatus !== "EXCHANGED" && (
                  <button onClick={() => handleResolve(req.id, "EXCHANGE")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🔄</span> Issue Exchange
                  </button>
                )}
                {req.resolutionStatus !== "REJECTED_FRAUD" && (
                  <button onClick={() => handleResolve(req.id, "REJECT")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🚫</span> Reject Wardrobing Fraud
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
