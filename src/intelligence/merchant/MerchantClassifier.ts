import { MerchantNormalizer } from "./MerchantNormalizer";
import { MERCHANT_DB, MerchantProfile } from "./MerchantKnowledgeBase";

export type MerchantMatch = {
  merchant_clean?: string;
  category?: string;
  template?: string;
  confidence: number;
  profile?: MerchantProfile;
};

export class MerchantClassifier {

  static classify(rawDescription: string): MerchantMatch {
    const normalized = MerchantNormalizer.normalize(rawDescription);

    for (const key of Object.keys(MERCHANT_DB)) {
      if (normalized.includes(key)) {
        const profile = MERCHANT_DB[key];

        return {
          merchant_clean: profile.canonical,
          category: profile.category,
          template: profile.descriptionTemplate,
          confidence: 0.95,
          profile
        };
      }
    }

    return { confidence: 0 };
  }
}
