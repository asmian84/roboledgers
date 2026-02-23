export type MerchantProfile = {
  canonical: string;
  category: string;
  descriptionTemplate: string;
};

export const MERCHANT_DB: Record<string, MerchantProfile> = {

  // ============================================================
  // MEALS & ENTERTAINMENT (6415)
  // ============================================================
  SKIPTHEDISHES: { canonical: "SkipTheDishes", category: "MEALS", descriptionTemplate: "meals" },
  "SKIP THE DISHES": { canonical: "SkipTheDishes", category: "MEALS", descriptionTemplate: "meals" },
  "TIM HORTONS": { canonical: "Tim Hortons", category: "MEALS", descriptionTemplate: "meals" },
  TIMS: { canonical: "Tim Hortons", category: "MEALS", descriptionTemplate: "meals" },
  "TIM HORTON": { canonical: "Tim Hortons", category: "MEALS", descriptionTemplate: "meals" },
  STARBUCKS: { canonical: "Starbucks", category: "MEALS", descriptionTemplate: "meals" },
  SBUX: { canonical: "Starbucks", category: "MEALS", descriptionTemplate: "meals" },
  "MCDONALD": { canonical: "McDonald's", category: "MEALS", descriptionTemplate: "meals" },
  MCDONALDS: { canonical: "McDonald's", category: "MEALS", descriptionTemplate: "meals" },
  SUBWAY: { canonical: "Subway", category: "MEALS", descriptionTemplate: "meals" },
  "BURGER KING": { canonical: "Burger King", category: "MEALS", descriptionTemplate: "meals" },
  "WENDY": { canonical: "Wendy's", category: "MEALS", descriptionTemplate: "meals" },
  "PIZZA HUT": { canonical: "Pizza Hut", category: "MEALS", descriptionTemplate: "meals" },
  DOMINOS: { canonical: "Domino's", category: "MEALS", descriptionTemplate: "meals" },
  "DOMINO'S": { canonical: "Domino's", category: "MEALS", descriptionTemplate: "meals" },
  "PAPA JOHN": { canonical: "Papa John's", category: "MEALS", descriptionTemplate: "meals" },
  CHIPOTLE: { canonical: "Chipotle", category: "MEALS", descriptionTemplate: "meals" },
  "TACO BELL": { canonical: "Taco Bell", category: "MEALS", descriptionTemplate: "meals" },
  "CHICK-FIL-A": { canonical: "Chick-fil-A", category: "MEALS", descriptionTemplate: "meals" },
  "PANERA BREAD": { canonical: "Panera Bread", category: "MEALS", descriptionTemplate: "meals" },
  PANERA: { canonical: "Panera Bread", category: "MEALS", descriptionTemplate: "meals" },
  DOORDASH: { canonical: "DoorDash", category: "MEALS", descriptionTemplate: "meals" },
  UBEREATS: { canonical: "Uber Eats", category: "MEALS", descriptionTemplate: "meals" },
  "UBER EATS": { canonical: "Uber Eats", category: "MEALS", descriptionTemplate: "meals" },
  GRUBHUB: { canonical: "Grubhub", category: "MEALS", descriptionTemplate: "meals" },
  INSTACART: { canonical: "Instacart", category: "MEALS", descriptionTemplate: "meals" },
  "A&W": { canonical: "A&W", category: "MEALS", descriptionTemplate: "meals" },
  "MARY BROWN": { canonical: "Mary Brown's", category: "MEALS", descriptionTemplate: "meals" },
  "SWISS CHALET": { canonical: "Swiss Chalet", category: "MEALS", descriptionTemplate: "meals" },
  EARLS: { canonical: "Earls", category: "MEALS", descriptionTemplate: "meals" },
  JOEYS: { canonical: "Joey's", category: "MEALS", descriptionTemplate: "meals" },
  CACTUS: { canonical: "Cactus Club", category: "MEALS", descriptionTemplate: "meals" },
  "THE KEG": { canonical: "The Keg", category: "MEALS", descriptionTemplate: "meals" },
  MILESTONES: { canonical: "Milestones", category: "MEALS", descriptionTemplate: "meals" },
  MOXIES: { canonical: "Moxies", category: "MEALS", descriptionTemplate: "meals" },
  "BOSTON PIZZA": { canonical: "Boston Pizza", category: "MEALS", descriptionTemplate: "meals" },
  "MONTANA'S": { canonical: "Montana's", category: "MEALS", descriptionTemplate: "meals" },
  NANDOS: { canonical: "Nando's", category: "MEALS", descriptionTemplate: "meals" },
  "NANDO'S": { canonical: "Nando's", category: "MEALS", descriptionTemplate: "meals" },
  POPEYES: { canonical: "Popeyes", category: "MEALS", descriptionTemplate: "meals" },
  "FIVE GUYS": { canonical: "Five Guys", category: "MEALS", descriptionTemplate: "meals" },
  FRESHII: { canonical: "Freshii", category: "MEALS", descriptionTemplate: "meals" },
  "OPA!": { canonical: "OPA!", category: "MEALS", descriptionTemplate: "meals" },
  PITA: { canonical: "Pita Pit", category: "MEALS", descriptionTemplate: "meals" },
  "SECOND CUP": { canonical: "Second Cup", category: "MEALS", descriptionTemplate: "meals" },
  "DAVIDS TEA": { canonical: "DAVIDsTEA", category: "MEALS", descriptionTemplate: "meals" },

  // ============================================================
  // OFFICE SUPPLIES & POSTAGE (8600)
  // ============================================================
  STAPLES: { canonical: "Staples", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "STAPLES DIRECT": { canonical: "Staples", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "OFFICE DEPOT": { canonical: "Office Depot", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  OFFICEDEPOT: { canonical: "Office Depot", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  OFFICEMAX: { canonical: "OfficeMax", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  AMAZON: { canonical: "Amazon", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "AMZN MKTP": { canonical: "Amazon", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  AMZN: { canonical: "Amazon", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "AMAZON PRIME": { canonical: "Amazon", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "AMAZON BUSINESS": { canonical: "Amazon Business", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  WALMART: { canonical: "Walmart", category: "OFFICE_SUPPLIES", descriptionTemplate: "retail_supplies" },
  "WAL-MART": { canonical: "Walmart", category: "OFFICE_SUPPLIES", descriptionTemplate: "retail_supplies" },
  "WM SUPERCENTER": { canonical: "Walmart", category: "OFFICE_SUPPLIES", descriptionTemplate: "retail_supplies" },
  TARGET: { canonical: "Target", category: "OFFICE_SUPPLIES", descriptionTemplate: "retail_supplies" },
  COSTCO: { canonical: "Costco", category: "COGS_SUPPLIES", descriptionTemplate: "costco_supplies" },
  "COSTCO WHOLESALE": { canonical: "Costco", category: "COGS_SUPPLIES", descriptionTemplate: "costco_supplies" },
  "COSTCO WHSE": { canonical: "Costco", category: "COGS_SUPPLIES", descriptionTemplate: "costco_supplies" },
  "COSTCO LIQUOR": { canonical: "Costco Liquor", category: "COGS_SUPPLIES", descriptionTemplate: "liquor_supplies" },
  ULINE: { canonical: "Uline", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  QUILL: { canonical: "Quill", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  GRAINGER: { canonical: "Grainger", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "WW GRAINGER": { canonical: "Grainger", category: "OFFICE_SUPPLIES", descriptionTemplate: "office_supplies" },
  "DOLLAR TREE": { canonical: "Dollar Tree", category: "OFFICE_SUPPLIES", descriptionTemplate: "retail_supplies" },
  "DOLLAR GENERAL": { canonical: "Dollar General", category: "OFFICE_SUPPLIES", descriptionTemplate: "retail_supplies" },

  // ============================================================
  // SOFTWARE & SUBSCRIPTIONS (6800)
  // ============================================================
  ADOBE: { canonical: "Adobe", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "ADOBE SYSTEMS": { canonical: "Adobe", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  MICROSOFT: { canonical: "Microsoft", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "MSFT ": { canonical: "Microsoft", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "MICROSOFT 365": { canonical: "Microsoft 365", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  GITHUB: { canonical: "GitHub", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  ATLASSIAN: { canonical: "Atlassian", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  JIRA: { canonical: "Atlassian Jira", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  SLACK: { canonical: "Slack", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  ZOOM: { canonical: "Zoom", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "ZOOM.US": { canonical: "Zoom", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  SALESFORCE: { canonical: "Salesforce", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  HUBSPOT: { canonical: "HubSpot", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  SHOPIFY: { canonical: "Shopify", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  QUICKBOOKS: { canonical: "QuickBooks", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "INTUIT": { canonical: "Intuit", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "INTUIT *QBOOKS": { canonical: "QuickBooks", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  XERO: { canonical: "Xero", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  FRESHBOOKS: { canonical: "FreshBooks", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  MAILCHIMP: { canonical: "Mailchimp", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  CANVA: { canonical: "Canva", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  DROPBOX: { canonical: "Dropbox", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "GOOGLE ": { canonical: "Google", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "GOOGLE CLOUD": { canonical: "Google Cloud", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  "GOOGLE WORKSPACE": { canonical: "Google Workspace", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  NOTION: { canonical: "Notion", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  FIGMA: { canonical: "Figma", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  ZAPIER: { canonical: "Zapier", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  CALENDLY: { canonical: "Calendly", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  DOCUSIGN: { canonical: "DocuSign", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  SEMRUSH: { canonical: "Semrush", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  AHREFS: { canonical: "Ahrefs", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  HOOTSUITE: { canonical: "Hootsuite", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  ASANA: { canonical: "Asana", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  TRELLO: { canonical: "Trello", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  MONDAY: { canonical: "Monday.com", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  CLICKUP: { canonical: "ClickUp", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "1PASSWORD": { canonical: "1Password", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  LASTPASS: { canonical: "LastPass", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  GRAMMARLY: { canonical: "Grammarly", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  OPENAI: { canonical: "OpenAI", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "CHAT GPT": { canonical: "OpenAI", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  ANTHROPIC: { canonical: "Anthropic", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  VERCEL: { canonical: "Vercel", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  NETLIFY: { canonical: "Netlify", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  HEROKU: { canonical: "Heroku", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  DIGITALOCEAN: { canonical: "DigitalOcean", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  LINODE: { canonical: "Linode", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  AWS: { canonical: "Amazon Web Services", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  "AMAZON WEB SERVICES": { canonical: "Amazon Web Services", category: "SOFTWARE_SERVICES", descriptionTemplate: "cloud_hosting" },
  FIVERR: { canonical: "Fiverr", category: "SOFTWARE_SERVICES", descriptionTemplate: "online_services" },
  NETFLIX: { canonical: "Netflix", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  SPOTIFY: { canonical: "Spotify", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "APPLE.COM/BILL": { canonical: "Apple", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  "APL* ITUNES": { canonical: "Apple iTunes", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  WEALTHSIMPLE: { canonical: "Wealthsimple", category: "SOFTWARE_SERVICES", descriptionTemplate: "software_subscription" },
  STRIPE: { canonical: "Stripe", category: "CREDIT_CARD_CHARGES", descriptionTemplate: "payment_processor" },
  SQUARE: { canonical: "Square", category: "CREDIT_CARD_CHARGES", descriptionTemplate: "payment_processor" },
  PAYPAL: { canonical: "PayPal", category: "CREDIT_CARD_CHARGES", descriptionTemplate: "payment_processor" },

  // ============================================================
  // FUEL & OIL (5330)
  // ============================================================
  SHELL: { canonical: "Shell", category: "FUEL", descriptionTemplate: "fuel" },
  "PETRO-CANADA": { canonical: "Petro-Canada", category: "FUEL", descriptionTemplate: "fuel" },
  "PETRO CANADA": { canonical: "Petro-Canada", category: "FUEL", descriptionTemplate: "fuel" },
  ESSO: { canonical: "Esso", category: "FUEL", descriptionTemplate: "fuel" },
  HUSKY: { canonical: "Husky", category: "FUEL", descriptionTemplate: "fuel" },
  CHEVRON: { canonical: "Chevron", category: "FUEL", descriptionTemplate: "fuel" },
  "CO-OP GAS": { canonical: "Co-op Gas", category: "FUEL", descriptionTemplate: "fuel" },
  MOBIL: { canonical: "Mobil", category: "FUEL", descriptionTemplate: "fuel" },
  SUNOCO: { canonical: "Sunoco", category: "FUEL", descriptionTemplate: "fuel" },
  "GAS BAR": { canonical: "Gas Bar", category: "FUEL", descriptionTemplate: "fuel" },
  "PIONEER ENERGY": { canonical: "Pioneer Energy", category: "FUEL", descriptionTemplate: "fuel" },
  ULTRAMAR: { canonical: "Ultramar", category: "FUEL", descriptionTemplate: "fuel" },
  "CIRCLE K": { canonical: "Circle K", category: "FUEL", descriptionTemplate: "fuel" },

  // ============================================================
  // TRAVEL & ACCOMMODATIONS (9200)
  // ============================================================
  UBER: { canonical: "Uber", category: "TRAVEL", descriptionTemplate: "travel" },
  "UBER CANADA": { canonical: "Uber", category: "TRAVEL", descriptionTemplate: "travel" },
  "UBER TRIP": { canonical: "Uber", category: "TRAVEL", descriptionTemplate: "travel" },
  LYFT: { canonical: "Lyft", category: "TRAVEL", descriptionTemplate: "travel" },
  WESTJET: { canonical: "WestJet", category: "TRAVEL", descriptionTemplate: "airline" },
  "AIR CANADA": { canonical: "Air Canada", category: "TRAVEL", descriptionTemplate: "airline" },
  "UNITED AIRLINES": { canonical: "United Airlines", category: "TRAVEL", descriptionTemplate: "airline" },
  "AMERICAN AIRLINES": { canonical: "American Airlines", category: "TRAVEL", descriptionTemplate: "airline" },
  DELTA: { canonical: "Delta Air Lines", category: "TRAVEL", descriptionTemplate: "airline" },
  SOUTHWEST: { canonical: "Southwest Airlines", category: "TRAVEL", descriptionTemplate: "airline" },
  JETBLUE: { canonical: "JetBlue", category: "TRAVEL", descriptionTemplate: "airline" },
  ALASKA: { canonical: "Alaska Airlines", category: "TRAVEL", descriptionTemplate: "airline" },
  FLAIR: { canonical: "Flair Airlines", category: "TRAVEL", descriptionTemplate: "airline" },
  SWOOP: { canonical: "Swoop", category: "TRAVEL", descriptionTemplate: "airline" },
  AIRBNB: { canonical: "Airbnb", category: "TRAVEL", descriptionTemplate: "lodging" },
  VRBO: { canonical: "Vrbo", category: "TRAVEL", descriptionTemplate: "lodging" },
  MARRIOTT: { canonical: "Marriott", category: "TRAVEL", descriptionTemplate: "lodging" },
  HILTON: { canonical: "Hilton", category: "TRAVEL", descriptionTemplate: "lodging" },
  "HOLIDAY INN": { canonical: "Holiday Inn", category: "TRAVEL", descriptionTemplate: "lodging" },
  "BEST WESTERN": { canonical: "Best Western", category: "TRAVEL", descriptionTemplate: "lodging" },
  "SUPER 8": { canonical: "Super 8", category: "TRAVEL", descriptionTemplate: "lodging" },
  HYATT: { canonical: "Hyatt", category: "TRAVEL", descriptionTemplate: "lodging" },
  "FOUR SEASONS": { canonical: "Four Seasons", category: "TRAVEL", descriptionTemplate: "lodging" },
  EXPEDIA: { canonical: "Expedia", category: "TRAVEL", descriptionTemplate: "travel_booking" },
  "BOOKING.COM": { canonical: "Booking.com", category: "TRAVEL", descriptionTemplate: "travel_booking" },
  HOTELS: { canonical: "Hotels.com", category: "TRAVEL", descriptionTemplate: "travel_booking" },
  AVIS: { canonical: "Avis", category: "TRAVEL", descriptionTemplate: "car_rental" },
  HERTZ: { canonical: "Hertz", category: "TRAVEL", descriptionTemplate: "car_rental" },
  "BUDGET RENT": { canonical: "Budget", category: "TRAVEL", descriptionTemplate: "car_rental" },
  ENTERPRISE: { canonical: "Enterprise", category: "TRAVEL", descriptionTemplate: "car_rental" },
  NATIONAL: { canonical: "National Car Rental", category: "TRAVEL", descriptionTemplate: "car_rental" },
  TURO: { canonical: "Turo", category: "TRAVEL", descriptionTemplate: "car_rental" },

  // ============================================================
  // TELEPHONE & INTERNET (9100)
  // ============================================================
  ROGERS: { canonical: "Rogers", category: "TELECOM", descriptionTemplate: "telecom" },
  TELUS: { canonical: "Telus", category: "TELECOM", descriptionTemplate: "telecom" },
  BELL: { canonical: "Bell", category: "TELECOM", descriptionTemplate: "telecom" },
  "BELL CANADA": { canonical: "Bell Canada", category: "TELECOM", descriptionTemplate: "telecom" },
  SHAW: { canonical: "Shaw", category: "TELECOM", descriptionTemplate: "telecom" },
  "SHAW CABLESYSTEMS": { canonical: "Shaw", category: "TELECOM", descriptionTemplate: "telecom" },
  FIDO: { canonical: "Fido", category: "TELECOM", descriptionTemplate: "telecom" },
  KOODO: { canonical: "Koodo", category: "TELECOM", descriptionTemplate: "telecom" },
  VIRGIN: { canonical: "Virgin Mobile", category: "TELECOM", descriptionTemplate: "telecom" },
  "T-MOBILE": { canonical: "T-Mobile", category: "TELECOM", descriptionTemplate: "telecom" },
  VERIZON: { canonical: "Verizon", category: "TELECOM", descriptionTemplate: "telecom" },
  "AT&T": { canonical: "AT&T", category: "TELECOM", descriptionTemplate: "telecom" },
  COMCAST: { canonical: "Comcast", category: "TELECOM", descriptionTemplate: "telecom" },
  TWILIO: { canonical: "Twilio", category: "TELECOM", descriptionTemplate: "telecom" },
  VONAGE: { canonical: "Vonage", category: "TELECOM", descriptionTemplate: "telecom" },
  RINGCENTRAL: { canonical: "RingCentral", category: "TELECOM", descriptionTemplate: "telecom" },

  // ============================================================
  // REPAIRS & MAINTENANCE (8800)
  // ============================================================
  "CANADIAN TIRE": { canonical: "Canadian Tire", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  "HOME DEPOT": { canonical: "Home Depot", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  "THE HOME DEPOT": { canonical: "Home Depot", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  "HOME HARDWARE": { canonical: "Home Hardware", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  LOWES: { canonical: "Lowe's", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  "LOWE'S": { canonical: "Lowe's", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  RONA: { canonical: "RONA", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  MENARDS: { canonical: "Menard's", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },
  "ACE HARDWARE": { canonical: "Ace Hardware", category: "REPAIRS_MAINTENANCE", descriptionTemplate: "hardware_store" },

  // ============================================================
  // ADVERTISING (6000)
  // ============================================================
  "GOOGLE ADS": { canonical: "Google Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "FACEBOOK ADS": { canonical: "Facebook Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "FB ADS": { canonical: "Facebook Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "META ADS": { canonical: "Meta Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "LINKEDIN ADS": { canonical: "LinkedIn Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "TIKTOK ADS": { canonical: "TikTok Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "TWITTER ADS": { canonical: "Twitter Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },
  VISTAPRINT: { canonical: "Vistaprint", category: "ADVERTISING", descriptionTemplate: "advertising" },
  "GOOGLE ADWORDS": { canonical: "Google Ads", category: "ADVERTISING", descriptionTemplate: "advertising" },

  // ============================================================
  // UTILITIES (9500)
  // ============================================================
  ENMAX: { canonical: "ENMAX", category: "UTILITIES", descriptionTemplate: "utilities" },
  EPCOR: { canonical: "EPCOR", category: "UTILITIES", descriptionTemplate: "utilities" },
  ATCO: { canonical: "ATCO", category: "UTILITIES", descriptionTemplate: "utilities" },
  "DIRECT ENERGY": { canonical: "Direct Energy", category: "UTILITIES", descriptionTemplate: "utilities" },
  FORTISALBERTA: { canonical: "FortisAlberta", category: "UTILITIES", descriptionTemplate: "utilities" },
  FORTIS: { canonical: "FortisAlberta", category: "UTILITIES", descriptionTemplate: "utilities" },

  // ============================================================
  // INSURANCE (7600)
  // ============================================================
  "INTACT INSURANCE": { canonical: "Intact Insurance", category: "INSURANCE", descriptionTemplate: "insurance" },
  "CO-OPERATORS": { canonical: "Co-operators", category: "INSURANCE", descriptionTemplate: "insurance" },
  "SUN LIFE": { canonical: "Sun Life", category: "INSURANCE", descriptionTemplate: "insurance" },
  MANULIFE: { canonical: "Manulife", category: "INSURANCE", descriptionTemplate: "insurance" },
  "GREAT-WEST": { canonical: "Great-West Life", category: "INSURANCE", descriptionTemplate: "insurance" },
  "STATE FARM": { canonical: "State Farm", category: "INSURANCE", descriptionTemplate: "insurance" },
  GEICO: { canonical: "GEICO", category: "INSURANCE", descriptionTemplate: "insurance" },

  // ============================================================
  // PROFESSIONAL FEES (8700)
  // ============================================================
  "H&R BLOCK": { canonical: "H&R Block", category: "PROFESSIONAL_FEES", descriptionTemplate: "professional_fees" },
  TURBOTAX: { canonical: "TurboTax", category: "PROFESSIONAL_FEES", descriptionTemplate: "professional_fees" },
  WEALTHSIMPLE: { canonical: "Wealthsimple Tax", category: "PROFESSIONAL_FEES", descriptionTemplate: "professional_fees" },

  // ============================================================
  // VEHICLE (9700)
  // ============================================================
  "CALGARY PARKING": { canonical: "Calgary Parking", category: "VEHICLE", descriptionTemplate: "vehicle" },
  CALGPARKAUTH: { canonical: "Calgary Parking Authority", category: "VEHICLE", descriptionTemplate: "vehicle" },
  IMPARK: { canonical: "Impark", category: "VEHICLE", descriptionTemplate: "vehicle" },
  EASYPARK: { canonical: "EasyPark", category: "VEHICLE", descriptionTemplate: "vehicle" },
  "JIFFY LUBE": { canonical: "Jiffy Lube", category: "VEHICLE", descriptionTemplate: "vehicle_maintenance" },
  "CANADIAN TIRE AUTO": { canonical: "Canadian Tire Auto", category: "VEHICLE", descriptionTemplate: "vehicle_maintenance" },
  "KAL TIRE": { canonical: "Kal Tire", category: "VEHICLE", descriptionTemplate: "vehicle_maintenance" },

  // ============================================================
  // RENT (8720)
  // ============================================================
  REGUS: { canonical: "Regus", category: "RENT", descriptionTemplate: "rent" },
  WEWORK: { canonical: "WeWork", category: "RENT", descriptionTemplate: "rent" },
  INDUSTRIOUS: { canonical: "Industrious", category: "RENT", descriptionTemplate: "rent" },

  // ============================================================
  // COURIER / SHIPPING (6550)
  // ============================================================
  FEDEX: { canonical: "FedEx", category: "COURIER", descriptionTemplate: "shipping" },
  UPS: { canonical: "UPS", category: "COURIER", descriptionTemplate: "shipping" },
  "CANADA POST": { canonical: "Canada Post", category: "COURIER", descriptionTemplate: "shipping" },
  PUROLATOR: { canonical: "Purolator", category: "COURIER", descriptionTemplate: "shipping" },
  DHL: { canonical: "DHL", category: "COURIER", descriptionTemplate: "shipping" },
  USPS: { canonical: "USPS", category: "COURIER", descriptionTemplate: "shipping" },

  // ============================================================
  // INTEREST & BANK CHARGES (7700)
  // ============================================================
  "PURCHASE INTEREST": { canonical: "Purchase Interest", category: "BANK_CHARGES", descriptionTemplate: "bank_charges" },
  "CASH ADVANCE INTEREST": { canonical: "Cash Advance Interest", category: "BANK_CHARGES", descriptionTemplate: "bank_charges" },
  "ANNUAL FEE": { canonical: "Annual Fee", category: "BANK_CHARGES", descriptionTemplate: "bank_charges" },
  "PLAN FEE": { canonical: "Plan Fee", category: "BANK_CHARGES", descriptionTemplate: "bank_charges" },
  "SERVICE CHARGE": { canonical: "Service Charge", category: "BANK_CHARGES", descriptionTemplate: "bank_charges" },

  // ============================================================
  // CREDIT CARD CHARGES (6600)
  // ============================================================
  "E-TRANSFER": { canonical: "E-Transfer", category: "CREDIT_CARD_CHARGES", descriptionTemplate: "credit_card_charges" },
  "INTERAC E-TRANSFER": { canonical: "Interac E-Transfer", category: "CREDIT_CARD_CHARGES", descriptionTemplate: "credit_card_charges" },
};
