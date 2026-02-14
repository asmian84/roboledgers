/**
 * VendorNormalizer - Normalizes transaction descriptions for fuzzy matching
 * Extracts core vendor names by removing locations, store numbers, and noise
 */

class VendorNormalizer {
    /**
     * Known brand patterns for exact extraction
     * Order matters - check longer patterns first
     */
    static BRAND_PATTERNS = [
        // Food & Restaurants
        'TIM HORTONS', 'MCDONALDS', 'DAIRY QUEEN', 'BURGER KING', 'SUBWAY',
        'STARBUCKS', 'A&W', 'WENDYS', 'PIZZA HUT', 'DOMINOS',
        'UBER EATS', 'SKIPTHEDISHES', 'DOORDASH',

        // Retailers
        'CANADIAN TIRE', 'THE HOME DEPOT', 'DOLLARAMA', 'WALMART', 'COSTCO',
        'IKEA', 'LONDON DRUGS', 'SHOPPERS DRUG MART', 'SAFEWAY', 'SOBEYS',

        // Tech/Online
        'AMAZON', 'AMZN', 'APPLE.COM', 'SPOTIFY', 'NETFLIX', 'GOOGLE',

        // Fuel
        'SHELL', 'PETRO CANADA', 'ESSO', 'HUSKY', 'CO-OP GAS',

        // Services
        'UBER', 'FIVERR', 'AIRBNB'
    ];

    /**
     * Location patterns to remove
     */
    static LOCATION_PATTERNS = [
        // Canadian cities
        /\s+(CALGARY|EDMONTON|VANCOUVER|TORONTO|OTTAWA|MONTREAL|WINNIPEG|REGINA|QUEBEC|HALIFAX)\s+[A-Z]{2}$/i,
        // Province codes at end
        /\s+(AB|BC|ON|QC|SK|MB|NS|NB|PE|NL)$/i,
        // US states
        /\s+[A-Z]{2}\s+\d{5}$/,  // State + ZIP
    ];

    /**
     * Noise patterns to remove
     */
    static NOISE_PATTERNS = [
        /\s+STORE\s+#?\d+/i,           // STORE #123
        /\s+#\d+/g,                    // #27
        /\*[A-Z0-9]+/g,                // *W32F
        /\s+\d{3,}$/,                  // Trailing numbers
        /\s+(INC|LTD|CORP|LLC)\.?$/i,  // Corporate suffixes
        /\s+WWW\s+/i,                  // WWW
        /\s+HTTP[S]?:\/\//i,           // URLs
    ];

    /**
     * Normalize a transaction description
     * @param {string} description - Raw transaction description
     * @returns {string} - Normalized vendor name
     */
    static normalize(description) {
        if (!description || typeof description !== 'string') {
            return '';
        }

        let clean = description.trim().toUpperCase();

        // Check for known brand patterns first
        for (const brand of this.BRAND_PATTERNS) {
            if (clean.includes(brand)) {
                return brand;
            }
        }

        // Remove locations
        for (const pattern of this.LOCATION_PATTERNS) {
            clean = clean.replace(pattern, '');
        }

        // Remove noise
        for (const pattern of this.NOISE_PATTERNS) {
            clean = clean.replace(pattern, '');
        }

        // Collapse multiple spaces
        clean = clean.replace(/\s+/g, ' ').trim();

        return clean;
    }

    /**
     * Normalize multiple descriptions in batch
     * @param {string[]} descriptions - Array of descriptions
     * @returns {string[]} - Array of normalized names
     */
    static normalizeBatch(descriptions) {
        return descriptions.map(desc => this.normalize(desc));
    }
}

export default VendorNormalizer;
