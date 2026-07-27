import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateCulturalNuanceScore, localizeProductContent } from "../services/globalReach";
import {
  seedInitialLocalizationProfiles,
  executeLocalizationAction,
} from "../services/globalReach.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialLocalizationProfiles(prisma, shop, admin);

  const profiles = await prisma.localizationProfile.findMany({
    where: { shop },
    orderBy: { culturalNuanceScore: "desc" },
  });

  let totalNuance = 0;
  let totalPublished = 0;

  for (const p of profiles) {
    totalNuance += p.culturalNuanceScore;
    if (p.publishingStatus === "PUBLISHED_STOREFRONT" || p.publishingStatus === "REVIEWED_APPROVED") {
      totalPublished++;
    }
  }

  const avgNuance = profiles.length > 0 ? Math.round(totalNuance / profiles.length) : 0;

  return {
    profiles,
    stats: {
      avgNuance,
      totalPublished,
      totalProfiles: profiles.length,
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
    const resolution = formData.get("resolution"); // PUBLISH, APPROVE, ARCHIVE
    await executeLocalizationAction(prisma, id, resolution, admin);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.localizationProfile.deleteMany({ where: { shop } });
    await seedInitialLocalizationProfiles(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function GlobalReachDashboard() {
  const { profiles, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simRegion, setSimRegion] = useState("JP");
  const [simTitle, setSimTitle] = useState("Silk Velvet Evening Gown — Midnight Edition");
  const [simPrice, setSimPrice] = useState("99.00");

  const simLocalized = localizeProductContent({
    targetRegion: simRegion,
    originalTitle: simTitle,
    usdPrice: parseFloat(simPrice) || 99.0,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Localization action executed!";
        if (fetcher.data.resolution === "PUBLISH") msg = "🚀 Culturally adapted listing published to Shopify Markets!";
        if (fetcher.data.resolution === "APPROVE") msg = "✅ Regional translation approved!";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo localization profiles reset successfully!");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🌐 GlobalReach AI — Autonomous Cross-Border Localization Engine
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Adapts cultural tone, Japanese keigo politeness, German DIN certification standards, unit conversions & psychological currency rounding.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155" }}>
          🔄 Reset Localization Profiles
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(20, 184, 166, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🎯 CULTURAL NUANCE ACCURACY</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgNuance} / 100</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Regional tone & formality score</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚀 STOREFRONT MARKET LISTINGS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalPublished} / {stats.totalProfiles} Published</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Live on Shopify Markets regions</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🌍 TARGET REGIONS TRACKED</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>DE, JP, FR, MX</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>EU, Asia-Pacific & LATAM markets</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Cultural Localization Alchemist
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Test instant market adaptation across target countries:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Target Market Region</label>
              <select value={simRegion} onChange={(e) => setSimRegion(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700" }}>
                <option value="DE">🇩🇪 Germany (DE) — DIN Quality & Precision</option>
                <option value="JP">🇯🇵 Japan (JP) — Keigo Formal & Gift Box Framing</option>
                <option value="FR">🇫🇷 France (FR) — Parisian Luxury & Elegance</option>
                <option value="MX">🇲🇽 Mexico (MX) — Installment Options & Warmth</option>
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Original Product Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Original USD Price ($)</label>
              <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🧠 Culturally Adapted Storefront</span>
                <span style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>
                  Nuance Score: {simLocalized.culturalNuanceScore}/100
                </span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#0d9488", marginBottom: "4px" }}>
                {simLocalized.translatedTitle}
              </div>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#059669", marginBottom: "8px" }}>
                Price: {simLocalized.localFormattedPrice}
              </div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.4", whiteSpace: "pre-wrap" }}>
                {simLocalized.translatedDescription}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Live Regional Market Adaptation Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {profiles.map((p) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (p.publishingStatus === "PUBLISHED_STOREFRONT") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (p.publishingStatus === "REVIEWED_APPROVED") { statusBg = "#e0e7ff"; statusColor = "#4f46e5"; }

          return (
            <div key={p.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                <div>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: "#0d9488" }}>🌐 Region: {p.targetRegion}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>Original SKU: {p.originalTitle} (${p.usdPrice})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#059669" }}>
                    Nuance: {p.culturalNuanceScore}/100
                  </span>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                    {p.publishingStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "4px" }}>🇺🇸 ORIGINAL US STOREFRONT:</div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>"{p.originalTitle}" (${p.usdPrice})</div>
                </div>

                <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#065f46", marginBottom: "4px" }}>🌍 CULTURALLY ADAPTED STOREFRONT:</div>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#047857" }}>"{p.translatedTitle}"</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#059669", marginTop: "4px" }}>Price: {p.localFormattedPrice}</div>
                  <div style={{ fontSize: "11px", color: "#065f46", marginTop: "4px" }}>"{p.translatedDescription}"</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {p.publishingStatus !== "PUBLISHED_STOREFRONT" && (
                  <button onClick={() => handleResolve(p.id, "PUBLISH")} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}>
                    🚀 Publish to Shopify Markets Storefront
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
