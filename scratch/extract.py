import re
import json

with open('../client/src/lib/tender-workspace-data.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def extract_array(name):
    pattern = rf'export const {name}[^\[]+(\[\s*{{.*?}}\s*\]);'
    match = re.search(pattern, content, re.DOTALL)
    if not match: return []
    arr_str = match.group(1)
    
    # Very dirty fix for TS objects -> JSON
    arr_str = re.sub(r'([a-zA-Z0-9_]+):', r'"\1":', arr_str)
    arr_str = arr_str.replace("'", '"')
    
    try:
        return json.loads(arr_str)
    except:
        return []

rd = extract_array('lindeRequiredDocuments')
ci = extract_array('lindeComplianceItems')

# This is getting complicated. Python regex to parse TS objects is prone to error.
