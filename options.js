let profileKeys = [];
let profileNames = [];

async function saveOptions() {
    const configKey = document.getElementById('config_key').value;
    await chrome.storage.sync.set({ config_key: configKey });
    await saveProfiles();
    
    const confirmation = document.getElementById('savedconfirmation');
    confirmation.style.display = 'inline-block';
    setTimeout(() => { confirmation.style.display = 'none'; }, 3000);
}

async function restoreOptions() {
    const data = await chrome.storage.sync.get(['config_key', 'multi_profile']);
    
    if (data.config_key !== undefined) {
        document.getElementById('config_key').value = data.config_key;
    }
    
    document.getElementById('multi_profile').checked = data.multi_profile || false;
    
    await restoreProfiles();
    showMultiProfile();
}

async function saveProfiles() {
    const profileContainers = document.querySelectorAll('.profile-entry');
    profileKeys = [];
    profileNames = [];
    
    profileContainers.forEach(container => {
        profileKeys.push(container.querySelector('.profile-key').value);
        profileNames.push(container.querySelector('.profile-name').value);
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
                <input type="text" class="profile-name" size="20" value="${name}" />
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

async function showMultiProfile() {
    const isMultiProfile = document.getElementById('multi_profile').checked;
    const multiProfileText = document.getElementById('multi_profile_text');
    const singleProfileText = document.getElementById('single_profile_text');
    const singleProfile = document.getElementById('config_key');
    const body = document.getElementsByTagName('body')[0];

    const getFirstProfileKey = () => document.querySelector('.profile-key');

    if (isMultiProfile) {
        multiProfileText.style.display = 'block';
        singleProfileText.style.display = 'none';
        body.style.height = 'auto';
        
        const firstProfileKey = getFirstProfileKey();
        if (firstProfileKey && singleProfile.value.trim() !== '') {
            // Only overwrite if it's currently empty so we don't accidentally wipe it
            if (firstProfileKey.value.trim() === '') {
                firstProfileKey.value = singleProfile.value;
            }
        }
    } else {
        multiProfileText.style.display = 'none';
        singleProfileText.style.display = 'block';
        body.style.height = '150px';
        
        const firstProfileKey = getFirstProfileKey();
        if (firstProfileKey && firstProfileKey.value.trim() !== '') {
            if (singleProfile.value.trim() === '') {
                singleProfile.value = firstProfileKey.value;
            }
        }
    }
    
    await chrome.storage.sync.set({ multi_profile: isMultiProfile });
}

document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('multi_profile').addEventListener('click', showMultiProfile);
document.getElementById('add_profile').addEventListener('click', (e) => {
    e.preventDefault();
    addProfileEntry();
});
document.addEventListener('DOMContentLoaded', restoreOptions);