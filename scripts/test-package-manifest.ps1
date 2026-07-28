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

Write-Output 'PASS package-manifest'
