import sys
import json
import argparse
from pathlib import Path
import logging
import pdfplumber

# Configure logging to stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Parse PDF tables using pdfplumber')
    parser.add_argument('input_file', help='Path to input PDF file')
    args = parser.parse_args()

    input_path = Path(args.input_file)
    if not input_path.exists():
        print(json.dumps({"error": "File not found", "path": str(input_path)}))
        sys.exit(1)

    try:
        logger.info(f"Processing: {input_path}")
        
        tables = []
        with pdfplumber.open(input_path) as pdf:
            for i, page in enumerate(pdf.pages):
                # Extract tables using default settings
                page_tables = page.extract_tables()
                
                for table_idx, table_data in enumerate(page_tables):
                    # table_data is a list of lists (rows)
                    if not table_data:
                        continue

                    # Clean None values and newlines for valid JSON
                    cleaned_rows = []
                    for row in table_data:
                        # Replace None with empty string, strip whitespace
                        cleaned_row = [(cell.strip() if cell else "") for cell in row]
                        cleaned_rows.append(cleaned_row)

                    if not cleaned_rows:
                        continue

                    # Basic header heuristic: First row is header
                    # (This fits most bank statements)
                    headers = cleaned_rows[0]
                    rows = cleaned_rows[1:]

                    tables.append({
                        "page": i + 1,
                        "table_index": table_idx,
                        "caption": f"Table {table_idx+1} on Page {i+1}",
                        "headers": headers,
                        "rows": rows
                    })

        # Success output
        print(json.dumps({
            "status": "success",
            "file": str(input_path.name),
            "table_count": len(tables),
            "tables": tables
        }, default=str))

    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        print(json.dumps({
            "error": "Processing failed",
            "message": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
