export class MerchantNormalizer {

  static normalize(raw: string): string {
    if (!raw) return "";

    let text = raw.toUpperCase();

    // Remove phone numbers
    text = text.replace(/\d{3}-\d{3}-\d{4}/g, "");
    text = text.replace(/\d{3}-\d{4}/g, "");
    text = text.replace(/\(\d{3}\)\s?\d{3}-\d{4}/g, "");

    // Remove URLs / prefixes
    text = text.replace(/WWW\./g, "");
    text = text.replace(/HTTP\S+/g, "");
    text = text.replace(/\.COM\b/g, "");
    text = text.replace(/\.CA\b/g, "");
    text = text.replace(/\.NET\b/g, "");
    text = text.replace(/\.ORG\b/g, "");

    // Remove Canadian provinces and common cities
    text = text.replace(/\b(CALGARY|CANMORE|EDMONTON|BANFF|RED DEER|LETHBRIDGE|MEDICINE HAT|AIRDRIE|COCHRANE|OKOTOKS|CHESTERMERE|SPRUCE GROVE|SHERWOOD PARK|ST ALBERT)\b/g, "");
    text = text.replace(/\b(TORONTO|VANCOUVER|MONTREAL|OTTAWA|WINNIPEG|SASKATOON|REGINA|VICTORIA|HALIFAX|QUEBEC CITY|KELOWNA|KAMLOOPS)\b/g, "");
    text = text.replace(/\b(AB|ON|MB|BC|SK|QC|NB|NS|PE|NL|NT|NU|YT|CYP)\b/g, "");

    // Remove US states (2-letter codes in context)
    text = text.replace(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g, "");

    // Remove transaction reference numbers (e.g., #1234, TXN-5678)
    text = text.replace(/#\d+/g, "");
    text = text.replace(/\bTXN[-\s]?\d+/g, "");
    text = text.replace(/\bREF[-\s]?\d+/g, "");
    text = text.replace(/\bCONF[-\s]?\d+/g, "");

    // Remove dates in descriptions
    text = text.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, "");
    text = text.replace(/\d{4}-\d{2}-\d{2}/g, "");

    // Remove card-related prefixes
    text = text.replace(/\bVISA\s*(PURCHASE|DEBIT)?\s*/g, "");
    text = text.replace(/\bMC\s*(PURCHASE|DEBIT)?\s*/g, "");
    text = text.replace(/\bINTERAC\s*(PURCHASE|DEBIT|DIRECT\s*PAYMENT)?\s*/g, "");
    text = text.replace(/\bPOS\s*(PURCHASE|DEBIT)?\s*/g, "");

    // Remove numbers (after removing structured patterns above)
    text = text.replace(/[0-9]+/g, "");

    // Remove common noise suffixes
    text = text.replace(/\b(INC|LLC|LTD|CORP|CO|LP|LLP|PLC|GMBH|PTY|S\.A\.?|SRL|BV)\b\.?/g, "");

    // Collapse spaces
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }
}
