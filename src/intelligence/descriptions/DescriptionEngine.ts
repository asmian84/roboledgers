type DescriptionPair = {
  line1: string;
  line2: string;
};

const TEMPLATES: Record<string, DescriptionPair> = {
  costco_supplies: {
    line1: "Purchase at Costco Wholesale.",
    line2: "Supplies and consumables for rental units."
  },

  liquor_supplies: {
    line1: "Purchase at Costco Liquor.",
    line2: "Guest amenities and consumable supplies."
  },

  hardware_store: {
    line1: "Purchase at Canadian Tire.",
    line2: "Maintenance supplies and property equipment."
  },

  retail_supplies: {
    line1: "Purchase at Walmart.",
    line2: "Household and operating supplies."
  },

  online_services: {
    line1: "Online service purchase.",
    line2: "Software or contractor services."
  },

  meals: {
    line1: "Meal purchase.",
    line2: "Staff meals or travel food expense."
  }
};

export class DescriptionEngine {

  static generateFromTemplate(template?: string): DescriptionPair | null {
    if (!template) return null;
    return TEMPLATES[template] ?? null;
  }

  static generateFallback(txType?: string): DescriptionPair | null {
    switch (txType) {
      case "INTERAC_IN":
        return {
          line1: "Interac e-Transfer received.",
          line2: "Funds deposited to business account."
        };

      case "CREDIT_CARD_PAYMENT":
        return {
          line1: "Payment toward credit card balance.",
          line2: "Settlement of card expenses."
        };

      case "INTERNAL_TRANSFER":
        return {
          line1: "Transfer between company accounts.",
          line2: "Internal movement of funds."
        };

      case "PAYROLL_BATCH":
        return {
          line1: "Payroll and contractor payments.",
          line2: "Direct deposit batch processed."
        };
    }

    return null;
  }
}
