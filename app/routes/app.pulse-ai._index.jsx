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

  const [simTag, setSimTag] = useState("#CozyCore");
  const [simTitle, setSimTitle] = useState("Heavyweight Organic Cotton Fleece Hoodie");

  const simFit = calculateViralFitScore({ trendingHashtag: simTag, productTitle: simTitle });
  const simContent = generateViralContent({ trendingHashtag: simTag, productTitle: simTitle });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Trend action processed!";
        if (fetcher.data.resolution === "LAUNCH") msg = "🚀 Viral campaign launched! Video scripts copied to clipboard.";
        if (fetcher.data.resolution === "APPROVE") msg = "✅ Video hook script approved!";
        if (fetcher.data.resolution === "ARCHIVE") msg = "📁 Trend archived.";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo social trends reset successfully!");
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
            🔥 PulseAI — Autonomous Social Trend Hunter & Video Script Generator
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Monitors TikTok/Instagram viral hashtags, matches store catalog SKUs, and generates short-form video hooks.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span>🔄</span> Reset Social Trends
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🔥 VIRAL TREND VELOCITY INDEX</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgVelocity} / 100</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>TikTok & Instagram Reels momentum</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🎯 CATALOG SYNERGY FIT SCORE</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgFit}% Match</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Product fit to current social aesthetic</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚀 LAUNCHED CAMPAIGNS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalLaunched} / {stats.totalOpps} Trends</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Active video hook scripts & FYP ads</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Short-Form Video Hook Alchemist
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Select a viral social hashtag and product to generate high-converting TikTok/Reels video script hooks:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Trending Hashtag</label>
              <input type="text" value={simTag} onChange={(e) => setSimTag(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#dc2626" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Product Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700" }} />
            </div>

            <div style={{ marginTop: "12px", fontSize: "11px", color: "#059669", fontWeight: "800" }}>
              Catalog Fit Match Score: {simFit}% Match
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px" }}>
                🎬 Generated 3-Second Video Hook
              </div>
              <div style={{ fontSize: "12px", color: "#1e293b", background: "#fef2f2", padding: "10px", borderRadius: "6px", border: "1px solid #fca5a5", fontWeight: "700", marginBottom: "8px" }}>
                "{simContent.hookScript}"
              </div>
              <div style={{ fontSize: "11px", color: "#475569" }}>
                <strong>FYP Caption:</strong> {simContent.caption}<br />
                <strong>Bundle Offer:</strong> {simContent.bundleRecommendation}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Radar Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Live Viral Social Opportunities Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {opps.map((o) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (o.campaignStatus === "CAMPAIGN_LAUNCHED") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (o.campaignStatus === "SCRIPT_APPROVED") { statusBg = "#e0e7ff"; statusColor = "#4f46e5"; }
          if (o.campaignStatus === "TREND_IDENTIFIED") { statusBg = "#fef2f2"; statusColor = "#dc2626"; }

          return (
            <div key={o.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: "#dc2626" }}>🔥 {o.trendingHashtag}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>Matched Product: {o.matchedProductTitle}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#fef2f2", color: "#dc2626" }}>
                    Velocity: {o.viralVelocityScore}/100
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#059669" }}>
                    Fit: {o.viralFitScore}%
                  </span>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                    {o.campaignStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", marginBottom: "4px" }}>🎬 3-SEC VIDEO HOOK SCRIPT:</div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>"{o.hookScript}"</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Caption: {o.captionText}</div>
                </div>

                <div style={{ background: "#ecfdf5", padding: "12px", borderRadius: "8px", border: "1px solid #a7f3d0", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#065f46", marginBottom: "4px" }}>🎁 RECOMMENDED AOV BUNDLE:</div>
                  <div style={{ fontSize: "12px", color: "#047857", fontWeight: "700" }}>{o.bundleStrategy}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {o.campaignStatus !== "CAMPAIGN_LAUNCHED" && (
                  <button onClick={() => handleResolve(o.id, "LAUNCH")} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(220,38,38,0.25)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🚀</span> Launch Campaign & Copy Video Script
                  </button>
                )}
                {o.campaignStatus !== "SCRIPT_APPROVED" && o.campaignStatus !== "CAMPAIGN_LAUNCHED" && (
                  <button onClick={() => handleResolve(o.id, "APPROVE")} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #c7d2fe", background: "#e0e7ff", color: "#3730a3", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>✅</span> Approve Hook Script
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
