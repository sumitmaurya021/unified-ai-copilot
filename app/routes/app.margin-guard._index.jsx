import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialMarginProfiles,
  executeRepriceAction,
} from "../services/marginGuard.server";
import {
  calculateMarginBreakdown,
  calculateElasticitySuggestion,
} from "../services/marginGuard";

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
    if (p.netMarginPercent < 0 || p.aiRepricingStatus === "UNPROFITABLE_BLEED") {
      unprofitableCount++;
    }
    if (p.aiRepricingStatus !== "OPTIMAL") {
      activeOptimizations++;
    }
  }

  const avgMarginPct = profiles.length > 0 ? Math.round(totalMarginPct / profiles.length) : 0;

  return {
    profiles,
    stats: {
      avgMarginPct,
      unprofitableCount,
      activeOptimizations,
      totalProfiles: profiles.length,
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
    const newPrice = parseFloat(formData.get("newPrice"));
    await executeRepriceAction(prisma, id, newPrice, admin);
    return { success: true, action: "REPRICE" };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.productMarginProfile.deleteMany({ where: { shop } });
    await seedInitialMarginProfiles(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function MarginGuardRoute() {
  const { profiles, stats } = useLoaderData();
  const fetcher = useFetcher();

  const [simPrice, setSimPrice] = useState(150.0);
  const [simCogs, setSimCogs] = useState(55.0);
  const [simCac, setSimCac] = useState(48.0);
  const [simStock, setSimStock] = useState(12);

  const simMargin = calculateMarginBreakdown({
    price: Number(simPrice),
    cogs: Number(simCogs),
    currentCac: Number(simCac),
  });

  const simElasticity = calculateElasticitySuggestion({
    price: Number(simPrice),
    inventoryLevel: Number(simStock),
    netMarginPercent: simMargin.netMarginPercent,
  });

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
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            📈 MarginGuard AI — Dynamic Profit & Elasticity Repricer
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Real-time net contribution margins factoring in Meta/Google CAC and payment gateway fees.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Net Profit & Elasticity Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Test SKU economics in real-time to watch AI calculate exact net margin dollar contribution and recommend scarcity price bumps:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Current Price ($)</label>
                <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px", fontWeight: "700" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Unit COGS ($)</label>
                <input type="number" value={simCogs} onChange={(e) => setSimCogs(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Ad CAC ($)</label>
                <input type="number" value={simCac} onChange={(e) => setSimCac(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Current Stock</label>
                <input type="number" value={simStock} onChange={(e) => setSimStock(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "14px" }} />
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px" }}>
                🧠 AI Profit Telemetry
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                • <strong>Gross Revenue:</strong> ${simPrice}<br />
                • <strong>Deductions:</strong> COGS (${simCogs}) + CAC (${simCac}) + Gateway Fee (${simMargin.gatewayFee})<br />
                • <strong>Net Profit / Unit:</strong> <span style={{ color: simMargin.netMarginDollar >= 0 ? "var(--success-main)" : "var(--danger-main)", fontWeight: "800" }}>${simMargin.netMarginDollar} ({simMargin.netMarginPercent}%)</span>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", backgroundColor: "rgba(99, 102, 241, 0.15)", border: "1px solid var(--brand-primary)", fontSize: "12px", fontWeight: "800", color: "var(--brand-primary)" }}>
              AI Price Suggestion: ${simElasticity.recommendedPrice} ({simElasticity.rationale})
            </div>
          </div>
        </div>
      </div>

      {/* SKU Portfolio Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ SKU Portfolio Profitability & Repricing Queue
      </h2>

      {profiles.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>No SKU Profiles Available</div>
          <div style={{ fontSize: "13px" }}>Synchronize your Shopify catalog to start real-time unit economics monitoring and autonomous repricing.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {profiles.map((p) => {
            let isUnprofitable = p.netMarginPercent < 0;

            return (
              <div key={p.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>📦 {p.productTitle}</span>
                    <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>SKU ID: {p.productId.split("/").pop()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`saas-badge ${isUnprofitable ? "badge-danger" : "badge-success"}`}>
                      Net Margin: {p.netMarginPercent}% (${p.netMarginDollar})
                    </span>
                    <span className="saas-badge badge-brand">
                      Status: {p.aiRepricingStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>CURRENT UNIT ECONOMICS</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                      • Retail Price: <strong>${p.price}</strong><br />
                      • Unit COGS: ${p.cogs} | Ad CAC: ${p.currentCac}<br />
                      • Net Contribution: <strong style={{ color: isUnprofitable ? "var(--danger-main)" : "var(--success-main)" }}>${p.netMarginDollar} ({p.netMarginPercent}%)</strong>
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>AI REPRICING SUGGESTION</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--brand-primary)", marginBottom: "4px" }}>
                      New Price: ${p.aiRecommendedPrice}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      {p.aiRepricingRationale}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => handleReprice(p.id, p.aiRecommendedPrice)}
                    disabled={fetcher.state !== "idle"}
                    className="saas-btn btn-primary"
                  >
                    🚀 Apply AI Price (${p.aiRecommendedPrice})
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
