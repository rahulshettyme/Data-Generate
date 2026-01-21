// =============================================
// DATA GENERATE SCRIPT
// =============================================

// State
let authToken = null;
let currentEnvironment = null;
let currentTenant = null;
let selectedDataType = null;
let uploadedData = [];
let executionResults = [];
let savedLocations = [];
let ENVIRONMENT_API_URLS = {};
let ENVIRONMENT_URLS = {};

// Load Env URLs on start
async function loadEnvUrls() {
    try {
        const res = await fetch('/api/env-urls');
        const data = await res.json();
        ENVIRONMENT_API_URLS = data.environment_api_urls || {};
        ENVIRONMENT_URLS = data.environment_urls || {};
        console.log('Loaded Environment URLs:', Object.keys(ENVIRONMENT_API_URLS));
    } catch (e) {
        console.error('Failed to load env URLs:', e);
    }
}

// Helper to get URLs for environment
function getEnvUrls(environment) {
    let apiBaseUrl = null;
    let frontendUrl = null;

    if (environment) {
        // Case-insensitive lookup
        const apiKeys = Object.keys(ENVIRONMENT_API_URLS);
        const envKey = apiKeys.find(k => k.toLowerCase() === environment.toLowerCase());
        if (envKey) {
            apiBaseUrl = ENVIRONMENT_API_URLS[envKey];
        }

        const feKeys = Object.keys(ENVIRONMENT_URLS);
        const feKey = feKeys.find(k => k.toLowerCase() === environment.toLowerCase());
        if (feKey) {
            frontendUrl = ENVIRONMENT_URLS[feKey];
        }
    }
    return { apiBaseUrl, frontendUrl };
}

// Constants for coordinate generation

// Constants for coordinate generation
const ACRE_M2 = 4046.8564224;

// =============================================
// RESET STATE
// =============================================
// =============================================
// RESET STATE (Partial Reset - Persists Login)
// =============================================
function resetState() {
    // DO NOT CLEAR AUTH TOKEN HERE
    // authToken = null;
    // currentEnvironment = null;
    // currentTenant = null;

    uploadedData = [];
    executionResults = [];

    // Reset UI
    if (elements.fileName) elements.fileName.textContent = 'Supported formats: .xlsx, .xls';
    if (elements.fileUpload) elements.fileUpload.value = '';
    if (elements.executeBtn) {
        elements.executeBtn.disabled = true;
        elements.executeBtn.textContent = '🚀 Execute Data Creation';
    }
    if (elements.resultsSection) elements.resultsSection.classList.add('hidden');
    if (elements.progressBar) elements.progressBar.style.width = '0%';
    if (elements.progressText) elements.progressText.textContent = '0 / 0';
    if (elements.passCount) elements.passCount.textContent = '0';
    if (elements.failCount) elements.failCount.textContent = '0';
    if (elements.resultsTbody) elements.resultsTbody.innerHTML = '';
}

// Full Logout
function fullLogout() {
    authToken = null;
    currentEnvironment = null;
    currentTenant = null;

    // Reset Data
    resetState();

    // UI Updates
    if (elements.sessionContainer) elements.sessionContainer.classList.add('hidden');
    if (elements.loginComponentContainer) elements.loginComponentContainer.classList.remove('hidden');

    // Disable Upload Area
    if (elements.uploadWorkflowContainer) {
        elements.uploadWorkflowContainer.classList.add('disabled-area');
        elements.uploadWorkflowContainer.style.opacity = '0.5';
        elements.uploadWorkflowContainer.style.pointerEvents = 'none';
    }
}

// Template Definitions
const TEMPLATES = {


};



