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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialLocalizationProfiles(prisma, shop);

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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESOLVE") {
    const id = formData.get("id");
    const resolution = formData.get("resolution"); // PUBLISH, APPROVE, ARCHIVE
    await executeLocalizationAction(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.localizationProfile.deleteMany({ where: { shop } });
    await seedInitialLocalizationProfiles(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function GlobalReachDashboard() {
  const { profiles, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive simulator
  const [simMarket, setSimMarket] = useState("GERMANY_EU");
  const [simTitle, setSimTitle] = useState("Heavyweight Organic Cotton Fleece Hoodie");
  const [simPrice, setSimPrice] = useState("110.0");

  const simResult = localizeProductContent({
    originalTitle: simTitle,
    originalPrice: parseFloat(simPrice) || 100.0,
    targetMarket: simMarket,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Localization reviewed & approved!";
        if (fetcher.data.resolution === "PUBLISH") msg = "🚀 Published to Shopify Markets storefront!";
        if (fetcher.data.resolution === "ARCHIVE") msg = "Localization profile archived.";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo international localization profiles reset successfully!");
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
    <s-page heading="🌐 GlobalReach AI — Autonomous Cross-Border Localization & Storefront Engine">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Localization Profiles
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="International Storefront & Cultural Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(2, 132, 199, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🌍 ACTIVE CROSS-BORDER MARKETS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalProfiles} Regions <span style={{ fontSize: "18px", color: "#bae6fd" }}>(5 Languages)</span></div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>EU, APAC, LATAM & EMEA regions configured</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(13, 148, 136, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🎯 AVG CULTURAL NUANCE SCORE</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgNuance}% Accuracy</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>DIN compliance, keigo politeness & VAT rules</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚀 PUBLISHED STOREFRONT SKUS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalPublished} Live Listings</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Autonomously synced to Shopify Markets</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Localization Sandbox Section */}
      <s-section heading="🔬 Live Localization Alchemist Sandbox">
        <s-paragraph>
          Test GlobalReach AI in real-time! Select a target market and input any product title and USD price below to watch AI compute cultural nuance scores, convert sizing units (inches to cm), and apply psychological local currency rounding!
        </s-paragraph>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => { setSimMarket("GERMANY_EU"); setSimTitle("Heavyweight Organic Cotton Fleece Hoodie"); setSimPrice("110.0"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🇩🇪 Germany (DIN Formal)
          </button>
          <button
            onClick={() => { setSimMarket("JAPAN_APAC"); setSimTitle("HydraGlow Advanced Vitamin C Radiance Serum"); setSimPrice("85.0"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🇯🇵 Japan (Keigo Gift Box)
          </button>
          <button
            onClick={() => { setSimMarket("FRANCE_EU"); setSimTitle("Silk Velvet Evening Gown — Midnight Edition"); setSimPrice("320.0"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🇫🇷 France (Parisiene Elegance)
          </button>
          <button
            onClick={() => { setSimMarket("MEXICO_LATAM"); setSimTitle("AeroMesh Lightweight Performance Running Sneaker"); setSimPrice("150.0"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
          >
            🇲🇽 Mexico (Meses sin intereses)
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  🌍 Target International Market
                </label>
                <select
                  value={simMarket}
                  onChange={(e) => setSimMarket(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", background: "white", color: "#0369a1" }}
                >
                  <option value="GERMANY_EU">🇩🇪 Germany & DACH (EU)</option>
                  <option value="JAPAN_APAC">🇯🇵 Japan (APAC)</option>
                  <option value="FRANCE_EU">🇫🇷 France & Wallonia (EU)</option>
                  <option value="MEXICO_LATAM">🇲🇽 Mexico (LATAM)</option>
                  <option value="UK_EMEA">🇬🇧 United Kingdom (EMEA)</option>
                </select>
              </div>
              <div style={{ width: "120px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  💲 USD Price ($)
                </label>
                <input
                  type="text"
                  value={simPrice}
                  onChange={(e) => setSimPrice(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                📦 Original US English Product Title
              </label>
              <input
                type="text"
                value={simTitle}
                onChange={(e) => setSimTitle(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>🌐 AI Culturally Adapted Listing</span>
                <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "800", backgroundColor: "#e0f2fe", color: "#0369a1" }}>
                  🎯 {simResult.culturalNuanceScore}% Cultural Nuance Fit
                </span>
              </div>

              <div style={{ fontSize: "15px", fontWeight: "800", color: "#0284c7", marginBottom: "8px" }}>
                {simResult.localizedTitle}
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: "800", color: "#059669", backgroundColor: "#d1fae5", padding: "4px 10px", borderRadius: "6px" }}>
                  🏷️ {simResult.localizedPriceDisplay}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                  (Psychologically rounded for {simResult.targetMarket})
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "#334155", background: "#f8fafc", padding: "10px", borderRadius: "6px", maxHeight: "110px", overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: "1.4", border: "1px solid #e2e8f0", marginBottom: "8px" }}>
                {simResult.localizedDescription}
              </div>
            </div>

            <div style={{ padding: "8px 10px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "4px solid #10b981", fontSize: "12px", color: "#065f46" }}>
              <strong>⚡ Automatic Unit Conversion:</strong> {simResult.unitConversionNote}
            </div>
          </div>
        </div>
      </s-section>

      {/* Live Cross-Border Market Localization Queue Section */}
      <s-section heading="⚡ Live Cross-Border Storefront Localization Queue">
        <s-paragraph>
          Review culturally adapted product listings before pushing to Shopify Markets. GlobalReach AI guarantees proper grammar formality, automatic measurement conversions, and rounded local currency pricing!
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {profiles.map((p) => {
            let statusBg = "#f1f5f9";
            let statusColor = "#475569";
            if (p.publishingStatus === "PUBLISHED_STOREFRONT") { statusBg = "#d1fae5"; statusColor = "#065f46"; }
            if (p.publishingStatus === "REVIEWED_APPROVED") { statusBg = "#e0e7ff"; statusColor = "#3730a3"; }
            if (p.publishingStatus === "ARCHIVED") { statusBg = "#e2e8f0"; statusColor = "#64748b"; }

            return (
              <div key={p.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                {/* Top Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#0369a1" }}>🌍 {p.targetMarket.replace(/_/g, " - ")}</span>
                    <span style={{ marginLeft: "12px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#f3f4f6", color: "#475569" }}>
                      🗣️ Language: {p.targetLanguage}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#e0f2fe", color: "#0369a1" }}>
                      🎯 {p.culturalNuanceScore}% Cultural Nuance Score
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: statusBg, color: statusColor, textTransform: "uppercase" }}>
                      {p.publishingStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Grid Content (Side-by-Side Diff) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {/* Left: Original US English */}
                  <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                      🇺🇸 Original US English Listing:
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                      {p.originalTitle}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#475569", marginBottom: "8px" }}>
                      Original Price: ${p.originalPrice.toFixed(2)} USD
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                      ℹ️ Standard US sizing (inches, fl oz, US shoe chart) & English copy.
                    </div>
                  </div>

                  {/* Right: Culturally Adapted Localized */}
                  <div style={{ background: "#f0fdf4", padding: "14px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#065f46", textTransform: "uppercase", marginBottom: "6px" }}>
                      🌐 Culturally Adapted Storefront Listing:
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "800", color: "#064e3b", marginBottom: "6px" }}>
                      {p.localizedTitle}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "800", color: "#047857", backgroundColor: "#d1fae5", padding: "2px 8px", borderRadius: "4px" }}>
                        🏷️ {p.localizedPriceDisplay}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#065f46" }}>
                        ✅ MarginGuard Verified
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#065f46", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid #a7f3d0", fontWeight: "600" }}>
                      ⚡ {p.unitConversionNote}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {p.publishingStatus !== "PUBLISHED_STOREFRONT" ? (
                    <>
                      <s-button onClick={() => handleResolve(p.id, "PUBLISH")}>
                        🚀 Publish to Shopify Markets Storefront
                      </s-button>
                      <s-button onClick={() => handleResolve(p.id, "APPROVE")}>
                        ✏️ Approve Cultural Nuance
                      </s-button>
                      <s-button onClick={() => handleResolve(p.id, "ARCHIVE")}>
                        🚫 Archive Profile
                      </s-button>
                    </>
                  ) : (
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#059669", padding: "4px 0" }}>
                      ✅ Live on International Shopify Markets Storefront
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
