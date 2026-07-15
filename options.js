let profileKeys = [];
let profileNames = [];

/**
 * Derive a human-friendly server name from a configuration key.
 * Keys are formatted as {baseUrl}|{pid}|{token}; we use the baseUrl's hostname
 * (e.g. "research.paigejulianne.com").
 */
function serverNameFromKey(key) {
    if (!key) return '';
    const baseUrl = key.toString().split('|')[0];
    try {
        return new URL(baseUrl).hostname;
    } catch (e) {
        return '';
    }
}

/**
 * One-time migration: fold any legacy single `config_key` into the profiles
 * dictionary and drop the now-unused single-key / multi_profile settings.
 */
async function migrateLegacyConfig() {
    const data = await chrome.storage.sync.get(['config_key', 'profile_keys']);

    if (data.config_key && (!data.profile_keys || data.profile_keys.length === 0)) {
        const key = data.config_key;
        await chrome.storage.sync.set({
            profile_keys: [key],
            profile_names: [serverNameFromKey(key)]
        });
    }

    await chrome.storage.sync.remove(['config_key', 'multi_profile']);
}

async function saveOptions() {
    await saveProfiles();

    const confirmation = document.getElementById('savedconfirmation');
    confirmation.style.display = 'inline-block';
    setTimeout(() => { confirmation.style.display = 'none'; }, 3000);
}

async function restoreOptions() {
    await migrateLegacyConfig();
    await restoreProfiles();
}

async function saveProfiles() {
    const profileContainers = document.querySelectorAll('.profile-entry');
    profileKeys = [];
    profileNames = [];

    profileContainers.forEach(container => {
        const key = container.querySelector('.profile-key').value.trim();
        let name = container.querySelector('.profile-name').value.trim();

        // Skip fully empty entries
        if (key === '' && name === '') return;

        // Default the profile name to the server name when left blank
        if (name === '') name = serverNameFromKey(key);

        profileKeys.push(key);
        profileNames.push(name);
    });

    await chrome.storage.sync.set({ profile_keys: profileKeys, profile_names: profileNames });
}

async function restoreProfiles() {
    const data = await chrome.storage.sync.get(['profile_keys', 'profile_names']);
    profileKeys = data.profile_keys || [];
    profileNames = data.profile_names || [];

    const container = document.getElementById('profiles_container');
    container.innerHTML = '';

    if (profileKeys.length === 0) {
        addProfileEntry('', '', true);
    } else {
        for (let i = 0; i < profileKeys.length; i++) {
            addProfileEntry(profileNames[i], profileKeys[i], i === 0);
        }
    }
}

function addProfileEntry(name = '', key = '', isDefault = false) {
    const container = document.getElementById('profiles_container');
    const div = document.createElement('div');
    div.className = 'profile-entry';

    const nameLabelText = isDefault ? 'Profile Name (default profile):' : 'Profile Name:';

    div.innerHTML = `
        <div class="profile-header">
            <label>${nameLabelText}
                <input type="text" class="profile-name" size="20" value="${name}" placeholder="Defaults to the server name" />
            </label>
            ${!isDefault ? '<button class="delete-profile">Delete</button>' : ''}
        </div>
        <label>Configuration Key:<br/>
            <textarea class="profile-key" rows="2" cols="60" style="margin-top: 5px;">${key}</textarea>
        </label>
    `;

    if (!isDefault) {
        div.querySelector('.delete-profile').addEventListener('click', (e) => {
            e.preventDefault();
            div.remove();
        });
    }

    container.appendChild(div);
}

document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('add_profile').addEventListener('click', (e) => {
    e.preventDefault();
    addProfileEntry();
});
document.addEventListener('DOMContentLoaded', restoreOptions);