// DOM Elements
// DOM Elements
const elements = {
    dataNeededForSelect: document.getElementById('data-needed-for'),
    dataTypeSelect: document.getElementById('data-type-select'), // Hidden input
    scriptDisplay: document.getElementById('script-display'),
    scriptDropdown: document.getElementById('script-dropdown-container'),
    scriptMenu: document.getElementById('script-dropdown-menu'),
    scriptSearch: document.getElementById('script-search'),
    scriptSearchClear: document.getElementById('script-search-clear'),
    scriptList: document.getElementById('script-list'),

    templateInfo: document.getElementById('template-info'),
    templateTypeName: document.getElementById('template-type-name'),
    templateColumns: document.getElementById('template-columns'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    loginSection: document.getElementById('login-section'),
    loginFormContainer: document.getElementById('login-form-container'),

    // Login elements replaced by component but we keep session container
    sessionContainer: document.getElementById('session-container'),
    sessionInfo: document.getElementById('session-info'),
    logoutBtn: document.getElementById('logout-btn'),
    fileUploadArea: document.getElementById('file-upload-area'),
    fileUpload: document.getElementById('file-upload'),
    fileName: document.getElementById('file-name'),
    executeBtn: document.getElementById('execute-btn'),
    resultsSection: document.getElementById('results-section'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),
    passCount: document.getElementById('pass-count'),
    failCount: document.getElementById('fail-count'),
    executionTime: document.getElementById('execution-time'),
    downloadResultsBtn: document.getElementById('download-results-btn'),
    resultsTbody: document.getElementById('results-tbody'),
    // Boundary elements
    boundaryConfig: document.getElementById('boundary-config'),
    savedLocationSelect: document.getElementById('saved-location-select'),
    deleteLocationBtn: document.getElementById('delete-location-btn'),
    minLat: document.getElementById('min-lat'),
    maxLat: document.getElementById('max-lat'),
    minLong: document.getElementById('min-long'),
    maxLong: document.getElementById('max-long'),
    locationName: document.getElementById('location-name'),
    saveLocationBtn: document.getElementById('save-location-btn'),

    // Import Script Elements
    toggleImportLink: document.getElementById('toggle-import-section'),
    importScriptSection: document.getElementById('import-script-section'),
    importScriptFile: document.getElementById('import-script-file'),
    importScriptJson: document.getElementById('import-script-json'),
    cancelImportBtn: document.getElementById('cancel-import-btn'),
    confirmImportBtn: document.getElementById('confirm-import-btn'),

    // Workflow Container
    uploadWorkflowContainer: document.getElementById('upload-workflow-container'),
    loginComponentContainer: document.getElementById('login-component-container'),

    // Additional Attributes
    additionalAttributesSection: document.getElementById('additional-attributes-section'),
    enableAdditionalAttributes: document.getElementById('enable-additional-attributes'),
    additionalAttributesInputContainer: document.getElementById('additional-attributes-input-container'),
    additionalAttributesInput: document.getElementById('additional-attributes-input'),
    gdprSection: document.getElementById('gdpr-section'),
    isGdprTenant: document.getElementById('is-gdpr-tenant'),

    // Advanced Settings
    advancedSettingsSection: document.getElementById('advanced-settings-section'),
    groupBySelect: document.getElementById('group-by-select')
};



// =============================================
// TEAM & DATA TYPE SELECTION
// =============================================

const TEAM_SCRIPTS = {
    cs_team: [],
    qa_team: []
};

// =============================================
// DYNAMIC SCRIPT LOADING
// =============================================
async function loadCustomScripts() {
    try {
        const res = await fetch('/api/scripts/custom', { cache: 'no-store' });
        const scripts = await res.json();

        console.log(`[LoadScripts] Fetched ${scripts.length} scripts`);

        scripts.forEach(script => {
            // Register Template
            // Use the filename (or a key) as the ID, ensuring it doesn't conflict
            const scriptKey = script.name.replace('.py', '');

            console.log(`[LoadScripts] Processing: ${scriptKey}, Team: ${script.team}`);

            TEMPLATES[scriptKey] = {
                name: script.display_name || script.name.replace('.py', ''),
                columns: (script.columns || []).map(c => ({
                    header: c.name,
                    key: c.name.toLowerCase().replace(/ /g, '_'),
                    required: c.type === 'Mandatory',
                    description: c.description
                })),
                isCustom: true,
                filename: script.filename || script.name,
                requiresLogin: script.requiresLogin,
                allowAdditionalAttributes: script.allowAdditionalAttributes,
                isMultithreaded: script.isMultithreaded,
                groupByColumn: script.groupByColumn,
                batchSize: script.batchSize
            };

            // Add to Team Lists
            // script.team should be 'QA' or 'CS' or 'Both'
            const team = (script.team || 'QA').toLowerCase();
            if (team.includes('qa') || team === 'both') {
                if (!TEAM_SCRIPTS.qa_team.includes(scriptKey)) {
                    TEAM_SCRIPTS.qa_team.push(scriptKey);
                }
            }
            if (team.includes('cs') || team === 'both') {
                if (!TEAM_SCRIPTS.cs_team.includes(scriptKey)) {
                    TEAM_SCRIPTS.cs_team.push(scriptKey);
                }
            }
        });

        console.log('Custom scripts loaded:', scripts.length);
        console.log('Teams:', JSON.stringify(TEAM_SCRIPTS, null, 2));

        // Re-render if team is selected
        if (elements.dataNeededForSelect && elements.dataNeededForSelect.value) {
            handleTeamSelection(elements.dataNeededForSelect.value);
        }

    } catch (e) {
        console.error('Failed to load custom scripts:', e);
    }
}

// Call on load
loadCustomScripts();

// =============================================
// REUSABLE SEARCHABLE DROPDOWN LOGIC
// =============================================
function setupSearchableDropdown(config) {
    const { display, menu, search, searchClear, list, hiddenInput, onSelect } = config;

    // Toggle Menu
    display.addEventListener('click', (e) => {
        if (display.classList.contains('disabled')) return;
        e.stopPropagation();
        // Close others if needed (optional)
        document.querySelectorAll('.custom-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
        if (menu.classList.contains('show')) {
            search.focus();
        }
    });

    // Search Filter
    search.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();

        // Toggle Clear Icon
        if (term.length > 0) {
            searchClear.classList.add('visible');
        } else {
            searchClear.classList.remove('visible');
        }

        const items = list.querySelectorAll('.custom-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(term)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Clear Search
    if (searchClear) {
        searchClear.addEventListener('click', (e) => {
            e.stopPropagation();
            search.value = '';
            searchClear.classList.remove('visible');
            const items = list.querySelectorAll('.custom-item');
            items.forEach(item => item.style.display = 'block');
            search.focus();
        });
    }

    // Select Item (Event Delegation)
    list.addEventListener('click', (e) => {
        if (e.target.classList.contains('custom-item')) {
            const value = e.target.getAttribute('data-value');
            const text = e.target.textContent;

            // Update UI
            display.textContent = text;
            display.style.color = '#264554'; // Ensure text color is reset/correct
            hiddenInput.value = value;

            // Highlight selected
            list.querySelectorAll('.custom-item').forEach(item => item.classList.remove('selected'));
            e.target.classList.add('selected');

            // Hide menu
            menu.classList.remove('show');
            search.value = ''; // Reset search
            if (searchClear) searchClear.classList.remove('visible'); // Reset clear icon
            const items = list.querySelectorAll('.custom-item'); // Reset list visibility
            items.forEach(item => item.style.display = 'block');

            // Trigger callback
            if (typeof onSelect === 'function') {
                onSelect(value, text);
            }
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!display.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('show');
        }
    });
}

// Initialize Dropdowns
// Script Dropdown
setupSearchableDropdown({
    display: elements.scriptDisplay,
    menu: elements.scriptMenu,
    search: elements.scriptSearch,
    searchClear: elements.scriptSearchClear,
    list: elements.scriptList,
    hiddenInput: elements.dataTypeSelect,
    onSelect: (value) => {
        // Trigger existing logic
        handleScriptSelection(value);
    }
});

// Environment Dropdown Logic REMOVED (Handled by Component)

// Extracted function for populating scripts and handling UI based on team selection
function handleTeamSelection(team) {
    console.log(`[handleTeamSelection] Called with team: ${team}`);
    try {
        resetState();
        let availableScripts = TEAM_SCRIPTS[team] || [];
        console.log(`[handleTeamSelection] Found ${availableScripts.length} scripts for ${team}`);

        // Sort scripts by name
        availableScripts.sort((a, b) => {
            const nameA = TEMPLATES[a] ? TEMPLATES[a].name.toLowerCase() : '';
            const nameB = TEMPLATES[b] ? TEMPLATES[b].name.toLowerCase() : '';
            return nameA.localeCompare(nameB);
        });

        // Handle Environment Visibility based on Team
        if (team === 'cs_team') {
            if (elements.loginEnvGroup) elements.loginEnvGroup.classList.add('hidden');
            // Also hide the environment dropdown itself if it's part of a custom-dropdown structure
            if (elements.envDisplay) elements.envDisplay.closest('.custom-dropdown').parentElement.classList.add('hidden');
        } else {
            if (elements.loginEnvGroup) elements.loginEnvGroup.classList.remove('hidden');
            if (elements.envDisplay) elements.envDisplay.closest('.custom-dropdown').parentElement.classList.remove('hidden');
        }

        // Clear list
        elements.scriptList.innerHTML = '';

        // Populate list
        availableScripts.forEach(scriptKey => {
            const template = TEMPLATES[scriptKey];
            if (template) {
                const li = document.createElement('li');
                li.classList.add('custom-item'); // UPDATED CLASS
                li.setAttribute('data-value', scriptKey);
                li.textContent = template.name;
                elements.scriptList.appendChild(li);
            }
        });

        // Enable Dropdown
        console.log('[handleTeamSelection] Enabling dropdown');
        elements.scriptDisplay.classList.remove('disabled');
        elements.scriptDisplay.textContent = 'Select Script';
        elements.dataTypeSelect.value = "";

        // Reset UI state
        elements.templateInfo.classList.add('hidden');
        elements.boundaryConfig.classList.add('hidden');
        elements.exportBtn.disabled = true;
        elements.importBtn.disabled = true;
        selectedDataType = null;
    } catch (err) {
        console.error('[handleTeamSelection] Error:', err);
        alert('Error selecting team: ' + err.message);
    }
}

// Asset Reference Data Cache
let assetRefData = {
    farmers: [],
    soilTypes: [],
    irrigationTypes: []
};

// Tag Reference Data Cache
let tagRefData = [];

async function loadAssetReferenceData() {
    try {
        console.log('Loading asset reference data...');
        const query = `?environment=${currentEnvironment}&tenant=${currentTenant}`;
        const [farmers, soils, irrigations] = await Promise.all([
            fetch(`/api/data-generate/farmers-list${query}`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()),
            fetch(`/api/data-generate/soil-types${query}`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()),
            fetch(`/api/data-generate/irrigation-types${query}`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json())
        ]);

        assetRefData.farmers = Array.isArray(farmers) ? farmers : [];
        assetRefData.soilTypes = Array.isArray(soils) ? soils : [];
        assetRefData.irrigationTypes = Array.isArray(irrigations) ? irrigations : [];
        console.log('Asset reference data loaded');
    } catch (e) {
        console.error('Failed to load reference data', e);
        throw new Error('Failed to load reference data: ' + e.message);
    }
}


if (elements.dataNeededForSelect) {
    elements.dataNeededForSelect.addEventListener('change', (e) => {
        handleTeamSelection(e.target.value);
    });
}

// Initialize
function init() {
    // Load Env URLs
    loadEnvUrls();

    // Load Scripts
    loadCustomScripts();
    loadSavedLocations();

    // If team is already selected, populate scripts
    if (elements.dataNeededForSelect && elements.dataNeededForSelect.value) {
        handleTeamSelection(elements.dataNeededForSelect.value);
    }
}
init();

// Additional Attributes Toggle Listener
if (elements.enableAdditionalAttributes) {
    elements.enableAdditionalAttributes.addEventListener('change', (e) => {
        if (e.target.checked) {
            elements.additionalAttributesInputContainer.classList.remove('hidden');
        } else {
            elements.additionalAttributesInputContainer.classList.add('hidden');
        }
    });
}

function handleScriptSelection(value) {
    resetState();
    selectedDataType = value;
    const template = TEMPLATES[selectedDataType];

    // Show/hide boundary config based on type AND team
    const selectedTeam = elements.dataNeededForSelect ? elements.dataNeededForSelect.value : '';
    const needsBoundary = (selectedDataType === 'Generate Coordinates' || selectedDataType === 'Area Audit');
    const isCSTeam = (selectedTeam === 'cs_team');

    if (needsBoundary && !isCSTeam) {
        elements.boundaryConfig.classList.remove('hidden');
    } else {
        elements.boundaryConfig.classList.add('hidden');
    }

    // Reset Additional Attributes UI
    if (elements.additionalAttributesSection) elements.additionalAttributesSection.classList.add('hidden');
    if (elements.enableAdditionalAttributes) elements.enableAdditionalAttributes.checked = false;
    if (elements.additionalAttributesInputContainer) elements.additionalAttributesInputContainer.classList.add('hidden');
    if (elements.additionalAttributesInput) elements.additionalAttributesInput.value = '';

    // Reset GDPR UI
    if (elements.gdprSection) elements.gdprSection.classList.add('hidden');
    if (elements.isGdprTenant) elements.isGdprTenant.checked = false;

    // Show/Hide Attributes based on Template Metadata
    if (template && template.allowAdditionalAttributes) {
        if (elements.additionalAttributesSection) elements.additionalAttributesSection.classList.remove('hidden');
    }

    // Show/Hide GDPR for Create Farmer
    // We check via filename relative to the converted name
    if (value === 'Create_Farmer.py' || (template && template.name && template.name.includes('Create_Farmer'))) {
        if (elements.gdprSection) elements.gdprSection.classList.remove('hidden');
    }

    // Show template info for types other than coordinates
    if (template && selectedDataType !== 'coordinates') {
        elements.templateTypeName.textContent = template.name;
        elements.templateColumns.innerHTML = template.columns
            .map(col => `<li><strong>${col.header}</strong>${col.required ? ' (required)' : ''} - ${col.description}</li>`)
            .join('');
        elements.templateInfo.classList.remove('hidden');
    } else {
        elements.templateInfo.classList.add('hidden');
    }

    // Enable buttons if template exists
    if (template) {
        elements.exportBtn.disabled = false;
        elements.importBtn.disabled = false;

        // Populate "Group By" Dropdown with columns
        if (elements.groupBySelect && elements.advancedSettingsSection) {
            elements.advancedSettingsSection.classList.remove('hidden');
            elements.groupBySelect.innerHTML = '<option value="">None (Sequential Batching)</option>';

            if (template.columns && template.columns.length > 0) {
                template.columns.forEach(col => {
                    const option = document.createElement('option');
                    // Use the key (normalized) or header? Ideally the key we expect in the row data.
                    // The scripts usually map headers to keys. Let's use the 'header' as that matches the user's mental model,
                    // but the execution logic checks keys.
                    // The implementation above used: `let keyVal = row[groupByColumn]`.
                    // row keys come from Excel headers usually.
                    option.value = col.header; // Use exact header name
                    option.textContent = col.header;
                    elements.groupBySelect.appendChild(option);
                });
            }

            // Auto-select if configured
            if (template.groupByColumn) {
                // Find matching option (case insensitive search if needed, but exact match first)
                // We set value = col.header. So if config says "name", header "name" matches.
                elements.groupBySelect.value = template.groupByColumn;

                // Fallback: if value didn't stick (e.g. config "name" vs header "Name"), try to find case-insensitive match
                if (!elements.groupBySelect.value) {
                    const match = Array.from(elements.groupBySelect.options).find(opt => opt.value.toLowerCase() === template.groupByColumn.toLowerCase());
                    if (match) elements.groupBySelect.value = match.value;
                }
            }
        }
    } else {
        elements.exportBtn.disabled = true;
        elements.importBtn.disabled = true;
        if (elements.advancedSettingsSection) elements.advancedSettingsSection.classList.add('hidden');
    }
}

// =============================================
// SAVED LOCATIONS MANAGEMENT
// =============================================
async function loadSavedLocations() {
    try {
        const res = await fetch('/api/saved-locations');
        savedLocations = await res.json();
    } catch (e) {
        console.error('Failed to load saved locations', e);
        savedLocations = [];
    }
    renderSavedLocations();
}

async function saveSavedLocations() {
    try {
        await fetch('/api/saved-locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(savedLocations)
        });
    } catch (e) {
        console.error('Failed to save locations', e);
    }
}

function renderSavedLocations() {
    if (!elements.savedLocationSelect) return;

    savedLocations.forEach((loc, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = loc.name;
        elements.savedLocationSelect.appendChild(option);
    });
}

function renderExecutionResults() {
    // Clear existing
    elements.resultsTbody.innerHTML = '';

    // Track seen names for grouping (User Request: Show only one row per variety)
    const seenNames = new Set();

    executionResults.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Grouping Logic: Check 'name' column (case-insensitive)
        let isDuplicate = false;
        if (row.name) { // Assuming 'name' is the key
            const nameKey = String(row.name).trim().toLowerCase();
            if (seenNames.has(nameKey)) {
                isDuplicate = true;
            } else {
                seenNames.add(nameKey);
            }
        }

        // If duplicate, you can choose to hide it or style it differently
        // Requested: "No need to show all the rows for same crop variety"
        if (isDuplicate) {
            tr.style.display = 'none';
        }

        const tdIndex = document.createElement('td');
        // Use the original index + 1, or re-calculate visible index? 
        // Showing original index helps map to Excel
        tdIndex.textContent = index + 1;
        tr.appendChild(tdIndex);

        // Name Column
        const tdName = document.createElement('td');
        tdName.textContent = row.name || '-';
        tr.appendChild(tdName);

        // Code Column
        const tdCode = document.createElement('td');
        tdCode.textContent = row.code || '-'; // Assuming 'code' exists or similar
        tr.appendChild(tdCode);

        // Status Column
        const tdStatus = document.createElement('td');
        // ... (existing status logic)
        // ...
        if (row.status === 'Success') {
            tdStatus.textContent = 'Passed';
            tdStatus.classList.add('status-pass');
        } else if (String(row.status).startsWith('Failed')) {
            tdStatus.textContent = row.status;
            tdStatus.classList.add('status-fail');
        } else {
            tdStatus.textContent = row.status;
            tdStatus.classList.add('status-pending');
        }
        tr.appendChild(tdStatus);

        // Response Column
        const tdResponse = document.createElement('td');
        tdResponse.textContent = row['API response'] || '';
        tr.appendChild(tdResponse);

        elements.resultsTbody.appendChild(tr);
    });
}

