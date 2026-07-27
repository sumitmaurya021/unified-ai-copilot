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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialAdCampaigns(prisma, shop);

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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESOLVE") {
    const id = formData.get("id");
    const resolution = formData.get("resolution"); // PAUSE, SCALE, MAINTAIN
    await executeAdAction(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.adCampaignProfile.deleteMany({ where: { shop } });
    await seedInitialAdCampaigns(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function AdSpendGuardianDashboard() {
  const { campaigns, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive simulator
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
    <s-page heading="📈 AdSpend Guardian AI — Multi-Channel Ad Attribution & Profit Protector">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Ad Campaigns
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="Multi-Channel Ad Spend & True Net Contribution Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🛡️ TOTAL DAILY AD SPEND MANAGED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalSpend}/day</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Across Meta, Google PMax, TikTok & Pinterest</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚨 LOSS PREVENTED (PAUSED ADS)</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalSaved}/day Saved</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Bleeding campaigns paused autonomously</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚀 NET CONTRIBUTION PROFIT</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>+${stats.totalProfit}/day</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Generated by scaling high-margin winners</div>
          </div>
        </div>
      </s-section>

      {/* Interactive AdSpend Sandbox Section */}
      <s-section heading="🔬 Live AdSpend Alchemist Sandbox">
        <s-paragraph>
          Test AdSpend Guardian AI in real-time! Platform dashboards report gross ROAS without factoring in COGS, payment processing, or Shopify return rates. Simulate campaign numbers below to see how AI calculates True Net ROAS!
        </s-paragraph>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => { setSimName("GOOGLE_PMax_Sneakers_USA"); setSimBudget("350"); setSimRoas("1.80"); setSimCogs("45"); setSimReturns("24"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #fca5a5", background: "#fef2f2", fontSize: "12px", cursor: "pointer", fontWeight: "700", color: "#b91c1c" }}
          >
            🚨 Bleeding Ad (High Returns / COGS)
          </button>
          <button
            onClick={() => { setSimName("TIKTOK_Spark_Serum_GenZ"); setSimBudget("150"); setSimRoas("3.80"); setSimCogs("20"); setSimReturns("4"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #6ee7b7", background: "#ecfdf5", fontSize: "12px", cursor: "pointer", fontWeight: "700", color: "#047857" }}
          >
            🚀 Cash Cow Winner (Low Returns / High ROAS)
          </button>
          <button
            onClick={() => { setSimName("META_Conv_Hoodie_Retargeting"); setSimBudget("250"); setSimRoas("2.60"); setSimCogs("35"); setSimReturns("18"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "700", color: "#334155" }}
          >
            ✅ Stable Retargeting Campaign
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                🏷️ Campaign Identifier
              </label>
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  💰 Daily Budget ($USD)
                </label>
                <input
                  type="text"
                  value={simBudget}
                  onChange={(e) => setSimBudget(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#1d4ed8" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  📊 Platform Reported ROAS
                </label>
                <input
                  type="text"
                  value={simRoas}
                  onChange={(e) => setSimRoas(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#059669" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  📦 COGS (% of Revenue)
                </label>
                <input
                  type="text"
                  value={simCogs}
                  onChange={(e) => setSimCogs(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#64748b" }}>Syncs from MarginGuard AI</span>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  🔄 Return Rate (%)
                </label>
                <input
                  type="text"
                  value={simReturns}
                  onChange={(e) => setSimReturns(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#64748b" }}>Syncs from ReturnGuard AI</span>
              </div>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>🧠 AI True Net Economics Math</span>
                <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "800", backgroundColor: simResult.trueNetRoas >= 1.2 ? "#d1fae5" : "#fee2e2", color: simResult.trueNetRoas >= 1.2 ? "#065f46" : "#991b1b" }}>
                  {simResult.trueNetRoas >= 1.2 ? "🚀 PROFITABLE" : "🚨 BLEEDING LOSS"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>GROSS AD REVENUE:</div>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b" }}>${simResult.grossRevenue}</div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>(${simBudget} * {simRoas}x)</div>
                </div>
                <div style={{ background: simResult.netProfitContributionUsd >= 0 ? "#ecfdf5" : "#fef2f2", padding: "10px", borderRadius: "6px", border: "1px solid", borderColor: simResult.netProfitContributionUsd >= 0 ? "#a7f3d0" : "#fca5a5" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: simResult.netProfitContributionUsd >= 0 ? "#065f46" : "#991b1b" }}>NET PROFIT / LOSS:</div>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: simResult.netProfitContributionUsd >= 0 ? "#059669" : "#dc2626" }}>
                    ${simResult.netProfitContributionUsd}/day
                  </div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: simResult.netProfitContributionUsd >= 0 ? "#065f46" : "#991b1b" }}>True Net ROAS: {simResult.trueNetRoas}x</div>
                </div>
              </div>

              <div style={{ fontSize: "11px", color: "#475569", background: "#f1f5f9", padding: "8px", borderRadius: "6px", marginBottom: "10px", lineHeight: "1.4" }}>
                <strong>📉 Hidden Operating Costs Deducted:</strong><br/>
                • Returns Loss ({simReturns}%): -${simResult.returnsLoss} | • COGS ({simCogs}%): -${simResult.cogsCost} | • Processing Fees (3%): -${simResult.processingFee}
              </div>

              <div style={{ fontSize: "12px", color: "#334155", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontWeight: "600" }}>
                {simResult.rationale}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <span style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "800", backgroundColor: "#1e293b", color: "white" }}>
                AI Recommendation: {simResult.aiRecommendation.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </s-section>

      {/* Live Multi-Channel Ad Attribution Queue Section */}
      <s-section heading="⚡ Live Multi-Channel Ad Attribution & Profit Protection Queue">
        <s-paragraph>
          Review active campaigns tracked across Meta Ads, Google PMax, TikTok, and Pinterest. Notice how AI catches bleeding ads where high return rates and COGS erase platform-reported ROAS!
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {campaigns.map((c) => {
            let statusBg = "#f1f5f9";
            let statusColor = "#475569";
            if (c.campaignStatus === "SCALED_AUTONOMOUSLY") { statusBg = "#d1fae5"; statusColor = "#065f46"; }
            if (c.campaignStatus === "PAUSED_AUTONOMOUSLY") { statusBg = "#fee2e2"; statusColor = "#991b1b"; }
            if (c.campaignStatus === "ACTIVE_RUNNING") { statusBg = "#e0f2fe"; statusColor = "#0369a1"; }

            let platColor = "#1e40af";
            if (c.platform === "GOOGLE_PMAX") platColor = "#b45309";
            if (c.platform === "TIKTOK_ADS") platColor = "#0f172a";
            if (c.platform === "PINTEREST_ADS") platColor = "#b91c1c";

            return (
              <div key={c.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                {/* Top Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: platColor }}>📢 {c.campaignName}</span>
                    <span style={{ marginLeft: "12px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#f3f4f6", color: platColor, textTransform: "uppercase" }}>
                      🌐 {c.platform.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#e0f2fe", color: "#0369a1" }}>
                      💰 Budget: ${c.dailyBudgetUsd}/day
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor, textTransform: "uppercase" }}>
                      {c.campaignStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Grid Content (Side-by-Side Comparison) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {/* Left: Platform Reported Metrics */}
                  <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                      📊 Platform Reported Metrics ({c.platform.split("_")[0]}):
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>
                      Mapped SKU: {c.mappedProductTitle}
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "#0284c7", marginBottom: "8px" }}>
                      Platform Reported ROAS: {c.platformRoas.toFixed(2)}x
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                      ℹ️ Platform dashboard shows ${(c.dailyBudgetUsd * c.platformRoas).toFixed(2)} gross revenue without COGS or return deductions.
                    </div>
                  </div>

                  {/* Right: True Net Economics Math */}
                  <div style={{ background: c.netProfitContributionUsd >= 0 ? "#f0fdf4" : "#fef2f2", padding: "14px", borderRadius: "8px", border: "1px solid", borderColor: c.netProfitContributionUsd >= 0 ? "#a7f3d0" : "#fca5a5" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: c.netProfitContributionUsd >= 0 ? "#065f46" : "#991b1b", textTransform: "uppercase", marginBottom: "6px" }}>
                      🧠 AI True Net Economics (After Returns & COGS):
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "18px", fontWeight: "800", color: c.netProfitContributionUsd >= 0 ? "#047857" : "#dc2626" }}>
                        True Net ROAS: {c.trueNetRoas.toFixed(2)}x
                      </span>
                      <span style={{ fontSize: "16px", fontWeight: "800", color: c.netProfitContributionUsd >= 0 ? "#059669" : "#dc2626", backgroundColor: c.netProfitContributionUsd >= 0 ? "#d1fae5" : "#fee2e2", padding: "2px 8px", borderRadius: "4px" }}>
                        {c.netProfitContributionUsd >= 0 ? "+" : ""}${c.netProfitContributionUsd.toFixed(2)}/day
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: c.netProfitContributionUsd >= 0 ? "#065f46" : "#991b1b", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid", borderColor: c.netProfitContributionUsd >= 0 ? "#a7f3d0" : "#fca5a5", fontWeight: "600" }}>
                      ⚡ Verified via MarginGuard AI (COGS) & ReturnGuard AI (RMA %): {c.aiRecommendation === "PAUSE_IMMEDIATELY" ? "🚨 Unprofitable ad bleed stopped!" : "✅ Healthy net contribution."}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {c.campaignStatus !== "PAUSED_AUTONOMOUSLY" && (
                    <s-button onClick={() => handleResolve(c.id, "PAUSE")}>
                      ⏸️ Pause Bleeding Ad Spend
                    </s-button>
                  )}
                  {c.campaignStatus !== "SCALED_AUTONOMOUSLY" && (
                    <s-button onClick={() => handleResolve(c.id, "SCALE")}>
                      🚀 Scale Budget +20% (Boost Winner)
                    </s-button>
                  )}
                  {c.campaignStatus !== "ACTIVE_RUNNING" && (
                    <s-button onClick={() => handleResolve(c.id, "MAINTAIN")}>
                      ✅ Maintain Current Spend
                    </s-button>
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
