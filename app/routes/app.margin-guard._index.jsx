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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialMarginProfiles(prisma, shop);

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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "REPRICE") {
    const id = formData.get("id");
    const newPrice = formData.get("newPrice");
    await executeAiRepricing(prisma, id, newPrice);
    return { success: true, action: "REPRICE" };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.productMarginProfile.deleteMany({ where: { shop } });
    await seedInitialMarginProfiles(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function MarginGuardDashboard() {
  const { profiles, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive sandbox
  const [simPrice, setSimPrice] = useState("99.99");
  const [simCogs, setSimCogs] = useState("25.00");
  const [simShipping, setSimShipping] = useState("12.00");
  const [simCac, setSimCac] = useState("35.00");

  const simAnalysis = analyzePriceElasticity({
    price: simPrice,
    cogs: simCogs,
    averageShippingCost: simShipping,
    currentCac: simCac,
    inventoryLevel: 50,
    restockLeadTimeDays: 14,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "REPRICE") {
        shopify.toast.show("🚀 AI Recommended Price Applied!");
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo margin data reset successfully!");
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
    <s-page heading="📈 MarginGuard AI — Real-Time Unit Economics & Profit Repricer">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Demo Data
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="Autonomous CFO Financial Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>📊 AVERAGE STORE NET MARGIN</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px", color: parseFloat(stats.avgMarginPct) >= 20 ? "#34d399" : "#fbbf24" }}>{stats.avgMarginPct}%</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Target threshold: 20.0% net contribution</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚨 UNPROFITABLE SKUS FLAGGED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.unprofitableCount} / {stats.totalSkus}</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Ad CAC & shipping exceed item gross profit</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🤖 AI PRICE OPTIMIZATIONS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.activeOptimizations} Active</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Elasticity tests & inventory preservation</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Sandbox Section */}
      <s-section heading="🔬 Live Unit Profit Sandbox & Elasticity Calculator">
        <s-paragraph>
          Test how MarginGuard AI monitors ad spend inflation (Meta/Google CAC) and shipping costs to calculate real-time net contribution. Notice how the AI Copilot dynamically recommends price adjustments to guarantee unit profitability.
        </s-paragraph>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#1e293b" }}>1. Input SKU Cost Variables</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Retail Selling Price ($)</label>
                <input
                  type="number"
                  value={simPrice}
                  onChange={(e) => setSimPrice(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Item COGS (Cost of Goods Sold $)</label>
                <input
                  type="number"
                  value={simCogs}
                  onChange={(e) => setSimCogs(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Average Shipping Cost ($)</label>
                <input
                  type="number"
                  value={simShipping}
                  onChange={(e) => setSimShipping(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Current Ad CAC (Customer Acquisition Cost $)</label>
                <input
                  type="number"
                  value={simCac}
                  onChange={(e) => setSimCac(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "14px" }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>2. AI CFO Net Contribution Analysis</span>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "700",
                  backgroundColor: simAnalysis.status === "LOW_MARGIN_ALERT" ? "#fee2e2" : "#d1fae5",
                  color: simAnalysis.status === "LOW_MARGIN_ALERT" ? "#991b1b" : "#065f46"
                }}>
                  {simAnalysis.status}
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                  <span>Gross Profit (Price - COGS):</span>
                  <strong>${simAnalysis.marginBreakdown.grossMarginDollar}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "4px 0" }}>
                  <span>Shipping Fee:</span>
                  <span>-${simAnalysis.marginBreakdown.averageShippingCost}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "4px 0" }}>
                  <span>Ad Spend CAC (Meta/Google):</span>
                  <span style={{ color: "#ef4444" }}>-${simAnalysis.marginBreakdown.currentCac}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", padding: "4px 0" }}>
                  <span>Payment Processor Fee (2.9% + $0.30):</span>
                  <span>-${simAnalysis.marginBreakdown.paymentFee}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "6px", fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                  <span>Net Contribution Profit:</span>
                  <span style={{ color: parseFloat(simAnalysis.marginBreakdown.netMarginDollar) >= 0 ? "#10b981" : "#ef4444" }}>
                    ${simAnalysis.marginBreakdown.netMarginDollar} ({simAnalysis.marginBreakdown.netMarginPercent}%)
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "4px solid #6366f1", fontSize: "13px", color: "#334155" }}>
              <strong>AI Repricer Recommendation:</strong> {simAnalysis.rationale}
              <div style={{ marginTop: "8px", fontWeight: "700", color: "#4f46e5" }}>
                💡 Target Optimal Price: ${simAnalysis.recommendedPrice}
              </div>
            </div>
          </div>
        </div>
      </s-section>

      {/* Live SKU Portfolio Section */}
      <s-section heading="⚡ Live SKU Portfolio & Autonomous Repricing Queue">
        <s-paragraph>
          Real-time unit economic audit across your catalog. MarginGuard AI monitors CAC spikes and stock scarcity, recommending 1-click price optimizations via Shopify Functions.
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
          {profiles.map((p) => {
            // Status badge styles
            let badgeBg = "#f1f5f9";
            let badgeColor = "#475569";
            if (p.aiRepricingStatus === "LOW_MARGIN_ALERT") { badgeBg = "#fee2e2"; badgeColor = "#991b1b"; }
            if (p.aiRepricingStatus === "INVENTORY_PROTECTION_ACTIVE") { badgeBg = "#fef3c7"; badgeColor = "#92400e"; }
            if (p.aiRepricingStatus === "ELASTICITY_TEST_ACTIVE") { badgeBg = "#e0e7ff"; badgeColor = "#3730a3"; }
            if (p.aiRepricingStatus === "OPTIMAL") { badgeBg = "#d1fae5"; badgeColor = "#065f46"; }

            return (
              <div key={p.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "18px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>{p.productTitle}</span>
                    <span style={{ marginLeft: "10px", fontSize: "13px", color: "#64748b" }}>(SKU: {p.sku})</span>
                  </div>
                  <div>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: badgeBg, color: badgeColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {p.aiRepricingStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 280px", gap: "20px", alignItems: "center" }}>
                  {/* Stock & Price */}
                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>${p.price.toFixed(2)}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                      📦 Stock: <strong>{p.inventoryLevel}</strong> units
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      🚚 Restock: <strong>{p.restockLeadTimeDays}d</strong> lead time
                    </div>
                  </div>

                  {/* Economics & Rationale */}
                  <div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#475569", marginBottom: "8px", background: "#f1f5f9", padding: "6px 10px", borderRadius: "6px" }}>
                      <span>COGS: <strong>${p.cogs.toFixed(2)}</strong></span> •
                      <span>Ship: <strong>${p.averageShippingCost.toFixed(2)}</strong></span> •
                      <span>Ad CAC: <strong style={{ color: "#ef4444" }}>${p.currentCac.toFixed(2)}</strong></span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
                      <strong>AI Rationale:</strong> {p.aiRepricingRationale}
                    </div>
                  </div>

                  {/* Actions & Net Margin */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ textAlign: "center", fontSize: "14px", fontWeight: "800", color: p.netMarginDollar >= 0 ? "#059669" : "#dc2626", marginBottom: "4px" }}>
                      Net Profit: ${p.netMarginDollar.toFixed(2)} ({p.netMarginPercent.toFixed(1)}%)
                    </div>

                    {p.aiRepricingStatus !== "OPTIMAL" ? (
                      <s-button onClick={() => handleReprice(p.id, p.aiRecommendedPrice)}>
                        🚀 Apply AI Price (${p.aiRecommendedPrice.toFixed(2)})
                      </s-button>
                    ) : (
                      <div style={{ textAlign: "center", fontSize: "12px", color: "#64748b", padding: "6px 0" }}>
                        ✅ Price Optimal & Highly Profitable
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