// Saved location selection
if (elements.savedLocationSelect) {
    elements.savedLocationSelect.addEventListener('change', (e) => {
        const index = e.target.value;
        if (index !== '') {
            const loc = savedLocations[parseInt(index)];
            elements.minLat.value = loc.minLat;
            elements.maxLat.value = loc.maxLat;
            elements.minLong.value = loc.minLong;
            elements.maxLong.value = loc.maxLong;
            elements.deleteLocationBtn.classList.remove('hidden');
        } else {
            elements.minLat.value = '';
            elements.maxLat.value = '';
            elements.minLong.value = '';
            elements.maxLong.value = '';
            elements.deleteLocationBtn.classList.add('hidden');
        }
    });
}

// Save location button
if (elements.saveLocationBtn) {
    elements.saveLocationBtn.addEventListener('click', () => {
        const name = elements.locationName.value.trim();
        const minLat = parseFloat(elements.minLat.value);
        const maxLat = parseFloat(elements.maxLat.value);
        const minLong = parseFloat(elements.minLong.value);
        const maxLong = parseFloat(elements.maxLong.value);

        if (!name) {
            alert('Please enter a name for this location');
            return;
        }
        if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLong) || isNaN(maxLong)) {
            alert('Please fill in all boundary values');
            return;
        }

        savedLocations.push({ name, minLat, maxLat, minLong, maxLong });
        saveSavedLocations();
        renderSavedLocations();
        elements.locationName.value = '';
        alert(`Location "${name}" saved!`);
    });
}

