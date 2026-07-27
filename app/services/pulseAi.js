/**
 * PulseAI Copilot Shared Logic
 * Handles viral trend fit calculation and autonomous short-form
 * video script hooks & FYP ad caption generation.
 */

/**
 * Calculates how well a store SKU matches an exploding social trend (0-100 score).
 */
export function calculateViralFitScore({
  trendName = "",
  productTitle = "",
  productCategory = "",
}) {
  const t = trendName.toLowerCase();
  const p = productTitle.toLowerCase();

  if ((t.includes("cozy") || t.includes("streetwear") || t.includes("winter") || t.includes("fleece")) && (p.includes("hoodie") || p.includes("sweater") || p.includes("cotton"))) {
    return 96;
  }
  if ((t.includes("marathon") || t.includes("running") || t.includes("gym") || t.includes("fitness")) && (p.includes("sneaker") || p.includes("shoe") || p.includes("aeromesh"))) {
    return 95;
  }
  if ((t.includes("oldmoney") || t.includes("luxury") || t.includes("quiet") || t.includes("silk") || t.includes("evening")) && (p.includes("gown") || p.includes("dress") || p.includes("velvet"))) {
    return 92;
  }
  if ((t.includes("tech") || t.includes("gadget") || t.includes("desk") || t.includes("setup") || t.includes("magnetic")) && (p.includes("watch") || p.includes("band") || p.includes("strap"))) {
    return 94;
  }
  if ((t.includes("glassskin") || t.includes("skincare") || t.includes("serum") || t.includes("glow")) && (p.includes("serum") || p.includes("vitamin") || p.includes("radiance"))) {
    return 98;
  }

  // General heuristic calculation
  return Math.min(90, Math.max(75, 78 + (p.length % 12)));
}

/**
 * Autonomously drafts viral creative assets for short-form social video platforms.
 */
export function generateViralContent({
  trendName = "#CozyCore Streetwear",
  platform = "TIKTOK",
  mappedProductTitle = "Heavyweight Organic Cotton Fleece Hoodie",
  targetTone = "Gen-Z High Energy & Authentic",
}) {
  const fitScore = calculateViralFitScore({
    trendName,
    productTitle: mappedProductTitle,
  });

  const hookScript = `[🎬 Visual Direction: Fast-paced 0.5s cut zooming in on premium texture/details of the ${mappedProductTitle}]\n[🔊 Trending Audio: Viral 'Wait, is this real life?' synth drop]\n[🗣️ Spoken Hook (0:00-0:03)]: "Stop scrolling! If your FYP is currently obsessed with ${trendName}, this ${mappedProductTitle} is literally the holy grail piece you've been searching for..."`;

  const adCaption = `The secret is finally out 👀 Everyone is upgrading to the ${mappedProductTitle} to master the ${trendName} aesthetic! ✨ Tap the shop link before our warehouse sells out again! 👇 #FYP #Viral #Shopify #${trendName.replace(/#/g, "")} #MustHave #Trending`;

  const bundleStrategy = `📦 Viral Surge Bundle Strategy: Launch the '${trendName} Starter Pack' — offer an instant 15% discount when customers buy this item together with a complementary accessory to maximize Average Order Value (AOV) during this viral wave!`;

  return {
    viralFitScore: fitScore,
    generatedHookScript: hookScript,
    generatedAdCaption: adCaption,
    bundleStrategy,
    platform,
    targetTone,
  };
}
