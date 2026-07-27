import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateTrueAdEconomics, evaluateAdCampaign } from "../services/adSpendGuardian";
import {
  seedInitialAdCampaigns,
  executeAdAction,
} from "../services/adSpendGuardian.server";

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

export default function AdSpendGuardianDashboard() {
  const { campaigns, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simName, setSimName] = useState("META_Conv_Hoodie_Retargeting");
  const [simBudget, setSimBudget] = useState("250");
  const [simRoas, setSimRoas] = useState("1.80");
  const [simCogs, setSimCogs] = useState("45");
  const [simReturns, setSimReturns] = useState("24");

  const simResult = evaluateAdCampaign({
    campaignName: simName,
    dailyBudgetUsd: parseFloat(simBudget) || 100.0,
    platformRoas: parseFloat(simRoas) || 1.5,
    cogsPercent: parseFloat(simCogs) || 35.0,
    returnRatePercent: parseFloat(simReturns) || 15.0,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Ad campaign spend updated!";
        if (fetcher.data.resolution === "PAUSE") msg = "🚨 Campaign paused! Bleeding ad spend stopped.";
        if (fetcher.data.resolution === "SCALE") msg = "🚀 Campaign scaled! Daily budget boosted +20%.";
        if (fetcher.data.resolution === "MAINTAIN") msg = "✅ Campaign budget maintained.";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo ad attribution campaigns reset successfully!");
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
            💰 AdSpend Guardian AI — Multi-Channel Ad Attribution & Profit Protector
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Calculates True Net ROAS by subtracting COGS (MarginGuard) and returns loss (ReturnGuard) from gross ad platform revenue.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live AdSpend Alchemist Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Simulate ad campaign metrics to see how AI computes True Net ROAS vs gross platform dashboards:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Campaign Name</label>
              <input type="text" value={simName} onChange={(e) => setSimName(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Daily Budget ($USD)</label>
                <input type="number" value={simBudget} onChange={(e) => setSimBudget(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#1d4ed8" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Platform Reported ROAS</label>
                <input type="number" step="0.1" value={simRoas} onChange={(e) => setSimRoas(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#059669" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>COGS (% of Revenue)</label>
                <input type="number" value={simCogs} onChange={(e) => setSimCogs(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Return Rate (%)</label>
                <input type="number" value={simReturns} onChange={(e) => setSimReturns(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
              </div>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🧠 AI True Net Economics Math</span>
                <span style={{ backgroundColor: simResult.trueNetRoas >= 1.2 ? "#ecfdf5" : "#fef2f2", color: simResult.trueNetRoas >= 1.2 ? "#059669" : "#dc2626", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", whiteSpace: "nowrap" }}>
                  {simResult.trueNetRoas >= 1.2 ? "🚀 PROFITABLE" : "🚨 BLEEDING LOSS"}
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.6" }}>
                • <strong>Gross Revenue:</strong> ${simResult.grossRevenue}<br />
                • <strong>Returns Loss ({simReturns}%):</strong> -${simResult.returnsLoss}<br />
                • <strong>Net Revenue:</strong> ${simResult.netRevenue}<br />
                • <strong>True Net Profit / Day:</strong> <span style={{ color: simResult.netProfitContributionUsd >= 0 ? "#059669" : "#dc2626", fontWeight: "800" }}>${simResult.netProfitContributionUsd} (True Net ROAS: {simResult.trueNetRoas}x)</span>
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: "#1e293b", color: "white", fontSize: "11px", fontWeight: "800", textAlign: "center" }}>
              AI Decision: {simResult.aiRecommendation.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Live Multi-Channel Ad Attribution Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {campaigns.map((c) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (c.campaignStatus === "SCALED_AUTONOMOUSLY") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (c.campaignStatus === "PAUSED_AUTONOMOUSLY") { statusBg = "#fef2f2"; statusColor = "#dc2626"; }
          if (c.campaignStatus === "ACTIVE_RUNNING") { statusBg = "#e0f2fe"; statusColor = "#0369a1"; }

          return (
            <div key={c.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: "#1e3a8a" }}>📢 {c.campaignName}</span>
                  <span style={{ marginLeft: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#f3f4f6", padding: "3px 8px", borderRadius: "12px", color: "#1e3a8a" }}>{c.platform}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#e0f2fe", color: "#0369a1" }}>
                    Budget: ${c.dailyBudgetUsd}/day
                  </span>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                    {c.campaignStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "4px" }}>PLATFORM REPORTED ROAS:</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#0284c7" }}>{c.platformRoas.toFixed(2)}x ROAS</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Mapped SKU: {c.mappedProductTitle}</div>
                </div>

                <div style={{ background: c.netProfitContributionUsd >= 0 ? "#f0fdf4" : "#fef2f2", padding: "12px", borderRadius: "8px", border: "1px solid", borderColor: c.netProfitContributionUsd >= 0 ? "#a7f3d0" : "#fca5a5", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: c.netProfitContributionUsd >= 0 ? "#065f46" : "#991b1b", marginBottom: "4px" }}>🧠 AI TRUE NET ECONOMICS:</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: c.netProfitContributionUsd >= 0 ? "#059669" : "#dc2626" }}>
                    True ROAS: {c.trueNetRoas.toFixed(2)}x ({c.netProfitContributionUsd >= 0 ? "+" : ""}${c.netProfitContributionUsd.toFixed(2)}/day)
                  </div>
                  <div style={{ fontSize: "11px", color: c.netProfitContributionUsd >= 0 ? "#065f46" : "#991b1b", marginTop: "4px" }}>
                    Verified via MarginGuard (COGS) & ReturnGuard (RMA %)
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {c.campaignStatus !== "PAUSED_AUTONOMOUSLY" && (
                  <button onClick={() => handleResolve(c.id, "PAUSE")} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>⏸️</span> Pause Bleeding Spend
                  </button>
                )}
                {c.campaignStatus !== "SCALED_AUTONOMOUSLY" && (
                  <button onClick={() => handleResolve(c.id, "SCALE")} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(5,150,105,0.25)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🚀</span> Scale Budget +20%
                  </button>
                )}
                {c.campaignStatus !== "ACTIVE_RUNNING" && (
                  <button onClick={() => handleResolve(c.id, "MAINTAIN")} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "white", color: "#334155", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>✅</span> Maintain Spend
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
