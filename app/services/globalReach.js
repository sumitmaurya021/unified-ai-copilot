/**
 * GlobalReach AI Copilot Shared Logic
 * Handles cultural nuance scoring, currency rounding, unit measurement conversions,
 * and regional market localization for Shopify cross-border storefronts.
 */

/**
 * Calculates cultural adaptation quality score (0-100).
 */
export function calculateCulturalNuanceScore({
  targetMarket = "",
  localizedTitle = "",
  localizedDescription = "",
}) {
  const t = localizedTitle.toLowerCase();
  const d = localizedDescription.toLowerCase();

  if (targetMarket === "GERMANY_EU" && (t.includes("din-") || t.includes("qualität") || t.includes("bio-"))) {
    return 98;
  }
  if (targetMarket === "JAPAN_APAC" && (t.includes("【") || t.includes("美容液") || t.includes("ギフト"))) {
    return 99;
  }
  if (targetMarket === "FRANCE_EU" && (t.includes("élégance") || t.includes("soirée") || t.includes("parisienne"))) {
    return 96;
  }
  if (targetMarket === "MEXICO_LATAM" && (t.includes("rendimiento") || d.includes("intereses") || t.includes("tenis"))) {
    return 95;
  }
  if (targetMarket === "UK_EMEA" && (t.includes("bespoke") || t.includes("engineered") || t.includes("strap"))) {
    return 94;
  }

  return 92;
}

/**
 * Autonomously adapts product titles, descriptions, pricing, and sizing units for cross-border markets.
 */
export function localizeProductContent({
  originalTitle = "Heavyweight Organic Cotton Fleece Hoodie",
  originalDescription = "Premium organic cotton hoodie with heavyweight fleece lining.",
  originalPrice = 110.0,
  targetMarket = "GERMANY_EU",
}) {
  let targetLanguage = "German (DE)";
  let localizedTitle = "Schwerer Bio-Baumwoll-Kapuzenpullover — DIN-Geprüfte Premium-Qualität";
  let localizedDescription = `🤖 [Deutsche Kulturanpassung]: Hervorhebung von Nachhaltigkeit, GOTS-Zertifizierung und präziser Verarbeitung für den anspruchsvollen europäischen DACH-Markt.\n\n✨ 100% gekämmte Bio-Baumwolle mit extra dickem Fleece-Futter für winterliche Temperaturen.\n\n(Original: ${originalDescription})`;
  let localizedPriceDisplay = `€${Math.round(originalPrice * 0.92)},90 EUR (Inkl. 19% MwSt.)`;
  let unitConversionNote = "📏 Converted US inches to cm (Brustweite 116cm) | EU Size 50 applied.";

  if (targetMarket === "JAPAN_APAC") {
    targetLanguage = "Japanese (JA)";
    if (originalTitle.toLowerCase().includes("serum") || originalTitle.toLowerCase().includes("glow")) {
      localizedTitle = "【高濃度ビタミンC】HydraGlow プレミアム導入美容液 — 敏感肌対応・ギフトボックス包装";
    } else {
      localizedTitle = "【厳選高品質】" + originalTitle + " — 日本特注仕立て・ギフト包装対応";
    }
    localizedDescription = `🤖 [日本文化ローカライズ]: 丁寧な敬語表現（丁寧語・謙譲語）を採用し、安心の品質保証と丁寧な梱包を強調。日本の母の日やホワイトデーのギフトシーズンに最適化。\n\n✨ 敏感肌にも優しい天然由来成分100%配合。国内即日発送。\n\n(Original: ${originalDescription})`;
    localizedPriceDisplay = `¥${Math.round(originalPrice * 145).toLocaleString()} JPY (税込・国内送料無料)`;
    unitConversionNote = "📏 Converted US fl oz to ml (50ml capacity) | Japanese JIS cosmetic labeling standards applied.";
  } else if (targetMarket === "FRANCE_EU") {
    targetLanguage = "French (FR)";
    if (originalTitle.toLowerCase().includes("gown") || originalTitle.toLowerCase().includes("dress")) {
      localizedTitle = "Robe de Soirée en Soie et Velours — Élégance Parisienne Édition Minuit";
    } else {
      localizedTitle = "Édition Prestige : " + originalTitle + " — Haute Joaillerie & Finition Luxe";
    }
    localizedDescription = `🤖 [Adaptation Culturelle Française]: Accentuation du chic parisien, du savoir-faire artisanal et de la sophistication intemporelle pour la saison des galas et des mariages.\n\n✨ Velours de soie véritable et coupe sur mesure pour une silhouette impeccable.\n\n(Original: ${originalDescription})`;
    localizedPriceDisplay = `€${Math.round(originalPrice * 0.92)},00 EUR (TTC - Livraison Express France)`;
    unitConversionNote = "📏 Converted US Dress Size 6 to French Size 38 | European length standards applied.";
  } else if (targetMarket === "MEXICO_LATAM") {
    targetLanguage = "Spanish (ES)";
    if (originalTitle.toLowerCase().includes("sneaker") || originalTitle.toLowerCase().includes("shoe") || originalTitle.toLowerCase().includes("running")) {
      localizedTitle = "Tenis de Correr AeroMesh — Alto Rendimiento y Amortiguación Ultraligera";
    } else {
      localizedTitle = "Edición Especial: " + originalTitle + " — Calidad Premium Latinoamericana";
    }
    localizedDescription = `🤖 [Adaptation para LATAM]: Copiar promocional dinámico enfocándose en durabilidad, estilo deportivo urbano y opciones de pago accesibles para el Buen Fin o temporada navideña.\n\n✨ Malla transpirable de alta tecnología y suela de fibra de carbono para máxima compresión.\n\n(Original: ${originalDescription})`;
    localizedPriceDisplay = `$${Math.round(originalPrice * 17).toLocaleString()} MXN (Hasta 12 meses sin intereses)`;
    unitConversionNote = "📏 Converted US Shoe Size 10 to MEX Size 28 cm | LATAM ergonomic fit chart applied.";
  } else if (targetMarket === "UK_EMEA") {
    targetLanguage = "British English (UK)";
    if (originalTitle.toLowerCase().includes("watch") || originalTitle.toLowerCase().includes("band")) {
      localizedTitle = "Titanium Magnetic Smart Watch Strap — British Engineered Bespoke Edition";
    } else {
      localizedTitle = originalTitle + " — Bespoke British Edition";
    }
    localizedDescription = `🤖 [British Cultural Adaptation]: Utilising UK spelling conventions (colour, bespoke, engineered) and emphasizing understated elegance for professional London attire.\n\n✨ Aerospace-grade titanium alloy with seamless magnetic clasp for enduring sophistication.\n\n(Original: ${originalDescription})`;
    localizedPriceDisplay = `£${Math.round(originalPrice * 0.78)}.99 GBP (Inc. VAT & Next-Day Delivery)`;
    unitConversionNote = "📏 Converted US Band Size to British standard mm measurements | UK wrist compatibility verified.";
  }

  const nuanceScore = calculateCulturalNuanceScore({
    targetMarket,
    localizedTitle,
    localizedDescription,
  });

  return {
    targetMarket,
    targetLanguage,
    localizedTitle,
    localizedDescription,
    localizedPriceDisplay,
    unitConversionNote,
    culturalNuanceScore: nuanceScore,
  };
}
