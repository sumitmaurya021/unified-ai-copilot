import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  seedInitialInventoryForecasts,
  executeInventoryAction,
} from "../services/inventoryOracle.server";
import {
  evaluateInventoryHealth,
} from "../services/inventoryOracle";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialInventoryForecasts(prisma, shop, admin);

  const items = await prisma.inventoryForecastProfile.findMany({
    where: { shop },
    orderBy: { predictedStockoutDays: "asc" },
  });

  let criticalCount = 0;
  let recommendedPoVal = 0;
  let deadStockVal = 0;

  for (const i of items) {
    if (i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT") {
      criticalCount++;
      recommendedPoVal += i.recommendedPoUnits * 35;
    }
    if (i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL") {
      deadStockVal += i.currentStock * 35;
    }
  }

  return {
    items,
    stats: {
      criticalCount,
      recommendedPoVal: Math.round(recommendedPoVal),
      deadStockVal: Math.round(deadStockVal),
      totalItems: items.length,
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
    const resolution = formData.get("resolution"); // DISPATCH_PO, DELIVERED, CLEARANCE
    await executeInventoryAction(prisma, id, resolution, admin);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.inventoryForecastProfile.deleteMany({ where: { shop } });
    await seedInitialInventoryForecasts(prisma, shop, admin);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function InventoryOracleRoute() {
  const { items, stats } = useLoaderData();
  const fetcher = useFetcher();

  const [simTitle, setSimTitle] = useState("Heavyweight Organic Cotton Fleece Hoodie");
  const [simStock, setSimStock] = useState(12);
  const [simVelocity, setSimVelocity] = useState(4.5);
  const [simLeadTime, setSimLeadTime] = useState(14);

  const simResult = evaluateInventoryHealth({
    productTitle: simTitle,
    currentStock: Number(simStock),
    dailySalesVelocity: Number(simVelocity),
    supplierLeadTimeDays: Number(simLeadTime),
  });

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
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🔮 InventoryOracle AI — Autonomous Supply Chain Rebalancer & Stockout Predictor
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-subtle)", margin: 0 }}>
            Predicts exact stockout dates based on sales velocity, supplier lead times, and viral surges from PulseAI & AdSpend Guardian.
          </p>
        </div>

        <button onClick={handleResetDemo} className="saas-btn btn-secondary">
          <span>🔄</span> Reset Supply Chain Forecasts
        </button>
      </div>

      {/* Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>🚨 IMMINENT STOCKOUT ALERTS</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.criticalCount} SKUs at Risk</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Stockout predicted before supplier lead time</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>📦 RECOMMENDED PO VALUE</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.recommendedPoVal.toLocaleString()}</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>AI draft POs ready for supplier dispatch</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #78350f 0%, #d97706 100%)", padding: "20px", borderRadius: "12px", color: "white", boxShadow: "0 4px 12px rgba(217, 119, 6, 0.25)" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9 }}>💵 OVERSTOCKED CAPITAL UNLOCKED</div>
          <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.deadStockVal.toLocaleString()}</div>
          <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Dead stock identified for clearance bundling</div>
        </div>
      </div>

      {/* Simulator */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "var(--shadow-md)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", margin: "0 0 8px 0" }}>
          🔬 Live Supply Chain Alchemist Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-subtle)", margin: "0 0 16px 0" }}>
          Simulate stock levels, sales velocity, and supplier lead times to watch AI predict stockout dates:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "var(--bg-subtle)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-strong)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Product SKU Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "600" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Current Stock (Units)</label>
                <input type="number" value={simStock} onChange={(e) => setSimStock(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Daily Velocity (Units/day)</label>
                <input type="number" step="0.1" value={simVelocity} onChange={(e) => setSimVelocity(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px", fontWeight: "700" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-main)", marginBottom: "4px" }}>Supplier Lead Time (Days)</label>
              <input type="number" value={simLeadTime} onChange={(e) => setSimLeadTime(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-strong)", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>🧠 AI Stockout Prediction</span>
                <span className={`saas-badge ${simResult.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "badge-danger" : "badge-success"}`}>
                  {simResult.stockStatus?.replace(/_/g, " ")}
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                • <strong>Predicted Stockout:</strong> <span style={{ color: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "var(--danger-main)" : "var(--text-main)", fontWeight: "800" }}>{simResult.predictedStockoutDays} Days</span><br />
                • <strong>Reorder Threshold:</strong> {simResult.reorderPointUnits} Units<br />
                • <strong>Recommended PO:</strong> {simResult.recommendedPoUnits} Units (${simResult.recommendedPoUnits * 35} Cost)
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "11px", fontWeight: "800", textAlign: "center", border: "1px solid var(--border-strong)" }}>
              AI Action: {simResult.aiActionRecommendation?.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", marginBottom: "16px" }}>
        ⚡ Live Supply Chain & Purchase Order (PO) Queue
      </h2>
      {items.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-main)", marginBottom: "6px" }}>No Inventory Forecasts Available</div>
          <div style={{ fontSize: "13px" }}>Synchronize store sales velocity and inventory stock levels to predict stockouts and automate Purchase Order dispatching.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {items.map((i) => {
            let isCritical = i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT";

            return (
              <div key={i.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "20px", boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>📦 {i.productTitle}</span>
                    <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-subtle)" }}>Stock: <strong>{i.currentStock} units</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`saas-badge ${isCritical ? "badge-danger" : "badge-success"}`}>
                      Stockout: {i.predictedStockoutDays} Days
                    </span>
                    <span className="saas-badge badge-brand">
                      Status: {i.stockStatus}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-subtle)", marginBottom: "4px" }}>VELOCITY & LEAD TIME</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                      • Sales Velocity: {i.dailySalesVelocity} units/day<br />
                      • Lead Time: {i.supplierLeadTimeDays} days<br />
                      • Reorder Threshold: {i.reorderPointUnits} units
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-primary)", marginBottom: "4px" }}>RECOMMENDED DRAFT PURCHASE ORDER</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-main)", marginBottom: "4px" }}>
                      Order {i.recommendedPoUnits} Units (${i.recommendedPoUnits * 35})
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      PO Status: {i.poStatus}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    onClick={() => handleResolve(i.id, "DISPATCH_PO")}
                    disabled={fetcher.state !== "idle" || i.poStatus === "APPROVED_DISPATCHED"}
                    className="saas-btn btn-primary"
                  >
                    {i.poStatus === "APPROVED_DISPATCHED" ? "✓ PO Dispatched to Supplier" : "🚀 Approve & Dispatch PO to Supplier"}
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
