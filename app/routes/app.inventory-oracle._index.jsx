import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateInventoryForecast, evaluateInventoryHealth } from "../services/inventoryOracle";
import {
  seedInitialInventoryForecasts,
  executeInventoryAction,
} from "../services/inventoryOracle.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await seedInitialInventoryForecasts(prisma, shop);

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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESOLVE") {
    const id = formData.get("id");
    const resolution = formData.get("resolution"); // DISPATCH_PO, DELIVERED, CLEARANCE
    await executeInventoryAction(prisma, id, resolution);
    return { success: true, action: "RESOLVE", resolution };
  }

  if (actionType === "RESET_DEMO") {
    await prisma.inventoryForecastProfile.deleteMany({ where: { shop } });
    await seedInitialInventoryForecasts(prisma, shop);
    return { success: true, action: "RESET_DEMO" };
  }

  return { success: false };
};

export default function InventoryOracleDashboard() {
  const { items, stats } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // State for interactive simulator
  const [simTitle, setSimTitle] = useState("Heavyweight Organic Cotton Fleece Hoodie");
  const [simStock, setSimStock] = useState("12");
  const [simVelocity, setSimVelocity] = useState("4.5");
  const [simLeadTime, setSimLeadTime] = useState("14");

  const simResult = evaluateInventoryHealth({
    productTitle: simTitle,
    currentStock: parseInt(simStock) || 0,
    dailySalesVelocity: parseFloat(simVelocity) || 1.0,
    supplierLeadTimeDays: parseInt(simLeadTime) || 14,
  });

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "RESOLVE") {
        let msg = "Supply chain action executed!";
        if (fetcher.data.resolution === "DISPATCH_PO") msg = "📨 Emergency Purchase Order (PO) dispatched to supplier!";
        if (fetcher.data.resolution === "DELIVERED") msg = "✅ PO shipment marked delivered! Inventory restocked.";
        if (fetcher.data.resolution === "CLEARANCE") msg = "🏷️ Clearance bundle discount initiated via PulseAI/MarginGuard!";
        shopify.toast.show(msg);
      } else if (fetcher.data.action === "RESET_DEMO") {
        shopify.toast.show("Demo supply chain forecasts reset successfully!");
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
    <s-page heading="🔮 InventoryOracle AI — Autonomous Supply Chain Rebalancer & Stockout Predictor">
      <s-button slot="primary-action" onClick={handleResetDemo}>
        🔄 Reset Supply Chain Forecasts
      </s-button>

      {/* KPI Stats Section */}
      <s-section heading="Autonomous Supply Chain Telemetry & Working Capital Monitor">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(220, 38, 38, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>🚨 IMMINENT STOCKOUT ALERTS</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>{stats.criticalCount} SKUs at Risk</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Stockout predicted before supplier lead time!</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>📦 RECOMMENDED PO VALUE</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.recommendedPoVal}</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>AI draft POs ready for supplier dispatch</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)", color: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.2)" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", opacity: 0.9 }}>💵 OVERSTOCKED CAPITAL UNLOCKED</div>
            <div style={{ fontSize: "32px", fontWeight: "800", marginTop: "8px" }}>${stats.deadStockVal}</div>
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>Dead stock identified for clearance bundling</div>
          </div>
        </div>
      </s-section>

      {/* Interactive Supply Chain Sandbox Section */}
      <s-section heading="🔬 Live Supply Chain Alchemist Sandbox">
        <s-paragraph>
          Test InventoryOracle AI in real-time! Simulate stock levels, sales velocity (including viral demand surges from PulseAI), and supplier lead times to watch AI predict stockout dates and formulate supplier Purchase Orders!
        </s-paragraph>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => { setSimTitle("Heavyweight Organic Cotton Fleece Hoodie"); setSimStock("12"); setSimVelocity("4.5"); setSimLeadTime("14"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #fca5a5", background: "#fef2f2", fontSize: "12px", cursor: "pointer", fontWeight: "700", color: "#b91c1c" }}
          >
            🚨 Viral Surge Stockout (Stock: 12, Lead Time: 14d)
          </button>
          <button
            onClick={() => { setSimTitle("AeroMesh Lightweight Performance Running Sneaker"); setSimStock("320"); setSimVelocity("0.4"); setSimLeadTime("21"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #fde68a", background: "#fffbeb", fontSize: "12px", cursor: "pointer", fontWeight: "700", color: "#b45309" }}
          >
            📦 Dead Stock (Stock: 320, Velocity: 0.4/day)
          </button>
          <button
            onClick={() => { setSimTitle("HydraGlow Advanced Vitamin C Radiance Serum"); setSimStock("180"); setSimVelocity("8.2"); setSimLeadTime("14"); }}
            style={{ padding: "6px 12px", borderRadius: "20px", border: "1px solid #6ee7b7", background: "#ecfdf5", fontSize: "12px", cursor: "pointer", fontWeight: "700", color: "#047857" }}
          >
            ✅ Optimal Buffer (Stock: 180, Velocity: 8.2/day)
          </button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                🏷️ Product SKU Title
              </label>
              <input
                type="text"
                value={simTitle}
                onChange={(e) => setSimTitle(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  📦 Current Warehouse Stock (Units)
                </label>
                <input
                  type="text"
                  value={simStock}
                  onChange={(e) => setSimStock(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#1d4ed8" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                  🚀 Daily Sales Velocity (Units/day)
                </label>
                <input
                  type="text"
                  value={simVelocity}
                  onChange={(e) => setSimVelocity(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#059669" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                🚢 Supplier Lead Time (Days to Restock)
              </label>
              <input
                type="text"
                value={simLeadTime}
                onChange={(e) => setSimLeadTime(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }}
              />
              <span style={{ fontSize: "11px", color: "#64748b" }}>Includes production & customs clearance time</span>
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>🧠 AI Stockout Prediction Math</span>
                <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "800", backgroundColor: simResult.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fee2e2" : simResult.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#fef3c7" : "#d1fae5", color: simResult.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#991b1b" : simResult.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#b45309" : "#065f46" }}>
                  {simResult.stockStatus.replace(/_/g, " ")}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div style={{ background: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "#fef2f2" : "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid", borderColor: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "#fca5a5" : "#e2e8f0" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "#991b1b" : "#64748b" }}>PREDICTED STOCKOUT:</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "#dc2626" : "#1e293b" }}>
                    {simResult.predictedStockoutDays} Days
                  </div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "#991b1b" : "#64748b" }}>
                    {simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "⚠️ Before Lead Time!" : "✅ Safe Buffer"}
                  </div>
                </div>

                <div style={{ background: "#f0fdf4", padding: "10px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#065f46" }}>RECOMMENDED PO SIZE:</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#059669" }}>{simResult.recommendedPoUnits} Units</div>
                  <div style={{ fontSize: "10px", color: "#065f46" }}>(${simResult.recommendedPoUnits * 35} Est. Cost)</div>
                </div>
              </div>

              <div style={{ fontSize: "11px", color: "#475569", background: "#f1f5f9", padding: "8px", borderRadius: "6px", marginBottom: "10px", lineHeight: "1.4" }}>
                <strong>📉 Reorder Threshold Trigger:</strong> {simResult.reorderPointUnits} Units (Lead time + 14d safety buffer) | <strong>💰 Working Capital Tied:</strong> ${simResult.workingCapitalUsd}
              </div>

              <div style={{ fontSize: "12px", color: "#334155", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontWeight: "600" }}>
                {simResult.rationale}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <span style={{ padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "800", backgroundColor: "#1e293b", color: "white" }}>
                AI Action: {simResult.aiActionRecommendation.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </s-section>

      {/* Live Supply Chain & Purchase Order Queue Section */}
      <s-section heading="⚡ Live Supply Chain & Purchase Order (PO) Dispatch Queue">
        <s-paragraph>
          Review tracked supply chain items across your warehouse. Notice how AI drafts Purchase Orders before stockouts happen and identifies dead stock for clearance bundling!
        </s-paragraph>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
          {items.map((i) => {
            let statusBg = "#f1f5f9";
            let statusColor = "#475569";
            if (i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT") { statusBg = "#fee2e2"; statusColor = "#991b1b"; }
            if (i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL") { statusBg = "#fef3c7"; statusColor = "#b45309"; }
            if (i.stockStatus === "HEALTHY_BUFFER") { statusBg = "#d1fae5"; statusColor = "#065f46"; }
            if (i.stockStatus === "REORDER_PLACED") { statusBg = "#e0f2fe"; statusColor = "#0369a1"; }

            return (
              <div key={i.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                {/* Top Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>📦 {i.productTitle}</span>
                    <span style={{ marginLeft: "12px", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: "#f3f4f6", color: "#475569" }}>
                      SKU: {i.productId.split("/").pop()}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1" }}>
                      PO Status: {i.poStatus.replace(/_/g, " ")}
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor, textTransform: "uppercase" }}>
                      {i.stockStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Grid Content (Side-by-Side Comparison) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
                  {/* Left: Current Inventory Telemetry */}
                  <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                      📊 Current Warehouse Telemetry:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "8px" }}>
                      <div style={{ background: "white", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "700" }}>STOCK UNITS</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b" }}>{i.currentStock}</div>
                      </div>
                      <div style={{ background: "white", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "700" }}>VELOCITY</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#059669" }}>{i.dailySalesVelocity}/d</div>
                      </div>
                      <div style={{ background: "white", padding: "8px", borderRadius: "4px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "700" }}>LEAD TIME</div>
                        <div style={{ fontSize: "16px", fontWeight: "800", color: "#334155" }}>{i.supplierLeadTimeDays}d</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                      ℹ️ Working capital tied up: ${(i.currentStock * 35).toLocaleString()} ($35 avg cost per unit).
                    </div>
                  </div>

                  {/* Right: AI Supply Chain Oracle Prediction */}
                  <div style={{ background: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fef2f2" : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#fffbeb" : "#f0fdf4", padding: "14px", borderRadius: "8px", border: "1px solid", borderColor: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fca5a5" : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#fde68a" : "#a7f3d0" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#991b1b" : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#b45309" : "#065f46", textTransform: "uppercase", marginBottom: "6px" }}>
                      🧠 AI Supply Chain Oracle Prediction:
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "18px", fontWeight: "800", color: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#dc2626" : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#d97706" : "#047857" }}>
                        Stockout in: {i.predictedStockoutDays} Days
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", backgroundColor: "white", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                        Reorder at: {i.reorderPointUnits}u
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#991b1b" : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#b45309" : "#065f46", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid", borderColor: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fca5a5" : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "#fde68a" : "#a7f3d0", fontWeight: "600" }}>
                      ⚡ Verified via PulseAI (Viral Surges) & AdSpend Guardian (Ad Budgets): {i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? `🚨 Emergency PO of ${i.recommendedPoUnits} units generated!` : i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" ? "📦 Recommending 20% clearance bundle discount." : "✅ Healthy buffer."}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  {i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" && (
                    <s-button onClick={() => handleResolve(i.id, "DISPATCH_PO")}>
                      📨 Dispatch Emergency Purchase Order (PO)
                    </s-button>
                  )}
                  {i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" && (
                    <s-button onClick={() => handleResolve(i.id, "CLEARANCE")}>
                      🏷️ Create 20% Clearance Bundle (via PulseAI)
                    </s-button>
                  )}
                  {i.stockStatus === "REORDER_PLACED" && (
                    <s-button onClick={() => handleResolve(i.id, "DELIVERED")}>
                      ✅ Mark PO Delivered (+{i.recommendedPoUnits} Units Restocked)
                    </s-button>
                  )}
                  {i.stockStatus === "HEALTHY_BUFFER" && (
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#059669", alignSelf: "center", marginRight: "8px" }}>
                      ✅ No emergency action required
                    </span>
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
