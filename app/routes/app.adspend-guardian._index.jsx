import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialAdCampaigns,
  executeAdAction,
} from "../services/adSpendGuardian.server";
import {
  calculateTrueAdEconomics,
} from "../services/adSpendGuardian";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialAdCampaigns(prisma, shop, admin);

  const campaigns = await prisma.adCampaignProfile.findMany({
    where: { shop },
    orderBy: { dailyBudgetUsd: "desc" },
  });

  let totalSpend = 0;
  let totalSaved = 0;
  let totalProfit = 0;

  for (const c of campaigns) {
    totalSpend += c.dailyBudgetUsd;
    if (c.campaignStatus === "PAUSED_AUTONOMOUSLY" && c.netProfitContributionUsd < 0) {
      totalSaved += Math.abs(c.netProfitContributionUsd);
    }
    if (c.netProfitContributionUsd > 0) {
      totalProfit += c.netProfitContributionUsd;
    }
  }

  return {
    campaigns,
    stats: {
      totalSpend: Math.round(totalSpend),
      totalSaved: Math.round(totalSaved),
      totalProfit: Math.round(totalProfit),
      totalCampaigns: campaigns.length,
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
    const resolution = formData.get("resolution"); // PAUSE, SCALE, MAINTAIN
    await executeAdAction(prisma, id, resolution, admin);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.adCampaignProfile.deleteMany({ where: { shop } });
    await seedInitialAdCampaigns(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function AdSpendGuardianRoute() {
  const { campaigns, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simName, setSimName] = useState("META_Prospecting_Sneakers_USA");
  const [simBudget, setSimBudget] = useState(350);
  const [simRoas, setSimRoas] = useState(1.8);
  const [simCogs, setSimCogs] = useState(45);
  const [simReturns, setSimReturns] = useState(24);

  const simResult = calculateTrueAdEconomics({
    dailyBudgetUsd: Number(simBudget),
    platformRoas: Number(simRoas),
    cogsPercent: Number(simCogs),
    returnRatePercent: Number(simReturns),
  });

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Campaign Action Executed!";
        if (fetcher.data.resolution === "PAUSE") msg = "🛑 Bleeding Campaign Paused!";
        if (fetcher.data.resolution === "SCALE") msg = "🚀 Winner Budget Scaled 20%!";
        if (fetcher.data.resolution === "MAINTAIN") msg = "✓ Monitoring Continued!";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Ad Campaigns reset successfully!");
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
            💰 AdSpend Guardian AI — Multi-Channel Ad Attribution & Profit Protector
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Calculates True Net ROAS by subtracting COGS (MarginGuard) and returns loss (ReturnGuard) from gross ad platform revenue.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
          <span>🔄</span> Reset Ad Campaigns
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🛡️ TOTAL DAILY AD SPEND MANAGED</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalSpend}/day</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Meta, Google PMax, TikTok & Pinterest</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚨 LOSS PREVENTED (PAUSED ADS)</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalSaved}/day Saved</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Bleeding campaigns paused autonomously</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚀 NET CONTRIBUTION PROFIT</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>+${stats.totalProfit}/day</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Generated by scaling high-margin winners</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live AdSpend Alchemist Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Simulate ad campaign metrics to see how AI computes True Net ROAS vs gross platform dashboards:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Campaign Name</label>
              <input type="text" value={simName} onChange={(e) => setSimName(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "600" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Daily Budget ($USD)</label>
                <input type="number" value={simBudget} onChange={(e) => setSimBudget(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Platform Reported ROAS</label>
                <input type="number" step="0.1" value={simRoas} onChange={(e) => setSimRoas(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>COGS (% of Revenue)</label>
                <input type="number" value={simCogs} onChange={(e) => setSimCogs(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Return Rate (%)</label>
                <input type="number" value={simReturns} onChange={(e) => setSimReturns(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>🧠 AI True Net Economics Math</span>
                <span className={`saas-badge ${simResult.trueNetRoas >= 1.2 ? "badge-success" : "badge-danger"}`}>
                  {simResult.trueNetRoas >= 1.2 ? "🚀 PROFITABLE" : "🚨 BLEEDING LOSS"}
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                • <strong>Gross Revenue:</strong> ${simResult.grossRevenue}<br />
                • <strong>Returns Loss ({simReturns}%):</strong> -${simResult.returnsLoss}<br />
                • <strong>Net Revenue:</strong> ${simResult.netRevenue}<br />
                • <strong>True Net Profit / Day:</strong> <span style={{ color: simResult.netProfitContributionUsd >= 0 ? "var(--success-main)" : "var(--danger-main)", fontWeight: "800" }}>${simResult.netProfitContributionUsd} (True Net ROAS: {simResult.trueNetRoas}x)</span>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "11px", fontWeight: "800", textAlign: "center", border: "1px solid var(--border-strong)" }}>
              AI Decision: {simResult.aiRecommendation?.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Live Multi-Channel Ad Attribution Queue
      </h2>

      {campaigns.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>No Ad Campaigns Available</div>
          <div style={{ fontSize: "13px" }}>Connect your ad accounts or synchronize store marketing metrics to start true Net ROAS attribution and bleeding campaign prevention.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {campaigns.map((c) => {
            let isPaused = c.campaignStatus === "PAUSED_AUTONOMOUSLY";
            let isScaled = c.campaignStatus === "SCALED_AUTONOMOUSLY";

            return (
              <div key={c.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>📊 {c.campaignName}</span>
                    <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Platform: {c.platform}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="saas-badge badge-brand">
                      Reported ROAS: {c.platformRoas}x
                    </span>
                    <span className={`saas-badge ${c.trueNetRoas >= 1.2 ? "badge-success" : "badge-danger"}`}>
                      True Net ROAS: {c.trueNetRoas}x
                    </span>
                    <span className={`saas-badge ${isPaused ? "badge-danger" : isScaled ? "badge-success" : "badge-info"}`}>
                      {c.campaignStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>CAMPAIGN METRICS & SPEND</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                      • Daily Budget: <strong>${c.dailyBudgetUsd}/day</strong><br />
                      • Platform ROAS: {c.platformRoas}x | True Net ROAS: <strong style={{ color: c.trueNetRoas >= 1.2 ? "var(--success-main)" : "var(--danger-main)" }}>{c.trueNetRoas}x</strong><br />
                      • Daily Profit Contribution: <strong style={{ color: c.netProfitContributionUsd >= 0 ? "var(--success-main)" : "var(--danger-main)" }}>${c.netProfitContributionUsd}/day</strong>
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>AI GUARDIAN RECOMMENDATION</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-main)", marginBottom: "4px" }}>
                      {c.aiRecommendation?.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      Target Product: {c.mappedProductTitle}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => handleResolve(c.id, "PAUSE")}
                    disabled={fetcher.state !== "idle" || isPaused}
                    className="saas-btn btn-danger"
                  >
                    🛑 Pause Bleeding Ad
                  </button>

                  <button
                    onClick={() => handleResolve(c.id, "SCALE")}
                    disabled={fetcher.state !== "idle" || isScaled}
                    className="saas-btn btn-primary"
                  >
                    🚀 Scale Budget (+20%)
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
