import json
import requests
import time

def run(rows, token, env_config):
    processed_rows = []
    
    # Config
    base_url = env_config.get('apiBaseUrl')
    if not base_url:
         env_name = env_config.get('environment', 'Prod')
         ENV_MAP = { "QA1": "https://qa1.cropin.in", "QA2": "https://qa2.cropin.in", "Prod": "" }
         base_url = ENV_MAP.get(env_name)
    
    headers = { 'Authorization': f'Bearer {token}' }
    
    # 1. Fetch Master Tags
    print("Fetching Tags...")
    tag_map = {}
    try:
        resp = requests.get(f"{base_url}/services/master/api/filter?type=FARMER", headers=headers)
        if resp.status_code == 200:
            for t in resp.json().get('data', []):
                tag_map[t.get('name', '').lower()] = t.get('id')
    except Exception as e:
        print(f"Failed to fetch tags: {e}")

    # Optional: Fetch Farmers List for Code->ID resolution if needed?
    # For now, let's assume user provides ID or verify if we can search by code quickly.
    # Searching by code requires fetching all farmers or using a search API.
    # We will support 'Farmer ID' column directly or 'Farmer Code' if we fetch list.
    # To keep initial version simple/fast, let's try to lookup by ID or Code (if list is fetched).
    # IF 'Farmer Code' is present, we need to resolve it.
    
    id_map = {}
    code_map = {}
    need_farmer_list = any('Farmer Code' in r or 'Farmer ID' in r for r in rows)
    if need_farmer_list:
        print("Fetching Farmers List for resolution...")
        try:
             fr = requests.get(f"{base_url}/services/farm/api/farmers/dropdownList", headers=headers)
             if fr.status_code == 200:
                 data = fr.json()
                 # Handle both direct array and {'data': [...]} wrapper
                 farmers = data if isinstance(data, list) else data.get('data', [])
                 for f in farmers:
                     fid = f.get('id')
                     fcode = f.get('farmerCode') or f.get('code')
                     if fid: id_map[str(fid).strip()] = fid
                     if fcode: code_map[str(fcode).strip().lower()] = fid
                 print(f"Loaded {len(farmers)} farmers for lookup (IDs: {len(id_map)}, Codes: {len(code_map)}).")
        except Exception as e:
            print(f"Farmer fetch failed: {e}")

    update_url = f"{base_url}/services/farm/api/farmers"

    for row in rows:
        new_row = row.copy()
        try:
            # Inputs
            f_id_raw = str(row.get('Farmer ID') or '').strip()
            f_code = str(row.get('Farmer Code') or '').strip()
            tag_name = str(row.get('Tag Name') or '').strip()
            
            if not tag_name:
                new_row['Status'] = 'Fail'
                new_row['API_Response'] = 'Missing Tag Name'
                processed_rows.append(new_row)
                continue
            
            # Resolve Target ID
            target_id = None
            if f_id_raw:
                target_id = id_map.get(f_id_raw)
            
            if not target_id and f_code:
                target_id = code_map.get(f_code.lower())
            
            if not target_id:
                new_row['Status'] = 'Fail'
                new_row['API_Response'] = f"Farmer ID/Code not found provided or resolved. ({f_code})"
                processed_rows.append(new_row)
                continue
                
            # Resolve Tag ID
            tag_id = tag_map.get(tag_name.lower())
            if not tag_id:
                new_row['Status'] = 'Fail'
                new_row['API_Response'] = f"Tag Name not found: {tag_name}"
                processed_rows.append(new_row)
                continue
                
            # 2. GET Farmer Details
            f_resp = requests.get(f"{update_url}/{target_id}", headers=headers)
            if f_resp.status_code != 200:
                 new_row['Status'] = 'Fail'
                 new_row['API_Response'] = f"Failed to fetch farmer: {f_resp.text}"
                 processed_rows.append(new_row)
                 continue
                 
            farmer_data = f_resp.json()
            if not farmer_data: # Wrapper?
                new_row['Status'] = 'Fail'
                new_row['API_Response'] = 'Empty Farmer Data'
                processed_rows.append(new_row)
                continue
            
            # 3. Update Tags
            # FIX: API expects tags inside 'data' object
            if 'data' not in farmer_data: farmer_data['data'] = {}
            current_tags = farmer_data['data'].get('tags', [])
            
            # Ensure list of ints
            tag_ids = []
            if isinstance(current_tags, list):
                for t in current_tags:
                    try: tag_ids.append(int(t))
                    except: pass
            elif isinstance(current_tags, str):
                 for t in current_tags.split(','):
                     try: tag_ids.append(int(t.strip()))
                     except: pass
                     
            if tag_id not in tag_ids:
                tag_ids.append(tag_id)
                farmer_data['data']['tags'] = tag_ids
                
                # 4. PUT Update (Multipart)
                files = { 'dto': ('body.json', json.dumps(farmer_data), 'application/json') }
                
                # IMPORTANT: PUT typically replaces. Use the FULL fetched object.
                put_resp = requests.put(update_url, headers=headers, files=files)
                
                if put_resp.status_code in [200, 201]:
                    new_row['Status'] = 'Pass'
                    new_row['API_Response'] = f"Tag {tag_id} added."
                else:
                    new_row['Status'] = 'Fail'
                    new_row['API_Response'] = put_resp.text
            else:
                new_row['Status'] = 'Pass'
                new_row['API_Response'] = f"Tag {tag_id} already exists."
                
        except Exception as e:
            new_row['Status'] = 'Fail'
            new_row['API_Response'] = str(e)
            
        processed_rows.append(new_row)
        
    return processed_rows
