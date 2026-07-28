import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    catalogItems,
    marginProfiles,
    returnRequests,
    oracleForecasts,
    supportTickets,
    socialTrends,
    localizations,
    adCampaigns
  ] = await Promise.all([
    prisma.catalogItemProfile.findMany({ where: { shop } }).catch(() => []),
    prisma.productMarginProfile.findMany({ where: { shop } }).catch(() => []),
    prisma.returnRequest.findMany({ where: { shop } }).catch(() => []),
    prisma.inventoryForecastProfile.findMany({ where: { shop } }).catch(() => []),
    prisma.supportTicketProfile.findMany({ where: { shop } }).catch(() => []),
    prisma.trendOpportunityProfile.findMany({ where: { shop } }).catch(() => []),
    prisma.localizationProfile.findMany({ where: { shop } }).catch(() => []),
    prisma.adCampaignProfile.findMany({ where: { shop } }).catch(() => [])
  ]);

  const totalSkus = catalogItems.length + marginProfiles.length + oracleForecasts.length;

  // Calculate real protected profit
  const returnSaved = returnRequests
    .filter(r => r.resolutionStatus === "DEFLECTED" || r.resolutionStatus === "EXCHANGED")
    .reduce((acc, r) => acc + (parseFloat(r.profitSavedByDeflection) || 0), 0);

  const adSaved = adCampaigns
    .filter(c => c.auditStatus && c.auditStatus.includes("PAUSED"))
    .reduce((acc, c) => acc + (parseFloat(c.dailyBudgetUsd) || 0) * 30, 0);

  const marginLift = marginProfiles
    .filter(m => m.aiRepricingStatus === "OPTIMAL")
    .reduce((acc, m) => acc + Math.max(0, parseFloat(m.netMarginDollar) || 0), 0);

  const totalNetProfitProtectedUsd = Math.round(returnSaved + adSaved + marginLift);

  // Calculate autonomous resolution rate
  const totalActions = returnRequests.length + supportTickets.length + adCampaigns.length + marginProfiles.length + catalogItems.length + oracleForecasts.length + socialTrends.length + localizations.length;
  const autonomousActions = 
    returnRequests.filter(r => r.resolutionStatus !== "PENDING").length +
    supportTickets.filter(t => t.resolutionStatus !== "OPEN").length +
    adCampaigns.filter(a => a.auditStatus !== "MONITORING_ACTIVE").length +
    marginProfiles.filter(m => m.aiRepricingStatus === "OPTIMAL").length +
    catalogItems.filter(c => c.aiHealingStatus === "AUTO_PUBLISHED").length +
    oracleForecasts.filter(f => f.poStatus !== "NONE").length +
    socialTrends.filter(s => s.status !== "DISCOVERED").length +
    localizations.filter(l => l.status !== "DRAFT").length;

  const autonomousResolutionRate = totalActions > 0 ? Math.round((autonomousActions / totalActions) * 1000) / 10 : 0;

  // Build real activity feed from latest updatedAt records
  const allEvents = [];
  returnRequests.forEach(r => allEvents.push({
    id: `return-${r.id}`,
    time: r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
    timestamp: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
    agent: "ReturnGuard AI",
    action: `Processed Return #${r.orderNumber || r.id.slice(0,6)} (${r.resolutionStatus})`,
    tag: r.profitSavedByDeflection ? `SAVED $${parseFloat(r.profitSavedByDeflection).toFixed(2)}` : r.resolutionStatus,
    tagType: r.resolutionStatus === "DEFLECTED" ? "success" : "info"
  }));
  adCampaigns.forEach(c => allEvents.push({
    id: `ad-${c.id}`,
    time: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
    timestamp: c.updatedAt ? new Date(c.updatedAt).getTime() : 0,
    agent: "AdSpend Guardian",
    action: `Audited ${c.campaignName} (${c.auditStatus})`,
    tag: c.platformRoas ? `ROAS ${c.platformRoas}x` : c.auditStatus,
    tagType: c.auditStatus && c.auditStatus.includes("PAUSED") ? "danger" : "info"
  }));
  supportTickets.forEach(t => allEvents.push({
    id: `support-${t.id}`,
    time: t.updatedAt ? new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
    timestamp: t.updatedAt ? new Date(t.updatedAt).getTime() : 0,
    agent: "SupportShield AI",
    action: `Triage Ticket #${t.orderNumber || t.id.slice(0,6)}: ${t.customerQuery?.slice(0,40)}...`,
    tag: t.resolutionStatus,
    tagType: "success"
  }));
  oracleForecasts.forEach(i => allEvents.push({
    id: `inv-${i.id}`,
    time: i.updatedAt ? new Date(i.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
    timestamp: i.updatedAt ? new Date(i.updatedAt).getTime() : 0,
    agent: "InventoryOracle",
    action: `Forecast SKU ${i.productTitle}: ${i.stockStatus}`,
    tag: i.poStatus === "NONE" ? "MONITORING" : i.poStatus,
    tagType: i.stockStatus && i.stockStatus.includes("STOCKOUT") ? "danger" : "info"
  }));
  catalogItems.forEach(c => allEvents.push({
    id: `cat-${c.id}`,
    time: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
    timestamp: c.updatedAt ? new Date(c.updatedAt).getTime() : 0,
    agent: "CatalogAlchemy",
    action: `Healed title for ${c.productTitle || 'SKU'}`,
    tag: `${c.aiQualityScoreHealed || 100}% SEO`,
    tagType: "brand"
  }));

  allEvents.sort((a, b) => b.timestamp - a.timestamp);
  const liveActivityFeed = allEvents.slice(0, 5);

  return {
    shop,
    stats: {
      totalNetProfitProtectedUsd,
      autonomousResolutionRate,
      totalActiveSkusMonitored: totalSkus,
      totalEventsProcessed: totalActions,
    },
    modules: [
      {
        id: "return-guard",
        name: "ReturnGuard AI",
        icon: "🛡️",
        path: "/app/return-guard",
        status: returnRequests.length > 0 ? "ACTIVE" : "IDLE",
        metric: returnRequests.length > 0 ? `$${returnSaved.toFixed(0)} Saved` : "No Returns",
        desc: "Autonomous return fraud audit & keep-it discount deflection engine.",
        color: "#10b981",
      },
      {
        id: "margin-guard",
        name: "MarginGuard AI",
        icon: "💰",
        path: "/app/margin-guard",
        status: marginProfiles.length > 0 ? "ACTIVE" : "IDLE",
        metric: marginProfiles.length > 0 ? `${marginProfiles.length} SKUs Monitored` : "0 SKUs Monitored",
        desc: "Dynamic elasticity repricing & CAC margin contribution sentinel.",
        color: "#6366f1",
      },
      {
        id: "catalog-alchemy",
        name: "CatalogAlchemy AI",
        icon: "✨",
        path: "/app/catalog-alchemy",
        status: catalogItems.length > 0 ? "ACTIVE" : "IDLE",
        metric: catalogItems.length > 0 ? `${catalogItems.length} Products Monitored` : "0 Products Monitored",
        desc: "AI product title healing & automated Shopify storefront publishing.",
        color: "#ec4899",
      },
      {
        id: "support-shield",
        name: "SupportShield AI",
        icon: "🎧",
        path: "/app/support-shield",
        status: supportTickets.length > 0 ? "ACTIVE" : "IDLE",
        metric: supportTickets.length > 0 ? `${supportTickets.length} Tickets Monitored` : "0 Tickets Monitored",
        desc: "L1 Support ticket resolution & customer sentiment triage.",
        color: "#06b6d4",
      },
      {
        id: "pulse-ai",
        name: "PulseAI Trends",
        icon: "📱",
        path: "/app/pulse-ai",
        status: socialTrends.length > 0 ? "ACTIVE" : "IDLE",
        metric: socialTrends.length > 0 ? `${socialTrends.length} Viral Opportunities` : "0 Trends Tracked",
        desc: "TikTok/IG viral trend mapper & 3-second hook script generator.",
        color: "#8b5cf6",
      },
      {
        id: "global-reach",
        name: "GlobalReach AI",
        icon: "🌍",
        path: "/app/global-reach",
        status: localizations.length > 0 ? "ACTIVE" : "IDLE",
        metric: localizations.length > 0 ? `${localizations.length} Markets Live` : "0 Markets Live",
        desc: "Cross-border storefront localization & Keigo/EU translations.",
        color: "#f59e0b",
      },
      {
        id: "adspend-guardian",
        name: "AdSpend Guardian",
        icon: "📊",
        path: "/app/adspend-guardian",
        status: adCampaigns.length > 0 ? "ACTIVE" : "IDLE",
        metric: adCampaigns.length > 0 ? `${adCampaigns.length} Campaigns Audited` : "0 Campaigns Audited",
        desc: "True Net ROAS attribution & bleeding ad campaign kill-switch.",
        color: "#ef4444",
      },
      {
        id: "inventory-oracle",
        name: "InventoryOracle",
        icon: "📦",
        path: "/app/inventory-oracle",
        status: oracleForecasts.length > 0 ? "ACTIVE" : "IDLE",
        metric: oracleForecasts.length > 0 ? `${oracleForecasts.length} SKUs Monitored` : "0 SKUs Monitored",
        desc: "Stockout forecasting & autonomous Purchase Order dispatch.",
        color: "#3b82f6",
      },
    ],
    liveActivityFeed
  };
};

