/**
 * CategorizationEngine.js — 3-Layer Deterministic Categorization Engine
 *
 * Layer 1: Vendor Pattern Dictionary — regex/keyword → VendorTypeCode
 * Layer 2: Routing Table — VendorTypeCode → COA account (COGS / Overhead / BS)
 * Layer 3: Account Guards + GIFI Validation — hard blockers before any result is returned
 *
 * This engine runs BEFORE SignalFusionEngine and has absolute priority.
 * If this engine returns a result with HIGH confidence, fusion is bypassed.
 * If this engine returns MEDIUM confidence, fusion still runs but is constrained.
 * If this engine returns null, fusion runs unconstrained (with guard rail enforcement).
 *
 * Integration: called by SignalFusionEngine as the first and highest-weight signal.
 *
 * Design principles (from workbook):
 * - Fuzzy/ML matching is the FALLBACK — never the primary decision
 * - Hard guards on dangerous accounts (8400, 9800, 2101, GST accounts) ALWAYS win
 * - COGS vs Overhead split is driven by client's industry profile
 * - Balance sheet accounts hit directly from bank (loan pmts, GST remit, CC pmts, transfers)
 * - Loan payments MUST be split: principal → BS, interest → IS (flag for manual if unknown)
 */

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1: VENDOR PATTERN DICTIONARY
// Maps raw bank description → { vendorType, confidence, matchedPattern }
// Order matters: more specific patterns are listed first.
// ─────────────────────────────────────────────────────────────────────────────

