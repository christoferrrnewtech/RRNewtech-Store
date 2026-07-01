/**
 * Product catalog — data model + seed data + query helpers.
 *
 * PHASE 1: the catalog lives in code so the store renders with no database or credentials.
 * PHASE 4 (admin): swap `PRODUCTS` for Firestore/DB reads behind these same helper functions
 * (getAllProducts, getProductBySlug, …) so pages don't change. Keep the Product shape stable.
 */

export type CategorySlug =
  | "anesthetics"
  | "occlusion-tmj"
  | "burs-diamonds"
  | "cosmetic-restorative"
  | "curing-lights"
  | "handpieces"
  | "photography"
  | "digital-dentistry"
  | "imaging-xray"
  | "disposables-ppe"
  | "endodontics"
  | "equipment"
  | "finishing-polishing"
  | "hand-instruments"
  | "infection-control"
  | "laboratory"
  | "laser-dentistry"
  | "loupes-magnification"
  | "oral-hygiene"
  | "preventive"
  | "orthodontics"
  | "pediatric"
  | "periodontics"
  | "prosthodontics"
  | "surgical-implant"
  | "uniforms-scrubs";

export type Category = {
  slug: CategorySlug;
  name: string;
  blurb: string;
  /** Optional icon path (under /public) for the category circle. Falls back to initials. */
  icon?: string;
};

// The store's real dental taxonomy. Order defines how the category circles are displayed.
export const CATEGORIES: Category[] = [
  { slug: "anesthetics", name: "Anesthetics", blurb: "Local anesthetics, needles & topical gels." },
  { slug: "occlusion-tmj", name: "Bite Analysis / Occlusion / TMJ", blurb: "Articulating papers, bite registration & TMJ aids." },
  { slug: "burs-diamonds", name: "Burs & Diamonds", blurb: "Diamond & carbide burs for cutting and finishing." },
  { slug: "cosmetic-restorative", name: "Cosmetic & Restorative Dentistry", blurb: "Composites, bonding agents, cements & liners." },
  { slug: "curing-lights", name: "Curing Lights", blurb: "LED curing lights, guides & radiometers." },
  { slug: "handpieces", name: "Dental Handpieces", blurb: "High- & low-speed handpieces and attachments." },
  { slug: "photography", name: "Dental Photography", blurb: "Cameras, contrastors & intraoral mirrors." },
  { slug: "digital-dentistry", name: "Digital Dentistry", blurb: "Intraoral scanners, CAD/CAM & milling supplies." },
  { slug: "imaging-xray", name: "Digital Imaging & X-Ray", blurb: "Sensors, phosphor plates & X-ray accessories." },
  { slug: "disposables-ppe", name: "Disposables / PPE", blurb: "Gloves, masks, gowns, ejectors & barriers." },
  { slug: "endodontics", name: "Endodontics", blurb: "Files, sealers, obturation & irrigation." },
  { slug: "equipment", name: "Equipment – Chairs, Compressor, HV Suction", blurb: "Dental chairs, compressors & suction systems." },
  { slug: "finishing-polishing", name: "Finishing & Polishing", blurb: "Discs, strips, cups & polishing pastes." },
  { slug: "hand-instruments", name: "Hand Instruments", blurb: "Mirrors, explorers, scalers & forceps." },
  { slug: "infection-control", name: "Infection Control & Disinfection", blurb: "Sterilization, disinfectants & surface care." },
  { slug: "laboratory", name: "Laboratory Materials", blurb: "Impression materials, gypsum, waxes & acrylics." },
  { slug: "laser-dentistry", name: "Laser Dentistry", blurb: "Soft- & hard-tissue lasers and tips." },
  { slug: "loupes-magnification", name: "Loupes & Magnification", blurb: "Loupes, headlights & magnification." },
  { slug: "oral-hygiene", name: "Oral Hygiene Products", blurb: "Brushes, floss, rinses & interdental care." },
  { slug: "preventive", name: "Oral Prophylaxis & Preventive Dentistry", blurb: "Prophy paste, sealants & fluoride." },
  { slug: "orthodontics", name: "Orthodontics", blurb: "Brackets, wires, elastics & ortho accessories." },
  { slug: "pediatric", name: "Pediatric Dentistry", blurb: "Kid-friendly restoratives, crowns & tools." },
  { slug: "periodontics", name: "Periodontics", blurb: "Scalers, curettes & ultrasonic scaling." },
  { slug: "prosthodontics", name: "Prosthodontics", blurb: "Crown & bridge, denture & impression supplies." },
  { slug: "surgical-implant", name: "Surgical & Implant Dentistry", blurb: "Implants, surgical kits & sutures." },
  { slug: "uniforms-scrubs", name: "Uniforms & Scrubs Suits", blurb: "Scrubs, gowns & clinic apparel." },
];

