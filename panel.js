let baseUrl = '';
let isMultiProfile = false;
let isSystemAdmin = false;
let profileKeys = [];
let profileNames = [];
let extraConfig = {};
let config = { baseUrl: '', pid: '', token: '', isLegacy: false };

/**
 * Parse a configuration key into its components.
 * Supports both the new format and the legacy format for backward compatibility.
 *
 * New format:    {baseUrl}|{pid}|{token}           → 3 fields
 * Legacy format: {baseUrl}|||{pid}|{api_token}|    → 6 fields (indices 1,2 empty)
 */
function parseConfigKey(configKey) {
    const parts = configKey.toString().split('|');

    // Legacy format detection: 6+ parts with empty slots at indices 1 and 2
    if (parts.length >= 6 && parts[1] === '' && parts[2] === '') {
        return {
            baseUrl: parts[0],
            pid: parts[3],
            token: parts[4],
            isLegacy: true
        };
    }

    // New format: {baseUrl}|{pid}|{token}
    return {
        baseUrl: parts[0],
        pid: parts[1],
        token: parts[2],
        isLegacy: false
    };
}

/**
 * POST to the REDCap External Module api-actions endpoint.
 *
 * Sends ext_token for new-format keys, api_token for legacy keys,
 * so the EM can validate either type.
 */
