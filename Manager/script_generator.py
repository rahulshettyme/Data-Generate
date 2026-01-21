
import sys
import json
import os
import requests

def get_gemini_api_key():
    """Fetches Gemini API Key from Env Var or System/db.json"""
    # Priority 1: Environment Variable (Legacy/Override)
    key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if key: return key
    
    # Priority 2: System/db.json
    try:
        # Navigate from Manager/script_generator.py -> Data Generate/ -> System/db.json
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 
        db_path = os.path.join(base_dir, "System", "db.json")
        
        if os.path.exists(db_path):
            with open(db_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("gemini_api_key", "").strip()
    except Exception as e:
        print(f"[Warn] Failed to read Gemini Key from db.json: {e}")
        
    return ""

def generate_heuristic_script(description):
    """Fallback: Generates a Python script by parsing the structured description directly."""
    import textwrap
    import re
    
    desc_lines = description.splitlines()
    imports = ["import requests", "import json", "import thread_utils"]
    
    # Body accumulator
    body_lines = []
    
    current_step_type = None
    
    # Simple state machine to parse the text description
    # Format: 
    # Step X [API]:
    #   - Step/Variable Name: foo
    #   - Call POST /url
    
    variable_name = "resp"
    method = "GET"
    url = ""
    payload = "{}"
    instruction = ""
    
    # Helper to flush an API step
    def flush_api_step(v_name, meth, u, pay, instr):
        # Sanitize variable name
        v_name = v_name.replace(' ', '_')
        url_var = f"{v_name}_url"
        
        # Payload Processing
        payload_code = "payload = {}"
        if pay and pay.strip() != "{}":
             clean_pay = pay.strip()
             if clean_pay.startswith("{") and clean_pay.endswith("}"):
                 # Heuristic: Don't hardcode large payloads safely. Comment them out.
                 payload_code = f"# payload = {clean_pay}  # <--- UNCOMMENT AND ADJUST\n            payload = {{}}"
             elif clean_pay.isidentifier():
                 payload_code = f"payload = {clean_pay}"
             else:
                 # Likely a description, comment it out
                 payload_code = f"# TODO: Construct payload from: {clean_pay}\n            payload = {{}}"

        code = f"""
            # API Step: {v_name}
            # Instructions: {instr}
            {url_var} = f"{{base_url}}{u}"
            {payload_code}
            # Using {v_name} as response variable
            {v_name} = requests.{meth.lower()}({url_var}, json=payload, headers={{'Authorization': token}})
            row['{v_name}_status'] = {v_name}.status_code
            try:
                row['{v_name}_response'] = {v_name}.json()
            except:
                row['{v_name}_response'] = {v_name}.text
        """
        return textwrap.dedent(code).strip()


    for line in desc_lines:
        line = line.strip()
        if not line: continue
        
        # Detect Step Start
        if line.startswith("Step") and "[" in line and "]:" in line:
            if "[API]" in line:
                current_step_type = "API"
                # Reset defaults
                variable_name = "api_resp"
                method = "POST"
                url = "/services/..."
                payload = "{}"
                instruction = ""
            elif "[LOGIC]" in line:
                current_step_type = "LOGIC"
        
        # Parse API Detials
        if current_step_type == "API":
             pass # Logic moved to block parser below

    # RE-STRATEGY: Use Regex to split into blocks and parse each block
    # The Description is consistent.
    
    generated_steps = []
    
    # Split by "Step \d+ [" to get blocks
    steps = re.split(r'Step \d+ \[', description)
    
    for step_block in steps:
        if not step_block.strip(): continue
        
        # Determin Type
        step_type = "UNKNOWN"
        if step_block.startswith("API"):
            step_type = "API"
        elif step_block.startswith("LOGIC"):
            step_type = "LOGIC"
            
        content = step_block
        
        if step_type == "API":
            # Extract Name
            name_match = re.search(r'- Step/Variable Name: (.*)', content)
            v_name = name_match.group(1).strip() if name_match else "api_resp"
            
            # Extract Call
            call_match = re.search(r'- Call (\w+) (.*)', content)
            meth = call_match.group(1).strip() if call_match else "POST"
            u = call_match.group(2).strip() if call_match else "/url"
            
            # Extract Payload
            pay_match = re.search(r'- Payload Example: (.*)', content)
            pay = pay_match.group(1).strip() if pay_match else "{}"

            # Extract Instructions
            instr_match = re.search(r'- Instructions: (.*)', content)
            instr = instr_match.group(1).strip() if instr_match else ""
            
            step_code = flush_api_step(v_name, meth, u, pay, instr)
            generated_steps.append(step_code)
            
        elif step_type == "LOGIC":
            logic_match = re.search(r'- Logic: (.*)', content, re.DOTALL)
            logic_text = logic_match.group(1).strip() if logic_match else "Logic..."
            
            # Comment
            step_code = f"# LOGIC: {logic_text.replace(chr(10), ' ')}"
            generated_steps.append(step_code)

    # If no steps found (heuristic fallback fallback), use the old hardcoded one
    if not generated_steps:
         # Old hardcoded logic...
         api_call_code = """# Create Asset (Fallback)
url = f"{base_url}/services/farm/api/assets"
payload = { "name": row.get("Asset Name") }
resp = requests.post(url, json=payload, headers={'Authorization': token})
row['Status'] = resp.status_code"""
         generated_steps.append(api_call_code)

    # Join steps with indentation
    steps_code = "\n\n".join(generated_steps)
    steps_code_indented = textwrap.indent(steps_code, '            ')

    script_template = f"""{chr(10).join(imports)}
# Add attribute_utils if needed (fallback doesn't strictly force it but good to have)
try:
    from components import attribute_utils
except ImportError:
    pass

def run(data, token, env_config):
    # Setup
    base_url = env_config.get('apiBaseUrl')
    if not base_url:
        raise ValueError("Configuration Error: 'apiBaseUrl' not found in env_config. Please ensure the Environment is selected and configured.")
    
    # --- PROCESS ROW FUNCTION ---
    def process_row(row):
        try:
{steps_code_indented}
            
        except Exception as e:
            row['Error'] = str(e)
            
        return row

    # Use thread_utils for parallel execution
    return thread_utils.run_in_parallel(process_row, data)
"""
    return script_template

    return script_template
 
def _get_ist_header(base_text):
    """Returns the header string with current IST timestamp."""
    from datetime import datetime, timedelta
    # UTC to IST is +5:30
    ist_time = datetime.utcnow() + timedelta(hours=5, minutes=30)
    timestamp = ist_time.strftime("%Y-%m-%d %H:%M:%S IST")
    return f"# {base_text} - {timestamp}"

def clean_ai_headers(script_content):
    """Removes old AI status headers and 'Original Code' markers from the script."""
    lines = script_content.splitlines()
    cleaned_lines = []
    
    # We want to remove any BLOCK of lines at the start that look like:
    # # AI Generated...
    # # AI Updated...
    # # AI Generation failed...
    # # Original Code:
    # AND any empty lines mixed in with them.
    # Once we hit "real" code (imports, comments that aren't these specific headers), we stop stripping.
    
    stripping = True
    for line in lines:
        stripped_line = line.strip()
        if stripping:
            if not stripped_line: continue # Skip empty leading lines
            
            # Check for AI Headers
            lower_line = stripped_line.lower()
            if lower_line.startswith("# ai generated"): continue
            if lower_line.startswith("# ai updated"): continue
            if lower_line.startswith("# ai generation failed"): continue
            if lower_line.startswith("# ai update failed"): continue
            if lower_line.startswith("# original code:"): continue
            
            # If it's a comment starting with # and subsequent indentation error lines (e.g. from previous bad updates)
            # This is riskier but "AI Update Failed" usually adds a block.
            # Let's stick to the specific headers for safety.
            
            # If line starts with "  " (indent) and we just saw an error header, it's likely part of the error JSON
            # But the cleaner logic above processes line by line independently.
            # A simple heuristic: If it starts with # and looks like json or error message?
            # User requirement: "remove old and show recent".
            
            # Stop stripping if we hit metadata like EXPECTED_INPUT_COLUMNS or imports
            # Stop stripping if we hit metadata like EXPECTED_INPUT_COLUMNS or imports
            if "EXPECTED_INPUT_COLUMNS" in line:
                 # Duplicate logic: The main block re-adds this at the top. 
                 # So we should STRIP old ones to prevent accumulation.
                 continue
                 
            if stripped_line.startswith("#"):
                 # Check if it's a "bad" header we missed or a "good" comment
                 # Good comments: # Description, # Step 1, etc.
                 # Bad comments: #   "error": ... (indented error trace)
                 if '"error":' in line or '"code":' in line: continue
                 pass 
            else:
                 # Real code or non-comment
                 stripping = False
                 cleaned_lines.append(line)
        else:
            cleaned_lines.append(line)
            
    return "\n".join(cleaned_lines)

def generate_script_with_ai(description, is_multithreaded=True):
    """Generates a Python script using Gemini API, falls back to heuristics."""

    api_key = get_gemini_api_key()

    if not api_key:
        return generate_heuristic_script(description)

    import_ins = "`requests`, `json`, `thread_utils`" if is_multithreaded else "`requests`, `json`"
    thread_ref = "- CORRECT: `import thread_utils`" if is_multithreaded else ""
    
    if is_multithreaded:
        run_req = "6. Main `run` function MUST return `thread_utils.run_in_parallel(target_function, items_to_process)`."
        lock_req = "3. Use **Double-Checked Locking** with `threading.Lock()` to ensure the API is called EXACTLY ONCE across threads."
        cache_ins = "Do NOT use `global` keywords. Use the closure-based `cache` dictionary pattern described above."
    else:
        run_req = "6. Main `run` function MUST execute sequentially by iterating `data`, calling `process_row/group`, and returning the results list. DO NOT use `thread_utils`."
        lock_req = "3. Fetch data once before the loop (e.g. `if not cache['key']: fetch()`). No need for `threading.Lock`."
        cache_ins = "Use a closure-based `cache` dictionary or simple local variable in `run`. No globals."

    prompt = f"""
    You are an expert Python developer for an automation platform using requests.
    User Description: "{description}"
    
    Requirements:
    1. Function `def run(data, token, env_config):`
    2. Import {import_ins}, and `attribute_utils` (Standard imports. DO NOT import from `data_platform`).
       {thread_ref}
       - `import attribute_utils`
       - WRONG: `from data_platform import ...`
    3. `env_config['apiBaseUrl']` is the base URL. Use it directly.
    4. **API PATHS**: Use the EXACT path provided in the description.
       - If description says `GET /services/farm/api/foo`, usage: `f"{{base_url}}/services/farm/api/foo"`.
       - Do NOT simplify/shorten paths. Do NOT remove `/services/farm/api` if present.
    5. Define a nested `def process_row(row):` function that processes a single row.
    5. Inside `process_row`:
       - Use `requests` for APIs. Use `token` in Authorization header: `{{'Authorization': f'Bearer {{token}}'}}`.
       - Update `row` with status/results.
       - Return `row`.
    {run_req}
    7. ONLY output Python code.
    
    CRITICAL RULES:
    - Use EXACT column names from input (e.g. row['Asset ID'], row['Tag']). Do NOT invent new inputs.
    - If you need to store temporary data in 'row', start the key with '_' (e.g. row['_temp_id']).
    - Do NOT access `row['_foo']` unless you assigned it earlier.

    CRITICAL - PARENT-CHILD AGGREGATION / ROW GROUPING:
    - IF the Description implies a "One-to-Many" relationship (e.g. creating a Variety with multiple Crop Stages, or an order with items) where multiple rows contribute to ONE API call:
      0. **WARNING**: Standard row-based threading triggers "Duplicate" errors if child rows are split across threads.
      1. **REQUIRED**: Add comments at the top:
         - `# CONFIG: groupByColumn="<parent_id_column>"` (e.g. "name")
         - `# CONFIG: isMultithreaded=True` (Enable threading for groups)
         - `# CONFIG: batchSize=1` (Process 1 Group per Batch/Thread)
      2. Group the input `data` by the parent ID (e.g. Name) inside `run()`.
         ```python
         grouped = dict()
         for row in data:
             k = row.get('Name')
             if k: grouped.setdefault(k, []).append(row)
         ```
      3. Define `process_group(item)` instead of `process_row`. `item` will be `(key, rows_list)`.
      4. Inside `process_group`, iterate over `rows` to build the child list (e.g. `stages`).
      5. Make ONE API call for the group.
      6. Error Handling: If 400 error, try to extract `message` or `title` from JSON body.
      7. Return `rows` (the list of ALL input rows in the group), updating EACH row with the same Status/Response.
         - DO NOT return `[main_row]`. Return `rows`.
    - ELSE (Standard 1-to-1):
      - Use `process_row(row)`.
    
    CRITICAL - RUN ONCE / MASTER DATA STEPS:
    - If a step is marked **"Run Once: Yes"** or described as Master Data/Setup:
      1. Initialize a cache dictionary in `run()` (e.g., `cache = dict(crop_map=None)`).
      2. Define a helper function *inside* `run()` to fetch the data.
      {lock_req}
      4. Example Pattern:
         ```python
         # fetch_lock = threading.Lock() # ONLY IF THREADED
         # ...
         if cache['crop_map'] is None:
             # with fetch_lock: # ONLY IF THREADED or just 'if'
             if cache['crop_map'] is None:
                 fetch_and_cache_crops()
         ```
      5. Store the result in the cache dictionary.
      6. **DO NOT** execute this API inside `process_row`. Use `cache['crop_map']` inside `process_row`.

    CRITICAL - CACHING / GLOBAL VARIABLES:
    - {cache_ins}
    - If you need to cache master data to reuse across rows:
      1. Initialize a container in `run` (e.g. `cache = dict(tags=None)`).
      2. Access `cache['tags']` inside `process_row`.
      3. This avoids threading/scope issues.
    
    CRITICAL - PYTHON SYNTAX RULES:
    - Never write an empty `if`, `else`, `try`, or `except` block.
    - If a block is empty, you MUST use `pass`.
    - Do NOT use `return` outside of a function.
    
    CRITICAL - MULTIPART / DTO Support:
    - If the request involves sending a JSON object as a file (often called 'dto' or 'body.json') or mentions "Multipart":
      1. Do NOT set 'Content-Type' in headers (requests library must set the boundary).
      2. Construct the file part: `files = dict(dto=(None, json.dumps(payload), 'application/json'))`
      3. make the call: `requests.post(url, headers=headers_without_content_type, files=files)`
      4. Ensure you remove 'Content-Type' from the headers dict passed to this call.
    
    CRITICAL - CASE INSENSITIVITY & WHITESPACE:
    - ALWAYS assume Excel input values might have different casing AND whitespace than API values.
    - When creating a lookup map (cache), store keys as STRIPPED LOWERCASE: `cache['map'][str(name).strip().lower()] = id`.
    - When looking up values, convert input to STRIPPED LOWERCASE: `id = cache['map'].get(str(row['Name']).strip().lower())`.
    
    IMPORTANT - Additional Attributes Support:
    - You MUST import `attribute_utils` at the top.
    - When constructing a payload (dict), you MUST use this helper to inject optional custom attributes:
      `payload = attribute_utils.add_attributes_to_payload(row, payload, env_config, target_key='data')`
      (Use target_key='data' if the API expects attributes nested in 'data', or target_key=None for root).
    """

    # Dynamic Model Discovery
    # 1. Fetch available models from API
    # 2. Pick the best "Pro" or "Flash" model available to the user
    
    selected_model = None
    try:
        models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        m_resp = requests.get(models_url, timeout=5)
        
        if m_resp.status_code == 200:
            data = m_resp.json()
            available_models = [m['name'].replace('models/', '') for m in data.get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
            
            # Preference Order (Best to Good)
            preferences = [
                "gemini-2.5-pro", "gemini-3-pro-preview", "gemini-2.0-flash", 
                "gemini-pro-latest", "gemini-1.5-pro-latest", "gemini-1.5-pro",
                "gemini-flash-latest", "gemini-1.5-flash-latest", "gemini-1.5-flash",
                "gemini-1.0-pro", "gemini-pro"
            ]
            
            for pref in preferences:
                if pref in available_models:
                    selected_model = pref
                    break
            
            # If no exact match, look for any 'gemini' model
            if not selected_model:
                for m in available_models:
                    if 'gemini' in m:
                        selected_model = m
                        break
                        
    except Exception as e:
        last_error = f"Model discovery failed: {e}"

    # Construct candidate list: Selected (Best) -> Fallbacks (High Quota)
    fallback_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]
    
    candidates = []
    if selected_model:
        candidates.append(selected_model)
    
    # Append fallbacks if they are valid/available
    for fb in fallback_models:
        if fb not in candidates:
             if available_models: # We have a verified list
                 if fb in available_models: candidates.append(fb)
             else:
                 candidates.append(fb) # Trust defaults if discovery failed

    # Ensure we have *something*
    models_to_try = candidates if candidates else fallback_models
    
    # Remove duplicates
    models_to_try = list(dict.fromkeys(models_to_try))
    
    # Define payload BEFORE the loop
    payload = { "contents": [{ "parts": [{"text": prompt}] }] }

    success, content, last_error = _call_gemini_with_candidates(api_key, models_to_try, payload)
    
    if success:
        return f"{_get_ist_header('AI Generated Script')}\n{content}"

    # Fallback if all models fail
    error_comment = "\n".join(f"# {line}" for line in str(last_error).splitlines())
    return f"{_get_ist_header('AI Generation failed, script generator created')}\n# AI Generation Failed (Tried: {models_to_try}). Error:\n{error_comment}\n\n# Using heuristic template.\n\n{generate_heuristic_script(description)}"

def _call_gemini_with_candidates(api_key, models_to_try, payload):
    """Helper to try multiple models with retries."""
    import time
    last_error = "No models tried"
    
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        # RETRY LOOP (3 attempts)
        for attempt in range(3):
            try:
                # Increased timeout to 120s
                resp = requests.post(url, json=payload, timeout=120)
                
                if resp.status_code == 200:
                    result = resp.json()
                    if 'candidates' in result and result['candidates']:
                        generated_text = result['candidates'][0]['content']['parts'][0]['text']
                        
                        # Clean markdown
                        if "```python" in generated_text:
                            generated_text = generated_text.split("```python")[1].split("```")[0].strip()
                        elif "```" in generated_text:
                            generated_text = generated_text.split("```")[1].split("```")[0].strip()
                        
                        # Post-Processing: Force Configuration for Grouped Scripts
                        if "groupByColumn" in generated_text or "process_group" in generated_text:
                            import re
                            # Force batchSize=1 (Sequential UI Updates)
                            generated_text = re.sub(r'#\s*CONFIG:\s*batchSize\s*=\s*\d+', '# CONFIG: batchSize=1', generated_text)
                            # Force isMultithreaded=True (Allow Chunking)
                            generated_text = re.sub(r'#\s*CONFIG:\s*isMultithreaded\s*=\s*\w+', '# CONFIG: isMultithreaded=True', generated_text)
                            
                            # Ensure 'import threading' is present if missing
                            if "import threading" not in generated_text:
                                generated_text = "import threading\n" + generated_text
                            
                        return True, generated_text.strip(), None
                        error_details = f"Model {model} returned no content (Safety?)"
                        last_error = error_details
                        break 
                elif resp.status_code == 503 or resp.status_code == 429:
                     # Overloaded or Rate Limited, retry
                     last_error = f"Model {model} failed with {resp.status_code} (Retries exhausted)"
                     
                     # Exponential backoff for 429 is important
                     sleep_time = 2 * (attempt + 1)
                     if resp.status_code == 429:
                         sleep_time += 2 # Add extra padding for quota
                     time.sleep(sleep_time)
                     continue 
                elif resp.status_code == 403:
                     # Permission Denied (API Not Enabled?)
                     err_text = resp.text
                     masked_key = f"{api_key[:5]}...{api_key[-5:]}" if api_key and len(api_key)>10 else "Unknown"
                     if "not been used" in err_text or "not enabled" in err_text:
                         last_error = f"Model {model} failed (403): API Not Enabled. (Key: {masked_key})\nAction Required: Enable 'Generative Language API' in Google Cloud Console for project linked to API Key."
                     else:
                         last_error = f"Model {model} failed with 403: {err_text[:200]} (Key: {masked_key})"
                     break
                else:
                    last_error = f"Model {model} failed with {resp.status_code}: {resp.text[:100]}"
                    break 
                    
            except Exception as e:
                last_error = f"Model {model} exception: {str(e)}"
                time.sleep(1)

    return False, None, last_error

def update_script_with_ai(existing_code, description, is_multithreaded=True):
    """Updates an existing Python script using Gemini API based on user feedback."""
    api_key = os.environ.get("GOOGLE_API_KEY", "").strip() or get_gemini_api_key()
    if api_key:
        print(f"[DEBUG] Using API Key: {api_key[:5]}...{api_key[-5:]}")
    
    if not api_key:
        return "# Error: No API Key found for update."

    # Process: Clean inputs so AI doesn't see old headers
    existing_code = clean_ai_headers(existing_code)

    # Dynamic Model Discovery for Update (Copied from generate for reliability)
    selected_model = None
    available_models = [] # Init to avoid UnboundLocalError
    try:
        models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        m_resp = requests.get(models_url, timeout=5)
        if m_resp.status_code == 200:
            data = m_resp.json()
            available_models = [m['name'].replace('models/', '') for m in data.get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
            preferences = [
                "gemini-2.5-pro", "gemini-3-pro-preview", "gemini-2.0-flash", 
                "gemini-pro-latest", "gemini-1.5-pro-latest", "gemini-1.5-pro",
                "gemini-flash-latest", "gemini-1.5-flash-latest", "gemini-1.5-flash",
                "gemini-1.0-pro", "gemini-pro"
            ]
            for pref in preferences:
                if pref in available_models:
                    selected_model = pref
                    break
            
            # Smart fallback: If no preference match, pick ANY gemini model
            if not selected_model:
                for m in available_models:
                     if 'gemini' in m: 
                         selected_model = m
                         break
    except: pass

    # Construct candidate list: Selected (Best) -> Fallbacks (High Quota)
    fallback_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]
    
    candidates = []
    if selected_model:
        candidates.append(selected_model)
    
    # Append fallbacks if they are valid/available
    for fb in fallback_models:
        if fb not in candidates:
             if available_models: 
                 if fb in available_models: candidates.append(fb)
             else:
                 candidates.append(fb)

    models_to_try = candidates if candidates else fallback_models
    models_to_try = list(dict.fromkeys([m for m in models_to_try if m]))

    import_check = "- `from data_platform import thread_utils` -> CHANGE TO `import thread_utils`" if is_multithreaded else "- REMOVE `thread_utils` imports if present. Switch to sequential processing."
    
    if is_multithreaded:
        lock_req = "11. **CRITICAL - RUN ONCE / MASTER DATA STEPS**:\n       - Use **Double-Checked Locking** pattern with `threading.Lock()` to fetch once."
        cache_ins = "Do NOT use `global` keywords. Use the closure-based `cache` dictionary pattern described above."
    else:
        lock_req = "11. **CRITICAL - RUN ONCE / MASTER DATA STEPS**:\n       - Fetch data once in `run()`. Do NOT use `threading.Lock`. Do NOT use threads."
        cache_ins = "Use a closure-based `cache` dictionary or simple local variable in `run`. No globals."

    prompt = f"""
    You are an expert Python developer preserving legacy logic during updates.
    Task: Update the "Existing Code" to incorporate changes from the "NEW Workflow Description", while strictly PRESERVING all unmentioned logic.
    
    NEW Workflow Description (High-level Intents):
    {description}
    
    Existing Code (Source of Truth for Implementation Details):
    ```python
    {existing_code}
    ```
    
    CRITICAL INSTRUCTIONS - PRESERVATION IS PARAMOUNT:
    1. The "Existing Code" contains essential business logic, helper functions, and complex field mappings that MUST BE PRESERVED.
    2. The "Workflow Description" is a lossy summary. If it implies a step that exists in the code, KEEP THE CODE'S DETAILED IMPLEMENTATION.
       - Example: If code has `address` with 13 fields, and description just says "Step X: Address", DO NOT reduce it to a string. Keep the 13 fields.
    3. ONLY modify code if the description EXPLICITLY mandates a change (e.g. "Change payload field X to Y", "Add new step Z").
    4. DO NOT re-write helper functions (like `get_location_details`). Keep them exactly as is.
    5. DO NOT flatten nested JSON structures (e.g. `data.tags`) unless explicitly told to.
    6. PRESERVE `attribute_utils` usage.
    6. PRESERVE `attribute_utils` usage.
    7. **API PATHS**: Use the EXACT path provided in the description. Do NOT simplify or "clean" invalid-looking paths. Trust the user.
    8. **CRITICAL CORRECTION**: check imports.
       {import_check}
       - `from data_platform import attribute_utils` -> CHANGE TO `import attribute_utils`
       - The `data_platform` package DOES NOT EXIST. Use standard top-level imports.
       - Ensure `import json`, `import os`, `import tempfile` are present if using caching.
     9. **PRESERVE HARDCODED KEYS**: If the script contains a hardcoded `GOOGLE_API_KEY`, **DO NOT** replace it with `os.environ` or `db.json` reads. Keep the string literal exactly as is.
    CRITICAL - CASE INSENSITIVITY & WHITESPACE:
       - Ensure all new logic uses case-insensitive matching AND handles whitespace.
       - Store map keys as STRIPPED LOWERCASE: `key = str(name).strip().lower()`.
       - Lookup using STRIPPED LOWERCASE keys.
    10. **CRITICAL - ROW GROUPING & CONFIGURATION**:
       - If the code uses `process_group` or groups rows:
         - **REQUIRED**: Add comment: `# CONFIG: groupByColumn="<parent_id_column>"` (e.g. "name")
         - **REQUIRED**: Add comment: `# CONFIG: isMultithreaded=True` (Enable threading for groups)
         - **REQUIRED**: Add comment: `# CONFIG: batchSize=1` (Process 1 Group per Batch/Thread)
       - If standard row-by-row:
         - `# CONFIG: isMultithreaded=True`
         - `# CONFIG: batchSize=10`
       - You MUST return `rows` (the list of all rows), NOT `[main_row]`.
       - Logic: `for row in rows: row['status']...` -> `return rows`

    11. **PARENT-CHILD / THREADING HAZARD**:
       - If implementing "One-to-Many" logic (e.g. creating Variety with Stages):
       - **WARNING**: Standard row-based threading triggers "Duplicate" errors if child rows are split across threads.
       - Grouping MUST happen inside `run()`: `grouped = {{k: [rows]...}}`.
       - Use `process_group((key, rows))` logic.

    {lock_req}
       - If a step is described as "Run Once", "Master Data", or "Setup" (e.g. Fetching Crops, Tags, Locations):
       - **DO NOT** put this API call inside `process_row` or the loop.
       - **PRESERVE** existing caching logic (e.g. `if cache['crop_map'] is None: ...`).
       - If implementing NEW "Run Once" logic:
         1. Initialize a cache container in `run()` (e.g. `cache = dict(key=None)`).
         2. Store result in cache.
         3. Use cached data inside `process_row` / `process_group`.
    12. **CRITICAL - CACHING / GLOBAL VARIABLES**:
       - {cache_ins}
    
    Output:
    The FULL, valid, updated Python script.
    """
    
    # Payload
    payload = { "contents": [{ "parts": [{"text": prompt}] }] }
    
    success, content, last_error = _call_gemini_with_candidates(api_key, models_to_try, payload)

    if success:
        return f"{_get_ist_header('AI Updated Script')}\n{content}"
 
    error_comment = "\n".join(f"# {line}" for line in str(last_error).splitlines())
    return f"{_get_ist_header('AI Update Failed')}\n# Error:\n{error_comment}\n\n# Original Code:\n{existing_code}"


if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
            
        req = json.loads(input_data)
        desc = req.get('description', '')
        existing_code = req.get('existing_code', '')
        input_columns = req.get('inputColumns', '')
        is_multithreaded = req.get('isMultithreaded', True)
        
        if existing_code:
            # Update Mode
            script_content = update_script_with_ai(existing_code, desc, is_multithreaded)
        else:
            # Generate Mode
            script_content = generate_script_with_ai(desc, is_multithreaded)
            
        # Prepend Input Columns Comment if available (Persist for Analyzer)
        if input_columns:
            # Ensure it's the very first line or close to it
            script_content = f"# EXPECTED_INPUT_COLUMNS: {input_columns}\n\n{script_content}"
        
        print("---JSON_START---")
        print(json.dumps({"status": "success", "script": script_content}))
        
    except Exception as e:
        print("---JSON_START---")
        print(json.dumps({"status": "error", "message": str(e)}))