// Delete location button
if (elements.deleteLocationBtn) {
    elements.deleteLocationBtn.addEventListener('click', () => {
        const index = elements.savedLocationSelect.value;
        if (index !== '') {
            const loc = savedLocations[parseInt(index)];
            if (confirm(`Delete location "${loc.name}"?`)) {
                savedLocations.splice(parseInt(index), 1);
                saveSavedLocations();
                renderSavedLocations();
                elements.minLat.value = '';
                elements.maxLat.value = '';
                elements.minLong.value = '';
                elements.maxLong.value = '';
                elements.deleteLocationBtn.classList.add('hidden');
            }
        }
    });
}

// =============================================
// COORDINATE GENERATION FUNCTIONS
// =============================================
function metersPerDegree(latDeg) {
    const lat = latDeg * Math.PI / 180;
    const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat) - 0.0023 * Math.cos(6 * lat);
    const mPerDegLon = 111412.84 * Math.cos(lat) - 93.5 * Math.cos(3 * lat) + 0.118 * Math.cos(5 * lat);
    return { mPerDegLat, mPerDegLon };
}

function generateSquareOneAcre(bbox, rotate = false) {
    const [minLon, minLat, maxLon, maxLat] = bbox;

    // Pick random center point inside bbox
    const cLon = minLon + Math.random() * (maxLon - minLon);
    const cLat = minLat + Math.random() * (maxLat - minLat);

    // Side of square in meters
    const sideM = Math.sqrt(ACRE_M2);

    // Convert to degrees
    const { mPerDegLat, mPerDegLon } = metersPerDegree(cLat);
    const dLat = sideM / mPerDegLat;
    const dLon = sideM / mPerDegLon;

    const halfDx = dLon / 2;
    const halfDy = dLat / 2;

    let corners;
    if (!rotate) {
        corners = [
            [cLon - halfDx, cLat - halfDy],
            [cLon + halfDx, cLat - halfDy],
            [cLon + halfDx, cLat + halfDy],
            [cLon - halfDx, cLat + halfDy]
        ];
    } else {
        const angle = Math.random() * 2 * Math.PI;
        corners = [];
        const offsets = [[-halfDx, -halfDy], [halfDx, -halfDy], [halfDx, halfDy], [-halfDx, halfDy]];
        for (const [dx, dy] of offsets) {
            const x = dx * Math.cos(angle) - dy * Math.sin(angle);
            const y = dx * Math.sin(angle) + dy * Math.cos(angle);
            corners.push([cLon + x, cLat + y]);
        }
    }

    // Close polygon (repeat first point)
    const ring = [...corners, corners[0]];
    // Return in MultiPolygon format: [[[lon, lat], ...]]
    return [[ring]];
}

