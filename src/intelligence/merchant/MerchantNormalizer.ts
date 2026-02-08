export class MerchantNormalizer {

  static normalize(raw: string): string {
    if (!raw) return "";

    let text = raw.toUpperCase();

    // Remove phone numbers
    text = text.replace(/\d{3}-\d{3}-\d{4}/g, "");
    text = text.replace(/\d{3}-\d{4}/g, "");

    // Remove URLs / prefixes
    text = text.replace(/WWW\./g, "");
    text = text.replace(/HTTP\S+/g, "");

    // Remove location noise
    text = text.replace(/\b(CALGARY|CANMORE|AB|ON|MB|BC|CYP)\b/g, "");

    // Remove numbers
    text = text.replace(/[0-9]+/g, "");

    // Collapse spaces
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }
}
