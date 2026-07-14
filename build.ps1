<#
.SYNOPSIS
    Builds distributable ZIP packages of the REDCap Browser Extension.

.DESCRIPTION
    Packages the extension source into a versioned ZIP for each target
    browser store. The same Manifest V3 file works for all targets (the
    gecko block in manifest.json covers Firefox), so the produced archives
    are identical per browser — the per-store folder layout is kept so each
    can be uploaded independently.

    The version is read automatically from manifest.json. Only the files an
    installed extension actually needs are packaged; docs, git metadata,
    IDE files, and previous builds are excluded.

.PARAMETER Browsers
    Which store targets to build. Defaults to all five.

.PARAMETER Clean
    Remove the dist directory before building.

.EXAMPLE
    .\build.ps1
    Builds all targets into dist\<browser>\.

.EXAMPLE
    .\build.ps1 -Browsers chrome,firefox -Clean
    Wipes dist\ then builds only the Chrome and Firefox packages.
#>
[CmdletBinding()]
param(
    [ValidateSet('chrome', 'edge', 'firefox', 'opera', 'safari')]
    [string[]]$Browsers = @('chrome', 'edge', 'firefox', 'opera', 'safari'),

    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

# Run from the repo root regardless of where the script is invoked from.
$Root = $PSScriptRoot
Set-Location $Root

# --- Read the version from the manifest -----------------------------------
$manifestPath = Join-Path $Root 'manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found at $manifestPath"
}
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Could not read 'version' from manifest.json"
}
Write-Host "Building REDCap Browser Extension v$version" -ForegroundColor Cyan

# --- Files/folders that belong in the packaged extension ------------------
# Allowlist: only ship what an installed extension loads.
$includeFiles = @(
    'manifest.json',
    'panel.html',
    'panel.js',
    'options.html',
    'options.js',
    'logo.png'
)
$includeDirs = @(
    'lib'
)

# --- Prepare dist ---------------------------------------------------------
$distRoot = Join-Path $Root 'dist'
if ($Clean -and (Test-Path $distRoot)) {
    Write-Host "Cleaning $distRoot" -ForegroundColor DarkGray
    Remove-Item $distRoot -Recurse -Force
}

# --- Stage the payload once, then zip it per target -----------------------
# Compress-Archive from a staging dir keeps files at the archive root
# (no nested build folder), which is what the stores expect.
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("rcbe_build_" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
    foreach ($f in $includeFiles) {
        $src = Join-Path $Root $f
        if (-not (Test-Path $src)) { throw "Required file missing: $f" }
        Copy-Item $src -Destination $staging -Force
    }
    foreach ($d in $includeDirs) {
        $src = Join-Path $Root $d
        if (-not (Test-Path $src)) { throw "Required folder missing: $d" }
        Copy-Item $src -Destination $staging -Recurse -Force
    }

    $zipName = "redcap_browser_extension_v$version.zip"

    foreach ($browser in $Browsers) {
        $outDir = Join-Path $distRoot $browser
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null

        $outZip = Join-Path $outDir $zipName
        if (Test-Path $outZip) { Remove-Item $outZip -Force }

        # Zip the staged contents (glob so items land at the archive root).
        Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $outZip -CompressionLevel Optimal

        $sizeKB = [math]::Round((Get-Item $outZip).Length / 1KB, 1)
        Write-Host ("  {0,-8} -> {1} ({2} KB)" -f $browser, (Resolve-Path $outZip -Relative), $sizeKB) -ForegroundColor Green
    }
}
finally {
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Done." -ForegroundColor Cyan