// Helper to ensure coordinates are in MultiPolygon format [[[lon, lat], ...]]
function ensureMultiPolygonFormat(coords) {
    if (!Array.isArray(coords) || coords.length === 0) {
        throw new Error('Invalid coordinates array');
    }

    // Check depth of array
    // MultiPolygon: [[[[lon, lat]...]]] or [[[lon, lat]...]]
    // Polygon: [[[lon, lat]...]] or [[lon, lat]...]

    // If first element is a number, it's a single point - wrap it
    if (typeof coords[0] === 'number') {
        return [[[coords]]];
    }

    // If first element's first element is a number, it's a ring of points
    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        // coords = [[lon, lat], [lon, lat], ...] - single ring
        return [[coords]];
    }

    // If first element's first element's first element is a number, it's a polygon
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && typeof coords[0][0][0] === 'number') {
        // coords = [[[lon, lat], ...]] - polygon format, wrap in MultiPolygon
        return [coords];
    }

    // Already in MultiPolygon format or deeper
    return coords;
}

// =============================================
// EXPORT TEMPLATE
// =============================================
elements.exportBtn.addEventListener('click', () => {
    if (!selectedDataType) return;

    const template = TEMPLATES[selectedDataType];
    if (!template) return;

    // Create workbook with headers
    const wb = XLSX.utils.book_new();

    // DEBUG: Alert columns to verify state
    if (!template.columns || template.columns.length === 0) {
        console.error('Template columns missing:', template);
    } else {
        console.log('Template columns:', template.columns);
    }

    const headers = template.columns.map(col => col.header);

    // Add Additional Attributes if enabled
    if (elements.enableAdditionalAttributes && elements.enableAdditionalAttributes.checked) {
        const extraAttrs = elements.additionalAttributesInput.value.split(',').map(s => s.trim()).filter(s => s);
        headers.push(...extraAttrs);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Set column widths
    ws['!cols'] = template.columns.map(() => ({ wch: 20 }));

    XLSX.utils.book_append_sheet(wb, ws, template.name.replace(/\s+/g, '_'));

    // Download
    const fileName = `${selectedDataType}_template.xlsx`;
    XLSX.writeFile(wb, fileName);
});

// =============================================
// IMPORT TEMPLATE (Show Login or File Upload)
// =============================================
elements.importBtn.addEventListener('click', () => {
    elements.loginSection.classList.remove('hidden');

    // Check if login is explicitly required
    const template = TEMPLATES[selectedDataType];
    const skipLogin = (template && template.requiresLogin === false) || selectedDataType === 'coordinates';

    if (skipLogin) {
        if (elements.loginComponentContainer) elements.loginComponentContainer.classList.add('hidden');
        elements.sessionContainer.classList.remove('hidden');
        elements.sessionInfo.textContent = 'No login required for this script';
        authToken = 'SKIPPED';

        // Enable Upload Area
        if (elements.uploadWorkflowContainer) {
            elements.uploadWorkflowContainer.classList.remove('disabled-area');
            elements.uploadWorkflowContainer.style.opacity = '1';
            elements.uploadWorkflowContainer.style.pointerEvents = 'auto';
        }
    } else {
        // If already logged in, keep it enabled
        if (authToken && authToken !== 'SKIPPED') {
            if (elements.loginComponentContainer) elements.loginComponentContainer.classList.add('hidden');
            elements.sessionContainer.classList.remove('hidden');
            // Enable Upload Area
            if (elements.uploadWorkflowContainer) {
                elements.uploadWorkflowContainer.classList.remove('disabled-area');
                elements.uploadWorkflowContainer.style.opacity = '1';
                elements.uploadWorkflowContainer.style.pointerEvents = 'auto';
            }
        } else {
            // Show Login
            if (elements.loginComponentContainer) elements.loginComponentContainer.classList.remove('hidden');
            elements.sessionContainer.classList.add('hidden');
            // Disable Upload Area
            if (elements.uploadWorkflowContainer) {
                elements.uploadWorkflowContainer.classList.add('disabled-area');
                elements.uploadWorkflowContainer.style.opacity = '0.5';
                elements.uploadWorkflowContainer.style.pointerEvents = 'none';
            }
        }
    }

    elements.loginSection.scrollIntoView({ behavior: 'smooth' });
});

// =============================================
// LOGIN HANDLING (VIA COMPONENT)
// =============================================
// Initialize Login Component
// Initialize Login Component
document.addEventListener("DOMContentLoaded", async () => {
    // Ensure Env URLs are loaded for the dropdown
    await loadEnvUrls();
    const envKeys = Object.keys(ENVIRONMENT_API_URLS);
    const envList = envKeys.length > 0 ? envKeys : ["QA1", "QA2", "QA3", "QA4", "QA5", "QA6", "QA7", "QA8", "Prod"];

    new LoginComponent("login-component-container", {
        envList: envList,
        onLoginSuccess: (token, userDetails) => {
            authToken = token;
            currentEnvironment = userDetails.environment;
            currentTenant = userDetails.tenant;

            // Update Session Info (Optional, if we want to show it somewhere)
            // For now, we are keeping the login form, so maybe we don't need to hide/show the session container
            // but we can update the text if it's visible.
            elements.sessionInfo.textContent = `${currentEnvironment} | ${currentTenant} | ${userDetails.username}`;
            // elements.sessionContainer.classList.remove('hidden'); // UNCOMMENT IF YOU WANT "Logged in as" TEXT TOO

            // Enable Upload Area
            if (elements.uploadWorkflowContainer) {
                elements.uploadWorkflowContainer.classList.remove('disabled-area');
                elements.uploadWorkflowContainer.style.opacity = '1';
                elements.uploadWorkflowContainer.style.pointerEvents = 'auto';
            }
        },
        onLoginFail: (error) => {
            console.log("Login Failed or Changed:", error);
            // Invalidate Token
            authToken = null;

            // Disable Upload Area
            if (elements.uploadWorkflowContainer) {
                elements.uploadWorkflowContainer.classList.add('disabled-area');
                elements.uploadWorkflowContainer.style.opacity = '0.5';
                elements.uploadWorkflowContainer.style.pointerEvents = 'none';
            }
        }
    });

    // Ensure upload area is disabled on load
    if (elements.uploadWorkflowContainer) {
        elements.uploadWorkflowContainer.classList.add('disabled-area');
    }
});

// =============================================
// LOGOUT HANDLING
// =============================================
elements.logoutBtn.addEventListener('click', fullLogout);

// =============================================
// FILE UPLOAD HANDLING
// =============================================
elements.fileUpload.addEventListener('change', handleFileUpload);

// Drag and drop support
elements.fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.fileUploadArea.classList.add('dragover');
});

elements.fileUploadArea.addEventListener('dragleave', () => {
    elements.fileUploadArea.classList.remove('dragover');
});

