export type MerchantProfile = {
  canonical: string;
  category: string;
  descriptionTemplate: string;
};

export const MERCHANT_DB: Record<string, MerchantProfile> = {
  COSTCO: {
    canonical: "Costco",
    category: "COGS_SUPPLIES",
    descriptionTemplate: "costco_supplies"
  },

  "COSTCO WHOLESALE": {
    canonical: "Costco",
    category: "COGS_SUPPLIES",
    descriptionTemplate: "costco_supplies"
  },

  WALMART: {
    canonical: "Walmart",
    category: "SUPPLIES",
    descriptionTemplate: "retail_supplies"
  },

  "CANADIAN TIRE": {
    canonical: "Canadian Tire",
    category: "REPAIRS_MAINTENANCE",
    descriptionTemplate: "hardware_store"
  },

  "COSTCO LIQUOR": {
    canonical: "Costco Liquor",
    category: "COGS_SUPPLIES",
    descriptionTemplate: "liquor_supplies"
  },

  FIVERR: {
    canonical: "Fiverr",
    category: "SOFTWARE_SERVICES",
    descriptionTemplate: "online_services"
  },

  SKIPTHEDISHES: {
    canonical: "SkipTheDishes",
    category: "MEALS",
    descriptionTemplate: "meals"
  }
};
