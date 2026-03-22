export interface ConfigTier {
  label: string;
  price: number;
}

export interface ConfigItem {
  id: string;
  category: string;
  name: string;
  description: string;
  pricingType: "fixed" | "per_unit" | "per_sqft" | "tiered";
  price: number;
  tiers?: ConfigTier[];
  maxQty: number;
  unit: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

export interface DeepCleaningCategory {
  id: string;
  label: string;
  emoji: string;
  isActive: boolean;
  sortOrder: number;
}

export interface DeepCleaningConfig {
  items: ConfigItem[];
  minimumCartValue: number;
  categories?: DeepCleaningCategory[];
  pageContent?: {
    heroBadge?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    categoriesTitle?: string;
    categoriesSubtitle?: string;
    miniServicesTitle?: string;
    miniServicesSubtitle?: string;
  };
}

export interface UserProfile {
  name?: string;
}

export type CategoryMode = "package" | "customize" | "quote";

export const DETAIL_CATEGORY_IDS = new Set(["fullhouse", "kitchen", "bathroom", "move_in_out"]);

export const CATEGORY_META: Record<
  string,
  {
    description: string;
    highlights: string[];
    mode: CategoryMode;
    headline: string;
    inclusionsTitle: string;
    idealFor: string[];
  }
> = {
  fullhouse: {
    description: "Choose a home-size package for full-house professional deep cleaning.",
    highlights: ["Packages by home size", "Advance scheduling", "Team-based cleaning"],
    mode: "package",
    headline: "Full-home deep cleaning packages for apartments, villas and handover prep.",
    inclusionsTitle: "Package includes",
    idealFor: ["Seasonal full-home reset", "Festival or guest preparation", "Homes needing a team visit"],
  },
  bathroom: {
    description: "From basic washroom cleaning to intense descaling and sanitization.",
    highlights: ["Descaling", "Sanitization", "Tile & fixture cleaning"],
    mode: "customize",
    headline: "Bathroom-focused deep cleaning with flexible add-to-cart options.",
    inclusionsTitle: "Popular bathroom tasks",
    idealFor: ["Hard-water stain removal", "Tile and grout refresh", "Washrooms needing hygienic sanitization"],
  },
  kitchen: {
    description: "Degreasing, appliance detailing, chimney cleaning and more.",
    highlights: ["Grease removal", "Appliance detailing", "Chimney options"],
    mode: "customize",
    headline: "Kitchen deep cleaning built around grease, appliances and high-touch areas.",
    inclusionsTitle: "Popular kitchen tasks",
    idealFor: ["Heavy grease build-up", "Appliance refresh before guests", "Monthly kitchen maintenance"],
  },
  sofa_upholstery: {
    description: "Wet shampooing and upholstery refresh for sofas and seating.",
    highlights: ["Fabric refresh", "Seat-wise pricing", "Quick add-ons"],
    mode: "customize",
    headline: "Seat-wise upholstery cleaning for fabric and soft furniture.",
    inclusionsTitle: "Popular upholstery tasks",
    idealFor: ["Sofa refresh", "Dust and stain control", "Living-room touch-ups"],
  },
  mattress: {
    description: "Deep mattress cleaning and sanitization for healthier sleep spaces.",
    highlights: ["Sanitization", "Dust removal", "Spot treatment"],
    mode: "customize",
    headline: "Mattress and sleep-surface cleaning for a fresher bedroom setup.",
    inclusionsTitle: "Popular mattress tasks",
    idealFor: ["Dust-sensitive homes", "Spot treatment", "Bedroom hygiene upgrades"],
  },
  balcony_window: {
    description: "Window tracks, glass, balcony wash and utility-area detailing.",
    highlights: ["Glass cleaning", "Utility detailing", "Balcony wash"],
    mode: "customize",
    headline: "Exterior-adjacent cleaning for windows, tracks, balconies and utility edges.",
    inclusionsTitle: "Popular balcony and window tasks",
    idealFor: ["Dusty balconies", "Track and frame cleanup", "Utility-area detailing"],
  },
  move_in_out: {
    description: "Best for handovers, empty flats and pre-move/post-move home cleaning.",
    highlights: ["Area-based estimate", "Vacant-home cleaning", "Shift-ready service"],
    mode: "customize",
    headline: "Move-in and move-out cleaning with instant amount calculation after you enter your home area.",
    inclusionsTitle: "Usually covered",
    idealFor: ["Tenant handover", "Pre-possession cleanup", "Move-in preparation before shifting"],
  },
  office: {
    description: "Commercial and office deep-cleaning requests handled through custom quotes.",
    highlights: ["Office spaces", "Commercial scope", "Custom quote"],
    mode: "quote",
    headline: "Commercial deep-cleaning for offices and business spaces.",
    inclusionsTitle: "Common office tasks",
    idealFor: ["Office refresh", "Commercial scope planning", "Custom team sizing"],
  },
  post_construction: {
    description: "Dust, residue and post-worksite cleaning for newly finished spaces.",
    highlights: ["Post-renovation", "Heavy dust cleanup", "Custom quote"],
    mode: "quote",
    headline: "Post-construction cleanup for heavy dust, residue and finishing work.",
    inclusionsTitle: "Typical post-worksite cleanup",
    idealFor: ["Newly renovated homes", "Builder handover", "Dust-heavy properties"],
  },
  appliances: {
    description: "Single-purpose cleaning for fans, chimneys and appliance-focused tasks.",
    highlights: ["Fast booking", "Appliance-only", "Easy add-ons"],
    mode: "customize",
    headline: "Focused appliance cleaning without booking a full-room package.",
    inclusionsTitle: "Popular appliance tasks",
    idealFor: ["Appliance-only visits", "Chimney refresh", "Quick maintenance cleaning"],
  },
  furniture: {
    description: "Sofa sets, dining areas and fabric furniture cleaning with clear pricing.",
    highlights: ["Furniture care", "Seat-based services", "Add to cart"],
    mode: "customize",
    headline: "Furniture-focused cleaning that fits neatly into a custom builder flow.",
    inclusionsTitle: "Popular furniture tasks",
    idealFor: ["Dining-area refresh", "Furniture detailing", "Living-space upkeep"],
  },
};

export const getStartingPrice = (items: ConfigItem[]) => {
  const prices = items.flatMap((item) => {
    if (item.pricingType === "tiered") {
      return (item.tiers || []).map((tier) => tier.price).filter((price) => price > 0);
    }
    return item.price > 0 ? [item.price] : [];
  });

  if (!prices.length) return null;
  return Math.min(...prices);
};

export const getCategoryAction = (categoryId: string) => {
  if (DETAIL_CATEGORY_IDS.has(categoryId)) {
    return { href: `/customer/deep-cleaning/${encodeURIComponent(categoryId)}`, label: "Explore details" };
  }

  const mode = CATEGORY_META[categoryId]?.mode || "customize";

  if (mode === "package") {
    return { href: "/customer/services/deep-cleaning", label: "Explore packages" };
  }
  if (mode === "quote") {
    return { href: "/deep-cleaning-quote", label: "Get custom quote" };
  }
  return { href: `/customer/deep-cleaning/customize?category=${encodeURIComponent(categoryId)}`, label: "Continue" };
};