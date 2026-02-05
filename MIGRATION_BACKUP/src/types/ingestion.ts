/**
 * RoboLedgers: Ingestion Data Structures
 * Based on raw statement parsing output.
 */

export type RawParsedTransaction = {
    source_id: string;           // e.g. "RBC_CHEQUING_1234"
    raw_date: string;            // as-is from statement
    raw_description: string;     // UNTOUCHED bank text
    raw_amount: string;          // as-is (string)
    raw_balance?: string;        // optional
    page?: number;               // optional (PDF)
    y_coord?: number;            // optional (PDF)
};

export type IngestionPayload = {
    transactions: RawParsedTransaction[];
    import_timestamp: string;
    source_system: string;
};
