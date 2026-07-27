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
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      
      {/* Module Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            🔮 InventoryOracle AI — Autonomous Supply Chain Rebalancer & Stockout Predictor
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Predicts exact stockout dates based on sales velocity, supplier lead times, and viral surges from PulseAI & AdSpend Guardian.
          </p>
        </div>

        <button onClick={handleResetDemo} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", color: "#334155", display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          🔬 Live Supply Chain Alchemist Sandbox
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
          Simulate stock levels, sales velocity, and supplier lead times to watch AI predict stockout dates:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Product SKU Title</label>
              <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "600" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Current Stock (Units)</label>
                <input type="number" value={simStock} onChange={(e) => setSimStock(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#1d4ed8" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Daily Velocity (Units/day)</label>
                <input type="number" step="0.1" value={simVelocity} onChange={(e) => setSimVelocity(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px", fontWeight: "700", color: "#059669" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>Supplier Lead Time (Days)</label>
              <input type="number" value={simLeadTime} onChange={(e) => setSimLeadTime(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>🧠 AI Stockout Prediction</span>
                <span style={{ backgroundColor: simResult.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fef2f2" : "#ecfdf5", color: simResult.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#dc2626" : "#059669", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800", whiteSpace: "nowrap" }}>
                  {simResult.stockStatus.replace(/_/g, " ")}
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.6" }}>
                • <strong>Predicted Stockout:</strong> <span style={{ color: simResult.predictedStockoutDays <= parseInt(simLeadTime) ? "#dc2626" : "#0f172a", fontWeight: "800" }}>{simResult.predictedStockoutDays} Days</span><br />
                • <strong>Reorder Threshold:</strong> {simResult.reorderPointUnits} Units<br />
                • <strong>Recommended PO:</strong> {simResult.recommendedPoUnits} Units (${simResult.recommendedPoUnits * 35} Cost)
              </div>
            </div>

            <div style={{ marginTop: "12px", padding: "8px", borderRadius: "6px", backgroundColor: "#1e293b", color: "white", fontSize: "11px", fontWeight: "800", textAlign: "center" }}>
              AI Action: {simResult.aiActionRecommendation.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
        ⚡ Live Supply Chain & Purchase Order (PO) Queue
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {items.map((i) => {
          let statusBg = "#f1f5f9";
          let statusColor = "#475569";
          if (i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT") { statusBg = "#fef2f2"; statusColor = "#dc2626"; }
          if (i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL") { statusBg = "#fffbeb"; statusColor = "#b45309"; }
          if (i.stockStatus === "HEALTHY_BUFFER") { statusBg = "#ecfdf5"; statusColor = "#059669"; }
          if (i.stockStatus === "REORDER_PLACED") { statusBg = "#e0f2fe"; statusColor = "#0369a1"; }

          return (
            <div key={i.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>📦 {i.productTitle}</span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", color: "#64748b" }}>SKU ID: {i.productId.split("/").pop()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1" }}>
                    PO: {i.poStatus.replace(/_/g, " ")}
                  </span>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: statusBg, color: statusColor }}>
                    {i.stockStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "4px" }}>WAREHOUSE TELEMETRY:</div>
                  <div style={{ fontSize: "13px", color: "#1e293b" }}>
                    Stock: <strong>{i.currentStock} units</strong> | Velocity: <strong>{i.dailySalesVelocity}/day</strong> | Lead Time: <strong>{i.supplierLeadTimeDays}d</strong>
                  </div>
                </div>

                <div style={{ background: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fef2f2" : "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid", borderColor: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#fca5a5" : "#a7f3d0", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#dc2626" : "#065f46", marginBottom: "4px" }}>🧠 AI ORACLE PREDICTION:</div>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" ? "#dc2626" : "#059669" }}>
                    Stockout in: {i.predictedStockoutDays} Days (Reorder point: {i.reorderPointUnits}u)
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                {i.stockStatus === "CRITICAL_STOCKOUT_IMMINENT" && (
                  <button onClick={() => handleResolve(i.id, "DISPATCH_PO")} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.25)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>📨</span> Dispatch Emergency Purchase Order (PO)
                  </button>
                )}
                {i.stockStatus === "OVERSTOCKED_DEAD_CAPITAL" && (
                  <button onClick={() => handleResolve(i.id, "CLEARANCE")} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>🏷️</span> Create 20% Clearance Bundle (PulseAI)
                  </button>
                )}
                {i.stockStatus === "REORDER_PLACED" && (
                  <button onClick={() => handleResolve(i.id, "DELIVERED")} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>✅</span> Mark PO Delivered (+{i.recommendedPoUnits} Units)
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
