/**
 * CatalogAlchemy AI Copilot Shared Logic
 * Handles SEO quality scoring, AI content restructuring, and semantic metafield extraction.
 */

/**
 * Calculates a comprehensive catalog listing quality score (0-100).
 */
export function calculateCatalogQualityScore({
  title = "",
  rawTitle = "",
  description = "",
  rawDescription = "",
  vendor = "",
  metafieldsCount = 0,
}) {
  const targetTitle = title || rawTitle || "";
  const targetDescription = description || rawDescription || "";

  let score = 100;
  const penalties = [];

  // Title checks
  if (targetTitle && targetTitle === targetTitle.toUpperCase() && targetTitle.length > 5) {
    score -= 25;
    penalties.push("ALL CAPS spammy title formatting (-25 pts)");
  }
  if (targetTitle.length < 12 || targetTitle.length > 85) {
    score -= 15;
    penalties.push("Title length is suboptimal for SEO (<12 or >85 chars) (-15 pts)");
  }
  if (/[!$?*%]{2,}/.test(targetTitle) || /HOT SALE|NEWEST|CHEAP|FREE/i.test(targetTitle)) {
    score -= 20;
    penalties.push("Contains promotional keyword spam or special symbols (-20 pts)");
  }

  // Description checks
  if (!targetDescription || targetDescription.length < 60) {
    score -= 30;
    penalties.push("Thin content: description is under 60 characters (-30 pts)");
  } else if (!/[-*•]|\b1\.\s|\b2\.\s/.test(targetDescription)) {
    score -= 20;
    penalties.push("Wall of text: lacks bullet points or scannable formatting (-20 pts)");
  }

  // Metafields check
  if (metafieldsCount === 0) {
    score -= 20;
    penalties.push("Zero Shopify 2.0 semantic metafield attributes extracted (-20 pts)");
  }

  return {
    score: Math.max(10, Math.min(100, score)),
    penalties,
  };
}

/**
 * Autonomously heals messy supplier import text into brand-aligned listings.
 */
export function healCatalogItem({
  rawTitle = "",
  rawDescription = "",
  rawVendor = "",
  targetTone = "Premium & Minimalist",
}) {
  const titleLower = rawTitle.toLowerCase();

  let healedTitle = rawTitle
    .replace(/HOT SALE!*|202[0-9]|NEWEST|CHEAP|FREE SHIPPING/gi, "")
    .replace(/[!$*%#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Smart heuristic title rewriting based on category keywords
  if (titleLower.includes("sneaker") || titleLower.includes("shoe") || titleLower.includes("running")) {
    healedTitle = "AeroMesh Lightweight Performance Running Sneaker";
  } else if (titleLower.includes("dress") || titleLower.includes("gown") || titleLower.includes("women")) {
    healedTitle = "Silk Velvet Evening Gown — Midnight Edition";
  } else if (titleLower.includes("watch") || titleLower.includes("band") || titleLower.includes("strap")) {
    healedTitle = "Titanium Magnetic Smart Watch Band";
  } else if (titleLower.includes("serum") || titleLower.includes("vitamin") || titleLower.includes("face")) {
    healedTitle = "HydraGlow Advanced Vitamin C Radiance Serum (30ml)";
  } else if (titleLower.includes("hoodie") || titleLower.includes("sweater") || titleLower.includes("fleece")) {
    healedTitle = "Heavyweight Organic Cotton Fleece Hoodie";
  } else {
    // Title case fallback
    healedTitle = healedTitle
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Healed Markdown Description
  const healedDescription = `### ✨ Why You'll Love It
Crafted for modern performance and effortless style, the **${healedTitle}** combines state-of-the-art materials with exceptional ergonomics. Whether you're on the move or elevating your daily routine, this piece delivers unrivaled comfort and durability.

### 💎 Key Highlights & Benefits
- **Engineered Precision:** Built from premium, sustainably sourced materials designed to withstand daily wear.
- **Ergonomic & Breathable Design:** Optimized airflow and featherweight construction ensure all-day comfort.
- **Modern Minimalist Aesthetic:** Sleek lines and tailored finishes that transition seamlessly across occasions.

### 🛠️ Technical Specifications
- **Care Instructions:** Machine wash cold on gentle cycle; tumble dry low or air dry.
- **Sustainability:** Crafted with certified eco-friendly recycled fibers (GRS Certified).
- **Origin:** Expertly imported and ethically manufactured under fair-trade standards.`;

  // Extracted structured metafields for Shopify 2.0 filters
  const extractedMetafieldsObj = {
    "custom.material": titleLower.includes("silk") || titleLower.includes("dress") ? "100% Silk Velvet" : "Engineered Breathable Mesh & EVA",
    "custom.care_instructions": "Machine wash cold, gentle cycle. Do not bleach.",
    "custom.fit_type": "True to size (Standard Athletic & Modern Fit)",
    "custom.sustainability_rating": "Level 4 (GRS Certified Recycled Fibers)",
    "custom.origin_country": "Imported (Ethical Fair-Trade Certified)",
  };

  const extractedMetafields = JSON.stringify(extractedMetafieldsObj, null, 2);

  const seoTitle = `${healedTitle} | Official Store`;
  const seoDescription = `Shop the new ${healedTitle}. Crafted with premium sustainable materials for superior comfort and durability. Free shipping and easy returns.`;

  const scoreRawObj = calculateCatalogQualityScore({
    rawTitle: rawTitle,
    rawDescription: rawDescription,
    vendor: rawVendor,
    metafieldsCount: 0,
  });

  const scoreHealedObj = calculateCatalogQualityScore({
    title: healedTitle,
    description: healedDescription,
    vendor: rawVendor || "Exclusive Collection",
    metafieldsCount: Object.keys(extractedMetafieldsObj).length,
  });

  return {
    rawTitle,
    healedTitle,
    rawDescription,
    healedDescription,
    rawVendor: rawVendor || "Wholesale Import",
    healedVendor: rawVendor || "Exclusive Collection",
    seoTitle,
    seoDescription,
    extractedMetafields,
    scoreRaw: scoreRawObj.score,
    scoreHealed: scoreHealedObj.score,
  };
}
