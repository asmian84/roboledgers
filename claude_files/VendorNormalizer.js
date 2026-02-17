/**
 * VendorNormalizer - Normalizes transaction descriptions for fuzzy matching
 *
 * IMPROVEMENTS over original:
 * 1. NEW: Canadian bank prefixes removed (PAP, POS, INTERAC, PREAUTH, etc.)
 * 2. NEW: Date prefix stripping (YYYYMMDD at start, common in Canadian bank exports)
 * 3. NEW: Reference number patterns removed (common in STR platforms)
 * 4. NEW: PayPal and Stripe prefix removal
 * 5. IMPROVED: More noise patterns to handle real bank statement formats
 */

class VendorNormalizer {

    /**
     * Known brand patterns for exact extraction.
     * Checked first — if matched, we return the canonical brand name immediately.
     * Order: longer/more-specific patterns first.
     */
    static BRAND_PATTERNS = [
        // STR Platforms
        'AIRBNB', 'VRBO', 'BOOKING.COM',

        // Food & Restaurants
        'TIM HORTONS', 'MCDONALDS', 'DAIRY QUEEN', 'BURGER KING', 'SUBWAY',
        'STARBUCKS', 'A&W', 'WENDYS', 'PIZZA HUT', 'DOMINOS',
        'UBER EATS', 'SKIPTHEDISHES', 'DOORDASH',

        // Retailers
        'CANADIAN TIRE', 'THE HOME DEPOT', 'HOME DEPOT', 'DOLLARAMA',
        'WALMART', 'COSTCO', 'IKEA', 'LONDON DRUGS', 'SHOPPERS DRUG MART',
        'SAFEWAY', 'SOBEYS', 'REAL CANADIAN SUPERSTORE', 'SUPERSTORE', 'LOBLAWS',

        // Tech/Online
        'AMAZON', 'AMZN', 'APPLE.COM', 'SPOTIFY', 'NETFLIX', 'GOOGLE',
        'MICROSOFT', 'DROPBOX', 'ADOBE', 'GITHUB', 'ZOOM',

        // Fuel
        'SHELL', 'PETRO CANADA', 'PETRO-CANADA', 'PETROCAN', 'ESSO',
        'HUSKY', 'CO-OP GAS', 'CHEVRON', 'ULTRAMAR',

        // Airlines
        'WESTJET', 'AIR CANADA', 'AIR TRANSAT', 'SWOOP',

        // Transport
        'UBER', 'LYFT',

        // STR Software
        'PRICELABS', 'IGMS', 'RANKBREEZE', 'MINUT', 'HOSTAWAY',

        // Telecoms
        'TELUS', 'ROGERS', 'BELL', 'FIDO', 'KOODO', 'FREEDOM MOBILE',

        // Financial services
        'FIVERR', 'PAYPAL',
    ];

    /**
     * NEW: Canadian bank statement prefixes to strip before processing.
     * These appear at the start of description fields in many Canadian bank exports.
     */
    static CANADIAN_BANK_PREFIXES = [
        /^PAP\s+/i,           // Pre-Authorized Payment
        /^POS\s+/i,           // Point of Sale
        /^INTERAC\s+/i,       // Interac e-Transfer
        /^PREAUTH\s+/i,       // Pre-authorized
        /^MEMO\s+/i,          // Memo field prefix
        /^ACH\s+/i,           // ACH transfer
        /^EFT\s+/i,           // Electronic Funds Transfer
        /^WIRE\s+/i,          // Wire transfer
        /^CHQ\s*#?\d*\s*/i,   // Cheque number
        /^e-Transfer\s+from\s+/i,  // e-Transfer from [name]
        /^Interac\s+e-Transfer\s+from\s+/i,
        /^TFR\s+/i,           // Transfer
        /^ONL\s+/i,           // Online
        /^BUS\s+/i,           // Business banking prefix
    ];

