import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateSkuMargin, analyzePriceElasticity } from "../services/marginGuard";
import {
  seedInitialMarginProfiles,
  executeAiRepricing,
} from "../services/marginGuard.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialMarginProfiles(prisma, shop, admin);

  const profiles = await prisma.productMarginProfile.findMany({
    where: { shop },
    orderBy: { netMarginPercent: "asc" },
  });

  let totalMarginPct = 0;
  let unprofitableCount = 0;
  let activeOptimizations = 0;

  for (const p of profiles) {
    totalMarginPct += p.netMarginPercent;
    if (p.netMarginDollar < 0) unprofitableCount++;
    if (p.aiRepricingStatus !== "OPTIMAL") activeOptimizations++;
  }

  const avgMarginPct = profiles.length > 0 ? (totalMarginPct / profiles.length).toFixed(1) : "0.0";

  return {
    profiles,
    stats: {
      avgMarginPct,
      unprofitableCount,
      activeOptimizations,
      totalSkus: profiles.length,
    },
  };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "REPRICE") {
    const id = formData.get("id");
    const newPrice = formData.get("newPrice");
    await executeAiRepricing(prisma, id, newPrice, "", admin);
    return { success: true, action: "REPRICE" };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.productMarginProfile.deleteMany({ where: { shop } });
    await seedInitialMarginProfiles(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function MarginGuardDashboard() {
  const { profiles, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simPrice, setSimPrice] = useState("120");
  const [simCogs, setSimCogs] = useState("45");
  const [simCac, setSimCac] = useState("35");
  const [simStock, setSimStock] = useState("12");

  const simMargin = calculateSkuMargin({
    currentPrice: parseFloat(simPrice) || 0,
    cogs: parseFloat(simCogs) || 0,
    adSpendCac: parseFloat(simCac) || 0,
  });

  const simElasticity = analyzePriceElasticity({
    currentPrice: parseFloat(simPrice) || 0,
    cogs: parseFloat(simCogs) || 0,
    adSpendCac: parseFloat(simCac) || 0,
    currentStock: parseInt(simStock) || 0,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "REPRICE") {
        shopify.toast.show("🚀 AI Price Optimization published to Shopify catalog!");
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo margin profiles reset successfully!");
      }
    }
  }, [fetcher.data, shopify]);

  const handleReprice = (id, newPrice) => {
    fetcher.submit({ actionType: "REPRICE", id, newPrice }, { method: "POST" });
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
            📈 MarginGuard AI — Dynamic Profit & Elasticity Repricer
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Real-time net contribution margins factoring in Meta/Google CAC and payment gateway fees.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span>🔄</span> Reset Margin Profiles
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>📊 AVERAGE PORTFOLIO MARGIN</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgMarginPct}%</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Net contribution after CAC & fees</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚨 UNPROFITABLE SKUS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.unprofitableCount} Bleeding SKUs</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Selling below break-even contribution</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚀 ACTIONABLE OPTIMIZATIONS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.activeOptimizations} SKUs</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Ready for AI dynamic repricing</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Net Profit & Elasticity Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Test SKU economics in real-time to watch AI calculate exact net margin dollar contribution and recommend scarcity price bumps:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Current Price ($)</label>
                <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px", fontWeight: "700" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Unit COGS ($)</label>
                <input type="number" value={simCogs} onChange={(e) => setSimCogs(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Ad CAC ($)</label>
                <input type="number" value={simCac} onChange={(e) => setSimCac(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Current Stock</label>
                <input type="number" value={simStock} onChange={(e) => setSimStock(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }} />
              </div>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px" }}>
                🧠 AI Profit Telemetry
              </div>
              <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.6" }}>
                • <strong>Gross Revenue:</strong> ${simPrice}<br />
                • <strong>Deductions:</strong> COGS (${simCogs}) + CAC (${simCac}) + Gateway Fee (${simMargin.gatewayFee})<br />
                • <strong>Net Profit / Unit:</strong> <span style={{ color: simMargin.netMarginDollar >= 0 ? "#059669" : "#dc2626", fontWeight: "800" }}>${simMargin.netMarginDollar} ({simMargin.netMarginPercent}%)</span>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: "#e0e7ff", border: "1px solid #c7d2fe", fontSize: "12px", fontWeight: "800", color: "#3730a3" }}>
              AI Price Suggestion: ${simElasticity.recommendedPrice} ({simElasticity.rationale})
            </div>
          </div>
        </div>
      </div>

      {/* SKU Portfolio Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ SKU Portfolio Profitability & Repricing Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {profiles.map((p) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (p.aiRepricingStatus === "OPTIMAL") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (p.aiRepricingStatus === "UNPROFITABLE_BLEED") { statusBg = "#fef2f2"; statusColor = "#dc2626"; }
          if (p.aiRepricingStatus === "SCARCITY_PRICE_BUMP") { statusBg = "#e0e7ff"; statusColor = "#4f46e5"; }

          return (
            <div key={p.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>📦 {p.productTitle}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>SKU ID: {p.productId.split("/").pop()}</span>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                  {p.aiRepricingStatus}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5", minWidth: 0 }}>
                  <strong>Current Price:</strong> ${p.price} | <strong>COGS:</strong> ${p.cogs} | <strong>Ad CAC:</strong> ${p.currentCac}<br />
                  <strong>Net Contribution / Unit:</strong> <span style={{ fontWeight: "800", color: p.netMarginDollar >= 0 ? "#059669" : "#dc2626" }}>${p.netMarginDollar} ({p.netMarginPercent}%)</span>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#475569", minWidth: 0 }}>
                  <strong>AI Recommendation:</strong><br />
                  Set price to <strong>${p.aiRecommendedPrice}</strong> ({p.aiRepricingRationale})
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {p.price !== p.aiRecommendedPrice && (
                  <button onClick={() => handleReprice(p.id, p.aiRecommendedPrice)} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.25)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🚀</span> Apply AI Recommended Price (${p.aiRecommendedPrice})
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
