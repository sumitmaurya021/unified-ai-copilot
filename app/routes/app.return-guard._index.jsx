import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialReturnRequests,
  executeReturnAction,
} from "../services/returnGuard.server";
import {
  evaluateReturnUnitEconomics,
  evaluateReturnRiskWithVision,
} from "../services/returnGuard";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialReturnRequests(prisma, shop, admin);

  const returnRequests = await prisma.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  let totalDeflected = 0;
  let totalProfitSaved = 0;
  let fraudCaught = 0;

  for (const r of returnRequests) {
    if (r.resolutionStatus === "DEFLECTED") {
      totalDeflected++;
      totalProfitSaved += r.profitSavedUsd;
    }
    if (r.fraudRiskScore >= 60 || r.resolutionStatus === "REJECTED_FRAUD") {
      fraudCaught++;
    }
  }

  return {
    returnRequests,
    stats: {
      totalDeflected,
      totalProfitSaved: Math.round(totalProfitSaved),
      fraudCaught,
      totalRequests: returnRequests.length,
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
    const resolution = formData.get("resolution"); // DEFLECT, EXCHANGE, REJECT
    await executeReturnAction(prisma, id, resolution, admin);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.returnRequest.deleteMany({ where: { shop } });
    await seedInitialReturnRequests(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function ReturnGuardRoute() {
  const { returnRequests, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simPrice, setSimPrice] = useState(85);
  const [simCogs, setSimCogs] = useState(25);
  const [simShipping, setSimShipping] = useState(14);

  const simEcon = evaluateReturnUnitEconomics({
    itemPriceUsd: Number(simPrice),
    cogsUsd: Number(simCogs),
    returnShippingFeeUsd: Number(simShipping),
  });

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Action executed!";
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
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🔄 ReturnGuard AI — Autonomous Returns Deflection
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Real-time unit economics calculations, Keep-It discount deflection, and Vision LLM fraud detection.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Unit Economics Simulator
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Simulate an incoming return request to see how ReturnGuard AI calculates whether a physical return loses money vs issuing a 40% Keep-It discount:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Item Price ($USD)</label>
              <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px", fontWeight: "700" }} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>COGS ($USD)</label>
              <input type="number" value={simCogs} onChange={(e) => setSimCogs(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Return Shipping Fee ($USD)</label>
              <input type="number" value={simShipping} onChange={(e) => setSimShipping(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px" }} />
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px" }}>
                🧠 AI Decision Analysis
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                • <strong>Physical Return Net Loss:</strong> -${simEcon.fullReturnLoss}<br />
                • <strong>40% Keep-It Discount Cost:</strong> ${simEcon.keepItCost}<br />
                • <strong>Profit Saved by Deflection:</strong> <span style={{ color: "var(--success-main)", fontWeight: "800" }}>+${simEcon.profitSavedByDeflection}</span>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "var(--success-bg)" : "var(--info-bg)", border: "1px solid", borderColor: simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "var(--success-border)" : "var(--info-border)", fontSize: "12px", fontWeight: "800", color: simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "var(--success-main)" : "var(--info-main)" }}>
              AI Recommendation: {simEcon.recommendedOffer === "KEEP_IT_DISCOUNT" ? "🎁 Offer 40% Keep-It Discount (Prevents Shipping Loss)" : "🔄 Standard Exchange"}
            </div>
          </div>
        </div>
      </div>

      {/* Live RMA Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Live RMA Requests Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {returnRequests.map((req) => {
          let isHighRisk = req.fraudRiskScore >= 60;

          return (
            <div key={req.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>RMA {req.rmaId}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Customer: {req.customerEmail}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`saas-badge ${isHighRisk ? "badge-danger" : "badge-success"}`}>
                    Fraud Risk: {req.fraudRiskScore}%
                  </span>
                  <span className="saas-badge badge-brand">
                    Status: {req.resolutionStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>CUSTOMER RETURN REASON</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>"{req.customerReturnReason}"</div>
                  <div style={{ fontSize: "11px", color: "var(--text-subtle)", marginTop: "6px" }}>Item Value: <strong>${req.itemPriceUsd}</strong> (COGS: ${req.cogsUsd})</div>
                </div>

                <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>VISION LLM & UNIT ECONOMICS ACTION</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    • Offer: <strong>{req.recommendedOffer}</strong><br />
                    • Projected Profit Saved: <strong style={{ color: "var(--success-main)" }}>+${req.profitSavedUsd}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  onClick={() => handleResolve(req.id, "REJECT")}
                  disabled={fetcher.state !== "idle"}
                  className="saas-btn btn-danger"
                >
                  🚫 Reject (Flag Fraud)
                </button>

                <button
                  onClick={() => handleResolve(req.id, "DEFLECT")}
                  disabled={fetcher.state !== "idle"}
                  className="saas-btn btn-primary"
                >
                  🎁 Issue 40% Keep-It Discount
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