    /**
     * Payment gateway prefixes — strip these to get the actual merchant name.
     */
    static PAYMENT_GATEWAY_PREFIXES = [
        /^PAYPAL\s*[\*\-]?\s*/i,   // PAYPAL*MERCHANTNAME or PAYPAL - MERCHANT
        /^SP\s+/i,                  // Stripe: SP MERCHANTNAME
        /^SQ\s*\*\s*/i,            // Square: SQ*MERCHANTNAME
        /^GOOGLE\s*\*\s*/i,        // Google Pay: GOOGLE*MERCHANT
        /^AMZN\s*\*\s*/i,          // Amazon marketplace: AMZN*MERCHANT
        /^BLS\s*\*\s*/i,           // Bluestar payment prefix
        /^WEB\s*\*\s*/i,           // Web payment prefix
        /^EIG\s*\*\s*/i,           // Endurance International Group
    ];

    /**
     * Location patterns to remove from the end of descriptions.
     */
    static LOCATION_PATTERNS = [
        // Canadian provinces with city
        /\s+(CALGARY|EDMONTON|VANCOUVER|TORONTO|OTTAWA|MONTREAL|WINNIPEG|REGINA|BANFF|CANMORE)\s+[A-Z]{2}$/i,
        // Province code at end
        /\s+(AB|BC|ON|QC|SK|MB|NS|NB|PE|NL|YT|NT|NU)\s*$/i,
        // US state + ZIP
        /\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/,
        // City, Province format
        /,\s*[A-Z]{2}\s*$/,
    ];

    /**
     * General noise patterns to remove.
     */
    static NOISE_PATTERNS = [
        /^\d{8}\s+/,               // NEW: Leading YYYYMMDD date (Canadian bank exports)
        /^\d{6}\s+/,               // Leading YYMMDD date
        /\s+STORE\s+#?\d+/i,       // STORE #123
        /\s+#\d+/g,                // #27
        /\*[A-Z0-9]{3,}/g,         // *W32F (transaction codes)
        /\s+\d{6,}/g,              // Long trailing numbers (refs/card numbers)
        /\s+(INC|LTD|CORP|LLC|CO)\\.?$/i, // Corporate suffixes
        /\s+WWW\s+/i,              // WWW
        /\s+HTTPS?:\/\/\S+/i,      // URLs
        /\s+REF\s*#?\d+/i,         // REF #12345
        /\s+TXN\s*#?\d+/i,         // TXN #12345
        /\s+INV\s*#?\d+/i,         // INV #12345
        /\s{2,}/g,                 // Multiple spaces → single
    ];

    /**
     * Normalize a raw bank transaction description to a clean vendor name.
     * @param {string} description
     * @returns {string} normalized vendor name
     */
    static normalize(description) {
        if (!description || typeof description !== 'string') return '';

        let clean = description.trim().toUpperCase();

        // 1. Strip Canadian bank prefixes
        for (const pattern of this.CANADIAN_BANK_PREFIXES) {
            const replaced = clean.replace(pattern, '');
            if (replaced !== clean) {
                clean = replaced.trim();
                break; // Only strip one prefix type
            }
        }

        // 2. Strip payment gateway prefixes
        for (const pattern of this.PAYMENT_GATEWAY_PREFIXES) {
            const replaced = clean.replace(pattern, '');
            if (replaced !== clean) {
                clean = replaced.trim();
                break;
            }
        }

        // 3. Check for known brand patterns (exact match wins)
        for (const brand of this.BRAND_PATTERNS) {
            if (clean.includes(brand)) return brand;
        }

        // 4. Remove location suffixes
        for (const pattern of this.LOCATION_PATTERNS) {
            clean = clean.replace(pattern, '');
        }

        // 5. Remove general noise
        for (const pattern of this.NOISE_PATTERNS) {
            clean = clean.replace(pattern, ' ');
        }

        return clean.trim();
    }

    /**
     * Normalize multiple descriptions.
     * @param {string[]} descriptions
     * @returns {string[]}
     */
    static normalizeBatch(descriptions) {
        return descriptions.map(desc => this.normalize(desc));
    }
}

export default VendorNormalizer;
