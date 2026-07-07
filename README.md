# REDCap Browser Extension

A browser extension designed to help REDCap users, project designers, and system administrators navigate their REDCap servers faster. 

Instead of waiting for long dropdown menus to load or clicking through multiple screens, this extension allows you to simply type a project name, enter a record number, and jump straight to that record's home page.

## Features

- **Project Search & Autocomplete**: Quickly find and select any project you have access to.
- **Direct Record Navigation**: Enter a record ID to instantly open its Data Entry home page, or click "New" to create a new record in that project.
- **Admin & Designer Shortcuts**: If you have the appropriate permissions, you'll see quick links to jump directly to a project's **User Rights** or **Online Designer**.
- **System Admin Shortcuts**: System Administrators get quick access to add users, search users, and manage External Modules from the extension popup.
- **Multiple Profiles**: Manage connections to different REDCap servers (e.g., Development vs. Production) using the multi-profile feature.

## Requirements

To use this extension, your REDCap server must have the **[REDCap Browser Extension Support](https://github.com/paigejulianne/redcap-browser-extension-support)** External Module installed and enabled on a project.

## Installation & Setup

1. Install the extension for your browser:
   - **Chrome, Edge, Brave, Opera**: [Chrome Web Store](https://chrome.google.com/webstore/detail/redcap-browser-extension/gplbopmpolkcfokdhjeclihfhnlhleji)
   - **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/redcap-browser-extension/)
2. Log into your REDCap server and navigate to the project where the Support External Module is enabled.
3. Click on the **Browser Extension Configuration** link on the left-hand menu.
4. **One-Click Setup (v2.0+)**: While on the configuration page, simply click the REDCap Browser Extension icon in your browser toolbar. It will automatically detect your server and configure itself instantly!

*(Manual setup is also available by copying the configuration key from the REDCap page and pasting it into the extension's options).*

## Security (v2.0 Update)

As of version 2.0, the extension uses a **dedicated, extension-specific token** for authentication rather than raw REDCap API tokens. 
- These tokens only grant access to list projects and facilitate navigation.
- They do not grant data export/import capabilities.
- They are generated on-demand by the External Module and can be revoked independently.
- The extension communicates with the REDCap server securely via POST requests using the `api-actions` framework.

## Support

If you have further questions or need assistance, please reach out to me via email:
Paige Julianne Sullivan (<paige@paigejulianne.com>)
