import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateCatalogQualityScore, healCatalogItem } from "../services/catalogAlchemy";
import {
  seedInitialCatalogItems,
  executeCatalogPublish,
} from "../services/catalogAlchemy.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialCatalogItems(prisma, shop);

  const items = await prisma.catalogItemProfile.findMany({
    where: { shop },
    orderBy: { aiQualityScoreHealed: "desc" },
  });

  let totalRawScore = 0;
  let totalHealedScore = 0;
  let totalPublished = 0;
  let totalMetafieldsExtracted = 0;

  for (const item of items) {
    totalRawScore += item.aiQualityScoreRaw;
    totalHealedScore += item.aiQualityScoreHealed;
    if (item.aiHealingStatus === "AUTO_PUBLISHED") totalPublished++;

    try {
      const mf = JSON.parse(item.extractedMetafields || "{}");
      totalMetafieldsExtracted += Object.keys(mf).length;
    } catch (e) {
      // ignore parse error
    }
  }

  const avgRaw = items.length > 0 ? Math.round(totalRawScore / items.length) : 0;
  const avgHealed = items.length > 0 ? Math.round(totalHealedScore / items.length) : 0;

  return {
    items,
    stats: {
      avgRaw,
      avgHealed,
      scoreJump: avgHealed - avgRaw,
      totalPublished,
      totalMetafieldsExtracted,
      totalItems: items.length,
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
    const resolution = formData.get("resolution"); // PUBLISH or REJECT
    await executeCatalogPublish(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.catalogItemProfile.deleteMany({ where: { shop } });
    await seedInitialCatalogItems(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function CatalogAlchemyDashboard() {
  const { items, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive sandbox
  const [simTitle, setSimTitle] = useState("HOT SALE!! 2024 Newest Men Womens Running Shoes Breathable Mesh Sport Sneakers Size 36-45 CHEAP");
  const [simDesc, setSimDesc] = useState("good quality running shoes mesh breathable comfortable sport shoes for men women outdoor gym running cheap price factory direct sale buy now fast shipping!");
  
  const simHealed = healCatalogItem({
    rawTitle: simTitle,
    rawDescription: simDesc,
    rawVendor: "AliExpress Wholesale",
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        shopify.toast.show(`Catalog item ${fetcher.data.resolution === "PUBLISH" ? "Published to Shopify" : "Rejected"}!`);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo catalog data reset successfully!");
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
    <s-page heading="✨ CatalogAlchemy AI — Autonomous Catalog Healing & Metafield Mapper">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Demo Data
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="AI Alchemist Quality Telemetry">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🧪 AVG QUALITY SCORE JUMP</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgRaw} ➔ {stats.avgHealed} <span style={{ fontSize: "20px", color: "#a7f3d0" }}>(+{stats.scoreJump} pts)</span></div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Converted from ALL-CAPS supplier spam</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>📦 PRODUCTS HEALED & PUBLISHED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalPublished} / {stats.totalItems}</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Auto-standardized with brand style guide</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🏷️ SEMANTIC METAFIELDS EXTRACTED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalMetafieldsExtracted} Attributes</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Mapped to Shopify 2.0 storefront filters</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Alchemist Sandbox Section */}
      <s-section heading="🔬 Live AI Alchemist Sandbox & Metafield Extractor">
        <s-paragraph>
          Paste any messy supplier import title and wall-of-text description below. Notice how CatalogAlchemy AI strips ALL-CAPS keyword spam, formats benefit bullet points, generates SEO meta tags, and extracts structured attributes for Shopify filters.
        </s-paragraph>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#1e293b" }}>❌ 1. Paste Raw Supplier Import</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Raw Title (AliExpress / CJ / ERP)</label>
                <textarea
                  rows="3"
                  value={simTitle}
                  onChange={(e) => setSimTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Raw Description</label>
                <textarea
                  rows="6"
                  value={simDesc}
                  onChange={(e) => setSimDesc(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>✨ 2. AI Healed Listing & Metafields</span>
                <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", backgroundColor: "#d1fae5", color: "#065f46" }}>
                  Score: {simHealed.scoreRaw} ➔ {simHealed.scoreHealed} (+{simHealed.scoreHealed - simHealed.scoreRaw})
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "#334155" }}>
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Healed Brand Title:</span>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>{simHealed.healedTitle}</div>
                </div>

                <div style={{ marginBottom: "12px", background: "#f8fafc", padding: "10px", borderRadius: "6px", maxHeight: "150px", overflowY: "auto", fontSize: "12px", lineHeight: "1.5" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Healed Markdown Description:</span>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{simHealed.healedDescription}</pre>
                </div>

                <div>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Extracted Shopify 2.0 Metafields:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {Object.entries(JSON.parse(simHealed.extractedMetafields || "{}")).map(([k, v]) => (
                      <span key={k} style={{ padding: "3px 8px", backgroundColor: "#e0e7ff", color: "#3730a3", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                        {k.replace("custom.", "")}: <strong>{v}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "4px solid #10b981", fontSize: "12px", color: "#065f46" }}>
              ✅ <strong>SEO Alchemist Verified:</strong> Title tag & description optimized for Google search and Shopify storefront filters.
            </div>
          </div>
        </div>
      </s-section>

      {/* Live Catalog Healing Queue Section */}
      <s-section heading="⚡ Live Catalog Healing Queue (Side-by-Side Diffs)">
        <s-paragraph>
          Review imported supplier products. CatalogAlchemy AI pre-computes healed titles, formatting, and metafields. 1-click publishing updates your live Shopify catalog via GraphQL.
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {items.map((item) => {
            let extractedObj = {};
            try {
              extractedObj = JSON.parse(item.extractedMetafields || "{}");
            } catch (e) {}

            let statusBg = "#f1f5f9";
            let statusColor = "#475569";
            if (item.aiHealingStatus === "AUTO_PUBLISHED") { statusBg = "#d1fae5"; statusColor = "#065f46"; }
            if (item.aiHealingStatus === "HEALED_READY_FOR_REVIEW") { statusBg = "#e0e7ff"; statusColor = "#3730a3"; }
            if (item.aiHealingStatus === "REJECTED") { statusBg = "#fee2e2"; statusColor = "#991b1b"; }

            return (
              <div key={item.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>Product ID: {item.productId.replace("gid://shopify/Product/", "#")}</span>
                    <span style={{ marginLeft: "12px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: "#f3f4f6", color: "#475569" }}>
                      Vendor: {item.rawVendor}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#059669" }}>
                      Score: {item.aiQualityScoreRaw} ➔ {item.aiQualityScoreHealed} (+{item.aiQualityScoreHealed - item.aiQualityScoreRaw} pts)
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", backgroundColor: statusBg, color: statusColor, textTransform: "uppercase" }}>
                      {item.aiHealingStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Diff Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {/* Left: Raw Supplier Import */}
                  <div style={{ background: "#fff1f2", padding: "14px", borderRadius: "8px", border: "1px solid #fecdd3" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b", textTransform: "uppercase", marginBottom: "6px" }}>
                      ❌ Raw Supplier Import (Score: {item.aiQualityScoreRaw}/100)
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#7f1d1d", marginBottom: "8px" }}>
                      {item.rawTitle}
                    </div>
                    <div style={{ fontSize: "12px", color: "#881337", maxHeight: "100px", overflowY: "auto", fontFamily: "monospace" }}>
                      {item.rawDescription}
                    </div>
                  </div>

                  {/* Right: AI Healed Listing */}
                  <div style={{ background: "#f0fdf4", padding: "14px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#065f46", textTransform: "uppercase", marginBottom: "6px" }}>
                      ✨ AI Healed & Standardized (Score: {item.aiQualityScoreHealed}/100)
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "800", color: "#064e3b", marginBottom: "8px" }}>
                      {item.healedTitle}
                    </div>
                    <div style={{ fontSize: "12px", color: "#065f46", maxHeight: "100px", overflowY: "auto", marginBottom: "10px", whiteSpace: "pre-wrap" }}>
                      {item.healedDescription}
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#047857", display: "block", marginBottom: "4px" }}>Extracted Semantic Metafields:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {Object.entries(extractedObj).map(([k, v]) => (
                          <span key={k} style={{ padding: "2px 6px", backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                            {k.replace("custom.", "")}: {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {item.aiHealingStatus !== "AUTO_PUBLISHED" ? (
                    <>
                      <s-button onClick={() => handleResolve(item.id, "PUBLISH")}>
                        🚀 Publish Healed Listing to Shopify
                      </s-button>
                      <s-button onClick={() => handleResolve(item.id, "REJECT")}>
                        🚫 Reject Alchemist Draft
                      </s-button>
                    </>
                  ) : (
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#059669", padding: "4px 0" }}>
                      ✅ Listing Published & Standardized on Storefront
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