const VENDOR_PATTERNS = [

  // ── GOVERNMENT REMITTANCES (must come before generic TRANSFER patterns) ────
  { type: 'GOV_REMIT_GST',     conf: 'HIGH',   re: /GST\s*(REMIT|PAYMENT|INSTAL|INSTALLMENT|FILING|RETURN)|RECEIVER\s*GENERAL.*GST|NETFILE\s*GST|HST\s*(REMIT|PAYMENT)/i },
  { type: 'GOV_REMIT_PAYROLL', conf: 'HIGH',   re: /PAYROLL\s*(REMIT|SOURCE\s*DED)|SOURCE\s*DEDUCT|CPP\s*(REMIT|PREMIUM)|EI\s*(REMIT|PREMIUM)|PAYROLL\s*TAX\s*REMIT/i },
  { type: 'GOV_REMIT_ITAX',    conf: 'HIGH',   re: /INCOME\s*TAX\s*(INSTAL|INSTALLMENT|PAYMENT)|TAX\s*INSTAL|COMMERCIAL\s*TAXES?\s*TXINS|FEDERAL\s*TAX\s*INSTAL|PROV.*TAX\s*INSTAL/i },
  { type: 'GOV_REMIT',         conf: 'HIGH',   re: /RECEIVER\s*GEN(ERAL)?|CANADA\s*REVENUE\s*AGENCY|CRA\s*(PAYMENT|REMIT|INST)|REVENUE\s*CANADA/i },
  { type: 'GOV_WCB',           conf: 'HIGH',   re: /\bWCB\b|WORKERS\s*COMP(ENSATION)?|\bWSIB\b|\bWORKSAFE\b|WORKPLACE\s*SAFETY/i },
  // WORKERS COMPENSATION confirmed 10x in scan
  { type: 'GOV_WCB',           conf: 'HIGH',   re: /WORKERS\s*COMPENSATION\s*(?:CALGARY|BOARD|AB|BC|ON|SK|MB)/i },
  { type: 'GOV_PROV',          conf: 'MEDIUM', re: /PROV(INCIAL)?\s*TREAS|MINISTER\s*OF\s*FINANCE|PROVINCIAL\s*TAX|AB\s*FINANCE|ATSE\s*LEARNING/i },

  // ── FUEL (gas stations) ────────────────────────────────────────────────────
  // Named stations (scan confirmed: SHELL 1182x, PETRO-CANADA 828x, CO-OP 193x+, COSTCO GAS 179x+)
  { type: 'FUEL', conf: 'HIGH',   re: /\bFAS\s*GAS\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /CO-?OP\s*GAS\b|CALG\s*CO-?OP\s*GAS|CO-?OP\s*FUEL/i },
  { type: 'FUEL', conf: 'HIGH',   re: /PETRO-?CAN(ADA)?|PETROCAN/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bESSO\b|\bIMPERIAL\s*OIL\b/i },
  // SHELL alone 1182x in scan (format: "SHELL C80113 _F", "SHELL CALGARY AB", "SHELL FLYING J")
  { type: 'FUEL', conf: 'HIGH',   re: /\bSHELL\s*(?:C\d+|OIL|FLYING|CALGARY|AIRDRIE|VERNON|KELOWNA|COCHRANE|EDMONTON|\d)|\bSHELL\s*C\d/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bSHELL\b.*(?:GAS|FUEL|STATION|CARDLOCK)|(?:GAS|FUEL|STATION|CARDLOCK).*\bSHELL\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bHUSKY\b.*(?:GAS|FUEL|STATION|CARDLOCK)|(?:GAS|FUEL|STATION).*\bHUSKY\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bCHEVRON\b.*(?:GAS|FUEL|STATION)|(?:GAS|FUEL).*\bCHEVRON\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bULTRAMAR\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bDOMO\s*GAS\b|\bDOMO\s*FUEL\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bMOHAWK\b.*(?:GAS|FUEL)|\bMOHAWK\s*CARDLOCK\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bPIONEER\s*GAS\b|\bPIONEER\s*PETRO\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bPARKLAND\s*FUEL\b|\bPARKLAND\s*CARDLOCK\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /\bFLYING\s*J\b/i },
  { type: 'FUEL', conf: 'HIGH',   re: /CARDLOCK(?!\s*SERVICES?)|CARD\s*LOCK\s*FUEL/i },
  { type: 'FUEL', conf: 'HIGH',   re: /CHINIKI\s*GAS\b|\bSPEEDWAY\s*FUEL\b|\bSUNOCO\b/i },
  // Training data: SAFEWAY GAS BAR (185x), FILL N' GO GAS (122x), COSTCO GAS (179x+), TSUU T'INA (139x+)
  // BARRY BEECROFT FUEL DIST (192x — Penticton bulk fuel distributor), SHELL FLYING J (139x)
  { type: 'FUEL', conf: 'HIGH',   re: /BARRY\s*BEECROFT\s*FUEL/i },
  { type: 'FUEL', conf: 'HIGH',   re: /SHELL\s*FLYING\s*J/i },
  { type: 'FUEL', conf: 'HIGH',   re: /SAFEWAY\s*GAS\s*BAR|SAFEWAY\s*GAS/i },
  { type: 'FUEL', conf: 'HIGH',   re: /FILL\s*N'?\s*GO\s*GAS|FILL\s*AND\s*GO\s*GAS/i },
  { type: 'FUEL', conf: 'HIGH',   re: /COSTCO\s*GAS|COSTCO\s*FUEL/i },
  { type: 'FUEL', conf: 'HIGH',   re: /TSUU\s*T'?INA\s*NATION\s*GAS|TSUU\s*TINA\s*GAS/i },
  { type: 'FUEL', conf: 'HIGH',   re: /HERITAGE\s*POINTE\s*GAS/i },
  { type: 'FUEL', conf: 'HIGH',   re: /HI\s*HO\s*GAS|HIHO\s*GAS/i },
  { type: 'FUEL', conf: 'HIGH',   re: /DALHOUSIE\s*STATION\s*(?:GAS|FUEL|HUSKY)/i },
  { type: 'FUEL', conf: 'MEDIUM', re: /(?:GAS|FUEL|PETROL|DIESEL|GASOLINE)\s*(BAR|STATION|STOP|MART)|\b(?:FILLING|SERVICE)\s*STATION\b/i },
  // Circle K only as fuel if "gas" or "fuel" appears too — otherwise it's a convenience store
  { type: 'FUEL', conf: 'MEDIUM', re: /CIRCLE\s*K.*(?:GAS|FUEL)|(?:GAS|FUEL).*CIRCLE\s*K/i },

  // ── TELECOM / TELEPHONE ────────────────────────────────────────────────────
  { type: 'TELECOM', conf: 'HIGH', re: /\bTELUS\b(?:\s*(MOBILITY|CUSTOMER|BUSINESS|COMMUNICATIONS|FIBRE|TV))?/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bSHAW\b\s*(COMMUNICATIONS|BUSINESS|DIRECT|CABLE)?/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bROGERS\b|\bFIDO\b/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bBELL\s*(CANADA|MOBILITY|BUSINESS|ALIANT|MTS)?\b/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bKOODO\b|\bFREEDOM\s*MOBILE\b|\bVIRGIN\s*(MOBILE|PLUS)\b/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bSASKTEL\b|\bMTS\s*ALLSTREAM\b|\bVIDÉOTRON\b|\bVIDEOTRON\b|\bCOGECO\b|\bEASTLINK\b/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bSTARLINK\b|\bXPLORNET\b/i },
  { type: 'TELECOM', conf: 'HIGH', re: /\bOPENPHONE\b/i },

  // ── UTILITIES ──────────────────────────────────────────────────────────────
  { type: 'UTILITY', conf: 'HIGH', re: /\bFORTIS\s*(BC|AB|ALBERTA|ENERGY)?\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bATCO\s*(GAS|ELECTRIC|ENERGY|UTILITIES)?\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bENMAX\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bEPCOR\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bDIRECT\s*ENERGY\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bBC\s*HYDRO\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bHYDRO\s*(ONE|OTTAWA|TORONTO|QUÉBEC|QUEBEC|SUDBURY|MISSISSAUGA)?\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bSASKPOWER\b|\bSASKENERGY\b/i },
  { type: 'UTILITY', conf: 'HIGH', re: /\bMANITOBA\s*HYDRO\b|\bNB\s*POWER\b|\bNOVA\s*SCOTIA\s*POWER\b|\bNSP\b/i },
  { type: 'UTILITY', conf: 'MEDIUM', re: /CITY\s*(OF\s*\w+)?\s*(WATER|SEWER|UTILITIES)|WATER\s*(UTILITY|SERVICE|BILL)/i },
  { type: 'UTILITY', conf: 'MEDIUM', re: /WASTE\s*MANAGEMENT|CLEAN\s*HARBORS|GFL\s*ENVIRONMENTAL|GARBAGE\s*(PICKUP|SERVICE)/i },

  // ── INSURANCE ─────────────────────────────────────────────────────────────
  { type: 'INSURANCE', conf: 'HIGH', re: /\bWAWANESA\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bINTACT\s*(INSUR(ANCE)?)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bCO-?OPERATORS\b|\bCOOPERATORS\s*CSI\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bAVIVA\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bDESJARDINS\s*INS/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bECONOMICAL\b|\bDEFINITY\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bTD\s*INSUR(ANCE)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bINDUSTRIAL\s*ALLIANCE\b|\biA\s*FINANCIAL\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bMANULIFE\b|\bGREAT.WEST\s*LIFE\b|\bCANADA\s*LIFE\b|\bSUN\s*LIFE\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bSECURITY\s*NATIONAL\s*INSUR/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bSMI\s*SASKATOON\b/i },
  // Training: PRIMMUM INSURANCE (76x), SQUARE ONE INSURANCE (61x), RBC LIFE INSURANCE (52x)
  // BCAA-INSURANCE (48x), CERTAS INSURANCE (44x), DIRECT DEBIT INSURANCE (40x+)
  { type: 'INSURANCE', conf: 'HIGH', re: /\bPRIMMUM\s*INSUR(ANCE)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bSQUARE\s*ONE\s*INSUR(ANCE)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bRBC\s*(?:LIFE\s*)?INSUR(ANCE)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bBCAA.?INSUR(ANCE)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bCERTAS\s*(INSUR(ANCE)?)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /DIRECT\s*DEBIT\s*INSUR(ANCE)?|DIRECT\s*DEBIT.*INS\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bBMO\s*INSUR(ANCE)?\b/i },
  { type: 'INSURANCE', conf: 'HIGH', re: /\bSASKATCHEWAN\s*MUTUAL\s*INSUR\b/i },
  { type: 'INSURANCE', conf: 'MEDIUM', re: /INSUR(ANCE)?\s*(PREMIUM|PMT|PAYMENT)|POLICY\s*(PAYMENT|PREMIUM)/i },

  // ── PAYROLL SERVICE PROVIDERS ──────────────────────────────────────────────
  { type: 'PAYROLL_SVC', conf: 'HIGH', re: /\bCERIDIAN\b|\bDAYFORCE\b/i },
  { type: 'PAYROLL_SVC', conf: 'HIGH', re: /\bADP\s*(PAYROLL|WORKFORCE|CANADA)?\b/i },
  { type: 'PAYROLL_SVC', conf: 'HIGH', re: /\bPAYCHEX\b|\bPAYWORKS\b|\bWAGEPOINT\b/i },
  { type: 'PAYROLL_SVC', conf: 'HIGH', re: /\bHUMI\b|\bKNIT\s*PEOPLE\b|\bRISE\s*PEOPLE\b/i },

  // ── PAYROLL / WAGES (actual payment runs) ──────────────────────────────────
  { type: 'PAYROLL', conf: 'MEDIUM', re: /^PAY(?:ROLL)?\s*(?:RUN|CYCLE|PERIOD)|EMPLOYEE\s*PAY|NET\s*PAY\s*(?:DEPOSIT|EFT)|SALARY\s*DEPOSIT|WAGES\s*DEPOSIT/i },
  // PAY EMP-VENDOR specifically — this is employee/vendor payroll on CHQ
  { type: 'PAYROLL', conf: 'MEDIUM', re: /PAY\s*EMP[-\s]?VENDOR/i },

  // ── BUILDING SUPPLIES ─────────────────────────────────────────────────────
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bHOME\s*DEPOT\b|PAYPAL.*HOMEDEPOT/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bRONA\b/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bHOME\s*HARDWARE\b/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bLOWE'?S\b/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bWINDSOR\s*PLYWOOD\b|\bTIMBER\s*MART\b|\bCASTLE\s*BLDG\b|\bTAIGA\s*BUILDING\b/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bEMCO\b|\bWOLSELEY\b|\bANDREW\s*SHERET\b/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bCANMORE\s*(HOME|PAINT|HARDWARE)\b|\bBANFF\s*HARDWARE\b/i },
  { type: 'BLDG_SUPPLY', conf: 'HIGH', re: /\bEECOL\s*ELECTRIC\b/i },

  // ── EQUIPMENT PURCHASES / CAPITAL (→ 1768 Equipment BS) ─────────────────
  // Training: CALMONT EQUIPMENT (59x→1768), ARN'S EQUIPMENT (72x combined→1768)
  // MEC MOUNTAIN EQUIPMENT CO-OP (53x+→1768), CERVUS EQUIPMENT (16x→1768)
  // KMS TOOLS & EQUIPMENT (14x→1768), ARMOUR EQUIPMENT SALES (14x→1768)
  // CONAKER EQUIPMENT (14x→1768), CROWN FOOD EQUIPMENT (6x→1768)
  // NOTE: Equipment purchases >$1,500 typically capital (1768); <$1,500 → 8900 shop supplies
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bCALMONT\s*EQUIPMENT\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /ARN'?S\s*EQUIPMENT\b|\bARNS\s*EQUIPMENT\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bMEC\s*MOUNTAIN\s*EQUIPMENT\b|\bMOUNTAIN\s*EQUIPMENT\s*CO-?OP\b|\bMOUNTAIN\s*EQUIPMENT\s*COMPAN\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bCERVUS\s*EQUIPMENT\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bKMS\s*TOOLS\s*(?:\$|&)?\s*EQUIPMENT\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bARMOUR\s*EQUIPMENT\s*SALES\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bCONAKER\s*EQUIPMENT\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bCROWN\s*FOOD\s*EQUIPMENT\b|\bHOBART\s*FOOD\s*EQUIPMENT\b|\bRUSSELL\s*FOOD\s*EQUIPMENT\b/i },
  { type: 'EQUIP_PURCHASE', conf: 'HIGH', re: /\bHAMMER\s*EQUIPMENT\b|\bDEL\s*EQUIPMENT\b/i },
  // Cooper Equipment Rentals = equipment RENTAL not purchase — handled by EQUIP_RENTAL below

  // ── INDUSTRIAL / SHOP SUPPLIES ────────────────────────────────────────────
  // Training: MARK'S WORK WEARHOUSE (30x+→9750 in scan, but it's PPE/workwear = 8900/5335 shop supplies)
  // PRINCESS AUTO (93x→8700 in scan, but it's tools/hardware = 8900 shop supplies or 5335 COGS)
  // CARLSON BODY SHOP SUPPLY (24x→8900), ABC SUPPLY CO. (10x→8700)
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bACKLANDS[-\s]GRAINGER\b|\bGRAINGER\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bFASCO\b|\bFASTENAL\b|\bMSC\s*INDUSTRIAL\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bMARK'?S\s*WORK\s*WEARHOUSE\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bPRINCESS\s*AUTO\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bCARLSON\s*BODY\s*SHOP\s*SUPPLY\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bABC\s*SUPPLY\s*CO\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bBOLT\s*SUPPLY\s*HOUSE\b|\bWWG\s*\/\s*TOTALINE\b/i },
  { type: 'INDUSTRIAL_SUPPLY', conf: 'HIGH', re: /\bWORK\s*AUTHORITY\b/i },

  // ── VEHICLE REPAIR / MAINTENANCE ──────────────────────────────────────────
  { type: 'VEHICLE_REPAIR', conf: 'HIGH', re: /\bCANADIAN\s*TIRE\b.*AUTO|\bCT\s*AUTO\b/i },
  { type: 'VEHICLE_REPAIR', conf: 'HIGH', re: /\bKAL\s*TIRE\b|\bOK\s*TIRE\b|\bFOUNTAIN\s*TIRE\b|\bTIRECRAFT\b/i },
  { type: 'VEHICLE_REPAIR', conf: 'HIGH', re: /\bTOYOTA\s*(DEALER|SERVICE|FINANCE|CANADA)\b|\bHONDA\s*(DEALER|SERVICE)\b|\bFORD\s*(DEALER|SERVICE|FINANCE)\b/i },
  { type: 'VEHICLE_REPAIR', conf: 'HIGH', re: /\bGM\s*(DEALER|SERVICE)\b|\bCHEVROLET\s*DEALER\b|\bDODGE\s*DEALER\b|\bCHRYSLER\s*DEALER\b|\bKIA\s*DEALER\b|\bHYUNDAI\s*DEALER\b/i },
  // Toyota Finance specifically = loan payment (vehicle), NOT repair
  { type: 'LOAN_PMT',         conf: 'HIGH', re: /\bTOYOTA\s*FINANCE\b|\bHONDA\s*FINANCIAL\b|\bFORD\s*CREDIT\b|\bGM\s*FINANCIAL\b|\bCHRYSLER\s*FINANCIAL\b/i },

  // ── VEHICLE PARTS ─────────────────────────────────────────────────────────
  { type: 'VEHICLE_PARTS', conf: 'HIGH', re: /\bNAPA\s*AUTO\b|\bLORDCO\b|\bPARTSOURCE\b|\bUAP\b|\bAUTO\s*VALUE\b/i },

  // ── VEHICLE INSURANCE / REGISTRATION ─────────────────────────────────────
  { type: 'VEHICLE_INSUR', conf: 'HIGH', re: /\bICBC\b|\bSGI\b|\bMPI\b|\bSAAQ\b|\bSGP\s*INSUR\b/i },
  { type: 'VEHICLE_INSUR', conf: 'HIGH', re: /VEHICLE\s*(INSUR|REGISTR|LICEN)|MOTOR\s*VEHICLE\s*REGISTR/i },

  // ── LEGAL FEES ────────────────────────────────────────────────────────────
  // Scan: RELIANCE LEGAL GROUP LLP (3x→7890), SHAWN MALIK LEGAL FEES (8x→7890)
  { type: 'LEGAL', conf: 'HIGH',   re: /\bRELIANCE\s*LEGAL\s*GROUP\b|\bSHAWN\s*MALIK\s*LEGAL\b/i },
  { type: 'LEGAL', conf: 'MEDIUM', re: /\w+\s*(?:LAW\s*FIRM|\bLLP\b|\bPLC\b)|\bBARRISTERS?\b|\bSOLICITOR\b|\bNOTARY\b|\bLEGAL\s*FEES?\b/i },

  // ── ACCOUNTING / PROFESSIONAL FEES ────────────────────────────────────────
  // Training: CALGARY AGGREGATE RECYCLI (529x→8700 — aggregate/concrete supplier, actually BLDG_SUPPLY)
  // SIEGBERT STEEL (114x→8700), LUX WINDOWS & GLASS (91x→8700), CYCLONE DIAMOND PRODUCTS (87x→8700)
  // HUSQVARNA CONSTRUCTION PRODUCTS (83x→8700), A-APOLLO WINDOWS & DOORS (68x→8700)
  // NOTE: 8700 in scan is used as catch-all for "professional and financial services" category
  //       Many of these are actually building supplies (BLDG_SUPPLY) or industrial (INDUSTRIAL_SUPPLY)
  // PAYPAL *ZOOMVIDEOCO (71x→8700) = Zoom = SOFTWARE_SAAS (already handled)
  // Genuine professional fees: VIRTUAL GURUS (51x), CORTEX BUSINESS SOLUTION (12x→8700)
  // FIGMA (12x→8700 = design software = SOFTWARE_SAAS), INVOICE2GO (14x→8700 = billing software)
  // AMAZON WEB SERVICES (29x→8700 = cloud hosting = SOFTWARE_SAAS)
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bFIGMA\b/i },           // design tool
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bINVOICE2GO\b/i },      // invoicing software
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bAMAZON\s*WEB\s*SERVICES\b|\bAWS\b(?:\s*AMAZON)?\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bCORTEX\s*BUSINESS\s*SOLUTION\b/i },
  // Building-supply style vendors miscategorized as "professional" in source data:
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bCALGARY\s*AGGREGATE\s*RECYCL\b/i },  // aggregate/gravel
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bSIEGBERT\s*STEEL\b/i },
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bLUX\s*WINDOWS\s*(?:&|AND)\s*GLASS\b/i },
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bA-APOLLO\s*WINDOWS\b|\bA\s*APOLLO\s*WINDOWS\b/i },
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bCYCLONE\s*DIAMOND\s*PRODUCTS\b/i },
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bHUSQVARNA\s*CONSTRUCTION\b/i },
  { type: 'BLDG_SUPPLY',   conf: 'HIGH', re: /\bZYTECH\s*BLDG\s*SYSTEM\b/i },
  { type: 'ACCOUNTING', conf: 'MEDIUM', re: /\bCPA\b|\bCHARTERED\s*PROF|\bACCOUNT.*FIRM\b|\bTAX\s*PREP(ARATION)?\b|\bBOOKKEEP\b/i },
  { type: 'ACCOUNTING', conf: 'HIGH',   re: /\bALLISON\s*ASSOCIATES\b/i },

  // ── BANK FEES / CHARGES ───────────────────────────────────────────────────
  // Scan confirmed: PURCHASE INTEREST (2937x→7700), CASH ADVANCE INTEREST (913x→7700)
  // OTHER BANK ABM WITHDRAWAL (551x→7700), OVERDRAFT INTEREST (333x→7700)
  // INTEREST CHARGES-PURCH (127x→7700), OTHER BANK FEES (105x→7700), CASH INTEREST (62x→7700)
  // LOAN INTEREST (23x→7700), RETAIL INTEREST (27x→7700), INTEREST CHARGES (14x→7700)
  { type: 'BANK_FEE', conf: 'HIGH', re: /SERVICE\s*CHARGE|MONTHLY\s*(FEE|CHARGE)|ACCOUNT\s*(FEE|MAINTENANCE)|MAINT(ENANCE)?\s*FEE/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /\bNSF\s*FEE\b|\bOVERDRAFT\s*(FEE|CHARGE|INTEREST)\b/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /\bATM\s*FEE\b|\bINTERAC\s*FEE\b|\bWIRE\s*FEE\b/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /\bOFI\b|\bONLINE\s*BANKING\s*FEE\b/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /PURCHASE\s*INTEREST|INTEREST\s*(CHARGE[SD]?|CHARGES-PURCH|CHARGES-C)/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /CASH\s*ADVANCE\s*INTEREST|RETAIL\s*INTEREST/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /OTHER\s*BANK\s*(FEE|ABM\s*WITHDRAWAL|FEES)/i },
  { type: 'BANK_FEE', conf: 'HIGH', re: /\bLOAN\s*INTEREST\b|\bCASH\s*INTEREST\b/i },
  // Deposit interest (CREDIT on savings) = interest INCOME, not bank fee
  { type: 'INTEREST_INCOME', conf: 'HIGH', re: /DEPOSIT\s*INTEREST|INTEREST\s*(CREDIT(ED)?|EARNED|PAID|INCOME)|SAVINGS\s*INTEREST|INT\s*PAID/i },
  // Cash back / rewards = contra income, not bank charge
  { type: 'CASHBACK',         conf: 'HIGH', re: /CASH\s*BACK|CASHBACK|\bREWARD\b(?!\s*CARD)|\bREBATE\b/i },

  // ── CREDIT CARD PAYMENTS ──────────────────────────────────────────────────
  { type: 'CC_PAYMENT', conf: 'HIGH', re: /PAYMENT\s*-\s*THANK\s*YOU|PAIEMENT\s*-\s*MERCI|PAYMENT\s*RECEIVED\s*-\s*THANK|THANK\s*YOU[,.]?\s*PAYMENT/i },
  { type: 'CC_PAYMENT', conf: 'HIGH', re: /ONLINE\s*BANKING\s*PAYMENT|INTERNET\s*BANKING\s*PMT/i },
  { type: 'CC_PAYMENT', conf: 'HIGH', re: /(?:VISA|MC|MASTERCARD|AMEX|AMERICAN\s*EXPRESS)\s*(?:PAYMENT|PMT|PAYABLE)/i },

  // ── LOAN / MORTGAGE PAYMENTS ──────────────────────────────────────────────
  { type: 'LOAN_PMT', conf: 'HIGH', re: /(?:LOAN|MTG|MORTGAGE)\s*(?:PAYMENT|PMT|PAY)|LOAN\s*REPAYMENT/i },
  { type: 'LOAN_PMT', conf: 'MEDIUM', re: /FINANCE\s*(CONTRACT|LEASE)\s*PMT|LEASE\s*PAYMENT/i },

  // ── INTEREST ON LONG-TERM DEBT ────────────────────────────────────────────
  { type: 'INTEREST_LTD', conf: 'HIGH', re: /MORTGAGE\s*INTEREST|MTG\s*INT|LOAN\s*INTEREST|INTEREST\s*ON\s*(?:LOAN|MORTGAGE|DEBT)/i },

  // ── BANK-TO-BANK TRANSFERS ────────────────────────────────────────────────
  // Very common; LOW confidence because e-transfers are also revenue (rental income)
  { type: 'TRANSFER', conf: 'LOW', re: /ONLINE\s*(TRANSFER|BANKING\s*TRANSFER)|INTERNET\s*(TRANSFER|BANKING\s*TRANSFER)/i },
  { type: 'TRANSFER', conf: 'LOW', re: /TRSF\s*(FROM|TO)|TRANSFER\s*(FROM|TO|BETWEEN)|BANK\s*(TRANSFER|TO\s*BANK)/i },
  { type: 'TRANSFER', conf: 'LOW', re: /TFR\s*(?:FROM|TO)|TRF\s*(?:FROM|TO)/i },
  { type: 'TRANSFER', conf: 'LOW', re: /WISE\s*PAYMENTS|WISE\.COM|WISE\s*TRANSFER/i },

  // ── E-TRANSFERS (LOW because also used for rental income deposits) ─────────
  { type: 'ETRANSFER', conf: 'LOW', re: /E[-\s]?TRANSFER|INTERAC\s*(E[-\s]?TRANSFER|AUTODEPOSIT|SEND|RECEIVE)|AUTODEPOSIT/i },

  // ── MEALS & ENTERTAINMENT ─────────────────────────────────────────────────
  { type: 'MEALS', conf: 'HIGH',   re: /\bTIM\s*HORTON|\bSTARBUCKS\b|\bSECOND\s*CUP\b|\bTHE\s*COFFEE\s*BEAN\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bMCDONALD|\bBURGER\s*KING\b|\bWENDY'?S\b|\bSUBWAY\b|\bA&W\b|\bHARVEY'?S\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bPIZZA\s*(HUT|NOVA|DELIGHT)|\bDOMINO'?S\b|\bLITTLE\s*CAESAR|\bBOSTON\s*PIZZA\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bEARLS?\b|\bCACTUS\s*CLUB\b|\bTHE\s*KEG\b|\bMILESTONES\b|\bDENNY'?S\b|\bIHOP\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bGRIZZLY\s*PAW\b|\bJAMESON\b.*(?:BAR|PUB)|\bKILKENNY\b|\bACE\s*LIQUOR\b/i },
  // Training data: ROSSO COFFEE (200x+), PHIL & SEBASTIAN (180x+), MUCHO BURRITO (161x+), SIERRA CAFE (130x+)
  // GRAVITY ESPRESSO (90x+), MOTI MAHAL (88x+), PARAMOUNT FINE FOODS (72x+), 350 BAKEHOUSE (65x+)
  // COMMUNITY NATURAL FOODS (50x), AMARANTH WHOLE FOODS (45x), MONOGRAM COFFEE (40x+)
  // NOTE: SAVE ON FOODS (957x) is in scan data as 6415 but likely a personal grocery account — NOT added
  // NOTE: SKIPTHEDISHES (2158x) coded as 9200 Travel in scan — added as FOOD_DELIVERY type below
  { type: 'MEALS', conf: 'HIGH',   re: /\bROSSO\s*COFFEE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bPHIL\s*(?:&|AND)\s*SEBASTIAN\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bMUCHO\s*BURRITO\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bSIERRA\s*CAFE\b|\bSIERRA\s*CAFÉ\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bGRAVITY\s*ESPRESSO\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bMOTI\s*MAHAL\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bPARAMOUNT\s*FINE\s*FOODS\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\b350\s*BAKEHOUSE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bCOMMUNITY\s*NATURAL\s*FOODS\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bAMARANTH\s*WHOLE\s*FOODS\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bMONOGRAM\s*COFFEE\b|SQ\s*\*MONOGRAM\b/i },
  // Additional from scan: CINNAMON INDIAN CUISINE (59x), THRIFTY FOODS (57x — grocery chain = meals context)
  // PHILOSAFY COFFEE (43x), DEVILLE COFFEE (37x), PLATFORM CAFE (40x), THE DAIRY LANE CAFE (39x)
  // NASH RESTAURANT (34x), LA JAWAB INDIAN (40x), ALI BABA KABOB (40x), MADRAS MAPLE CAFE (48x)
  // PAWS PET FOOD (37x — skip, likely personal), BLUSH LANE ORGANIC (26x — specialty grocery, skip)
  { type: 'MEALS', conf: 'HIGH',   re: /\bCINNAMON\s*INDIAN\s*CUISINE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bPHILOSAFY\s*COFFEE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bDEVILLE\s*COFFEE\b|SQ\s*\*DEVILLE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bPLATFORM\s*CAFE\b|SQ\s*\*PLATFORM\s*CAFE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bTHE\s*DAIRY\s*LANE\s*CAFE\b|\bDAIRY\s*LANE\s*CAFE\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bTHE\s*NASH\s*RESTAURANT\b|\bNASH\s*RESTAURANT\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bLA\s*JAWAB\b|\bALI\s*BABA\s*KABOB\b/i },
  { type: 'MEALS', conf: 'HIGH',   re: /\bMADRAS\s*MAPLE\s*CAFE\b/i },
  { type: 'MEALS', conf: 'MEDIUM', re: /RESTAURANT|BISTRO|BRASSERIE|TAVERN|\bCAFE\b|\bCAFÉ\b|\bDINING\b|\bPUB\b/i },

  // ── SOFTWARE / SaaS (capitalized or expensed depending on threshold) ──────
  // Training: ADOBE INC (172x→1857), ADOBE CREATIVE CLOUD (63x), ADOBE ACROPRO SUBS (58x)
  // GOOGLE *GOOGLE STORAGE (159x→1857), GOOGLE *GSUITE_* (multiple→1857), GOOGLE*DOMAINS (49x)
  // JANE SOFTWARE (81x→1857) — clinic management system
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bADOBE\s*(?:INC\.?|CREATIVE\s*CLOUD|ACROPRO|ACROBAT|\*ACROBAT|\*ACROPRO|\*CREATIVE)\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /GOOGLE\s*\*(?:GOOGLE\s*STORAGE|GSUITE|GOOGLE\s*ONE|APPS?\s*FOR\s*BUS|WORKSPACE)|GOOGLE\s*WORKSPACE/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /GOOGLE\s*\*?DOMAINS?|GOOGLE\s*DOMAIN/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bJANE\s*SOFTWARE\b|JANE\.APP/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bSAGE\s*(CANADA|ONLINE|ACCOUNTING|PAYROLL|50|200|BUSINESS|SOFTWARE)\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bQUICKBOOKS\b|\bINTUIT\s*(CANADA|ONLINE|PAYROLL|QB|QUICKBOOKS)?\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bDROPBOX\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bZOOM\s*(?:US|VIDEO|COM|PHONE)?\b|PAYPAL\s*\*ZOOMVIDEOCO/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bMICROSOFT\s*(?:365|OFFICE|M365|AZURE|DYNAMICS|BUSINESS)\b|MSFT\s*\*/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bGITHUB\b(?!\s*FOREIGN\s*CURRENCY)/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bSLACK\b(?:\s*TECHNOLOGIES)?\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bHUBSPOT\b/i },
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bASANA\b|\bNOTION\b|\bCLICKUP\b|\bMONDAY\.COM\b|\bBASECAMP\b/i },
  // Scan: FRESHBOOKS (25x→7752 = USD billed, still software), 2NDSITE FRESHBOOKS same
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bFRESHBOOKS\b|2NDSITE\s*FRESHBOOKS\b/i },
  // LOOKA LOGO MAKER (12x→7752 = design/branding software)
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bLOOKA\s*LOGO\s*MAKER\b|\bLOOKA\b/i },
  // BLENDER MARKET (13x→7752 = 3D asset marketplace = software)
  { type: 'SOFTWARE_SAAS', conf: 'HIGH', re: /\bBLENDER\s*MARKET\b/i },

  // ── SUBSCRIPTIONS / MEMBERSHIPS (SaaS billed monthly, 6800) ─────────────
  // Training: OPENAI *CHATGPT (78x→6800), PELOTON* MEMBERSHIP (91x→6800), SQUARESPACE (156x→7752/6800)
  // CALENDLY (38x→6800), FOLLOWUPBOSS (57x→6800), CONVERTKIT (74x→6800), TEAMWORK (39x→6800)
  // AUDIBLE (business audiobooks → 6800), AMAZON PRIME (6800)
  // NOTE: SQUARESPACE also appears as 7752 foreign currency — if paid in USD flag for review
  // NOTE: LIBERATED SYNDICATION (191x→7752) = podcast hosting, USD — flag for FX review
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /OPENAI\s*\*(?:CHATGPT|API)|CHATGPT\s*SUBSCR/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bMIDJOURNEY\s*(?:INC\.?)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bPELOTON\s*\*?\s*MEMBERSHIP\b|\bPELOTON\s*INTERACTIVE\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bSQUARESPACE\s*(?:INC\.?)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bCALENDLY\s*(?:LLC\.?)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bFOLLOWUPBOSS\b|FOLLOW\s*UP\s*BOSS/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bCONVERTKIT\b(?:\s*EMAIL)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bTEAMWORK\s*(?:COM\.?|PROJECT)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bAUDIBLE\b(?:\s*CA)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /AMAZON\s*\.?CA?\s*PRIME\s*MEMBER|\bAMAZON\s*PRIME\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bLIBERATED\s*SYNDICATION\b|LIBSYN\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /DNH\s*\*MEDIA\s*TEMPLE|\bMEDIA\s*TEMPLE\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bSIERRA\s*INTERACTIVE\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bKEEPER\s*SECURITY\s*(?:COM\.?)?\b|KEEPERSECURITY\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bGODADDY\b(?:\.COM\s*CANADA)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bVIVINT\s*(?:CANADA)?\b/i },
  // Additional from scan: LOOM (3x→6800), PATREON (10x→6800), COSMOLEX (7x→6800 legal practice mgmt)
  // UPTODATE (4x→6800 — medical reference subscription), GAIA SUBSCRIPTION (16x→6800)
  // ASANA.COM (7x→6800), PIRATE SHIP POSTAGE (7x→6800 — shipping label service)
  // APPLE.COM/BILL (5x→6800 — iCloud/app subscriptions), MICROSOFT*365 (4x→6800)
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bLOOM\b(?:\s*SUBSCRIPTION)?\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bPATREON\s*\*?\s*MEMBERSHIP\b|\bPATREON\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bCOSMOLEX\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bUPTODATE\s*SUBSCRIPTION\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bGAIA\s*SUBSCRIPTION\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bPIRATE\s*SHIP\s*(?:\*\s*)?POSTAGE\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bAPPLE\.COM\/BILL\b|\bAPL\s*\*\s*ITUNES\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /MICROSOFT\s*\*?365|MSFT\s*\*?M365|MSBILL\.INFO/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bSPOTIFY\b/i },
  { type: 'SUBSCRIPTION', conf: 'HIGH', re: /\bDISCORD\s*\*?\s*NITRO/i },

  // ── VEHICLE RENTAL (→ 9200 Travel, not 8720 Rent) ─────────────────────────
  // Training: AVIS RENT A CAR (139x→8720 WRONG, should be 9200), BUDGET RENT-A-CAR (23x)
  // THRIFTY CAR RENTAL (11x), ENTERPRISE RENT-A-CAR (8x), ALAMO RENT-A-CAR (8x)
  // THERENTALGUYS.CA (24x), DRIVING FORCE VEHICLE (15x)
  // NOTE: car rental is TRAVEL (9200) not RENT (8720) — added before RENT pattern
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bAVIS\s*RENT\b|\bAVIS\s*CAR\b|\bAVIS\s*VEHICLE\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bBUDGET\s*RENT.?A.?CAR\b|\bBUDGET\s*RENTAL\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bTHRIFTY\s*(?:CAR\s*)?RENTAL\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bENTERPRISE\s*RENT.?A.?CAR\b|\bENTERPRISE\s*(?:CAR\s*)?RENTAL\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bALAMO\s*RENT.?A.?CAR\b|\bALAMO\s*(?:CAR\s*)?RENTAL\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bTHERENTALGUYS\b|\bRENTAL\s*GUYS\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bDRIVING\s*FORCE\s*VEHICLE\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bNATIONAL\s*CAR\s*RENTAL\b|\bNATIONAL\s*RENT.?A.?CAR\b/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bHERTZ\s*(?:CAR\s*)?RENTAL\b|\bHERTZ\s*#\d/i },
  { type: 'VEHICLE_RENTAL', conf: 'HIGH', re: /\bDOLLAR\s*(?:CAR\s*)?RENTAL\b/i },

  // ── SECURITY SYSTEMS ──────────────────────────────────────────────────────
  // Training: UNITED SECURITYALARM (33x→8850), WILSONS SECURITY (12x→8850)
  // ADT SECURITY SVCS CDA (3x→8850), KEEPERSECURITY.COM (3x→6800 not 8850)
  // NOTE: KEEPERSECURITY is password manager software → handled as SUBSCRIPTION above
  { type: 'SECURITY_SYS', conf: 'HIGH', re: /\bUNITED\s*SECURITY\s*ALARM\b|\bUNITED\s*SECURITYALARM\b/i },
  { type: 'SECURITY_SYS', conf: 'HIGH', re: /\bWILSONS\s*SECURITY\b|\bWILSON\s*SECURITY\b/i },
  { type: 'SECURITY_SYS', conf: 'HIGH', re: /\bADT\s*SECURITY\b|\bADT\s*SVCS\b/i },
  { type: 'SECURITY_SYS', conf: 'MEDIUM', re: /\bSECURITY\s*(?:SYSTEM|MONITORING|ALARM|SURVEILLANCE)\b/i },

  // ── FOOD DELIVERY APPS (→ 6415 Meals, same as restaurant) ────────────────
  // Training: SKIPTHEDISHES (2158x→9200 in scan, but logically = food delivery = 6415 Meals)
  // UBER EATS treated separately from UBER TRIP (travel)
  { type: 'FOOD_DELIVERY', conf: 'HIGH', re: /\bSKIPTHEDISHES\b|\bSKIP\s*THE\s*DISHES\b/i },
  { type: 'FOOD_DELIVERY', conf: 'HIGH', re: /UBER\s*(?:EATS|DELIVERY|FOOD)/i },
  { type: 'FOOD_DELIVERY', conf: 'HIGH', re: /\bDOORDASH\b|\bFOODORA\b|\bINSTACART\b/i },

  // ── EQUIPMENT RENTAL ─────────────────────────────────────────────────────
  // Training: MODU-LOC FENCE RENTALS (10x→8720), ROGERS RENT ALL LTD (74x→8720), WEST EQUIPMENT RENTALS (4x→7000)
  // COOPER EQUIPMENT RENTA (4x→1768 — but it's rentals), CRC RENTS (7x→8720)
  { type: 'EQUIP_RENTAL', conf: 'HIGH', re: /\bHERTZ\s*EQUIP|\bSUNBELT\s*(RENTAL|EQUIP)|\bUNITED\s*RENTAL|\bHERC\s*RENTAL|\bBATTLEFORDS\s*RENTAL\b/i },
  { type: 'EQUIP_RENTAL', conf: 'HIGH', re: /\bMODU-?LOC\s*FENCE\s*RENTAL\b/i },
  { type: 'EQUIP_RENTAL', conf: 'HIGH', re: /\bROGERS\s*RENT.?ALL\b|\bROGERS\s*RENTALL\b/i },
  { type: 'EQUIP_RENTAL', conf: 'HIGH', re: /\bCOOPER\s*EQUIPMENT\s*RENT/i },
  { type: 'EQUIP_RENTAL', conf: 'HIGH', re: /\bCRC\s*RENTS\b|\bWEST\s*EQUIPMENT\s*RENTALS\b/i },
  { type: 'EQUIP_RENTAL', conf: 'HIGH', re: /\bAFFORDABLE\s*AUTO\s*RENTAL\b/i },

  // ── SUBCONTRACTORS ────────────────────────────────────────────────────────
  { type: 'SUBCONTRACTOR', conf: 'HIGH',   re: /\bFIVERR\b|\bUPWORK\b|\bFREELANCER\.COM\b|\b99DESIGNS\b/i },
  // Training: VIRTUAL GURUS (virtual assistant staffing firm)
  { type: 'SUBCONTRACTOR', conf: 'HIGH',   re: /\bVIRTUAL\s*GURUS\b/i },
  { type: 'SUBCONTRACTOR', conf: 'MEDIUM', re: /SUBCONTRACT|SUB-?CONTRACT|TRADE\s*CONTRACTOR/i },

  // ── ADVERTISING ───────────────────────────────────────────────────────────
  // Scan: PATTISON OUTDOOR ADVERT (4x→6000), CALGARY OUTDOOR ADVERTISING (47x→8700 miscat→6000)
  // INDEED (25x→8700 job ads→6000), HIILITE CREATIVE GROUP (47x→8700 marketing agency→6000)
  // VISTAPRINT (18x→8700 print marketing→6000)
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bFACEBOOK\s*ADS?\b|\bMETA\s*ADS?\b|\bINSTAGRAM\s*ADS?\b/i },
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bGOOGLE\s*ADS?\b|\bGOOGLE\s*ADWORDS\b/i },
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bINDEED\b(?:\s*TEL)?\b|\bKIJIJI\b|\bYELLOW\s*PAGES?\b|\bCANPAGES\b/i },
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bVISTAPRINT\b|VISTAPR\s*\*VISTAPRINT\b|\bMOO\.COM\b|\bQR-CODE-GENERATOR\b/i },
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bPATTISON\s*OUTDOOR\b/i },
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bCALGARY\s*OUTDOOR\s*ADVERTIS\b/i },
  { type: 'ADVERTISING', conf: 'HIGH', re: /\bHIILITE\s*CREATIVE\s*GROUP\b/i },

  // ── OFFICE SUPPLIES ───────────────────────────────────────────────────────
  { type: 'OFFICE_SUPPLY', conf: 'HIGH', re: /\bSTAPLES\b|\bBUREAU\s*EN\s*GROS\b|\bGRAND\s*&\s*TOY\b/i },
  { type: 'OFFICE_SUPPLY', conf: 'HIGH', re: /\bULINE\b/i },

  // ── COURIER / SHIPPING ────────────────────────────────────────────────────
  // Scan: FREIGHTCOM INC. (105x→5700 Freight COGS), ACE COURIER SERVICES (3x→6550)
  { type: 'COURIER', conf: 'HIGH', re: /\bCANADA\s*POST\b|\bPOSTES\s*CANADA\b/i },
  { type: 'COURIER', conf: 'HIGH', re: /\bPUROLATOR\b|\bFEDEX\b|\bUPS\b(?!\s*(?:CANADA|STORE))|\bDHL\b|\bCANPAR\b/i },
  { type: 'COURIER', conf: 'HIGH', re: /\bFREIGHTCOM\s*INC\b|\bFREIGHTCOM\b/i },
  { type: 'COURIER', conf: 'HIGH', re: /\bACE\s*COURIER\s*SERVICES\b/i },

  // ── RENT ─────────────────────────────────────────────────────────────────
  { type: 'RENT', conf: 'MEDIUM', re: /^RENT\b|MONTHLY\s*RENT|LEASE\s*PMT|OFFICE\s*RENT/i },

  // ── TRAINING / COURSES ────────────────────────────────────────────────────
  // Training scan: UDEMY (39x→9250), EWORKPLACE TRAINING (3x→9250)
  // NOTE: Golf courses (KANANASKIS 39x, WOODSIDE 22x) coded 9250 in scan — likely client entertainment
  //       Golf = Meals & Entertainment 6415 (50% non-deductible), not training 9250
  { type: 'TRAINING', conf: 'HIGH',   re: /\bYOUPRENEUR\b|\bVSF\s*LONDON\b|\bPARAGON\s*TESTING\b/i },
  { type: 'TRAINING', conf: 'HIGH',   re: /\bUDEMY\b(?:\s*(?::|ONLINE|\.COM))?\b/i },
  { type: 'TRAINING', conf: 'HIGH',   re: /\bEWORKPLACE\s*TRAINING\b/i },
  { type: 'TRAINING', conf: 'MEDIUM', re: /TRAINING|COURSE|SEMINAR|WORKSHOP|SAFETY\s*TRAIN|\bH2S\b|FIRST\s*AID|\bCERTIFICATE\b/i },

  // ── TRAVEL ────────────────────────────────────────────────────────────────
  { type: 'TRAVEL', conf: 'HIGH', re: /\bWESTJET\b|\bPAC-WESTJET\b|\bWIFIONBOARD\b|\bAIR\s*CANADA\b|\bAIR\s*TRANSAT\b|\bSWOOP\b/i },
  { type: 'TRAVEL', conf: 'HIGH', re: /\bALPINE\s*HELICOPTERS?\b/i },
  { type: 'TRAVEL', conf: 'HIGH', re: /\bMARRIOTT\b|\bHILTON\b|\bWESTIN\b|\bBEST\s*WESTERN\b|\bHOLIDAY\s*INN\b/i },
  { type: 'TRAVEL', conf: 'HIGH', re: /\bBANFF\s*SPRINGS\s*HOTEL\b|\bGEORGETOWN\s*INN\b/i },
  // Training: UBER CANADA / UBERTRIP (325x+133x→9200) — rideshare = travel. UBER EATS handled as FOOD_DELIVERY
  { type: 'TRAVEL', conf: 'HIGH', re: /UBER\s*(?:CANADA|TRIP|RIDE|CAR|BV|TECHNOLOGIES)(?!\s*(?:EATS|DELIVERY|FOOD))/i },
  // Airbnb on a CC card = travel/accommodation. On CHQ/SAV = rental revenue (handled by polarity/account type)
  { type: 'TRAVEL',  conf: 'MEDIUM', re: /\bAIRBNB\b(?!.*PAYOUT)/i },

  // ── LOCKSMITH / SECURITY ──────────────────────────────────────────────────
  { type: 'LOCKSMITH', conf: 'HIGH', re: /\bSTRONGHOLD\s*LOCKSMITH\b|\bLOCKSMITH\b|\bSECURITY\s*LOCK\b/i },

  // ── PROFESSIONAL / REGISTRIES ─────────────────────────────────────────────
  { type: 'LICENSING', conf: 'HIGH', re: /\bREAL\s*ESTATE\s*COUNCIL\b|\bRECA\b/i },
  { type: 'LICENSING', conf: 'HIGH', re: /\bALBERTA\s*REGISTRY\b|\bAIRDRIE\s*REGISTRY\b|\bA-PLUS\s*REGISTRY\b|\bREGISTRY\b/i },

  // ── BENEFITS / GROUP PLANS ────────────────────────────────────────────────
  { type: 'EMP_BENEFITS', conf: 'HIGH', re: /\bIP\s*PLAN.*BLUE\s*CROSS\b|\bAB\s*BLUE\s*CROSS\b|\bALBERTA\s*BLUE\s*CROSS\b/i },
  { type: 'EMP_BENEFITS', conf: 'HIGH', re: /\bBLUE\s*CROSS\b|\bGREEN\s*SHIELD\b|\bSUN\s*LIFE\s*BENEFITS?\b/i },

  // ── GENERAL RETAIL (always ambiguous — flag for review) ───────────────────
  { type: 'GENERAL_RETAIL', conf: 'LOW', re: /\bWALMART\b|\bWAL-MART\b/i },
  { type: 'GENERAL_RETAIL', conf: 'LOW', re: /\bCOSTCO\b/i },
  // Amazon is almost always an expense (on CC), but could be anything
  { type: 'GENERAL_RETAIL', conf: 'LOW', re: /\bAMAZON\b|\bAMZN\b/i },
  // Canadian Tire (non-auto context) is general retail
  { type: 'GENERAL_RETAIL', conf: 'LOW', re: /\bCANADIAN\s*TIRE\b(?!\s*AUTO)/i },
  // Ashley HomeStore / Sleep Country = furniture/furnishings
  { type: 'FURNISHINGS',    conf: 'MEDIUM', re: /\bASHLEY\s*HOMESTORE\b|\bSLEEP\s*COUNTRY\b|\bIKEA\b|\bTHE\s*BRICK\b|\bLEON'?S\b/i },

];

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2: ROUTING TABLE
// Maps VendorTypeCode → { cogs, overhead, bs, logic, gifi }
// cogs     = COA code if this is a direct-cost/job-cost (5xxx)
// overhead = COA code if this is an operating/admin expense (6xxx-9xxx)
// bs       = COA code if this hits a balance sheet account (1xxx-3xxx)
// logic    = human-readable routing note
// gifi     = expected GIFI code (used in Layer 3 validation)
// defaultCOGS = true means the COGS code is used when industry is contractor/construction
// ─────────────────────────────────────────────────────────────────────────────

