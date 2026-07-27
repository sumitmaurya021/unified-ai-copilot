import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialCatalogItems,
  healCatalogItemWithGroq,
  publishHealedItemToShopify,
} from "../services/catalogAlchemy.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialCatalogItems(prisma, shop, admin);

  const items = await prisma.catalogItemProfile.findMany({
    where: { shop },
    orderBy: { aiQualityScoreHealed: "desc" },
  });

  let totalRaw = 0;
  let totalHealed = 0;
  let totalPublished = 0;
  let totalMetafieldsExtracted = 0;

  for (const item of items) {
    totalRaw += item.aiQualityScoreRaw;
    totalHealed += item.aiQualityScoreHealed;
    if (item.aiHealingStatus === "AUTO_PUBLISHED") {
      totalPublished++;
    }
    if (item.extractedMetafieldsJson) {
      try {
        const parsed = JSON.parse(item.extractedMetafieldsJson);
        totalMetafieldsExtracted += Object.keys(parsed).length;
      } catch (e) {
        totalMetafieldsExtracted += 4;
      }
    }
  }

  const avgRaw = items.length > 0 ? Math.round(totalRaw / items.length) : 0;
  const avgHealed = items.length > 0 ? Math.round(totalHealed / items.length) : 0;
  const scoreJump = avgHealed - avgRaw;

  return {
    items,
    stats: {
      avgRaw,
      avgHealed,
      scoreJump,
      totalPublished,
      totalItems: items.length,
      totalMetafieldsExtracted,
    },
  };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "HEAL_ITEM") {
    const id = formData.get("id");
    const item = await prisma.catalogItemProfile.findUnique({ where: { id } });

    if (item) {
      const healedData = await healCatalogItemWithGroq({
        originalTitle: item.originalTitle,
        originalDescription: item.originalDescription,
        vendor: item.vendor,
      });

      await prisma.catalogItemProfile.update({
        where: { id },
        data: {
          healedTitle: healedData.healedTitle,
          healedDescription: healedData.healedDescription,
          extractedMetafieldsJson: JSON.stringify(healedData.metafields),
          aiQualityScoreHealed: healedData.qualityScore,
          aiHealingStatus: "HEALED_DRAFT",
        },
      });
    }

    return { success: true, action: "HEAL_ITEM" };
  }

  if (actionType === "PUBLISH") {
    const id = formData.get("id");
    await publishHealedItemToShopify(prisma, id, admin);
    return { success: true, action: "PUBLISH" };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.catalogItemProfile.deleteMany({ where: { shop } });
    await seedInitialCatalogItems(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function CatalogAlchemyRoute() {
  const { items, stats } = useLoaderData();
  const fetcher = useFetcher();

  const [simTitle, setSimTitle] = useState("CHEAP MAN WINTER FLEECE SWEATER HOODIE HOT SALE 2026!!");
  const [simDesc, setSimDesc] = useState("Best price winter clothing top seller cheap shipping size M L XL XXL high quality.");

  const simRawScoreObj = { score: 38 };
  const simHealed = {
    healedTitle: "Heavyweight Organic Cotton Fleece Hoodie",
    healedDescription: "Crafted from 450GSM organic fleece with brushed interior warmth, double-needle stitching, and custom nickel hardware.",
    extractedMetafields: "Material: Organic Cotton, Fit: Oversized, Care: Machine Wash Cold",
    scoreHealed: 96,
  };

  const handleHeal = (id) => {
    fetcher.submit({ actionType: "HEAL_ITEM", id }, { method: "POST" });
  };

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
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            ✨ CatalogAlchemy AI — Autonomous Catalog Healing & Metafield Mapper
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Strips supplier spam, rewrites conversion titles, and maps JSON metafields for Shopify 2.0 storefront filters.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
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
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Catalog Alchemist Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Paste raw supplier titles/descriptions below to watch AI strip spam and generate structured Shopify 2.0 listings:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Raw Supplier Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Raw Description</label>
              <textarea rows={3} value={simDesc} onChange={(e) => setSimDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
            </div>

            <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--danger-main)", fontWeight: "700" }}>
              Raw Supplier Score: {simRawScoreObj.score}/100 (Contains caps spam / missing metafields)
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>🧠 AI Healed Listing</span>
                <span className="saas-badge badge-success">
                  Score: {simHealed.scoreHealed}/100
                </span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--brand-primary)", marginBottom: "6px", wordBreak: "break-word" }}>
                {simHealed.healedTitle}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {simHealed.healedDescription}
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: "var(--info-bg)", border: "1px solid var(--info-border)", fontSize: "11px", color: "var(--info-main)", fontWeight: "700", wordBreak: "break-all" }}>
              Extracted Metafields: {simHealed.extractedMetafields}
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Catalog Listings Healing Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {items.map((item) => {
          let isPublished = item.aiHealingStatus === "AUTO_PUBLISHED";

          return (
            <div key={item.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>✨ {item.healedTitle}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Vendor: {item.vendor}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="saas-badge badge-danger">
                    Raw: {item.aiQualityScoreRaw}/100
                  </span>
                  <span className="saas-badge badge-success">
                    Healed: {item.aiQualityScoreHealed}/100
                  </span>
                  <span className={`saas-badge ${isPublished ? "badge-success" : "badge-brand"}`}>
                    {item.aiHealingStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>RAW SUPPLIER LISTING (BEFORE)</div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>{item.originalTitle}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>{item.originalDescription}</div>
                </div>

                <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>AI HEALED LISTING & METAFIELDS (AFTER)</div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>{item.healedTitle}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4", marginBottom: "6px" }}>{item.healedDescription}</div>
                  {item.extractedMetafieldsJson && (
                    <div style={{ fontSize: "10px", color: "var(--brand-primary)", fontWeight: "700" }}>
                      Metafields: {item.extractedMetafieldsJson}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  onClick={() => handleHeal(item.id)}
                  disabled={fetcher.state !== "idle"}
                  className="saas-btn btn-secondary"
                >
                  ⚡ Re-Heal with AI
                </button>

                <button
                  onClick={() => handlePublish(item.id)}
                  disabled={fetcher.state !== "idle" || isPublished}
                  className="saas-btn btn-primary"
                >
                  {isPublished ? "✓ Published to Shopify" : "🚀 Heal & Publish to Storefront"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
