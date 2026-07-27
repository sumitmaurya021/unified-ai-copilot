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
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialCatalogItems(prisma, shop, admin);

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
      // ignore
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
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "PUBLISH") {
    const id = formData.get("id");
    await executeCatalogPublish(prisma, id, "PUBLISH", admin);
    return { success: true, action: "PUBLISH" };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.catalogItemProfile.deleteMany({ where: { shop } });
    await seedInitialCatalogItems(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function CatalogAlchemyDashboard() {
  const { items, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [simTitle, setSimTitle] = useState("2026 NEW HOT SALE CHEAP MENS SNEAKER ATHLETIC SHOE");
  const [simDesc, setSimDesc] = useState("Good shoe cheap price buy now fast shipping size 10 11 12.");

  const simRawScoreObj = calculateCatalogQualityScore({ rawTitle: simTitle, rawDescription: simDesc });
  const simHealed = healCatalogItem({ rawTitle: simTitle, rawDescription: simDesc, vendor: "Alibaba Direct" });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "PUBLISH") {
        shopify.toast.show("✨ Healed listing & Shopify 2.0 Metafields published to store!");
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo catalog items reset successfully!");
      }
    }
  }, [fetcher.data, shopify]);

  const handlePublish = (id) => {
    fetcher.submit({ actionType: "PUBLISH", id }, { method: "POST" });
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
            ✨ CatalogAlchemy AI — Autonomous Catalog Healing & Metafield Mapper
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Strips supplier spam, rewrites conversion titles, and maps JSON metafields for Shopify 2.0 storefront filters.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span>🔄</span> Reset Catalog Items
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #312e81 0%, #7c3aed 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>📈 AVERAGE HEALED QUALITY SCORE</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.avgHealed} / 100</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>+{stats.scoreJump} points boost over raw import ({stats.avgRaw})</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>✨ PUBLISHED HEALED LISTINGS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalPublished} / {stats.totalItems} SKUs</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Live on Shopify 2.0 Storefront</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(6, 182, 212, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🏷️ EXTRACTED METAFIELDS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.totalMetafieldsExtracted} Metafields</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Material, care, fit & origin attributes</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Catalog Alchemist Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Paste raw supplier titles/descriptions below to watch AI strip spam and generate structured Shopify 2.0 listings:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Raw Supplier Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Raw Description</label>
              <textarea rows={3} value={simDesc} onChange={(e) => setSimDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
            </div>

            <div style={{ marginTop: "10px", fontSize: "11px", color: "#dc2626", fontWeight: "700" }}>
              Raw Supplier Score: {simRawScoreObj.score}/100 (Contains caps spam / missing metafields)
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🧠 AI Healed Listing</span>
                <span style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", whiteSpace: "nowrap" }}>
                  Score: {simHealed.scoreHealed}/100
                </span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#7c3aed", marginBottom: "6px", wordBreak: "break-word" }}>
                {simHealed.healedTitle}
              </div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {simHealed.healedDescription}
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", fontSize: "11px", color: "#0369a1", fontWeight: "700", wordBreak: "break-all" }}>
              Extracted Metafields: {simHealed.extractedMetafields}
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Catalog Listings Healing Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {items.map((item) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (item.aiHealingStatus === "AUTO_PUBLISHED") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (item.aiHealingStatus === "HEALED_DRAFT") { statusBg = "#e0e7ff"; statusColor = "#4f46e5"; }

          return (
            <div key={item.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>✨ {item.healedTitle}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>Vendor: {item.vendor}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#fef2f2", color: "#dc2626" }}>
                    Raw: {item.aiQualityScoreRaw}/100
                  </span>
                  <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#059669" }}>
                    Healed: {item.aiQualityScoreHealed}/100
                  </span>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                    {item.aiHealingStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                <div style={{ background: "#fffbeb", padding: "12px", borderRadius: "8px", border: "1px solid #fde68a", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#b45309", marginBottom: "4px" }}>
                    🔴 RAW SUPPLIER IMPORT:
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#78350f" }}>"{item.rawTitle}"</div>
                  <div style={{ fontSize: "11px", color: "#92400e", marginTop: "4px" }}>"{item.rawDescription}"</div>
                </div>

                <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid #a7f3d0", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#065f46", marginBottom: "4px" }}>
                    🟢 AI HEALED STOREFRONT LISTING:
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#047857" }}>"{item.healedTitle}"</div>
                  <div style={{ fontSize: "11px", color: "#065f46", marginTop: "4px" }}>Metafields: {item.extractedMetafields}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {item.aiHealingStatus !== "AUTO_PUBLISHED" && (
                  <button onClick={() => handlePublish(item.id)} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.25)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🚀</span> Publish Healed Listing to Shopify
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