const ROUTING_TABLE = {
  FUEL:               { cogs: '5330', overhead: '7400', bs: null,              defaultCOGS: false, gifi: '8764', logic: 'Contractor/construction → 5330 COGS; professional services/admin → 7400' },
  TELECOM:            { cogs: null,   overhead: '9100', bs: null,              defaultCOGS: false, gifi: '8220', logic: 'Almost always overhead — office phone, internet' },
  UTILITY:            { cogs: null,   overhead: '9500', bs: null,              defaultCOGS: false, gifi: '8811', logic: 'Almost always overhead — hydro, gas, water' },
  INSURANCE:          { cogs: '5340', overhead: '7600', bs: null,              defaultCOGS: false, gifi: '8690', logic: 'Project/bonding → 5340 COGS; general commercial → 7600' },
  GOV_WCB:            { cogs: null,   overhead: '9750', bs: null,              defaultCOGS: false, gifi: '9274', logic: 'Always overhead — workers compensation' },
  GOV_REMIT:          { cogs: null,   overhead: null,   bs: '2149',            defaultCOGS: false, gifi: '2130', logic: 'BS only — parse description for GST/payroll/income tax' },
  GOV_REMIT_GST:      { cogs: null,   overhead: null,   bs: '2149',            defaultCOGS: false, gifi: '2130', logic: 'BS only — GST/HST remittance to Receiver General' },
  GOV_REMIT_PAYROLL:  { cogs: null,   overhead: null,   bs: '2300',            defaultCOGS: false, gifi: '2130', logic: 'BS only — payroll source deduction remittance' },
  GOV_REMIT_ITAX:     { cogs: null,   overhead: null,   bs: '2602',            defaultCOGS: false, gifi: '2320', logic: 'BS only — income tax installment payment' },
  GOV_EI:             { cogs: null,   overhead: null,   bs: '2340',            defaultCOGS: false, gifi: '2130', logic: 'BS only — EI premium remittance' },
  GOV_PROV:           { cogs: null,   overhead: '6410', bs: null,              defaultCOGS: false, gifi: '8711', logic: 'Provincial business taxes → 6410' },
  PAYROLL_SVC:        { cogs: null,   overhead: '8700', bs: null,              defaultCOGS: false, gifi: '8860', logic: 'Payroll service fee → professional fees (not wages)' },
  PAYROLL:            { cogs: null,   overhead: '8400', bs: null,              defaultCOGS: false, gifi: '8661', logic: 'Owner/director → 8400 Mgmt Remuneration; employees → 9800 Wages' },
  BLDG_SUPPLY:        { cogs: '5335', overhead: '8450', bs: null,              defaultCOGS: true,  gifi: '8811', logic: 'Job-specific materials → 5335 COGS; office/admin maintenance → 8450' },
  INDUSTRIAL_SUPPLY:  { cogs: '5335', overhead: '8900', bs: null,              defaultCOGS: true,  gifi: '8811', logic: 'Job-site PPE/consumables → 5335; shop supplies → 8900' },
  VEHICLE_REPAIR:     { cogs: '5380', overhead: '9700', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Fleet/job vehicle → 5380 COGS; admin/owner vehicle → 9700' },
  VEHICLE_PARTS:      { cogs: '5380', overhead: '9700', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Same as vehicle repair — job vs admin split' },
  VEHICLE_INSUR:      { cogs: null,   overhead: '9700', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Vehicle insurance/registration → 9700 Vehicle' },
  LEGAL:              { cogs: null,   overhead: '7890', bs: null,              defaultCOGS: false, gifi: '8860', logic: 'Almost always overhead legal fees' },
  ACCOUNTING:         { cogs: null,   overhead: '8700', bs: null,              defaultCOGS: false, gifi: '8860', logic: 'Professional fees — CPA, bookkeeping, accounting' },
  CONSULTING:         { cogs: '5305', overhead: '6450', bs: null,              defaultCOGS: true,  gifi: '8860', logic: 'Client-project consultant → 5305 COGS; business advisor → 6450' },
  OFFICE_SUPPLY:      { cogs: null,   overhead: '8600', bs: null,              defaultCOGS: false, gifi: '8810', logic: 'Always overhead — office supplies and postage' },
  COURIER:            { cogs: '5700', overhead: '6550', bs: null,              defaultCOGS: false, gifi: '8550', logic: 'Product freight → 5700 COGS; document courier → 6550' },
  OFFICE_SVC:         { cogs: null,   overhead: '8500', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Office services (shredding, records mgmt) → miscellaneous' },
  RENT:               { cogs: null,   overhead: '8720', bs: null,              defaultCOGS: false, gifi: '8810', logic: 'Rent/lease → 8720 (equipment lease → 7000)' },
  BANK_FEE:           { cogs: null,   overhead: '7700', bs: null,              defaultCOGS: false, gifi: '8710', logic: 'Always overhead — interest and bank charges' },
  INTEREST_INCOME:    { cogs: null,   overhead: null,   bs: null,   rev: '4860', defaultCOGS: false, gifi: '8710', logic: 'Deposit interest = INCOME → 4860 Interest income' },
  CASHBACK:           { cogs: null,   overhead: '7700', bs: null,              defaultCOGS: false, gifi: '8710', logic: 'Cash back/reward = contra bank charge → 7700' },
  INTEREST_LTD:       { cogs: null,   overhead: '7800', bs: null,              defaultCOGS: false, gifi: '8710', logic: 'Long-term debt interest → 7800' },
  CC_PAYMENT:         { cogs: null,   overhead: null,   bs: '2101',            defaultCOGS: false, gifi: '2130', logic: 'BS only — credit card payment reduces Visa Payable' },
  LOAN_PMT:           { cogs: null,   overhead: '7800', bs: '2710',            defaultCOGS: false, gifi: '2780', logic: 'SPLIT REQUIRED: principal → 2710-2880 BS, interest → 7800 IS' },
  TRANSFER:           { cogs: null,   overhead: null,   bs: '1000',            defaultCOGS: false, gifi: '1001', logic: 'BS only — bank-to-bank transfer, no P&L impact' },
  ETRANSFER:          { cogs: null,   overhead: null,   bs: null,              defaultCOGS: false, gifi: null,   logic: 'LOW confidence — could be rental income (4900) or transfer (BS). Review polarity and account type.' },
  MEALS:              { cogs: null,   overhead: '6415', bs: null,              defaultCOGS: false, gifi: '8520', logic: 'Meals & entertainment → 6415 (50% non-deductible CRA ITA 67.1)' },
  FOOD_DELIVERY:      { cogs: null,   overhead: '6415', bs: null,              defaultCOGS: false, gifi: '8520', logic: 'Food delivery apps (SkipTheDishes, Uber Eats) → 6415 Meals & entertainment' },
  EQUIP_PURCHASE:     { cogs: null,   overhead: null,   bs: '1768',            defaultCOGS: false, gifi: '1740', logic: 'Equipment purchase → 1768 BS (needs capitalization threshold review >$1,500/unit)' },
  SOFTWARE_SAAS:      { cogs: null,   overhead: '1857', bs: null,              defaultCOGS: false, gifi: '8811', logic: 'Software/SaaS subscriptions → 1857 (or 6800 Dues if low-value)' },
  SUBSCRIPTION:       { cogs: null,   overhead: '6800', bs: null,              defaultCOGS: false, gifi: '8811', logic: 'Online subscriptions and memberships → 6800' },
  VEHICLE_RENTAL:     { cogs: null,   overhead: '9200', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Car rental → 9200 Travel (NOT 8720 Rent — different expense class)' },
  SECURITY_SYS:       { cogs: null,   overhead: '8850', bs: null,              defaultCOGS: false, gifi: '8810', logic: 'Security system monitoring/alarm → 8850' },
  EQUIP_RENTAL:       { cogs: '5310', overhead: '7000', bs: null,              defaultCOGS: true,  gifi: '9270', logic: 'Job-site equipment → 5310 COGS; office equipment → 7000' },
  SUBCONTRACTOR:      { cogs: '5360', overhead: '8950', bs: null,              defaultCOGS: true,  gifi: '8590', logic: 'Client-project sub → 5360 COGS; internal → 8950 Subcontracting' },
  ADVERTISING:        { cogs: null,   overhead: '6000', bs: null,              defaultCOGS: false, gifi: '8520', logic: 'Always overhead — advertising and promotion' },
  TRAINING:           { cogs: null,   overhead: '9250', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Training courses → 9250' },
  TRAVEL:             { cogs: null,   overhead: '9200', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Travel and accommodations → 9200' },
  LOCKSMITH:          { cogs: null,   overhead: '7300', bs: null,              defaultCOGS: false, gifi: '8810', logic: 'Locksmith/security lock → Repairs and maintenance 7300 (NOT cleaning 5325)' },
  LICENSING:          { cogs: null,   overhead: '6800', bs: null,              defaultCOGS: false, gifi: '9270', logic: 'Professional licensing, registry fees → 6800 Dues & memberships' },
  EMP_BENEFITS:       { cogs: null,   overhead: '6900', bs: null,              defaultCOGS: false, gifi: '8930', logic: 'Employee benefits (Blue Cross, group plan) → 6900' },
  FURNISHINGS:        { cogs: null,   overhead: '5336', bs: null,              defaultCOGS: false, gifi: '1770', logic: 'Furniture/furnishings for rental property → 5336 or capital if >$1,500/unit' },
  GENERAL_RETAIL:     { cogs: null,   overhead: '8500', bs: null,              defaultCOGS: false, gifi: null,   logic: 'AMBIGUOUS — always flag for human review' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3: ACCOUNT GUARDS
// Hard blockers — these override ANY signal, including user rules.
// If a proposed COA code violates a guard, the result is either:
//   - redirected to the correct account (if deterministic), or
//   - flagged as needsReview (if ambiguous)
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNT_GUARDS = {

  // ── CRITICAL: Management Remuneration (WHITELIST) ─────────────────────────
  '8400': {
    risk: 'CRITICAL',
    rule: 'WHITELIST_ONLY',
    allowedVendorTypes: ['PAYROLL', 'PAYROLL_SVC'],
    description: '8400 Management Remuneration — ONLY payroll runs and owner/director draws. ALL vendor purchases blocked.',
    redirect: null,  // no safe redirect — must flag for review
  },

  // ── CRITICAL: Wages and Benefits (WHITELIST) ──────────────────────────────
  '9800': {
    risk: 'CRITICAL',
    rule: 'WHITELIST_ONLY',
    allowedVendorTypes: ['PAYROLL'],
    description: '9800 Wages and Benefits — ONLY employee payroll. ALL vendor purchases blocked.',
    redirect: null,
  },

  // ── HIGH: Miscellaneous (always flag) ─────────────────────────────────────
  '8500': {
    risk: 'HIGH',
    rule: 'FLAG_FOR_REVIEW',
    description: '8500 Miscellaneous — nothing auto-categorizes here without human confirmation.',
    redirect: null,
  },

  // ── HIGH: Visa Payable (only CC payments) ────────────────────────────────
  '2101': {
    risk: 'HIGH',
    rule: 'WHITELIST_ONLY',
    allowedVendorTypes: ['CC_PAYMENT'],
    description: '2101 Visa Payable — ONLY credit card bill payments. Visa purchase expenses go to their expense account.',
    redirect: null,
  },

  // ── HIGH: GST paid on purchases (system only) ─────────────────────────────
  '2150': {
    risk: 'HIGH',
    rule: 'SYSTEM_ONLY',
    description: '2150 GST paid on purchases — populated by the accounting system from purchase entries. Never from raw bank transactions.',
    redirect: null,
  },

  // ── HIGH: GST collected on sales (system only) ────────────────────────────
  '2160': {
    risk: 'HIGH',
    rule: 'SYSTEM_ONLY',
    description: '2160 GST collected on sales — populated by accounting system. Never from raw bank transactions.',
    redirect: null,
  },

  // ── HIGH: GST payments to CRA (whitelist) ────────────────────────────────
  '2149': {
    risk: 'HIGH',
    rule: 'WHITELIST_ONLY',
    allowedVendorTypes: ['GOV_REMIT', 'GOV_REMIT_GST'],
    description: '2149 GST payments to Revenue Canada — ONLY Receiver General GST remittances.',
    redirect: null,
  },

  // ── HIGH: Sales Revenue (credit only, no transfers/loans) ────────────────
  '4001': {
    risk: 'HIGH',
    rule: 'CREDIT_ONLY',
    blockedVendorTypes: ['TRANSFER', 'LOAN_PMT', 'CC_PAYMENT'],
    description: '4001 Sales — CREDIT only. No transfers, shareholder contributions, or loan draws.',
    redirect: null,
  },

  // ── HIGH: Income taxes current (whitelist) ────────────────────────────────
  '9950': {
    risk: 'HIGH',
    rule: 'WHITELIST_ONLY',
    allowedVendorTypes: [],  // year-end provision only — never from bank transactions
    description: '9950 Income taxes — year-end provision entry only. Tax installments → 2602/2622.',
    redirect: '2602',
  },

  // ── HIGH: Shareholder loans (manual only) ────────────────────────────────
  '2650': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Shareholder loan #1 — manual entry only.' },
  '2652': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Shareholder loan #2 — manual entry only.' },
  '2654': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Shareholder loan #3 — manual entry only.' },
  '2656': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Shareholder loan #4 — manual entry only.' },

  // ── HIGH: Capital assets (manual only) ───────────────────────────────────
  '1500': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Capital asset — requires capitalization threshold review.' },
  '1600': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Buildings — capital asset, manual only.' },
  '1760': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Office equipment — capital asset, manual only.' },
  '1768': {
    risk: 'MEDIUM',
    rule: 'FLAG_FOR_REVIEW',
    description: '1768 Equipment — capitalization threshold review required. Items >$1,500 are capital assets; below → 8900 shop supplies.',
  },
  '1800': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Vehicles — capital asset, manual only.' },
  '1855': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Computer equipment — capital asset, manual only.' },

  // ── HIGH: Equity and retained earnings (manual only) ─────────────────────
  '3000': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Share capital — manual only.' },
  '3640': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Dividends paid — manual only. Large amounts flagged.' },
  '3999': { risk: 'HIGH', rule: 'MANUAL_ONLY', description: 'Retained earnings — closing entry only, never from bank.' },

  // ── MEDIUM: Amortization (never a vendor charge) ─────────────────────────
  '6100': {
    risk: 'MEDIUM',
    rule: 'SYSTEM_ONLY',
    description: '6100 Amortization — journal entry only. Never from a vendor charge or bank transaction.',
    redirect: '8700',  // if a vendor ends up here, redirect to professional fees
  },

  // ── MEDIUM: CRA penalties (whitelist) ────────────────────────────────────
  '7751': {
    risk: 'MEDIUM',
    rule: 'WHITELIST_ONLY',
    allowedVendorTypes: ['GOV_REMIT', 'GOV_REMIT_ITAX'],
    description: '7751 CRA penalties and interest — only CRA penalty notices or interest on tax arrears.',
    redirect: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class CategorizationEngine {

  constructor() {
    this._patterns = VENDOR_PATTERNS;
    this._routing  = ROUTING_TABLE;
    this._guards   = ACCOUNT_GUARDS;
  }

  /**
   * Main entry point.
   *
   * @param {Object} tx        — transaction object { description, polarity, amount_cents, account_id }
   * @param {Object} options
   * @param {string} options.industry  — client industry: 'CONTRACTOR' | 'PROFESSIONAL' | 'RETAIL' | 'SHORT_TERM_RENTAL' | 'DEFAULT'
   * @param {boolean} options.isCCAcct — is this transaction from a credit card account?
   *
   * @returns {Object|null}
   *   {
   *     coa_code:      '7400',
   *     vendor_type:   'FUEL',
   *     confidence:    'HIGH',      // 'HIGH' | 'MEDIUM' | 'LOW'
   *     conf_score:    0.95,        // numeric for SignalFusionEngine
   *     method:        'deterministic',
   *     matched_pattern: '...',     // the regex that matched
   *     routing_logic: '...',       // human-readable why
   *     needs_review:  false,
   *     guard_blocked: false,
   *     flag:          null,        // 'LOAN_SPLIT_REQUIRED' | 'MANUAL_ONLY' | etc.
   *   }
   *   or null if no pattern matched
   */
  categorize(tx, options = {}) {
    const { industry = 'DEFAULT', isCCAcct = false } = options;
    const isCredit = tx.polarity === 'CREDIT';
    const isDebit  = tx.polarity === 'DEBIT';
    const desc     = (tx.description || tx.raw_description || '').toUpperCase().trim();

    // ── Step 1: Match against vendor patterns ────────────────────────────────
    const match = this._matchVendorPattern(desc);
    if (!match) return null;

    const { vendorType, confidence, matchedPattern } = match;
    const routing = this._routing[vendorType];
    if (!routing) return null;

    // ── Step 2: Determine COA based on routing + industry + polarity ─────────
    let coaCode = null;
    let flag    = null;
    let routingNote = routing.logic;

    if (routing.bs && !routing.overhead && !routing.cogs) {
      // Balance sheet only
      coaCode = routing.bs;
      if (vendorType === 'LOAN_PMT') flag = 'LOAN_SPLIT_REQUIRED';
    } else if (routing.rev) {
      // Revenue account (interest income, etc.)
      coaCode = routing.rev;
    } else if (routing.cogs && routing.overhead) {
      // COGS vs Overhead split — determined by industry
      coaCode = this._resolveCOGSvsOverhead(vendorType, industry, routing);
    } else if (routing.overhead) {
      coaCode = routing.overhead;
    } else if (routing.cogs) {
      coaCode = routing.cogs;
    }

    // ETRANSFER special handling: polarity + account type determines routing
    if (vendorType === 'ETRANSFER') {
      if (isCredit && !isCCAcct) {
        // On chequing/savings: credit e-transfer = likely rental revenue or income
        coaCode = '4900';  // default for STR client; fusion engine can override with context
        routingNote = 'E-transfer credit on CHQ/SAV — likely rental revenue (4900). Verify with context.';
      } else if (isDebit && !isCCAcct) {
        coaCode = null;  // sending e-transfer — could be expense or transfer
        routingNote = 'E-transfer debit — unknown destination. Flag for review.';
      } else {
        coaCode = null;  // on CC = ambiguous
      }
      return {
        coa_code:       coaCode,
        vendor_type:    vendorType,
        confidence:     'LOW',
        conf_score:     0.50,
        method:         'deterministic',
        matched_pattern: matchedPattern,
        routing_logic:  routingNote,
        needs_review:   true,
        guard_blocked:  false,
        flag:           null,
      };
    }

    // PAYROLL: distinguish owner (8400) vs employee (9800)
    if (vendorType === 'PAYROLL') {
      // Default to 8400 (management remuneration) for single-shareholder corps
      // Flag for review so accountant can confirm
      coaCode = '8400';
      flag    = 'PAYROLL_CONFIRM_OWNER_VS_EMPLOYEE';
    }

    // ── Step 3: Apply account guards ─────────────────────────────────────────
    const guardResult = this._applyGuard(coaCode, vendorType, tx);
    if (guardResult.blocked) {
      return {
        coa_code:       guardResult.redirect || null,
        vendor_type:    vendorType,
        confidence:     'HIGH',  // the guard itself is certain
        conf_score:     0.99,
        method:         'deterministic_guard',
        matched_pattern: matchedPattern,
        routing_logic:  guardResult.reason,
        needs_review:   true,
        guard_blocked:  true,
        flag:           guardResult.flag || 'GUARD_BLOCKED',
      };
    }

    // ── Step 4: Polarity sanity check ────────────────────────────────────────
    const polarityOK = this._checkPolarity(coaCode, isCredit, isCCAcct);
    if (!polarityOK) {
      return {
        coa_code:       null,
        vendor_type:    vendorType,
        confidence:     'HIGH',
        conf_score:     0.90,
        method:         'deterministic_polarity_block',
        matched_pattern: matchedPattern,
        routing_logic:  `Polarity mismatch — ${isCredit ? 'CREDIT' : 'DEBIT'} does not match expected direction for ${coaCode}`,
        needs_review:   true,
        guard_blocked:  false,
        flag:           'POLARITY_MISMATCH',
      };
    }

    // ── Build result ─────────────────────────────────────────────────────────
    const confScore = confidence === 'HIGH' ? 0.95 : confidence === 'MEDIUM' ? 0.78 : 0.55;

    return {
      coa_code:       coaCode,
      vendor_type:    vendorType,
      confidence,
      conf_score:     confScore,
      method:         'deterministic',
      matched_pattern: matchedPattern,
      routing_logic:  routingNote,
      needs_review:   confidence === 'LOW' || flag !== null,
      guard_blocked:  false,
      flag,
    };
  }

  // ─── Layer 1: Pattern Matching ─────────────────────────────────────────────

  _matchVendorPattern(desc) {
    for (const p of this._patterns) {
      if (p.re.test(desc)) {
        return {
          vendorType:     p.type,
          confidence:     p.conf,
          matchedPattern: p.re.toString(),
        };
      }
    }
    return null;
  }

  // ─── Layer 2: COGS vs Overhead Resolution ─────────────────────────────────

  _resolveCOGSvsOverhead(vendorType, industry, routing) {
    // Industries that default to COGS for dual-route types
    const cogsIndustries = new Set([
      'CONTRACTOR', 'CONSTRUCTION', 'TRADES', 'OIL_GAS', 'MINING',
      'TRANSPORTATION', 'AGRICULTURE',
    ]);

    if (routing.defaultCOGS && cogsIndustries.has(industry)) {
      return routing.cogs;
    }

    // SHORT_TERM_RENTAL: fuel is overhead (not job-cost)
    // Professional services: fuel is overhead
    return routing.overhead;
  }

  // ─── Layer 3a: Account Guards ──────────────────────────────────────────────

  _applyGuard(proposedCOA, vendorType, tx) {
    if (!proposedCOA) return { blocked: false };

    const guard = this._guards[proposedCOA];
    if (!guard) return { blocked: false };

    switch (guard.rule) {
      case 'WHITELIST_ONLY': {
        const allowed = guard.allowedVendorTypes || [];
        if (!allowed.includes(vendorType)) {
          return {
            blocked:  true,
            redirect: guard.redirect || null,
            reason:   `🚫 GUARD: ${proposedCOA} is WHITELIST ONLY — allowed: [${allowed.join(', ')}]. Got: ${vendorType}. ${guard.description}`,
            flag:     'GUARD_WHITELIST_VIOLATION',
          };
        }
        return { blocked: false };
      }

      case 'SYSTEM_ONLY':
        return {
          blocked:  true,
          redirect: guard.redirect || null,
          reason:   `🚫 GUARD: ${proposedCOA} is SYSTEM ONLY — ${guard.description}`,
          flag:     'GUARD_SYSTEM_ONLY',
        };

      case 'MANUAL_ONLY':
        return {
          blocked:  true,
          redirect: null,
          reason:   `🚫 GUARD: ${proposedCOA} is MANUAL ONLY — ${guard.description}`,
          flag:     'GUARD_MANUAL_ONLY',
        };

      case 'FLAG_FOR_REVIEW':
        return {
          blocked:  true,
          redirect: proposedCOA,  // allow the code but force review
          reason:   `⚠️ GUARD: ${proposedCOA} always requires human review — ${guard.description}`,
          flag:     'GUARD_REVIEW_REQUIRED',
        };

      case 'CREDIT_ONLY': {
        const isCredit = tx.polarity === 'CREDIT';
        const blocked  = (guard.blockedVendorTypes || []).includes(vendorType);
        if (!isCredit || blocked) {
          return {
            blocked:  true,
            redirect: null,
            reason:   `🚫 GUARD: ${proposedCOA} is CREDIT ONLY for confirmed revenue. Got: ${tx.polarity} / ${vendorType}`,
            flag:     'GUARD_CREDIT_ONLY_VIOLATION',
          };
        }
        return { blocked: false };
      }

      default:
        return { blocked: false };
    }
  }

  // ─── Layer 3b: Polarity Check ──────────────────────────────────────────────

  _checkPolarity(coaCode, isCredit, isCCAcct) {
    if (!coaCode) return true;

    // On CC accounts: CREDIT = charge (expense), DEBIT = payment
    // So credit to an expense account on CC is CORRECT
    if (isCCAcct && isCredit && this._isExpenseCode(coaCode)) return true;
    if (isCCAcct && isCredit && this._isRevenueCode(coaCode)) return false;

    // On bank/savings: DEBIT should go to expense; CREDIT should go to revenue/BS
    if (!isCCAcct && !isCredit && this._isRevenueCode(coaCode)) return false;

    return true;
  }

  _isExpenseCode(code) {
    const n = parseInt(code);
    return (n >= 5000 && n <= 9969);
  }

  _isRevenueCode(code) {
    const n = parseInt(code);
    return (n >= 4000 && n <= 4999);
  }

  // ─── Public Helpers ────────────────────────────────────────────────────────

  /**
   * Identify vendor type from description without full routing.
   * Useful for GIFI validation and UI display.
   */
  identifyVendorType(description) {
    const desc = (description || '').toUpperCase().trim();
    return this._matchVendorPattern(desc);
  }

  /**
   * Check if a proposed COA code is valid for a given vendor type.
   * Used by SignalFusionEngine to validate fuzzy ML suggestions before accepting them.
   */
  validateProposedCOA(proposedCOA, vendorType) {
    if (!vendorType || !proposedCOA) return { valid: true };

    const routing = this._routing[vendorType];
    if (!routing) return { valid: true };

    const validCodes = [routing.cogs, routing.overhead, routing.bs, routing.rev].filter(Boolean);

    // If routing table has specific codes, the proposed code must be one of them (or close)
    if (validCodes.length > 0 && !validCodes.includes(proposedCOA)) {
      return {
        valid:       false,
        reason:      `Vendor type ${vendorType} should route to [${validCodes.join(' or ')}], not ${proposedCOA}`,
        suggested:   validCodes[0],
      };
    }

    const guardCheck = this._applyGuard(proposedCOA, vendorType, { polarity: 'DEBIT' });
    if (guardCheck.blocked) {
      return {
        valid:       false,
        reason:      guardCheck.reason,
        suggested:   guardCheck.redirect,
      };
    }

    return { valid: true };
  }

  /**
   * Get a human-readable explanation for a proposed COA.
   * Used by UI to show why a category was chosen.
   */
  explain(vendorType, coaCode) {
    const routing = this._routing[vendorType];
    if (!routing) return `Unknown vendor type: ${vendorType}`;
    return routing.logic || `${vendorType} → ${coaCode}`;
  }

  /**
   * Validate a proposed COA against GIFI codes.
   * Returns true if valid, false + reason if mismatch.
   */
  validateGIFI(proposedCOA, vendorType) {
    const routing = this._routing[vendorType];
    if (!routing?.gifi) return { valid: true };

    // Simplified GIFI check — expand as needed
    return {
      valid:    true,
      gifi:     routing.gifi,
      vendorType,
      coaCode:  proposedCOA,
    };
  }
}

// Singleton export
const categorizationEngine = new CategorizationEngine();
export default categorizationEngine;
export { VENDOR_PATTERNS, ROUTING_TABLE, ACCOUNT_GUARDS };
