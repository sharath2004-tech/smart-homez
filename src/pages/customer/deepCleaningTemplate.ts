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
  description?: string;
  highlights?: string[];
  mode?: CategoryMode;
  headline?: string;
  inclusionsTitle?: string;
  idealFor?: string[];
  howItWorksTitle?: string;
  howItWorksSteps?: string[];
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
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

export type DeepCleaningCategoryMeta = {
  description: string;
  highlights: string[];
  mode: CategoryMode;
  headline: string;
  inclusionsTitle: string;
  idealFor: string[];
  howItWorksTitle: string;
  howItWorksSteps: string[];
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
};

export const CATEGORY_META: Record<
  string,
  DeepCleaningCategoryMeta
> = {
  fullhouse: {
    description: "Choose a home-size package for full-house professional deep cleaning.",
    highlights: ["Packages by home size", "Advance scheduling", "Team-based cleaning"],
    mode: "package",
    headline: "Full-home deep cleaning packages for apartments, villas and handover prep.",
    inclusionsTitle: "Package includes",
    idealFor: ["Seasonal full-home reset", "Festival or guest preparation", "Homes needing a team visit"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Pick this category to understand what is covered.",
      "Choose the package or continue to booking and enter your home details.",
      "Review the amount and confirm your preferred slot.",
    ],
    primaryActionLabel: "Continue to packages",
    secondaryActionLabel: "Prefer custom selection?",
  },
  bathroom: {
    description: "From basic washroom cleaning to intense descaling and sanitization.",
    highlights: ["Descaling", "Sanitization", "Tile & fixture cleaning"],
    mode: "customize",
    headline: "Bathroom-focused deep cleaning with flexible add-to-cart options.",
    inclusionsTitle: "Popular bathroom tasks",
    idealFor: ["Hard-water stain removal", "Tile and grout refresh", "Washrooms needing hygienic sanitization"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Pick this category to understand what is covered.",
      "Continue to booking, choose the tasks you want, and enter your home details.",
      "Review the amount and confirm your slot.",
    ],
    primaryActionLabel: "Continue to booking",
    secondaryActionLabel: "See full-home packages",
  },
  kitchen: {
    description: "Degreasing, appliance detailing, chimney cleaning and more.",
    highlights: ["Grease removal", "Appliance detailing", "Chimney options"],
    mode: "customize",
    headline: "Kitchen deep cleaning built around grease, appliances and high-touch areas.",
    inclusionsTitle: "Popular kitchen tasks",
    idealFor: ["Heavy grease build-up", "Appliance refresh before guests", "Monthly kitchen maintenance"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Pick this category to see the active kitchen services.",
      "Continue to booking and select the tasks or package that fit your kitchen.",
      "Review the amount and confirm your preferred slot.",
    ],
    primaryActionLabel: "Continue to booking",
    secondaryActionLabel: "See full-home packages",
  },
  sofa_upholstery: {
    description: "Wet shampooing and upholstery refresh for sofas and seating.",
    highlights: ["Fabric refresh", "Seat-wise pricing", "Quick add-ons"],
    mode: "customize",
    headline: "Seat-wise upholstery cleaning for fabric and soft furniture.",
    inclusionsTitle: "Popular upholstery tasks",
    idealFor: ["Sofa refresh", "Dust and stain control", "Living-room touch-ups"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Pick the service to see what is covered.",
      "Continue to booking and choose the upholstery tasks you need.",
      "Review the amount and confirm your slot.",
    ],
  },
  mattress: {
    description: "Deep mattress cleaning and sanitization for healthier sleep spaces.",
    highlights: ["Sanitization", "Dust removal", "Spot treatment"],
    mode: "customize",
    headline: "Mattress and sleep-surface cleaning for a fresher bedroom setup.",
    inclusionsTitle: "Popular mattress tasks",
    idealFor: ["Dust-sensitive homes", "Spot treatment", "Bedroom hygiene upgrades"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Open the category to see the active services.",
      "Continue to booking and select the items you need.",
      "Review the amount and confirm your slot.",
    ],
  },
  balcony_window: {
    description: "Window tracks, glass, balcony wash and utility-area detailing.",
    highlights: ["Glass cleaning", "Utility detailing", "Balcony wash"],
    mode: "customize",
    headline: "Exterior-adjacent cleaning for windows, tracks, balconies and utility edges.",
    inclusionsTitle: "Popular balcony and window tasks",
    idealFor: ["Dusty balconies", "Track and frame cleanup", "Utility-area detailing"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "See the active tasks in this category.",
      "Continue to booking and choose the services you need.",
      "Review the amount and confirm your slot.",
    ],
  },
  move_in_out: {
    description: "Best for handovers, empty flats and pre-move/post-move home cleaning.",
    highlights: ["Area-based estimate", "Vacant-home cleaning", "Shift-ready service"],
    mode: "customize",
    headline: "Move-in and move-out cleaning with instant amount calculation after you enter your home area.",
    inclusionsTitle: "Usually covered",
    idealFor: ["Tenant handover", "Pre-possession cleanup", "Move-in preparation before shifting"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Pick the right move-in or move-out option for your home.",
      "Enter your home area and get the amount calculated for you.",
      "Choose your slot and confirm the booking.",
    ],
    primaryActionLabel: "Continue to booking",
    secondaryActionLabel: "Browse all deep-cleaning types",
  },
  office: {
    description: "Commercial and office deep-cleaning requests handled through custom quotes.",
    highlights: ["Office spaces", "Commercial scope", "Custom quote"],
    mode: "quote",
    headline: "Commercial deep-cleaning for offices and business spaces.",
    inclusionsTitle: "Common office tasks",
    idealFor: ["Office refresh", "Commercial scope planning", "Custom team sizing"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Review the service scope and common office tasks.",
      "Request a custom quote for your office or commercial property.",
      "Our team will contact you with the next steps.",
    ],
    primaryActionLabel: "Request custom quote",
    secondaryActionLabel: "Browse all deep-cleaning types",
  },
  post_construction: {
    description: "Dust, residue and post-worksite cleaning for newly finished spaces.",
    highlights: ["Post-renovation", "Heavy dust cleanup", "Custom quote"],
    mode: "quote",
    headline: "Post-construction cleanup for heavy dust, residue and finishing work.",
    inclusionsTitle: "Typical post-worksite cleanup",
    idealFor: ["Newly renovated homes", "Builder handover", "Dust-heavy properties"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Review the cleanup scope for your property.",
      "Request a quote for the site size and condition.",
      "Our team will contact you with the next steps.",
    ],
    primaryActionLabel: "Request custom quote",
    secondaryActionLabel: "Browse all deep-cleaning types",
  },
  appliances: {
    description: "Single-purpose cleaning for fans, chimneys and appliance-focused tasks.",
    highlights: ["Fast booking", "Appliance-only", "Easy add-ons"],
    mode: "customize",
    headline: "Focused appliance cleaning without booking a full-room package.",
    inclusionsTitle: "Popular appliance tasks",
    idealFor: ["Appliance-only visits", "Chimney refresh", "Quick maintenance cleaning"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Review the appliance tasks available.",
      "Continue to booking and choose what you need.",
      "Review the amount and confirm your slot.",
    ],
  },
  furniture: {
    description: "Sofa sets, dining areas and fabric furniture cleaning with clear pricing.",
    highlights: ["Furniture care", "Seat-based services", "Add to cart"],
    mode: "customize",
    headline: "Furniture-focused cleaning that fits neatly into a custom builder flow.",
    inclusionsTitle: "Popular furniture tasks",
    idealFor: ["Dining-area refresh", "Furniture detailing", "Living-space upkeep"],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Review the furniture tasks available in this category.",
      "Continue to booking and add the services you need.",
      "Review the amount and confirm your slot.",
    ],
  },
};