export default function MasterExecutiveDashboard() {
  const { stats, modules, liveActivityFeed } = useLoaderData();
  const navigate = useNavigate();
  const [monthlyOrders, setMonthlyOrders] = useState(1200);

  const estimatedAnnualSavings = Math.round(monthlyOrders * 12 * 8.5);

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      
      {/* Hero Welcome Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311b92 100%)",
        borderRadius: "16px",
        padding: "32px",
        color: "white",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
        marginBottom: "28px",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", marginBottom: "12px", backdropFilter: "blur(4px)" }}>
            ✨ MASTER CONTROL CENTER
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: "800", margin: "0 0 8px 0", letterSpacing: "-0.02em", color: "#ffffff" }}>
            Unified AI Copilot Suite
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", margin: "0", maxWidth: "680px", lineHeight: "1.5" }}>
            Eight autonomous AI agents orchestrating returns deflection, margin repricing, catalog healing, L1 support, viral trends, cross-border localization, ad attribution, and supply chain rebalancing.
          </p>
        </div>
      </div>

      {/* Top Master Telemetry KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", borderRadius: "12px", padding: "20px", color: "white", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>🛡️ NET PROFIT PROTECTED</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.totalNetProfitProtectedUsd.toLocaleString()}</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.85 }}>Saved across returns, ad bleed & margins</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)", borderRadius: "12px", padding: "20px", color: "white", boxShadow: "0 4px 14px rgba(79, 70, 229, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>⚡ AUTONOMOUS EXECUTION RATE</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.autonomousResolutionRate}%</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.85 }}>Resolved without human merchant friction</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)", borderRadius: "12px", padding: "20px", color: "white", boxShadow: "0 4px 14px rgba(6, 182, 212, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>📦 ACTIVE SKUS MONITORED</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalActiveSkusMonitored} Products</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.85 }}>Tracked across 8 intelligence engines</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #78350f 0%, #d97706 100%)", borderRadius: "12px", padding: "20px", color: "white", boxShadow: "0 4px 14px rgba(217, 119, 6, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>🤖 TOTAL AI ACTIONS EXECUTED</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalEventsProcessed} Actions</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.85 }}>Continuous background optimization</div>
        </div>
      </div>

      {/* 8-Module Copilot Control Radar Grid */}
      <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>🤖</span> Active AI Copilot Module Radar
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "36px" }}>
        {modules.map((m) => (
          <div
            key={m.id}
            onClick={() => navigate(m.path)}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "var(--shadow-md)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              justify: "space-between"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = m.color;
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "var(--shadow-lg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "24px" }}>{m.icon}</span>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>{m.name}</span>
                </div>
                <span className="saas-badge badge-success">
                  ● {m.status}
                </span>
              </div>

              <div style={{ fontSize: "14px", fontWeight: "700", color: m.color, marginBottom: "6px" }}>
                {m.metric}
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-subtle)", lineHeight: "1.4", marginBottom: "16px" }}>
                {m.desc}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", borderTop: "1px solid var(--border-light)", paddingTop: "12px", fontSize: "12px", fontWeight: "700", color: m.color }}>
              Launch Module ➔
            </div>
          </div>
        ))}
      </div>

      {/* Live AI Stream & ROI Calculator Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px" }}>
        
        {/* Real-Time Live AI Activity Stream */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚡</span> Real-Time Autonomous AI Activity Feed
          </h3>

          {liveActivityFeed.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-subtle)", borderRadius: "8px", border: "1px dashed var(--border-light)" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
              <div style={{ fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>No Recent AI Activity Found</div>
              <div style={{ fontSize: "12px" }}>Synchronize real store data in any copilot module to start autonomous optimizations and view live telemetry!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {liveActivityFeed.map((act) => {
                let badgeBg = "var(--success-bg)";
                let badgeColor = "var(--success-main)";
                if (act.tagType === "danger") { badgeBg = "var(--danger-bg)"; badgeColor = "var(--danger-main)"; }
                if (act.tagType === "info") { badgeBg = "var(--info-bg)"; badgeColor = "var(--info-main)"; }
                if (act.tagType === "brand") { badgeBg = "rgba(99, 102, 241, 0.15)"; badgeColor = "var(--brand-primary)"; }

                return (
                  <div key={act.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "8px", background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-main)" }}>{act.agent}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-light)" }}>• {act.time}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{act.action}</div>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "800", backgroundColor: badgeBg, color: badgeColor, padding: "3px 8px", borderRadius: "12px", whiteSpace: "nowrap" }}>
                      {act.tag}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive Store ROI Uplift Calculator */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💡</span> Projected Annual Profit Impact Calculator
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-subtle)", lineHeight: "1.4", margin: "0 0 16px 0" }}>
              Adjust your average monthly order volume to see projected annual net savings across return deflection, margin repricing, and ad loss prevention:
            </p>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>
                <span>Monthly Orders:</span>
                <span style={{ color: "var(--brand-primary)", fontWeight: "800" }}>{monthlyOrders.toLocaleString()} Orders/mo</span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={monthlyOrders}
                onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--brand-primary)", cursor: "pointer" }}
              />
            </div>

            <div style={{ background: "linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)", borderRadius: "10px", padding: "16px", textAlign: "center", border: "1px solid var(--brand-primary)" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--brand-primary)", textTransform: "uppercase" }}>ESTIMATED ANNUAL NET PROFIT UPLIFT</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "var(--text-main)", marginTop: "4px" }}>
                +${estimatedAnnualSavings.toLocaleString()}/yr
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                Based on $8.50 average profit recovery per order
              </div>
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-light)", textAlign: "center", marginTop: "16px" }}>
            🔒 Powered by Unified AI Copilot Engine • Zero latency
          </div>
        </div>

      </div>

    </div>
  );
}
