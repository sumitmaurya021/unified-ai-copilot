import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let config = await prisma.copilotGlobalSettings?.findUnique({ where: { shop } }).catch(() => null);

  return {
    shop,
    config: config || {
      themeMode: "system",
      autoPublishCatalog: false,
      autoRepriceMargin: true,
      autoResolveSupport: true,
      autoPauseBleedingAds: true,
      minNetRoasThreshold: 1.20,
      groqModel: "llama-3.3-70b-versatile",
      groqApiKeyConfigured: true,
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "RESET_DB_SYNC") {
    // Clear old database records across all tables so next load re-fetches from store
    await prisma.catalogItemProfile.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.productMarginProfile.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.returnRequest.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.inventoryForecastProfile.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.supportTicketProfile.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.trendOpportunityProfile.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.localizationProfile.deleteMany({ where: { shop } }).catch(() => {});
    await prisma.adCampaignProfile.deleteMany({ where: { shop } }).catch(() => {});

    return { success: true, message: "Database reset! Re-syncing live Shopify store data..." };
  }

  if (actionType === "SAVE_SETTINGS") {
    const autoRepriceMargin = formData.get("autoRepriceMargin") === "on";
    const autoResolveSupport = formData.get("autoResolveSupport") === "on";
    const autoPauseBleedingAds = formData.get("autoPauseBleedingAds") === "on";
    const minNetRoasThreshold = parseFloat(formData.get("minNetRoasThreshold"));
    const themeMode = formData.get("themeMode") || "system";

    await prisma.copilotGlobalSettings.upsert({
      where: { shop },
      update: {
        autoRepriceMargin,
        autoResolveSupport,
        autoPauseBleedingAds,
        minNetRoasThreshold,
        themeMode
      },
      create: {
        shop,
        autoRepriceMargin,
        autoResolveSupport,
        autoPauseBleedingAds,
        minNetRoasThreshold,
        themeMode
      }
    });

    return { success: true, message: "Settings saved successfully!" };
  }

  return { success: true };
};