export const CATEGORY_MAP: Record<CategorySlug, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
) as Record<CategorySlug, Category>;

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  /** Price in PHP (whole pesos). */
  price: number;
  /** Optional original price for a sale (must be > price). */
  compareAtPrice?: number;
  /** Short one-line summary for cards + meta descriptions. */
  summary: string;
  /** Full description paragraphs for the product page. */
  description: string[];
  /** Bullet spec/feature highlights. */
  highlights: string[];
  unit: string;
  sku: string;
  inStock: boolean;
  /** Marks a product for the "Featured" home rail. */
  featured?: boolean;
  /** Deterministic seed for the placeholder image (picsum). Replace with real images later. */
  imageSeed: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Seed catalog — representative products across every category.
// ─────────────────────────────────────────────────────────────────────────────
export const PRODUCTS: Product[] = [
  {
    slug: "nano-hybrid-composite-a2",
    name: "Nano-Hybrid Composite Resin — Shade A2",
    brand: "Herculite",
    category: "cosmetic-restorative",
    price: 1450,
    compareAtPrice: 1750,
    summary: "Light-cure universal composite with excellent polishability and low shrinkage.",
    description: [
      "A premium nano-hybrid restorative composite engineered for both anterior and posterior restorations. Its balanced filler system delivers high strength with a natural, life-like polish.",
      "Low polymerization shrinkage reduces post-operative sensitivity and marginal gaps, while the smooth handling stays where you place it without slumping.",
    ],
    highlights: [
      "Universal shade A2 (VITA)",
      "Low shrinkage (~1.9%)",
      "Radiopaque for easy diagnostics",
      "4g syringe",
    ],
    unit: "4g syringe",
    sku: "CON-NHC-A2",
    inStock: true,
    featured: true,
    imageSeed: "composite-a2",
  },
  {
    slug: "self-etch-bonding-agent-5ml",
    name: "7th-Generation Self-Etch Bonding Agent",
    brand: "Kerr",
    category: "cosmetic-restorative",
    price: 2150,
    summary: "One-bottle, no-mix adhesive for fast, reliable bonding to enamel and dentin.",
    description: [
      "A single-component self-etch adhesive that simplifies bonding into one step — etch, prime, and bond in a single application with minimal technique sensitivity.",
      "Delivers strong, durable bond strengths to both enamel and dentin with reduced post-op sensitivity.",
    ],
    highlights: ["No mixing required", "High bond strength", "Reduced sensitivity", "5ml bottle"],
    unit: "5ml bottle",
    sku: "CON-SEB-5",
    inStock: true,
    imageSeed: "bonding-agent",
  },
  {
    slug: "alginate-impression-material-fast-set",
    name: "Chromatic Alginate Impression Material — Fast Set",
    brand: "Kerr",
    category: "laboratory",
    price: 620,
    summary: "Dust-reduced, color-changing alginate for accurate, easy impressions.",
    description: [
      "A fast-setting chromatic alginate that changes color through each stage — mixing, loading, and setting — so timing is never a guess.",
      "Dust-reduced formula for a cleaner operatory and fine detail reproduction for accurate models.",
    ],
    highlights: ["Color-change indicator", "Fast set (~1:15)", "Dust-reduced", "454g pouch"],
    unit: "454g pouch",
    sku: "CON-ALG-FS",
    inStock: true,
    imageSeed: "alginate",
  },
  {
    slug: "disposable-saliva-ejectors-100",
    name: "Disposable Saliva Ejectors (Box of 100)",
    brand: "Curaprox",
    category: "disposables-ppe",
    price: 285,
    summary: "Flexible, latex-free saliva ejectors with a removable tip.",
    description: [
      "Everyday chairside disposables with a smooth, kink-resistant body and a comfortable removable tip.",
      "Latex-free and available in assorted colors. Sold by the box of 100.",
    ],
    highlights: ["Latex-free", "Kink-resistant", "Assorted colors", "Box of 100"],
    unit: "box of 100",
    sku: "CON-SE-100",
    inStock: true,
    imageSeed: "saliva-ejector",
  },
  {
    slug: "dental-mirror-set-6",
    name: "Front-Surface Mouth Mirror Set (6 pcs)",
    brand: "Rundeer",
    category: "hand-instruments",
    price: 980,
    summary: "Distortion-free front-surface mirrors, autoclavable stainless steel.",
    description: [
      "A set of six size-4 front-surface mirrors that deliver crisp, distortion-free reflection for accurate intraoral viewing.",
      "Made from surgical-grade stainless steel — rust-resistant and fully autoclavable.",
    ],
    highlights: ["Front-surface (no ghosting)", "Size 4", "Surgical stainless steel", "Set of 6"],
    unit: "set of 6",
    sku: "INS-MIR-6",
    inStock: true,
    featured: true,
    imageSeed: "mouth-mirror",
  },
  {
    slug: "sickle-scaler-h6-h7",
    name: "Sickle Scaler H6/H7 — Double-Ended",
    brand: "Rundeer",
    category: "hand-instruments",
    price: 540,
    summary: "Precision-tipped double-ended scaler for supragingival calculus removal.",
    description: [
      "A double-ended H6/H7 sickle scaler with sharp, precisely angled tips for efficient supragingival calculus removal.",
      "Ergonomic hollow handle reduces hand fatigue; surgical stainless steel, autoclavable.",
    ],
    highlights: ["Double-ended H6/H7", "Ergonomic hollow handle", "Autoclavable", "Single instrument"],
    unit: "each",
    sku: "INS-SCL-H67",
    inStock: true,
    imageSeed: "scaler",
  },
  {
    slug: "extraction-forceps-upper-molar",
    name: "Extraction Forceps — Upper Molar #18L",
    brand: "Kavoo",
    category: "surgical-implant",
    price: 1290,
    summary: "Anatomically shaped forceps for atraumatic upper molar extractions.",
    description: [
      "Precision-forged #18L forceps with anatomically contoured beaks for a secure grip on upper-left molars.",
      "Balanced weight and serrated handles for control during extraction. Surgical stainless steel.",
    ],
    highlights: ["Upper-left molar #18L", "Serrated grip handles", "Precision-forged", "Autoclavable"],
    unit: "each",
    sku: "INS-FOR-18L",
    inStock: false,
    imageSeed: "forceps",
  },
  {
    slug: "led-curing-light-cordless",
    name: "Cordless LED Curing Light — 1200mW/cm²",
    brand: "Kerr",
    category: "curing-lights",
    price: 8900,
    compareAtPrice: 10500,
    summary: "High-output cordless curing light with wide wavelength range and light meter.",
    description: [
      "A lightweight cordless LED curing light delivering a consistent 1200mW/cm² across a 385–515nm range — compatible with virtually all light-cured materials.",
      "Multiple curing modes, a built-in light meter, and a 360° rotating head for easy intraoral access. Includes charging base and light guide.",
    ],
    highlights: ["1200mW/cm² output", "385–515nm broad spectrum", "3 curing modes", "Built-in light meter"],
    unit: "each",
    sku: "EQP-CL-1200",
    inStock: true,
    featured: true,
    imageSeed: "curing-light",
  },
  {
    slug: "ultrasonic-scaler-unit",
    name: "Piezo Ultrasonic Scaler Unit with 5 Tips",
    brand: "SOL Laser",
    category: "periodontics",
    price: 14500,
    summary: "Piezoelectric scaler with auto water supply and five interchangeable tips.",
    description: [
      "A powerful piezoelectric ultrasonic scaler for efficient calculus and stain removal, with adjustable power and automatic water irrigation.",
      "Includes five autoclavable tips covering scaling, perio, and endo applications. Detachable, sterilizable handpiece.",
    ],
    highlights: ["Piezoelectric technology", "Adjustable power + water", "5 autoclavable tips", "Detachable handpiece"],
    unit: "each",
    sku: "EQP-USS-5T",
    inStock: true,
    imageSeed: "ultrasonic-scaler",
  },
  {
    slug: "high-speed-handpiece-push-button",
    name: "High-Speed Handpiece — Push-Button, Triple Spray",
    brand: "Kavoo",
    category: "handpieces",
    price: 6750,
    summary: "Quiet, high-torque turbine with push-button bur release and triple water spray.",
    description: [
      "A smooth, high-torque high-speed handpiece with a ceramic-bearing turbine for quiet operation and long service life.",
      "Push-button bur release and triple-port water spray for effective cooling. Standard 4-hole connection.",
    ],
    highlights: ["Ceramic bearings", "Push-button chuck", "Triple water spray", "4-hole connection"],
    unit: "each",
    sku: "EQP-HP-PB",
    inStock: true,
    imageSeed: "handpiece",
  },
  {
    slug: "nitrile-exam-gloves-medium-100",
    name: "Nitrile Examination Gloves — Medium (Box of 100)",
    brand: "Curaprox",
    category: "disposables-ppe",
    price: 495,
    summary: "Powder-free, latex-free nitrile gloves with textured fingertips.",
    description: [
      "Durable powder-free nitrile examination gloves with textured fingertips for a secure grip, wet or dry.",
      "Latex-free to avoid allergic reactions. Ambidextrous. Sold by the box of 100 (size Medium).",
    ],
    highlights: ["Powder-free & latex-free", "Textured fingertips", "Size Medium", "Box of 100"],
    unit: "box of 100",
    sku: "IC-NG-M100",
    inStock: true,
    featured: true,
    imageSeed: "nitrile-gloves",
  },
  {
    slug: "surgical-face-masks-3ply-50",
    name: "3-Ply Surgical Face Masks (Box of 50)",
    brand: "Curaprox",
    category: "disposables-ppe",
    price: 165,
    summary: "Breathable 3-ply masks with adjustable nose bar and soft ear loops.",
    description: [
      "Comfortable 3-ply surgical masks with a high bacterial filtration efficiency, adjustable nose bar, and soft elastic ear loops.",
      "Breathable inner layer for all-day chairside comfort. Box of 50.",
    ],
    highlights: ["3-ply BFE ≥ 95%", "Adjustable nose bar", "Soft ear loops", "Box of 50"],
    unit: "box of 50",
    sku: "IC-FM-50",
    inStock: true,
    imageSeed: "face-mask",
  },
  {
    slug: "surface-disinfectant-spray-1l",
    name: "Surface Disinfectant Spray — 1L",
    brand: "Curaprox",
    category: "infection-control",
    price: 380,
    summary: "Fast-acting, alcohol-based surface disinfectant for clinical areas.",
    description: [
      "A ready-to-use alcohol-based disinfectant effective against a broad spectrum of bacteria and viruses, with a short contact time.",
      "Leaves no sticky residue and is safe on most clinical surfaces. 1-liter spray bottle.",
    ],
    highlights: ["Broad-spectrum", "Fast contact time", "Residue-free", "1L spray"],
    unit: "1L bottle",
    sku: "IC-SD-1L",
    inStock: true,
    imageSeed: "disinfectant",
  },
  {
    slug: "sterilization-pouches-self-seal-200",
    name: "Self-Seal Sterilization Pouches (Box of 200)",
    brand: "Kavoo",
    category: "infection-control",
    price: 340,
    summary: "Self-sealing autoclave pouches with internal & external indicators.",
    description: [
      "Self-sealing pouches with dual sterilization indicators that change color to confirm exposure, so you can trust every cycle.",
      "Medical-grade paper and clear film for easy identification. 90×230mm, box of 200.",
    ],
    highlights: ["Self-seal (no tape)", "Internal + external indicators", "90×230mm", "Box of 200"],
    unit: "box of 200",
    sku: "IC-SP-200",
    inStock: true,
    imageSeed: "sterilization-pouch",
  },
  {
    slug: "orthodontic-brackets-mbt-022",
    name: "Metal Orthodontic Brackets — MBT .022 (Full Case)",
    brand: "Lasotronix",
    category: "orthodontics",
    price: 1980,
    summary: "Precision-milled MBT prescription brackets, full-mouth set of 20.",
    description: [
      "A full-case set of 20 mini metal brackets in the MBT .022 prescription, laser-marked for quadrant identification.",
      "Precision-milled base with 80-gauge mesh for reliable bond retention and patient comfort.",
    ],
    highlights: ["MBT .022 prescription", "80-gauge mesh base", "Laser quadrant marks", "Full case of 20"],
    unit: "case of 20",
    sku: "ORT-BR-022",
    inStock: true,
    imageSeed: "brackets",
  },
  {
    slug: "niti-archwire-round-014",
    name: "Superelastic NiTi Archwire — Round .014 (Pack of 10)",
    brand: "SOL Laser",
    category: "orthodontics",
    price: 850,
    summary: "Superelastic nickel-titanium archwires for gentle initial alignment.",
    description: [
      "Superelastic NiTi archwires that deliver light, continuous forces ideal for the initial leveling and aligning stage.",
      "Preformed natural arch shape. Round .014, ovoid form. Pack of 10.",
    ],
    highlights: ["Superelastic NiTi", "Round .014", "Preformed ovoid arch", "Pack of 10"],
    unit: "pack of 10",
    sku: "ORT-AW-014",
    inStock: true,
    imageSeed: "archwire",
  },
  {
    slug: "elastic-ligature-ties-power-chain",
    name: "Elastomeric Power Chain — Continuous (Clear)",
    brand: "Lasotronix",
    category: "orthodontics",
    price: 240,
    summary: "Stain-resistant continuous power chain for space closure.",
    description: [
      "A continuous elastomeric power chain that delivers steady force for space closure and rotation control.",
      "Stain-resistant clear material keeps appliances discreet. 15-inch spool.",
    ],
    highlights: ["Continuous links", "Stain-resistant clear", "Consistent force", "15-inch spool"],
    unit: "spool",
    sku: "ORT-PC-CLR",
    inStock: true,
    imageSeed: "power-chain",
  },
  {
    slug: "orthodontic-toothbrush-v-cut",
    name: "V-Cut Orthodontic Toothbrush (Pack of 3)",
    brand: "Curaprox",
    category: "oral-hygiene",
    price: 210,
    summary: "V-shaped bristle brush designed to clean around brackets and wires.",
    description: [
      "A specialized orthodontic toothbrush with a V-shaped bristle cut that cleans effectively around brackets, wires, and gumlines.",
      "Soft, rounded bristles are gentle on enamel and appliances. Pack of 3.",
    ],
    highlights: ["V-cut bristle design", "Soft rounded bristles", "Slim ortho head", "Pack of 3"],
    unit: "pack of 3",
    sku: "OC-OTB-3",
    inStock: true,
    imageSeed: "ortho-brush",
  },
  {
    slug: "waxed-dental-floss-50m",
    name: "Waxed Mint Dental Floss — 50m (Pack of 4)",
    brand: "Curaprox",
    category: "oral-hygiene",
    price: 180,
    summary: "Shred-resistant waxed floss that glides smoothly between tight contacts.",
    description: [
      "Durable waxed floss with a light mint flavor that slides smoothly between tight contacts without shredding.",
      "Each dispenser holds 50m. Pack of 4.",
    ],
    highlights: ["Waxed & shred-resistant", "Light mint flavor", "50m per pack", "Pack of 4"],
    unit: "pack of 4",
    sku: "OC-FL-50",
    inStock: true,
    imageSeed: "dental-floss",
  },
  {
    slug: "fluoride-mouth-rinse-500ml",
    name: "Alcohol-Free Fluoride Mouth Rinse — 500ml",
    brand: "Philips Zoom",
    category: "oral-hygiene",
    price: 265,
    summary: "Daily fluoride rinse for cavity protection without the alcohol sting.",
    description: [
      "An alcohol-free daily rinse with sodium fluoride to strengthen enamel and help prevent cavities — gentle enough for sensitive mouths.",
      "Fresh mint flavor, 500ml bottle.",
    ],
    highlights: ["Alcohol-free", "Sodium fluoride", "Anticavity", "500ml"],
    unit: "500ml bottle",
    sku: "OC-MR-500",
    inStock: true,
    featured: true,
    imageSeed: "mouth-rinse",
  },
  {
    slug: "prophy-paste-medium-mint-200",
    name: "Prophy Paste — Medium Grit, Mint (Box of 200)",
    brand: "Philips Zoom",
    category: "preventive",
    price: 720,
    summary: "Fluoride prophy paste in single-use cups for efficient polishing.",
    description: [
      "Medium-grit prophylaxis paste with fluoride for effective stain and plaque removal during routine cleanings.",
      "Splatter-resistant and packaged in convenient single-use cups. Mint flavor, box of 200.",
    ],
    highlights: ["Medium grit + fluoride", "Splatter-resistant", "Single-use cups", "Box of 200"],
    unit: "box of 200",
    sku: "CON-PP-M200",
    inStock: true,
    imageSeed: "prophy-paste",
  },

  // ── Digital Dentistry (seed/placeholder — edit names, prices & images later) ──
  {
    slug: "intraoral-scanner-wireless-elf",
    name: "Wireless Intraoral Scanner — ScanElf",
    brand: "Sprintray",
    category: "digital-dentistry",
    price: 700000,
    compareAtPrice: 750000,
    summary: "Cordless intraoral scanner with fast full-arch capture and open-format exports.",
    description: [
      "A lightweight cordless intraoral scanner that captures accurate full-arch digital impressions in minutes, freeing your operatory from messy trays.",
      "Open STL/PLY exports integrate with any lab or mill workflow, and on-device AI cleans up scans in real time.",
    ],
    highlights: ["Cordless & lightweight", "Fast full-arch capture", "Open STL/PLY export", "Real-time AI cleanup"],
    unit: "unit",
    sku: "DIG-IOS-ELF",
    inStock: true,
    imageSeed: "intraoral-scanner-elf",
  },
  {
    slug: "intraoral-scanner-elite",
    name: "Intraoral Scanner — ScanElite (More than an IOS)",
    brand: "Sprintray",
    category: "digital-dentistry",
    price: 950000,
    summary: "Premium intraoral scanner with caries detection and shade-matching add-ons.",
    description: [
      "A flagship intraoral scanner that goes beyond impressions — optional caries detection and automated shade matching help you diagnose and plan chairside.",
      "High frame-rate optics deliver crisp, color-accurate scans with minimal retakes.",
    ],
    highlights: ["Color-accurate optics", "Optional caries detection", "Auto shade matching", "Chairside planning"],
    unit: "unit",
    sku: "DIG-IOS-ELITE",
    inStock: true,
    imageSeed: "intraoral-scanner-elite",
  },
  {
    slug: "intraoral-scanner-lync-pro",
    name: "Intraoral Scanner — Lync Pro",
    brand: "Sprintray",
    category: "digital-dentistry",
    price: 390000,
    compareAtPrice: 750000,
    summary: "Value-priced intraoral scanner with a slim wand and reliable full-arch accuracy.",
    description: [
      "A budget-friendly intraoral scanner that brings digital impressions within reach for growing clinics, without sacrificing accuracy.",
      "Slim, balanced wand reduces hand fatigue during longer scans; open exports keep you lab-agnostic.",
    ],
    highlights: ["Slim ergonomic wand", "Reliable full-arch accuracy", "Open exports", "Great value"],
    unit: "unit",
    sku: "DIG-IOS-LYNC",
    inStock: true,
    imageSeed: "intraoral-scanner-lync",
  },
  {
    slug: "face-scanner-metismile",
    name: "3D Face Scanner with Jaw Motion — MetiSmile",
    brand: "Sprintray",
    category: "digital-dentistry",
    price: 450000,
    summary: "3D facial scanner that captures faces and jaw motion for smile design.",
    description: [
      "A 3D face scanner that captures true-to-life facial data and jaw motion, powering facially-driven smile design and patient communication.",
      "Pairs with intraoral scans for a complete digital patient record.",
    ],
    highlights: ["3D facial capture", "Jaw-motion tracking", "Smile-design ready", "Intraoral scan sync"],
    unit: "unit",
    sku: "DIG-FACE-METI",
    inStock: true,
    imageSeed: "face-scanner-metismile",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers — the single interface pages use. Swap the source here in Phase 4.
// ─────────────────────────────────────────────────────────────────────────────

export function getAllProducts(): Product[] {
  return PRODUCTS;
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: CategorySlug): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

/** URL-safe slug for a brand display name (e.g. "Shining Digital" → "shining-digital"). */
export function brandSlug(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Canonical brand list shown in the Brand menu & validated for `?brand=` filtering.
 * Sorted A–Z. All brands appear even if they currently have no products.
 */
export const BRANDS: { name: string; slug: string }[] = [
  "Curaprox",
  "Herculite",
  "Kavoo",
  "Kerr",
  "Lasotronix",
  "Philips Zoom",
  "Rundeer",
  "SOL Laser",
  "Sprintray",
].map((name) => ({ name, slug: brandSlug(name) }));

/** Unique brands present in the catalog, sorted A–Z, with URL slugs. */
export function getAllBrands(): { name: string; slug: string }[] {
  const bySlug = new Map<string, string>();
  for (const p of PRODUCTS) bySlug.set(brandSlug(p.brand), p.brand);
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getProductsByBrand(slug: string): Product[] {
  return PRODUCTS.filter((p) => brandSlug(p.brand) === slug);
}

/** Keyword search over name, brand, and summary (case-insensitive). */
export function searchProducts(list: Product[], q: string): Product[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((p) =>
    `${p.name} ${p.brand} ${p.summary}`.toLowerCase().includes(needle),
  );
}

export function getFeaturedProducts(limit = 8): Product[] {
  return PRODUCTS.filter((p) => p.featured).slice(0, limit);
}

/** Related products: same category, excluding the current one. */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return PRODUCTS.filter(
    (p) => p.category === product.category && p.slug !== product.slug,
  ).slice(0, limit);
}

/** Placeholder image URL for a product (deterministic). Replace with real hosted images later. */
export function productImageUrl(product: Product, size = 800): string {
  return `https://picsum.photos/seed/rrdental-${product.imageSeed}/${size}/${size}`;
}

export type SortKey =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "savings-desc"
  | "stock-first";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A–Z" },
  { value: "savings-desc", label: "Biggest savings" },
  { value: "stock-first", label: "In stock first" },
];

/** Fractional discount for a product (0 when not on sale). */
function savingsFraction(p: Product): number {
  return p.compareAtPrice && p.compareAtPrice > p.price
    ? (p.compareAtPrice - p.price) / p.compareAtPrice
    : 0;
}

export function sortProducts(list: Product[], key: SortKey): Product[] {
  const copy = [...list];
  switch (key) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "savings-desc":
      return copy.sort((a, b) => savingsFraction(b) - savingsFraction(a));
    case "stock-first":
      return copy.sort((a, b) => Number(b.inStock) - Number(a.inStock));
    case "featured":
    default:
      return copy.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }
}
