#!/usr/bin/env python3
"""
Build complete vendor-category graph database from CSV data
Processes all 172K unique vendor-category mappings
"""

import json
import csv
from collections import defaultdict

print("Loading vendor-category mappings...")

# Data structures
vendor_to_categories = defaultdict(lambda: defaultdict(int))
category_info = {}
all_vendors = set()

# Read the combined mappings file
with open('vendor_mappings_all.txt', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        parts = line.strip().split('|')
        if len(parts) >= 3:
            vendor = parts[0].strip('"')
            category_code = parts[1].strip('"')
            category_name = parts[2].strip('"')
            
            if vendor and category_code and category_name:
                # Track vendor→category mapping
                key = f"{category_code}|{category_name}"
                vendor_to_categories[vendor][key] += 1
                all_vendors.add(vendor)
                
                # Track category info
                if key not in category_info:
                    category_info[key] = {
                        'code': category_code,
                        'name': category_name,
                        'vendor_count': 0
                    }
                category_info[key]['vendor_count'] += 1

print(f"Loaded {len(all_vendors)} unique vendors")
print(f"Found {len(category_info)} unique categories")

# Build graph structure
nodes = []
edges = []
node_id = 0

# Create category nodes
category_to_id = {}
for cat_key, cat_data in category_info.items():
    cat_id = f"cat_{cat_data['code']}"
    category_to_id[cat_key] = cat_id
    nodes.append({
        'id': cat_id,
        'type': 'category',
        'code': cat_data['code'],
        'label': cat_data['name'],
        'vendor_count': cat_data['vendor_count']
    })

# Create vendor nodes and edges
vendor_to_id = {}
for idx, vendor in enumerate(all_vendors):
    if idx % 10000 == 0:
        print(f"Processing vendor {idx}/{len(all_vendors)}...")
    
    vendor_id = f"v_{idx}"
    vendor_to_id[vendor] = vendor_id
    
    # Get total transaction count for this vendor
    total_txns = sum(vendor_to_categories[vendor].values())
    
    nodes.append({
        'id': vendor_id,
        'type': 'vendor',
        'label': vendor,
        'transaction_count': total_txns
    })
    
    # Create edges for all categories this vendor maps to
    for cat_key, count in vendor_to_categories[vendor].items():
        cat_id = category_to_id.get(cat_key)
        if cat_id:
            # Calculate confidence (simple heuristic)
            confidence = min(1.0, count / 100.0)
            
            edges.append({
                'source': vendor_id,
                'target': cat_id,
                'type': 'CATEGORIZED_AS',
                'transaction_count': count,
                'confidence': round(confidence, 2)
            })

print(f"\nGraph built successfully!")
print(f"- Total nodes: {len(nodes)}")
print(f"- Total edges: {len(edges)}")

# Save graph database
graph_db = {
    'metadata': {
        'total_nodes': len(nodes),
        'total_edges': len(edges),
        'unique_vendors': len(all_vendors),
        'unique_categories': len(category_info),
        'source_transactions': 783124,
        'unique_mappings': 172268,
        'generated_date': '2026-02-15',
        'schema_version': '1.0'
    },
    'nodes': nodes,
    'edges': edges
}

print("\nSaving complete_vendor_graph.json...")
with open('src/training_data/complete_vendor_graph.json', 'w', encoding='utf-8') as f:
    json.dump(graph_db, f, indent=2, ensure_ascii=False)

print("✅ Complete graph database created!")
print(f"\nStats:")
print(f"  Vendors: {len(all_vendors):,}")
print(f"  Categories: {len(category_info):,}")
print(f"  Relationships: {len(edges):,}")
