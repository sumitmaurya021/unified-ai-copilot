import { useState, useEffect } from "react";
import { Outlet, useLoaderData, useRouteError, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const navigate = useNavigate();

  const [themeMode, setThemeMode] = useState("system");

  useEffect(() => {
    const savedTheme = localStorage.getItem("unified_ai_theme") || "system";
    setThemeMode(savedTheme);

    let effectiveTheme = savedTheme;
    if (savedTheme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.body.setAttribute("data-theme", effectiveTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    localStorage.setItem("unified_ai_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.body.setAttribute("data-theme", nextTheme);
  };

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Executive Dashboard</s-link>
        <s-link href="/app/return-guard">ReturnGuard AI</s-link>
        <s-link href="/app/margin-guard">MarginGuard AI</s-link>
        <s-link href="/app/catalog-alchemy">CatalogAlchemy AI</s-link>
        <s-link href="/app/support-shield">SupportShield AI</s-link>
        <s-link href="/app/pulse-ai">PulseAI Trends</s-link>
        <s-link href="/app/global-reach">GlobalReach AI</s-link>
        <s-link href="/app/adspend-guardian">AdSpend Guardian AI</s-link>
        <s-link href="/app/inventory-oracle">InventoryOracle AI</s-link>
        <s-link href="/app/settings">Settings & Themes</s-link>
      </s-app-nav>

      {/* Sleek Global SaaS Header Bar */}
      <div style={{
        background: "var(--header-bg, linear-gradient(90deg, #0f172a 0%, #1e293b 100%))",
        color: "white",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--header-border, #334155)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>⚡</span>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "800", letterSpacing: "-0.01em" }}>
              UNIFIED AI COPILOT <span style={{ fontSize: "11px", fontWeight: "600", color: "#a5b4fc", backgroundColor: "#312e81", padding: "2px 8px", borderRadius: "12px", marginLeft: "6px" }}>SUITE v2.0</span>
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Autonomous E-Commerce Intelligence & Profit Sentinel</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#064e3b", color: "#6ee7b7", padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", border: "1px solid #047857" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", boxShadow: "0 0 8px #10b981" }} className="animate-pulse-glow"></span>
            ALL 8 AI AGENTS ONLINE & AUTONOMOUS
          </div>

          {/* Quick Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title="Toggle Light/Dark Theme"
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease"
            }}
          >
            {themeMode === "dark" ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>

          {/* Quick Settings Link */}
          <button
            onClick={() => navigate("/app/settings")}
            title="Open App Settings"
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease"
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