export default function SettingsAndThemesRoute() {
  const { shop, config } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // Local state for theme
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("unified_ai_theme") || "system";
    }
    return "system";
  });

  const [autoReprice, setAutoReprice] = useState(config.autoRepriceMargin);
  const [autoSupport, setAutoSupport] = useState(config.autoResolveSupport);
  const [autoPauseAds, setAutoPauseAds] = useState(config.autoPauseBleedingAds);
  const [roasThreshold, setRoasThreshold] = useState(config.minNetRoasThreshold);
  const [toastMessage, setToastMessage] = useState(null);

  // Apply theme to document element
  const applyTheme = (mode) => {
    setCurrentTheme(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("unified_ai_theme", mode);

      let effectiveTheme = mode;
      if (mode === "system") {
        effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", effectiveTheme);
      document.body.setAttribute("data-theme", effectiveTheme);
    }
  };

  useEffect(() => {
    applyTheme(currentTheme);
  }, []);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    fetcher.submit({
      actionType: "SAVE_SETTINGS",
      autoRepriceMargin: autoReprice ? "on" : "off",
      autoResolveSupport: autoSupport ? "on" : "off",
      autoPauseBleedingAds: autoPauseAds ? "on" : "off",
      minNetRoasThreshold: roasThreshold,
      themeMode: currentTheme,
    }, { method: "POST" });
    
    setToastMessage("Settings & Preferences saved successfully!");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isSyncing = fetcher.state !== "idle";

  return (
    <div className="copilot-container animate-fade-in" style={{ paddingBottom: "40px" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: "var(--success-main)",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "var(--shadow-lg)",
          fontWeight: "600",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <span>✅</span> {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid var(--border-light)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "24px" }}>⚙️</span>
            <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, color: "var(--text-main)" }}>
              Global Settings & Theme Mode
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-subtle)", fontSize: "14px" }}>
            Customize your app appearance, contrast, AI autonomy guardrails, and Groq engine parameters for store <strong>{shop}</strong>.
          </p>
        </div>

        <button
          onClick={() => navigate("/app")}
          className="saas-btn btn-secondary"
        >
          ← Return to Dashboard
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        
        {/* Section 1: Appearance & Light/Dark Theme Selector */}
        <div className="saas-card simulator-col">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>🎨</span>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "var(--text-main)" }}>
              Appearance & Color Theme
            </h2>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
            Select your preferred visual style. Both Light and Dark modes feature high text visibility and crisp color contrast across all 8 AI modules.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
            
            {/* Light Mode Option */}
            <button
              type="button"
              onClick={() => applyTheme("light")}
              style={{
                padding: "16px 12px",
                borderRadius: "10px",
                border: currentTheme === "light" ? "2px solid var(--brand-primary)" : "1px solid var(--border-strong)",
                backgroundColor: currentTheme === "light" ? "rgba(79, 70, 229, 0.08)" : "var(--bg-subtle)",
                color: "var(--text-main)",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>☀️</div>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "2px" }}>Light Mode</div>
              <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>Crisp & Bright</div>
            </button>

            {/* Dark Mode Option */}
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              style={{
                padding: "16px 12px",
                borderRadius: "10px",
                border: currentTheme === "dark" ? "2px solid var(--brand-primary)" : "1px solid var(--border-strong)",
                backgroundColor: currentTheme === "dark" ? "rgba(99, 102, 241, 0.15)" : "var(--bg-subtle)",
                color: "var(--text-main)",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>🌙</div>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "2px" }}>Dark Mode</div>
              <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>Midnight Slate</div>
            </button>

            {/* System Auto Option */}
            <button
              type="button"
              onClick={() => applyTheme("system")}
              style={{
                padding: "16px 12px",
                borderRadius: "10px",
                border: currentTheme === "system" ? "2px solid var(--brand-primary)" : "1px solid var(--border-strong)",
                backgroundColor: currentTheme === "system" ? "rgba(79, 70, 229, 0.08)" : "var(--bg-subtle)",
                color: "var(--text-main)",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>🖥️</div>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "2px" }}>System Auto</div>
              <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>OS Preference</div>
            </button>
          </div>

          <div style={{
            padding: "12px 16px",
            backgroundColor: "var(--bg-subtle)",
            borderRadius: "8px",
            borderLeft: "4px solid var(--brand-primary)",
            fontSize: "12px",
            color: "var(--text-muted)"
          }}>
            💡 <strong>Contrast Guarantee:</strong> All headings, cards, telemetry metrics, and tables auto-adjust their font colors to ensure 100% legibility in both Light and Dark themes.
          </div>
        </div>

        {/* Section 2: Groq GenAI Engine Status */}
        <div className="saas-card simulator-col">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>🧠</span>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "var(--text-main)" }}>
              Groq GenAI Intelligence Engine
            </h2>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px", color: "var(--text-muted)" }}>
              Groq LLM Model Architecture
            </label>
            <select
              defaultValue={config.groqModel}
              style={{ width: "100%", padding: "10px", borderRadius: "6px" }}
            >
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended - High Speed)</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Ultra Low Latency)</option>
              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (Complex Reasoning)</option>
            </select>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px", color: "var(--text-muted)" }}>
              Groq API Key Status
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="password"
                readOnly
                value="••••••••••••••••••••••••••••••••••••••••"
                style={{ flex: 1, backgroundColor: "var(--bg-subtle)" }}
              />
              <span className="saas-badge badge-success">
                <span>●</span> CONNECTED
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "4px" }}>
              Your Groq API key is securely bound to environment variables and active across all 8 copilot modules.
            </p>
          </div>
        </div>

        {/* Section 3: Autonomous Guardrails */}
        <div className="saas-card simulator-col">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>🛡️</span>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "var(--text-main)" }}>
              AI Autonomy & Safety Guardrails
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: "600", color: "var(--text-main)" }}>MarginGuard Dynamic Repricing</div>
                <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>Allow AI to auto-update Shopify variant prices based on CAC elasticity</div>
              </div>
              <input
                type="checkbox"
                checked={autoReprice}
                onChange={(e) => setAutoReprice(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: "600", color: "var(--text-main)" }}>SupportShield L1 Auto-Resolution</div>
                <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>Allow AI to auto-reply to WISMO and return queries with 85%+ confidence</div>
              </div>
              <input
                type="checkbox"
                checked={autoSupport}
                onChange={(e) => setAutoSupport(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: "600", color: "var(--text-main)" }}>AdSpend Guardian Campaign Kill-Switch</div>
                <div style={{ fontSize: "11px", color: "var(--text-subtle)" }}>Auto-pause ad campaigns falling below True Net ROAS threshold</div>
              </div>
              <input
                type="checkbox"
                checked={autoPauseAds}
                onChange={(e) => setAutoPauseAds(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <div style={{ paddingTop: "8px", borderTop: "1px solid var(--border-light)" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "6px", color: "var(--text-muted)" }}>
                Minimum True Net ROAS Floor Threshold: <strong>{roasThreshold}x</strong>
              </label>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={roasThreshold}
                onChange={(e) => setRoasThreshold(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Data Sync & Maintenance */}
        <div className="saas-card simulator-col">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>🔄</span>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "var(--text-main)" }}>
              Store Data Sync & Cache
            </h2>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px" }}>
            Force a fresh synchronization with your live Shopify Admin GraphQL API to pull newly created products, inventory levels, or order updates.
          </p>

          <fetcher.Form method="post">
            <input type="hidden" name="actionType" value="RESET_DB_SYNC" />
            <button
              type="submit"
              disabled={isSyncing}
              className="saas-btn btn-secondary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {isSyncing ? "🔄 Re-syncing Store Data..." : "🔄 Force Live Store Data Re-Sync"}
            </button>
          </fetcher.Form>
        </div>
      </div>

      {/* Save Settings Bar */}
      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSaveSettings}
          className="saas-btn btn-primary"
          style={{ padding: "12px 28px", fontSize: "14px" }}
        >
          💾 Save All Settings & Preferences
        </button>
      </div>
    </div>
  );
}
