import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialLocalizationProfiles,
  executeLocalizationAction,
} from "../services/globalReach.server";
import {
  localizeProductContent,
} from "../services/globalReach";

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

export default function GlobalReachRoute() {
  const { profiles, stats } = useLoaderData();
  const fetcher = useFetcher();

  const [simRegion, setSimRegion] = useState("DE");
  const [simTitle, setSimTitle] = useState("Heavyweight Organic Cotton Fleece Hoodie");
  const [simPrice, setSimPrice] = useState(110);

  const simLocalized = localizeProductContent({
    originalTitle: simTitle,
    originalPrice: Number(simPrice),
    targetMarket: simRegion === "DE" ? "GERMANY_EU" : simRegion === "JP" ? "JAPAN_APAC" : "FRANCE_EU",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🌐 GlobalReach AI — Autonomous Cross-Border Localization Engine
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Adapts cultural tone, Japanese keigo politeness, German DIN certification standards, unit conversions & psychological currency rounding.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Cultural Localization Alchemist
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Test instant market adaptation across target countries:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Target Market Region</label>
              <select value={simRegion} onChange={(e) => setSimRegion(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }}>
                <option value="DE">🇩🇪 Germany (DE) — DIN Quality & Precision</option>
                <option value="JP">🇯🇵 Japan (JP) — Keigo Formal & Gift Box Framing</option>
                <option value="FR">🇫🇷 France (FR) — Parisian Luxury & Elegance</option>
                <option value="MX">🇲🇽 Mexico (MX) — Installment Options & Warmth</option>
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Original Product Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Original USD Price ($)</label>
              <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>🧠 Culturally Adapted Storefront</span>
                <span className="saas-badge badge-success">
                  Nuance Score: {simLocalized.culturalNuanceScore}/100
                </span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--brand-primary)", marginBottom: "4px" }}>
                {simLocalized.localizedTitle}
              </div>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "var(--success-main)", marginBottom: "8px" }}>
                Price: {simLocalized.localizedPriceDisplay}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4", whiteSpace: "pre-wrap" }}>
                {simLocalized.localizedDescription}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Live Regional Market Adaptation Queue
      </h2>

      {profiles.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>No Market Localizations Found</div>
          <div style={{ fontSize: "13px" }}>Synchronize your store inventory to start translating product listings into regional dialects and currency conversions.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {profiles.map((p) => {
            let isPublished = p.publishingStatus === "PUBLISHED_STOREFRONT";

            return (
              <div key={p.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px" }}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "var(--brand-primary)" }}>🌐 Region: {p.targetMarket}</span>
                    <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Original SKU: {p.originalTitle} (${p.originalPrice})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="saas-badge badge-success">
                      Nuance: {p.culturalNuanceScore}/100
                    </span>
                    <span className={`saas-badge ${isPublished ? "badge-success" : "badge-brand"}`}>
                      {p.publishingStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>LOCALIZED STOREFRONT LISTING</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-main)", marginBottom: "4px" }}>{p.localizedTitle}</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--success-main)", marginBottom: "6px" }}>Price: {p.localizedPriceDisplay}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>{p.localizedDescription}</div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>UNIT CONVERSION & CULTURAL HOOKS</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      • Language: <strong>{p.targetLanguage}</strong><br />
                      • Notes: {p.unitConversionNote}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => handleAction(p.id, "PUBLISH")}
                    disabled={fetcher.state !== "idle" || isPublished}
                    className="saas-btn btn-primary"
                  >
                    {isPublished ? "✓ Published to Shopify Markets" : "🚀 Publish Localized Listing"}
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