elements.fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.fileUploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        elements.fileUpload.files = files;
        handleFileUpload({ target: elements.fileUpload });
    }
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    elements.fileName.textContent = `📄 ${file.name}`;

    // Reset previous results when new file is uploaded
    executionResults = [];
    elements.resultsTbody.innerHTML = '';
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = '0 / 0';
    elements.passCount.textContent = '0';
    elements.failCount.textContent = '0';
    elements.downloadResultsBtn.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            uploadedData = jsonData;
            elements.fileName.textContent = `📄 ${file.name} (${jsonData.length} rows)`;
            elements.executeBtn.disabled = false;
            elements.executeBtn.textContent = '🚀 Execute Data Creation'; // Reset button text

        } catch (error) {
            console.error('Error parsing Excel:', error);
            elements.fileName.textContent = '❌ Error reading file';
            elements.executeBtn.disabled = true;
        }
    };
    reader.readAsArrayBuffer(file);
}

// Reset file input to allow re-selecting the same file
elements.fileUpload.addEventListener('click', function () {
    this.value = '';
});

// =============================================
// EXECUTE DATA CREATION
// =============================================
const BATCH_SIZE = 5; // Number of concurrent API calls

elements.executeBtn.addEventListener('click', async () => {




    // Check if Custom Script
    const template = TEMPLATES[selectedDataType];
    if (template && template.isCustom) {
        await executeCustomScript(template.filename);
        return;
    }

    // For other types, token is required
    if (!authToken || !selectedDataType || uploadedData.length === 0) return;

    let progressTitle = '⏳ Processing Data...';
    if (selectedDataType === 'addAsset') {
        progressTitle = '⏳ Loading Ref Data & Processing Assets...';
        // Pre-load reference data
        try {
            elements.executeBtn.disabled = true;
            elements.executeBtn.textContent = '⏳ Loading Reference Data...';
            await loadAssetReferenceData();
        } catch (e) {
            alert(e.message);
            elements.executeBtn.disabled = false;
            elements.executeBtn.textContent = '🚀 Execute Data Creation';
            return;
        }
    } else if (selectedDataType === 'addFarmerTag') {
        progressTitle = '⏳ Loading Tags...';
        try {
            elements.executeBtn.disabled = true;
            elements.executeBtn.textContent = '⏳ Loading Tags...';
            await loadTagReferenceData();
        } catch (e) {
            alert(e.message);
            elements.executeBtn.disabled = false;
            elements.executeBtn.textContent = '🚀 Execute Data Creation';
            return;
        }
    }

    let { passCount, failCount } = startExecution(progressTitle);
    const total = uploadedData.length;

    // Process in batches for parallel execution
    for (let batchStart = 0; batchStart < uploadedData.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, uploadedData.length);
        const batch = uploadedData.slice(batchStart, batchEnd);

        // Create promises for all rows in this batch
        const batchPromises = batch.map(async (row, batchIndex) => {
            const i = batchStart + batchIndex;
            const rowNum = i + 2;

            try {
                let result;
                if (selectedDataType === 'farmer') {
                    result = await createFarmer(row, rowNum);
                } else if (selectedDataType === 'addAsset') {
                    result = await createAsset(row, rowNum);
                } else if (selectedDataType === 'addFarmerTag') {
                    result = await addFarmerTag(row, rowNum);
                }
                return result;
            } catch (error) {
                return {
                    row: rowNum,
                    name: row['Farmer Name'] || '',
                    code: row['Farmer Code'] || '',
                    status: 'Fail',
                    response: error.message
                };
            }
        });

        // Wait for all batch promises to complete
        const batchResults = await Promise.all(batchPromises);

        // Process batch results
        for (const batchResult of batchResults) {
            // Python script returns a LIST of rows (or a single error dict if crashed)
            const results = Array.isArray(batchResult) ? batchResult : [batchResult];

            for (const result of results) {
                executionResults.push(result);
                if (result.status === 'Pass' || result.status === 'Success') {
                    passCount++;
                } else {
                    failCount++;
                }
                addResultRow(result);
            }
        }

        // Update progress after batch
        updateProgress(Math.min(batchEnd, total), total, passCount, failCount);
    }

    completeExecution();
});

// =============================================
// EXECUTE COORDINATE GENERATION
// =============================================