function apiPost(action, extraParams = {}) {
    const tokenKey = config.isLegacy ? 'api_token' : 'ext_token';
    const body = new URLSearchParams({
        content: 'externalModule',
        prefix: 'browser_extension_support',
        action: action,
        [tokenKey]: config.token,
        pid: config.pid
    });

    for (const [key, value] of Object.entries(extraParams)) {
        body.set(key, value);
    }

    return fetch(`${config.baseUrl}api/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    }).then(response => {
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    });
}

/**
 * Check the current browser tab for REDCap extension configuration data.
 *
 * The EM's config page (index.php) embeds a hidden DOM element with
 * id="redcap-ext-config" containing data attributes. This function
 * injects a small script into the active tab to read those attributes.
 *
 * Returns { baseUrl, pid, token } if found, or null.
 */
async function checkForAutoConfig() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return null;

        // Skip non-http pages (chrome://, about:, extension pages, etc.)
        if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
            return null;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const el = document.getElementById('redcap-ext-config');
                if (!el) return null;
                return {
                    baseUrl: el.dataset.baseUrl || '',
                    pid: el.dataset.pid || '',
                    token: el.dataset.token || ''
                };
            }
        });

        const result = results?.[0]?.result;
        if (result && result.baseUrl && result.pid && result.token) {
            return result;
        }
        return null;
    } catch (e) {
        // Permission denied or script injection failed — not on a compatible page
        return null;
    }
}

/**
 * Configure jQuery UI Autocomplete on the projects input.
 * Uses a function-based source that POSTs to the api-actions endpoint.
 */
function setupProjectAutocomplete() {
    $('#projects').autocomplete({
        source: function(request, response) {
            apiPost('projects', { term: request.term })
                .then(data => response(data))
                .catch(() => response([]));
        },
        minLength: 1
    });
}

/**
 * Load and activate a configuration key: parse it, set up autocomplete,
 * fetch extra config (redcap_version, permissions), and update admin UI.
 */
async function loadConfig(configKey) {
    config = parseConfigKey(configKey);
    baseUrl = config.baseUrl;

    setupProjectAutocomplete();
    await getExtraConfig();

    if (extraConfig.system_admin) {
        isSystemAdmin = true;
        $('#adminLinks').show();
    } else {
        isSystemAdmin = false;
        $('#adminLinks').hide();
    }
}

async function runMain() {
    // --- Step 1: Check the current tab for one-click auto-configuration ---
    const autoConfig = await checkForAutoConfig();

    if (autoConfig) {
        const newKey = `${autoConfig.baseUrl}|${autoConfig.pid}|${autoConfig.token}`;

        // Only show the banner if this key isn't already saved
        const existing = await chrome.storage.sync.get('config_key');
        if (existing.config_key !== newKey) {
            const banner = document.getElementById('autoSetupBanner');
            const serverLabel = document.getElementById('detectedServer');

            if (banner && serverLabel) {
                serverLabel.textContent = autoConfig.baseUrl;
                banner.style.display = 'block';

                document.getElementById('autoConfigureBtn').addEventListener('click', async () => {
                    await chrome.storage.sync.set({ config_key: newKey });
                    banner.style.display = 'none';

                    const confirmEl = document.getElementById('setupConfirmation');
                    if (confirmEl) {
                        confirmEl.style.display = 'block';
                        setTimeout(() => { confirmEl.style.display = 'none'; }, 3000);
                    }

                    // Reload the panel with the new config
                    document.getElementById('profileoptions').style.display = 'none';
                    isMultiProfile = false;
                    await loadConfig(newKey);
                });
            }
        }
    }

    // --- Step 2: Load saved configuration ---
    const data = await chrome.storage.sync.get('multi_profile');
    isMultiProfile = data.multi_profile || false;

    if (!isMultiProfile) {
        const configDataObj = await chrome.storage.sync.get('config_key');
        const configKey = configDataObj.config_key;

        if (!configKey) {
            // No saved config — if auto-config is available, wait for user to click;
            // otherwise redirect to the manual options page.
            if (!autoConfig) {
                chrome.runtime.openOptionsPage();
                window.close();
            }
            return;
        }

        document.getElementById('profileoptions').style.display = 'none';
        await loadConfig(configKey);
    } else {
        const profileData = await chrome.storage.sync.get(['profile_keys', 'profile_names']);
        profileKeys = profileData.profile_keys || [];
        profileNames = profileData.profile_names || [];

        if (!profileKeys[0]) {
            if (!autoConfig) {
                chrome.runtime.openOptionsPage();
                window.close();
            }
            return;
        }

        document.getElementById('profileoptions').style.display = 'block';

        // Populate the profile autocomplete
        const options = [];
        for (let i = 0; i < profileNames.length; i++) {
            if (profileKeys[i] && profileKeys[i].trim() !== '') {
                options.push({ value: i + 1, label: profileNames[i] || `Profile ${i + 1}` });
            }
        }
        $('#profile').autocomplete({ source: options });
    }
}

async function profileOnChange() {
    const profileVal = $('#profile').val();
    if (!profileVal) return;

    const profileIndex = parseInt(profileVal, 10) - 1;
    if (profileIndex < 0 || profileIndex >= profileKeys.length) return;

    await loadConfig(profileKeys[profileIndex]);
}

function checkForDefaultProfile() {
    if (isMultiProfile && !$('#profile').val()) {
        $('#profile').val('1');
        profileOnChange();
    }
}

async function getExtraConfig() {
    extraConfig = await apiPost('extraconfig');
}

async function changeProjects() {
    const projectId = document.getElementById('projects').value;
    document.getElementById('projectLinks').style.display = 'block';

    if (extraConfig.system_admin) {
        $('#goToUserAdmin').show();
        $('#goToDesign').show();
        return;
    }

    if (extraConfig.project_data && extraConfig.project_data[projectId]) {
        if (extraConfig.project_data[projectId].user_rights === 1) {
            $('#goToUserAdmin').show();
        } else {
            $('#goToUserAdmin').hide();
        }

        if (extraConfig.project_data[projectId].design === 1) {
            $('#goToDesign').show();
        } else {
            $('#goToDesign').hide();
        }
    } else {
        $('#goToUserAdmin').hide();
        $('#goToDesign').hide();
    }
}

document.addEventListener('DOMContentLoaded', runMain);

const profileEl = document.getElementById('profile');
if (profileEl) {
    profileEl.addEventListener('change', profileOnChange);
    profileEl.addEventListener('blur', profileOnChange);
}

const projectsEl = document.getElementById('projects');
if (projectsEl) {
    projectsEl.addEventListener('change', changeProjects);
    projectsEl.addEventListener('blur', changeProjects);
    projectsEl.addEventListener('click', checkForDefaultProfile);
}

function getBaseUrl() {
    return `${config.baseUrl}redcap_v${extraConfig.redcap_version}`;
}

const addClickListener = (id, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', callback);
};

addClickListener('goToRecord', () => {
    checkForDefaultProfile();
    const projectId = $('#projects').val();
    const recordId = $('#record').val();
    const url = `${getBaseUrl()}/DataEntry/record_home.php?pid=${projectId}&id=${recordId}`;
    chrome.tabs.create({ url });
});

addClickListener('goToUserAdmin', () => {
    checkForDefaultProfile();
    const projectId = $('#projects').val();
    const url = `${getBaseUrl()}/UserRights/index.php?pid=${projectId}`;
    chrome.tabs.create({ url });
});

addClickListener('goToHome', () => {
    checkForDefaultProfile();
    const projectId = $('#projects').val();
    const url = `${getBaseUrl()}/index.php?pid=${projectId}`;
    chrome.tabs.create({ url });
});

addClickListener('addUser', () => {
    checkForDefaultProfile();
    const url = `${getBaseUrl()}/ControlCenter/create_user.php`;
    chrome.tabs.create({ url });
});

addClickListener('manageEMs', () => {
    checkForDefaultProfile();
    const url = `${getBaseUrl()}/ExternalModules/manager/control_center.php`;
    chrome.tabs.create({ url });
});

addClickListener('goToDesign', () => {
    checkForDefaultProfile();
    const projectId = $('#projects').val();
    const url = `${getBaseUrl()}/Design/online_designer.php?pid=${projectId}`;
    chrome.tabs.create({ url });
});

addClickListener('searchUsers', () => {
    checkForDefaultProfile();
    const url = `${getBaseUrl()}/ControlCenter/view_users.php`;
    chrome.tabs.create({ url });
});

addClickListener('newRecord', async () => {
    checkForDefaultProfile();
    const projectId = $('#projects').val();
    try {
        const result = await apiPost('newrec', { target_project: projectId });
        const url = `${getBaseUrl()}/DataEntry/record_home.php?auto=1&pid=${projectId}&id=${result.record_id}`;
        chrome.tabs.create({ url });
    } catch (e) {
        // Fallback: let REDCap handle auto-numbering
        const url = `${getBaseUrl()}/DataEntry/record_home.php?pid=${projectId}&auto=1`;
        chrome.tabs.create({ url });
    }
});