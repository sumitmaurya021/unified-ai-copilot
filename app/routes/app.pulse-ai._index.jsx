import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialTrendOpportunities,
  executeTrendAction,
} from "../services/pulseAi.server";
import {
  calculateViralFitScore,
  generateViralContent,
} from "../services/pulseAi";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialTrendOpportunities(prisma, shop, admin);

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
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESOLVE") {
    const id = formData.get("id");
    const resolution = formData.get("resolution"); // LAUNCH, APPROVE, ARCHIVE
    await executeTrendAction(prisma, id, resolution, admin);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.trendOpportunityProfile.deleteMany({ where: { shop } });
    await seedInitialTrendOpportunities(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function PulseAiRoute() {
  const { opps, stats } = useLoaderData();
  const fetcher = useFetcher();

  const [simTag, setSimTag] = useState("#CozyCore");
  const [simTitle, setSimTitle] = useState("Heavyweight Organic Cotton Fleece Hoodie");

  const simFit = calculateViralFitScore(simTag, simTitle);
  const simContent = generateViralContent({
    trendName: simTag,
    platform: "TIKTOK",
    mappedProductTitle: simTitle,
  });

  const handleAction = (id, resolution) => {
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
            🔥 PulseAI — Autonomous Social Trend Hunter & Video Script Generator
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Monitors TikTok/Instagram viral hashtags, matches store catalog SKUs, and generates short-form video hooks.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Short-Form Video Hook Alchemist
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Select a viral social hashtag and product to generate high-converting TikTok/Reels video script hooks:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Trending Hashtag</label>
              <input type="text" value={simTag} onChange={(e) => setSimTag(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700", color: "var(--danger-main)" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Product Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }} />
            </div>

            <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--success-main)", fontWeight: "800" }}>
              Catalog Fit Match Score: {simFit}% Match
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px" }}>
                🎬 Generated 3-Second Video Hook
              </div>
              <div style={{ fontSize: "12px", color: "var(--danger-main)", background: "var(--danger-bg)", padding: "10px", borderRadius: "6px", border: "1px solid var(--danger-border)", fontWeight: "700", marginBottom: "8px" }}>
                "{simContent.generatedHookScript}"
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                <strong>FYP Caption:</strong> {simContent.generatedAdCaption}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Radar Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Live Viral Social Opportunities Queue
      </h2>

      {opps.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>No Viral Opportunities Discovered</div>
          <div style={{ fontSize: "13px" }}>Synchronize your Shopify products to allow PulseAI to scan TikTok and Instagram for matching viral trends and hook generation.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {opps.map((o) => {
            let isLaunched = o.campaignStatus === "CAMPAIGN_LAUNCHED";

            return (
              <div key={o.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "var(--danger-main)" }}>🔥 {o.trendName}</span>
                    <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Matched Product: {o.mappedProductTitle}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="saas-badge badge-danger">
                      Velocity: {o.viralVelocityScore}/100
                    </span>
                    <span className="saas-badge badge-success">
                      Fit: {o.viralFitScore}%
                    </span>
                    <span className={`saas-badge ${isLaunched ? "badge-success" : "badge-brand"}`}>
                      {o.campaignStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--danger-main)", marginBottom: "4px" }}>GENERATED 3-SECOND VIDEO HOOK SCRIPT</div>
                    <div style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: "700", lineHeight: "1.4" }}>"{o.generatedHookScript}"</div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>AD CAPTION & HASHTAG MATRIX</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>{o.generatedAdCaption}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => handleAction(o.id, "GENERATE_NEW")}
                    disabled={fetcher.state !== "idle" || isLaunched}
                    className="saas-btn btn-secondary"
                  >
                    🔄 Regenerate AI Hook
                  </button>

                  <button
                    onClick={() => handleAction(o.id, "LAUNCH")}
                    disabled={fetcher.state !== "idle" || isLaunched}
                    className="saas-btn btn-primary"
                  >
                    {isLaunched ? "✓ Campaign Live on TikTok" : "🚀 Launch FYP Ad Campaign"}
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