// =============================================
// CUSTOM SCRIPT EXECUTION
// =============================================
// =============================================
async function executeCustomScript(scriptName) {
    let { passCount, failCount } = startExecution();
    const rows = uploadedData;

    // 1. Get Environment Config
    const selectedEnv = currentEnvironment; // Use Global State
    if (!selectedEnv) {
        alert("Please login first.");
        return;
    }
    const { apiBaseUrl } = getEnvUrls(selectedEnv);
    const envConfig = {
        apiBaseUrl: apiBaseUrl,
        environment: selectedEnv
    };

    const total = rows.length;
    const template = TEMPLATES[selectedDataType];
    // Grouping Logic: AUTOMATIC - Use Template Configon, fallback to Template config
    // Grouping Logic: AUTOMATIC - Use Template Config
    let groupByColumn = (template && template.groupByColumn);

    // If empty string, treat as null/false
    if (!groupByColumn) groupByColumn = null;
    else console.log(`[Execute] Auto-detected Grouping Column: ${groupByColumn}`);

    const isMultithreaded = (template && template.isMultithreaded !== undefined) ? template.isMultithreaded : true;

    // CRITICAL: Determine Batch Size
    // If Not Multithreaded -> Batch Size = Total (One single synchronized call)
    // If Multithreaded -> Batch Size = Configured Size (Default 10)
    let BATCH_SIZE_CUSTOM = 10;
    if (!isMultithreaded) {
        BATCH_SIZE_CUSTOM = total; // No threading = Send all at once
        console.log(`[Execute] Threading DISABLED. Running as single batch of ${total}`);
    } else {
        BATCH_SIZE_CUSTOM = (template && template.batchSize) ? parseInt(template.batchSize) : 10;
        // ENABLED: Safety Guard for Infinite Loop
        if (!BATCH_SIZE_CUSTOM || BATCH_SIZE_CUSTOM < 1) {
            console.warn(`[Execute] Invalid Batch Size detected (${BATCH_SIZE_CUSTOM}). Defaulting to 10.`);
            BATCH_SIZE_CUSTOM = 10;
        }
        console.log(`[Execute] Threading ENABLED. Batch Size: ${BATCH_SIZE_CUSTOM}`);
    }

    let loopCount = 0;
    const maxLoopGuard = 100; // Emergency break

    console.log(`[Execute] Starting Execution. Total: ${total}, Batch Target: ${BATCH_SIZE_CUSTOM}`);

    // 1. Group Data (if needed)
    const groups = {};
    if (groupByColumn) {
        console.log(`[Execute] Grouping by column: ${groupByColumn}`);
        rows.forEach(row => {
            let keyVal = row[groupByColumn];
            if (keyVal === undefined) {
                // Case-insensitive fallback
                const foundKey = Object.keys(row).find(k => k.toLowerCase() === groupByColumn.toLowerCase());
                if (foundKey) keyVal = row[foundKey];
            }
            const key = keyVal || 'UNKNOWN_GROUP';
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
    }

    // 2. Create Batches
    const batches = [];

    if (groupByColumn) {
        const groupKeys = Object.keys(groups);
        let currentBatch = [];

        for (const key of groupKeys) {
            const groupRows = groups[key];

            // Flush current batch if adding this group exceeds target (unless batch is empty)
            if (currentBatch.length > 0 && (currentBatch.length + groupRows.length > BATCH_SIZE_CUSTOM)) {
                batches.push(currentBatch);
                currentBatch = [];
            }
            // Add entire group to keep it atomic
            currentBatch.push(...groupRows);
        }
        if (currentBatch.length > 0) batches.push(currentBatch);

    } else {
        // Standard Row Batching
        for (let i = 0; i < total; i += BATCH_SIZE_CUSTOM) {
            batches.push(rows.slice(i, i + BATCH_SIZE_CUSTOM));
        }
    }

    console.log(`[Execute] Created ${batches.length} batches from ${total} rows.`);

    try {
        // Execute Batches Sequentially (to ensure ordered processing, especially for grouping)
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchStartTime = Date.now();

            try {
                const response = await fetch('/api/scripts/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scriptName: scriptName,
                        rows: batch,
                        token: authToken,
                        envConfig: envConfig
                    })
                });

                if (!response.ok) {
                    const text = await response.text();
                    try {
                        const errorData = JSON.parse(text);
                        throw new Error(errorData.error || 'Execution Failed');
                    } catch (e) {
                        if (e.message !== 'Execution Failed' && !e.message.includes('JSON')) throw e;
                        // If parsing failed or generic error, throw raw text snippet
                        console.error('Server returned non-JSON error:', text);
                        throw new Error(`Server Error (${response.status}): ${text.substring(0, 200)}...`);
                    }
                }

                const text = await response.text();
                let results;
                try {
                    results = JSON.parse(text);
                } catch (e) {
                    console.error('Failed to parse successful response:', text);
                    throw new Error(`Invalid Server Response: ${text.substring(0, 200)}...`);
                }

                results.forEach((res, idx) => {
                    const uiResult = {
                        row: i + idx + 1,
                        name: res['Farmer Name'] || res['Asset Name'] || res['CAName'] || res['Name'] || res['name'] || 'Row ' + (i + idx + 1),
                        code: res['Farmer Code'] || res['Asset Code'] || res['CA_ID'] || res['CA ID'] || res['Code'] || res['code'] || res['Farmer ID'] || '-',
                        status: res['Status'] || 'Unknown',
                        response: res['API_Response'] || '',
                        ...res
                    };

                    executionResults.push(uiResult);

                    // Add to UI (Grouping will be handled by re-rendering or smart appending)
                    // For performance, re-rendering whole table 1000s of times is bad.
                    // But for this use case (<100 rows usually), it's fine.
                    // Let's call renderExecutionResults() to refresh the view with grouping.
                    renderExecutionResults();

                    if (uiResult.status === 'Success' || uiResult.status === 'Pass') {
                        passCount++;
                    } else {
                        failCount++;
                    }
                });

            } catch (error) {
                console.error('Batch failed:', error);
                batch.forEach((row, idx) => {
                    const uiResult = {
                        row: i + idx + 1,
                        name: 'Batch Error',
                        code: '-',
                        status: 'Fail',
                        response: error.message
                    };
                    executionResults.push(uiResult);
                    renderExecutionResults();
                    failCount++;
                });
            }

            // Calculate progress based on actual processed rows
            const currentProcessedCount = batches.slice(0, i + 1).reduce((acc, b) => acc + b.length, 0);
            updateProgress(currentProcessedCount, total, passCount, failCount);
            await sleep(100);
        }
    } catch (criticalError) {
        console.error("Critical Execution Error:", criticalError);
        alert("Execution stopped unexpectedly: " + criticalError.message);
    } finally {
        completeExecution();
    }
}



// =============================================
// ADD RESULT ROW
// =============================================
function addResultRow(result) {
    const tr = document.createElement('tr');
    // Check for both 'Pass' and 'Success' status values
    const isSuccess = result.status === 'Pass' || result.status === 'Success';
    // Display row as 1-indexed (result.row is already 1-indexed)
    const displayRow = result.row;

    // Use the raw response
    let responseText = result.response || '';

    tr.innerHTML = `
        <td>${displayRow}</td>
        <td>${result.name}</td>
        <td>${result.code}</td>
        <td class="${isSuccess ? 'status-pass' : 'status-fail'}">${result.status}</td>
        <td title="${responseText}">${responseText.substring(0, 70)}${responseText.length > 70 ? '...' : ''}</td>
    `;
    elements.resultsTbody.appendChild(tr);
}

