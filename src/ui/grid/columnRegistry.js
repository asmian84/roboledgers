/**
 * Column Registry - Master definition of all available columns
 * Each column defines: label, field, flex (relative width), optional flags
 */

export const COLUMN_REGISTRY = {
  // CORE ACCOUNTING (always available)
  ref: { 
    label: "Ref", 
    field: "ref", 
    flex: 1, 
    required: true 
  },
  date: { 
    label: "Date", 
    field: "date", 
    flex: 1, 
    required: true, 
    sorter: "date" 
  },
  description: { 
    label: "Description", 
    field: "description", 
    flex: 4, 
    required: true 
  },
  debit: { 
    label: "Debit", 
    field: "debit_col", 
    flex: 1, 
    hozAlign: "right",
    required: true
  },
  credit: { 
    label: "Credit", 
    field: "credit_col", 
    flex: 1, 
    hozAlign: "right",
    required: true
  },
  balance: { 
    label: "Balance", 
    field: "balance", 
    flex: 1, 
    hozAlign: "right",
    required: true
  },

  // AUTO BOOKKEEPING (optional)
  gl_account: { 
    label: "Category", 
    field: "gl_account_id", 
    flex: 2, 
    optional: true 
  },
  confidence: { 
    label: "AI Confidence", 
    field: "ai_confidence", 
    flex: 1, 
    optional: true 
  },
  merchant_score: { 
    label: "Merchant Match %", 
    field: "merchant_score", 
    flex: 1, 
    optional: true 
  },

  // FORENSICS
  txsig: { 
    label: "Transaction Signature", 
    field: "txsig", 
    flex: 2, 
    optional: true 
  },
  source_file: { 
    label: "Source File", 
    field: "sourceFileId", 
    flex: 2, 
    optional: true 
  },

  // PRODUCTIVITY
  notes: { 
    label: "Notes", 
    field: "notes", 
    flex: 2, 
    optional: true 
  },
  tags: { 
    label: "Tags", 
    field: "tags", 
    flex: 2, 
    optional: true 
  }
};
