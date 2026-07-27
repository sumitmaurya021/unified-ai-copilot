import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateViralFitScore, generateViralContent } from "../services/pulseAi";
import {
  seedInitialTrendOpportunities,
  executeTrendAction,
} from "../services/pulseAi.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialTrendOpportunities(prisma, shop);

  const opps = await prisma.trendOpportunityProfile.findMany({
    where: { shop },
    orderBy: { viralVelocityScore: "desc" },
  });

  let totalVelocity = 0;
  let totalFit = 0;
  let totalLaunched = 0;

  for (const o of opps) {
    totalVelocity += o.viralVelocityScore;
    totalFit += o.viralFitScore;
    if (o.campaignStatus === "CAMPAIGN_LAUNCHED" || o.campaignStatus === "SCRIPT_APPROVED") {
      totalLaunched++;
    }
  }

  const avgVelocity = opps.length > 0 ? Math.round(totalVelocity / opps.length) : 0;
  const avgFit = opps.length > 0 ? Math.round(totalFit / opps.length) : 0;

  return {
    opps,
    stats: {
      avgVelocity,
      avgFit,
      totalLaunched,
      totalOpps: opps.length,
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
    const resolution = formData.get("resolution"); // LAUNCH, APPROVE, ARCHIVE
    await executeTrendAction(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.trendOpportunityProfile.deleteMany({ where: { shop } });
    await seedInitialTrendOpportunities(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function PulseAiDashboard() {
  const { opps, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive simulator
  const [simTrend, setSimTrend] = useState("#CozyCore Streetwear");
  const [simPlatform, setSimPlatform] = useState("TIKTOK");
  const [simProduct, setSimProduct] = useState("Heavyweight Organic Cotton Fleece Hoodie");

  const simResult = generateViralContent({
    trendName: simTrend,
    platform: simPlatform,
    mappedProductTitle: simProduct,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Viral video script approved & copy readied!";
        if (fetcher.data.resolution === "LAUNCH") msg = "🚀 Campaign Launched! Ad copy synced!";
        if (fetcher.data.resolution === "ARCHIVE") msg = "Trend opportunity archived.";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo viral trend radar reset successfully!");
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
    <s-page heading="🔥 PulseAI — Autonomous Social Trend Hunter & Viral Product Generator">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Trend Radar
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="Viral Social Radar & Merchandising Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(236, 72, 153, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚀 EXPLODING SOCIAL TRENDS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalOpps} Active <span style={{ fontSize: "18px", color: "#fbcfe8" }}>(⚡ {stats.avgVelocity} Avg Velocity)</span></div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Tracked across TikTok, IG Reels & Pinterest</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🎯 AVG CATALOG VIRAL FIT SCORE</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgFit}% Synergy</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Matched to your existing store inventory</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🎬 VIRAL CAMPAIGNS & SCRIPTS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalLaunched} Approved</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Ready-to-record hook scripts and FYP ad copy</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Viral Sandbox Section */}
      <s-section heading="🔬 Live Viral Alchemist Sandbox & Script Generator">
        <s-paragraph>
          Test PulseAI in real-time! Type any emerging TikTok or Reels hashtag below and select one of your store products to watch AI calculate Viral Fit synergy, write a 3-second video hook script, and formulate an AOV bundle strategy!
        </s-paragraph>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => { setSimTrend("#CozyCore Streetwear"); setSimProduct("Heavyweight Organic Cotton Fleece Hoodie"); setSimPlatform("TIKTOK"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🧸 #CozyCore Hoodie
          </button>
          <button
            onClick={() => { setSimTrend("#MarathonTraining Prep"); setSimProduct("AeroMesh Lightweight Performance Running Sneaker"); setSimPlatform("INSTAGRAM"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🏃 #MarathonTraining Sneaker
          </button>
          <button
            onClick={() => { setSimTrend("#OldMoneyAesthetic"); setSimProduct("Silk Velvet Evening Gown — Midnight Edition"); setSimPlatform("PINTEREST"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            💎 #OldMoney Gown
          </button>
          <button
            onClick={() => { setSimTrend("#GlassSkinGlowUp"); setSimProduct("HydraGlow Advanced Vitamin C Radiance Serum"); setSimPlatform("TIKTOK"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            ✨ #GlassSkin Serum
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  🔥 Trending Social Hashtag
                </label>
                <input
                  type="text"
                  value={simTrend}
                  onChange={(e) => setSimTrend(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600" }}
                />
              </div>
              <div style={{ width: "140px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  📱 Platform
                </label>
                <select
                  value={simPlatform}
                  onChange={(e) => setSimPlatform(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600", background: "white" }}
                >
                  <option value="TIKTOK">TikTok FYP</option>
                  <option value="INSTAGRAM">IG Reels</option>
                  <option value="PINTEREST">Pinterest</option>
                  <option value="YOUTUBE_SHORTS">YT Shorts</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                📦 Mapped Store Product (From CatalogAlchemy AI)
              </label>
              <input
                type="text"
                value={simProduct}
                onChange={(e) => setSimProduct(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>🎬 AI Formulated Video Script & Copy</span>
                <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "800", backgroundColor: "#fce7f3", color: "#9d174d" }}>
                  🎯 {simResult.viralFitScore}% Viral Fit Synergy
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "#334155", marginBottom: "12px", background: "#fdf2f8", padding: "12px", borderRadius: "6px", maxHeight: "140px", overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: "1.5", border: "1px solid #fbcfe8" }}>
                <strong style={{ color: "#be185d", display: "block", marginBottom: "4px" }}>🎬 3-Sec Video Hook Script:</strong>
                {simResult.generatedHookScript}
              </div>

              <div style={{ fontSize: "12px", color: "#475569", background: "#f1f5f9", padding: "8px 12px", borderRadius: "6px", marginBottom: "8px" }}>
                <strong style={{ color: "#1e293b" }}>✍️ FYP Ad Caption:</strong> {simResult.generatedAdCaption}
              </div>
            </div>

            <div style={{ padding: "10px", backgroundColor: "#fffbeb", borderRadius: "6px", borderLeft: "4px solid #f59e0b", fontSize: "12px", color: "#92400e" }}>
              {simResult.bundleStrategy}
            </div>
          </div>
        </div>
      </s-section>

      {/* Live Trend Radar & Campaign Queue Section */}
      <s-section heading="⚡ Live Social Trend Radar & Script Queue">
        <s-paragraph>
          Review discovered social trends mapped to your store inventory. PulseAI pre-computes high-converting TikTok/Reels video hooks and FYP ad copy so you can launch campaigns before saturation!
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {opps.map((o) => {
            let statusBg = "#f1f5f9";
            let statusColor = "#475569";
            if (o.campaignStatus === "CAMPAIGN_LAUNCHED") { statusBg = "#d1fae5"; statusColor = "#065f46"; }
            if (o.campaignStatus === "SCRIPT_APPROVED") { statusBg = "#e0e7ff"; statusColor = "#3730a3"; }
            if (o.campaignStatus === "ARCHIVED") { statusBg = "#e2e8f0"; statusColor = "#64748b"; }

            return (
              <div key={o.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                {/* Top Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#be185d" }}>{o.trendName}</span>
                    <span style={{ marginLeft: "12px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#f3f4f6", color: "#475569" }}>
                      📱 {o.platform}
                    </span>
                    <span style={{ marginLeft: "8px", fontSize: "13px", fontWeight: "700", color: "#059669" }}>
                      ⚡ Velocity: {o.viralVelocityScore}/100 | +{o.growthRatePercent}% 7-Day Growth
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#fce7f3", color: "#9d174d" }}>
                      🎯 {o.viralFitScore}% Viral Fit
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: statusBg, color: statusColor, textTransform: "uppercase" }}>
                      {o.campaignStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Grid Content */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {/* Left: Mapped Product */}
                  <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                        📦 Mapped Store Product:
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                        {o.mappedProductTitle}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        SKU ID: {o.mappedProductId.replace("gid://shopify/Product/", "#")}
                      </div>
                    </div>
                    <div style={{ marginTop: "12px", padding: "8px", backgroundColor: "#d1fae5", borderRadius: "6px", fontSize: "11px", fontWeight: "700", color: "#065f46" }}>
                      ✅ MarginGuard AI Verified: Unit economics profitable for paid viral boosting.
                    </div>
                  </div>

                  {/* Right: AI Script Hook & Caption */}
                  <div style={{ background: "#fdf2f8", padding: "14px", borderRadius: "8px", border: "1px solid #fbcfe8" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#9d174d", textTransform: "uppercase", marginBottom: "6px" }}>
                      🎬 AI 3-Sec Video Hook Script:
                    </div>
                    <div style={{ fontSize: "13px", color: "#831843", maxHeight: "90px", overflowY: "auto", whiteSpace: "pre-wrap", marginBottom: "10px", lineHeight: "1.4" }}>
                      {o.generatedHookScript}
                    </div>
                    <div style={{ fontSize: "11px", color: "#475569", background: "white", padding: "6px 8px", borderRadius: "4px", border: "1px solid #f1f5f9" }}>
                      <strong>✍️ Ad Caption:</strong> {o.generatedAdCaption}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {o.campaignStatus !== "CAMPAIGN_LAUNCHED" ? (
                    <>
                      <s-button onClick={() => handleResolve(o.id, "LAUNCH")}>
                        🚀 Launch Campaign & Copy Script
                      </s-button>
                      <s-button onClick={() => handleResolve(o.id, "APPROVE")}>
                        ✏️ Approve Video Script
                      </s-button>
                      <s-button onClick={() => handleResolve(o.id, "ARCHIVE")}>
                        🚫 Archive Opportunity
                      </s-button>
                    </>
                  ) : (
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#059669", padding: "4px 0" }}>
                      ✅ Campaign Launched & Scripts Synced to Ad Creator
                    </div>
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
