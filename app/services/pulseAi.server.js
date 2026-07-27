/**
 * PulseAI Copilot Server Engine
 * Handles database seeding and trend campaign mutations.
 */
import { calculateViralFitScore, generateViralContent } from "./pulseAi";

export { calculateViralFitScore, generateViralContent };

/**
 * Seeds initial demo trend opportunities if the database is empty for the shop.
 */
export async function seedInitialTrendOpportunities(prisma, shop) {
  const count = await prisma.trendOpportunityProfile.count({ where: { shop } });
  if (count > 0) {
    return false;
  }

  const demoOpps = [
    {
      shop,
      trendId: "TRND-901",
      trendName: "#CozyCore Streetwear",
      platform: "TIKTOK",
      viralVelocityScore: 96,
      growthRatePercent: 420,
      mappedProductId: "gid://shopify/Product/2005",
      mappedProductTitle: "Heavyweight Organic Cotton Fleece Hoodie",
      statusOverride: "DISCOVERED",
    },
    {
      shop,
      trendId: "TRND-902",
      trendName: "#MarathonTraining Prep",
      platform: "INSTAGRAM",
      viralVelocityScore: 94,
      growthRatePercent: 280,
      mappedProductId: "gid://shopify/Product/2001",
      mappedProductTitle: "AeroMesh Lightweight Performance Running Sneaker",
      statusOverride: "SCRIPT_APPROVED",
    },
    {
      shop,
      trendId: "TRND-903",
      trendName: "#OldMoneyAesthetic",
      platform: "PINTEREST",
      viralVelocityScore: 91,
      growthRatePercent: 195,
      mappedProductId: "gid://shopify/Product/2002",
      mappedProductTitle: "Silk Velvet Evening Gown — Midnight Edition",
      statusOverride: "CAMPAIGN_LAUNCHED",
    },
    {
      shop,
      trendId: "TRND-904",
      trendName: "#TechBroDeskSetup",
      platform: "YOUTUBE_SHORTS",
      viralVelocityScore: 89,
      growthRatePercent: 310,
      mappedProductId: "gid://shopify/Product/2003",
      mappedProductTitle: "Titanium Magnetic Smart Watch Band",
      statusOverride: "DISCOVERED",
    },
    {
      shop,
      trendId: "TRND-905",
      trendName: "#GlassSkinGlowUp",
      platform: "TIKTOK",
      viralVelocityScore: 98,
      growthRatePercent: 550,
      mappedProductId: "gid://shopify/Product/2004",
      mappedProductTitle: "HydraGlow Advanced Vitamin C Radiance Serum",
      statusOverride: "SCRIPT_APPROVED",
    }
  ];

  for (const opp of demoOpps) {
    const generated = generateViralContent({
      trendName: opp.trendName,
      platform: opp.platform,
      mappedProductTitle: opp.mappedProductTitle,
    });

    await prisma.trendOpportunityProfile.create({
      data: {
        shop,
        trendId: opp.trendId,
        trendName: opp.trendName,
        platform: opp.platform,
        viralVelocityScore: opp.viralVelocityScore,
        growthRatePercent: opp.growthRatePercent,
        mappedProductId: opp.mappedProductId,
        mappedProductTitle: opp.mappedProductTitle,
        viralFitScore: generated.viralFitScore,
        generatedHookScript: generated.generatedHookScript,
        generatedAdCaption: generated.generatedAdCaption,
        campaignStatus: opp.statusOverride || "DISCOVERED",
      },
    });
  }

  await prisma.trendPolicyConfig.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      minViralFitScore: 75,
      autoGenerateScripts: true,
      targetAudienceTone: "Gen-Z High Energy & Authentic",
    },
  });

  return true;
}

/**
 * Autonomously launches or archives a viral trend campaign.
 */
export async function executeTrendAction(prisma, oppId, actionType = "LAUNCH") {
  let newStatus = "CAMPAIGN_LAUNCHED";
  if (actionType === "APPROVE") newStatus = "SCRIPT_APPROVED";
  if (actionType === "ARCHIVE") newStatus = "ARCHIVED";

  const updated = await prisma.trendOpportunityProfile.update({
    where: { id: oppId },
    data: { campaignStatus: newStatus },
  });

  return updated;
}
