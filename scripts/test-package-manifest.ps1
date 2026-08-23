$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $workspace 'config\package-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$artifactIds = @($manifest.artifacts | ForEach-Object { [string]$_.id })
$resourceIds = @($manifest.resources | ForEach-Object { [string]$_.id })

if ($artifactIds -notcontains 'gui-web.browser-native-host') {
    throw 'package manifest must include gui-web.browser-native-host artifact'
}

if ($artifactIds -notcontains 'gui-web.clawbot-sidecar') {
    throw 'package manifest must include gui-web.clawbot-sidecar artifact'
}

if ($artifactIds -notcontains 'gui-desktop.webview2-loader') {
    throw 'package manifest must include the Tauri WebView2 loader artifact'
}

$nativeHost = @($manifest.artifacts | Where-Object { $_.id -eq 'gui-web.browser-native-host' })[0]
if ([string]$nativeHost.source -ne 'modules/gui-web/target/{profile}/coolzhu-browser-native-host.exe') {
    throw "unexpected native host source: $($nativeHost.source)"
}
if ([string]$nativeHost.target -ne 'bin/coolzhu-browser-native-host.exe') {
    throw "unexpected native host target: $($nativeHost.target)"
}

$clawbotSidecar = @($manifest.artifacts | Where-Object { $_.id -eq 'gui-web.clawbot-sidecar' })[0]
if ([string]$clawbotSidecar.source -ne 'modules/gui-web/target/{profile}/coolzhu-clawbot-sidecar.exe') {
    throw "unexpected ClawBot sidecar source: $($clawbotSidecar.source)"
}
if ([string]$clawbotSidecar.target -ne 'bin/coolzhu-clawbot-sidecar.exe') {
    throw "unexpected ClawBot sidecar target: $($clawbotSidecar.target)"
}

$webView2Loader = @($manifest.artifacts | Where-Object { $_.id -eq 'gui-desktop.webview2-loader' })[0]
if ([string]$webView2Loader.source -ne 'modules/gui-desktop/target/tauri-shell/{profile}/WebView2Loader.dll') {
    throw "unexpected WebView2 loader source: $($webView2Loader.source)"
}
if ([string]$webView2Loader.target -ne 'bin/WebView2Loader.dll') {
    throw "unexpected WebView2 loader target: $($webView2Loader.target)"
}

if ($resourceIds -notcontains 'browser.extension') {
    throw 'package manifest must include browser.extension resource'
}

$extension = @($manifest.resources | Where-Object { $_.id -eq 'browser.extension' })[0]
if ([string]$extension.source -ne 'modules/browser-extension') {
    throw "unexpected browser extension source: $($extension.source)"
}
if ([string]$extension.target -ne 'modules/browser-extension') {
    throw "unexpected browser extension target: $($extension.target)"
}

if ($resourceIds -notcontains 'gui-web.stt-models') {
    throw 'package manifest must include gui-web.stt-models resource'
}

$sttModels = @($manifest.resources | Where-Object { $_.id -eq 'gui-web.stt-models' })[0]
if ([string]$sttModels.source -ne 'modules/gui-web/packages/web-console/models') {
    throw "unexpected STT models source: $($sttModels.source)"
}
if ([string]$sttModels.target -ne 'bin/models') {
    throw "unexpected STT models target: $($sttModels.target)"
}

if ($resourceIds -notcontains 'documentation.user-guide') {
    throw 'package manifest must include documentation.user-guide resource'
}

$userGuide = @($manifest.resources | Where-Object { $_.id -eq 'documentation.user-guide' })[0]
if ([string]$userGuide.source -ne 'docs/user-guide') {
    throw "unexpected user guide source: $($userGuide.source)"
}
if ([string]$userGuide.target -ne 'docs/user-guide') {
    throw "unexpected user guide target: $($userGuide.target)"
}

if ($resourceIds -notcontains 'documentation.command-line') {
    throw 'package manifest must include documentation.command-line resource'
}

$commandLineGuide = @($manifest.resources | Where-Object { $_.id -eq 'documentation.command-line' })[0]
if ([string]$commandLineGuide.source -ne 'docs/command-line.md') {
    throw "unexpected command-line guide source: $($commandLineGuide.source)"
}
if ([string]$commandLineGuide.target -ne 'docs/command-line.md') {
    throw "unexpected command-line guide target: $($commandLineGuide.target)"
}
if (-not (Test-Path -LiteralPath (Join-Path $workspace ([string]$commandLineGuide.source)) -PathType Leaf)) {
    throw 'command-line guide source file is missing'
}

Write-Output 'PASS package-manifest'
