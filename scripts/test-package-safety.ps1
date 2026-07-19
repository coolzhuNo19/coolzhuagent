$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$scanner = Join-Path $PSScriptRoot 'package-safety.ps1'
$sandbox = Join-Path $workspace 'tmp\tests\package-safety'

if (Test-Path -LiteralPath $sandbox) {
    Remove-Item -LiteralPath $sandbox -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'safe\config') | Out-Null
Set-Content -LiteralPath (Join-Path $sandbox 'safe\app.exe') -Value 'binary-placeholder'
Set-Content -LiteralPath (Join-Path $sandbox 'safe\config\package-launcher.json') -Value '{"health_url":"http://127.0.0.1"}'

& $scanner -Root (Join-Path $sandbox 'safe') | Out-Null

$resourceRoot = Join-Path $sandbox 'resource-package'
$resourceManifest = Join-Path $sandbox 'resource-manifest.json'
[ordered]@{
    package_root = $resourceRoot
    backup_keep = 1
    artifacts = @()
    resources = @(
        [ordered]@{ id = 'launcher'; source = 'config/package-launcher.json'; target = 'config/package-launcher.json' },
        [ordered]@{ id = 'manifest'; source = 'config/package-manifest.json'; target = 'config/package-manifest.json' }
    )
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resourceManifest -Encoding UTF8
New-Item -ItemType Directory -Force -Path (Join-Path $resourceRoot 'backup'), (Join-Path $resourceRoot 'tmp\logs') | Out-Null
Set-Content -LiteralPath (Join-Path $resourceRoot 'backup\old.exe') -Value 'stale-backup'
Set-Content -LiteralPath (Join-Path $resourceRoot 'tmp\logs\runtime.log') -Value 'stale-log'
& (Join-Path $PSScriptRoot 'package-all.ps1') -Manifest $resourceManifest -SkipBuild | Out-Null
$stalePackageState = @(
    'backup', 'tmp', 'logs', 'sessions' |
        ForEach-Object { Join-Path $resourceRoot $_ } |
        Where-Object { Test-Path -LiteralPath $_ }
)
if ($stalePackageState.Count -ne 0) {
    throw "stale blocked package state was not removed: $($stalePackageState.FullName -join ', ')"
}
$packagedConfigs = @(Get-ChildItem -LiteralPath (Join-Path $resourceRoot 'config') -File | Select-Object -ExpandProperty Name | Sort-Object)
if (($packagedConfigs -join ',') -ne 'package-launcher.json,package-manifest.json') {
    throw "unexpected packaged config files: $($packagedConfigs -join ',')"
}

$unsafe = Join-Path $sandbox 'unsafe'
New-Item -ItemType Directory -Force -Path `
    (Join-Path $unsafe '.coolzhu'), `
    (Join-Path $unsafe 'backup'), `
    (Join-Path $unsafe 'config') | Out-Null
Set-Content -LiteralPath (Join-Path $unsafe '.coolzhu\web-sessions.json') -Value '{}'
Set-Content -LiteralPath (Join-Path $unsafe '.coolzhu\clawbot-gateway.sqlite3') -Value 'sqlite-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'coolzhu.toml') -Value '[models]'
Set-Content -LiteralPath (Join-Path $unsafe '.env') -Value 'SAFE_TEST=true'
Set-Content -LiteralPath (Join-Path $unsafe 'chat.sqlite3') -Value 'sqlite-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'backup\old.exe') -Value 'backup-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'config\credential.txt') -Value 'api_key="sk-package-safety-fixture-1234567890"'
Set-Content -LiteralPath (Join-Path $unsafe 'config\wechat-cookie.txt') -Value 'token="wx-cookie-fixture-1234567890"'

$unsafeMessage = $null
try {
    & $scanner -Root $unsafe | Out-Null
} catch {
    $unsafeMessage = $_.Exception.Message
}
if (-not $unsafeMessage) { throw 'unsafe package unexpectedly passed' }

foreach ($expected in @('.coolzhu\web-sessions.json', '.coolzhu\clawbot-gateway.sqlite3', 'coolzhu.toml', '.env', 'chat.sqlite3', 'backup\old.exe', 'config\credential.txt', 'config\wechat-cookie.txt')) {
    if ($unsafeMessage -notlike "*$expected*") {
        throw "unsafe finding missing from report: $expected"
    }
}

Write-Output 'PASS package-safety'