export const getCategoryMeta = (category?: DeepCleaningCategory | null): DeepCleaningCategoryMeta => {
  const fallback = CATEGORY_META[category?.id || ""] || {
    description: "Choose the right deep cleaning scope for your home and continue with booking.",
    highlights: [],
    mode: "customize" as CategoryMode,
    headline: "Deep cleaning for the spaces that need extra care.",
    inclusionsTitle: "Included services",
    idealFor: [],
    howItWorksTitle: "How this works",
    howItWorksSteps: [
      "Review the services available in this category.",
      "Continue to booking and choose what you need.",
      "Review the amount and confirm your preferred slot.",
    ],
  };

  return {
    ...fallback,
    ...category,
    highlights: category?.highlights?.length ? category.highlights : fallback.highlights,
    idealFor: category?.idealFor?.length ? category.idealFor : fallback.idealFor,
    howItWorksSteps: category?.howItWorksSteps?.length ? category.howItWorksSteps : fallback.howItWorksSteps,
  };
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

export const getCategoryAction = (category: DeepCleaningCategory | string) => {
  const categoryId = typeof category === "string" ? category : category.id;
  const meta = getCategoryMeta(typeof category === "string" ? { id: category } as DeepCleaningCategory : category);

  if (DETAIL_CATEGORY_IDS.has(categoryId)) {
    return { href: `/customer/deep-cleaning/${encodeURIComponent(categoryId)}`, label: "Explore details" };
  }

  const mode = meta.mode || "customize";

  if (mode === "package") {
    return { href: "/customer/services/deep-cleaning", label: meta.primaryActionLabel || "Explore packages" };
  }
  if (mode === "quote") {
    return { href: "/deep-cleaning-quote", label: meta.primaryActionLabel || "Get custom quote" };
  }
  return { href: `/customer/deep-cleaning/customize?category=${encodeURIComponent(categoryId)}`, label: meta.primaryActionLabel || "Continue" };
};