// =============================================
// DOWNLOAD RESULTS
// =============================================
elements.downloadResultsBtn.addEventListener('click', () => {
    if (executionResults.length === 0) return;

    const TEMPLATE = TEMPLATES[selectedDataType] || {};

    // For Custom scripts, we want to include ALL generated columns merged with original entries
    let exportData;

    if (TEMPLATE.isCustom) {
        exportData = executionResults.map((result, index) => {
            const originalRow = uploadedData[index] || {};
            // User requested: "cropid column should be after cropname"
            // We can try to interleave if we know the schema, but generic "append" is safest for Custom scripts
            // unless we strictly conform to TEMPLATE.columns if defined.
            // If TEMPLATE.columns is NOT defined (likely for custom), we should just merge.

            // To ensure generated columns (like cropId) appear, we MUST mix in `result`.
            // But `result` also contains `row`, `name`, `code` which are UI meta-fields.
            // We should filter those out if they are purely internal, OR let the user see them.
            // Let's filter out known internal UI keys to keep it clean, but keep 'cropId' etc.
            const { row, name, code, status, response, ...generatedFields } = result;

            // Simple Merge: Original + Generated + Status + Response
            // This puts generated fields (cropId) *before* Status/Response which is usually better.
            return {
                ...originalRow,
                ...generatedFields,
                'Status': result.status,
                'API_Response': result.response
            };
        });
    } else {
        // Fallback for hardcoded templates (Area Audit, Coordinates etc.)
        if (selectedDataType === 'coordinates') {
            exportData = executionResults.map(result => ({
                'CAName': result.name,
                'CA_ID': result.code,
                'Coordinates': result.coordinates || '',
                'Status': result.status
            }));
        } else if (selectedDataType === 'areaAudit') {
            exportData = executionResults.map((result, index) => {
                const originalRow = uploadedData[index] || {};

                const findKey = (keys) => Object.keys(originalRow).find(k => keys.some(search => k.toLowerCase().includes(search))) || keys[0];
                const expYieldKey = findKey(['expected yield', 'exp_yield']);
                const reYieldKey = findKey(['re-estimated yield', 're_yield']);

                return {
                    ...originalRow,
                    'CAName': result.name || originalRow['CAName'] || originalRow['CA Name'],
                    'CA_ID': result.code || originalRow['CA_ID'] || originalRow['CA ID'],
                    'Coordinates': result.coordinates || '',
                    'AuditedArea': result.auditedArea || originalRow['AuditedArea'] || '',
                    [expYieldKey]: result.expYield || originalRow[expYieldKey] || '',
                    [reYieldKey]: result.reYield || originalRow[reYieldKey] || '',
                    'Latitude': result.latitude || '',
                    'Longitude': result.longitude || '',
                    'GeoInfo': result.geoInfo || '',
                    'Status': result.status,
                    'API_Response': result.response
                };
            });
        } else {
            // General fallback
            exportData = executionResults.map((result, index) => {
                const originalRow = uploadedData[index] || {};
                return {
                    ...originalRow,
                    'Status': result.status,
                    'API_Response': result.response
                };
            });
        }
    }

    // Create Worksheet
    let ws;
    // Enforce column order if template defines it
    if (TEMPLATE.columns && TEMPLATE.columns.length > 0) {
        // 1. Get User Defined Order
        const definedHeaders = TEMPLATE.columns.map(c => c.header);

        // 2. Discover Validation/Result headers (Status, Response, etc.)
        // We scan data to find keys NOT in definedHeaders
        const allKeys = new Set();
        exportData.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

        // Exclude internal keys if any
        allKeys.delete('row');

        const extraKeys = [...allKeys].filter(k => !definedHeaders.includes(k));

        // 3. Final Order: Defined + Extras
        const finalHeaders = [...definedHeaders, ...extraKeys];

        ws = XLSX.utils.json_to_sheet(exportData, { header: finalHeaders });
    } else {
        // Default behavior (random/alpha order usually)
        ws = XLSX.utils.json_to_sheet(exportData);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');

    const fileName = `Results_${selectedDataType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
});

// =============================================
// SHARED EXECUTION UTILITIES
// =============================================

// Execution state
let executionStartTime = null;
let executionTimerInterval = null;

// Format duration in human-readable format
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes}m ${remainingSeconds}s`;
}

// Start execution - initializes UI and timer
function startExecution(buttonText = '⏳ Processing...') {
    executionStartTime = Date.now();

    // Reset UI
    elements.executeBtn.disabled = true;
    elements.executeBtn.textContent = buttonText;
    elements.resultsSection.classList.remove('hidden');
    elements.downloadResultsBtn.classList.add('hidden');
    elements.resultsTbody.innerHTML = '';
    elements.progressText.textContent = '0 / 0';
    elements.progressBar.style.width = '0%';
    elements.passCount.textContent = '0';
    elements.failCount.textContent = '0';
    elements.executionTime.textContent = '0.0s';
    executionResults = [];

    // Start live timer update
    if (executionTimerInterval) clearInterval(executionTimerInterval);
    executionTimerInterval = setInterval(() => {
        const elapsed = Date.now() - executionStartTime;
        elements.executionTime.textContent = formatDuration(elapsed);
    }, 100);

    return { passCount: 0, failCount: 0 };
}

// Update progress during execution
function updateProgress(current, total, passCount, failCount) {
    elements.progressText.textContent = `${current} / ${total}`;
    elements.progressBar.style.width = `${(current / total) * 100}%`;
    elements.passCount.textContent = passCount;
    elements.failCount.textContent = failCount;
}

// Complete execution - stops timer, shows download button
function completeExecution() {
    // Stop timer
    if (executionTimerInterval) {
        clearInterval(executionTimerInterval);
        executionTimerInterval = null;
    }

    // Final time update
    const totalTime = Date.now() - executionStartTime;
    elements.executionTime.textContent = formatDuration(totalTime);

    // Update button and show download
    elements.executeBtn.textContent = '✅ Completed';
    elements.downloadResultsBtn.classList.remove('hidden');

    console.log(`Execution completed in ${formatDuration(totalTime)}`);
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================
// IMPORT CUSTOM SCRIPT HANDLING
// =============================================

// Check URL params for auto-open
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('openImport') === 'true' && elements.toggleImportLink) {
    elements.importScriptSection.classList.remove('hidden');
    elements.toggleImportLink.parentElement.classList.add('hidden');

    // Scroll to section
    setTimeout(() => {
        elements.importScriptSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300); // Small delay to ensure render

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Toggle Import Section
if (elements.toggleImportLink) {
    elements.toggleImportLink.addEventListener('click', (e) => {
        e.preventDefault();
        elements.importScriptSection.classList.remove('hidden');
        elements.toggleImportLink.parentElement.classList.add('hidden');
    });
}

// Cancel Import
if (elements.cancelImportBtn) {
    elements.cancelImportBtn.addEventListener('click', () => {
        elements.importScriptSection.classList.add('hidden');
        elements.toggleImportLink.parentElement.classList.remove('hidden');
        // Reset inputs
        elements.importScriptFile.value = '';
        elements.importScriptJson.value = '';
    });
}

// Confirm Import (Upload)
if (elements.confirmImportBtn) {
    elements.confirmImportBtn.addEventListener('click', async () => {
        const file = elements.importScriptFile.files[0];
        const jsonContent = elements.importScriptJson.value.trim();

        if (!file) {
            alert('Please select a Python script file (.py)');
            return;
        }

        if (!jsonContent) {
            alert('Please provide the UI Configuration JSON');
            return;
        }

        // Validate JSON
        try {
            JSON.parse(jsonContent);
        } catch (e) {
            alert('Invalid JSON format in UI Configuration');
            return;
        }

        // Prepare FormData
        const formData = new FormData();
        formData.append('script', file);
        formData.append('config', jsonContent);

        // UI Feedback
        const originalBtnText = elements.confirmImportBtn.textContent;
        elements.confirmImportBtn.disabled = true;
        elements.confirmImportBtn.textContent = 'Uploading...';

        try {
            const response = await fetch('/api/scripts/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                alert('Script uploaded and registered successfully!');

                // Hide section
                elements.importScriptSection.classList.add('hidden');
                elements.toggleImportLink.parentElement.classList.remove('hidden');

                // Reset inputs
                elements.importScriptFile.value = '';
                elements.importScriptJson.value = '';

                // Reload scripts list
                await loadCustomScripts();

            } else {
                throw new Error(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload Error:', error);
            alert('Failed to upload script: ' + error.message);
        } finally {
            elements.confirmImportBtn.disabled = false;
            elements.confirmImportBtn.textContent = originalBtnText;
        }
    });
}

// =============================================
// EXECUTE CUSTOM SCRIPT
// =============================================

