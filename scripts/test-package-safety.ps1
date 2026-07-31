$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$scanner = Join-Path $PSScriptRoot 'package-safety.ps1'
$sandbox = Join-Path $workspace 'tmp\tests\package-safety'

if (Test-Path -LiteralPath $sandbox) {
    Remove-Item -LiteralPath $sandbox -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'safe\config') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sandbox 'safe\models'), (Join-Path $sandbox 'safe\src') | Out-Null
New-Item -ItemType Directory -Force -Path `
    (Join-Path $sandbox 'resource-fixture\public'), `
    (Join-Path $sandbox 'resource-fixture\src\__pycache__'), `
    (Join-Path $sandbox 'resource-fixture\sessions') | Out-Null
Set-Content -LiteralPath (Join-Path $sandbox 'safe\app.exe') -Value 'binary-placeholder'
Set-Content -LiteralPath (Join-Path $sandbox 'safe\config\package-launcher.json') -Value '{"health_url":"http://127.0.0.1"}'
Set-Content -LiteralPath (Join-Path $sandbox 'safe\models\tokens.txt') -Value 'normal-model-token-vocabulary'
Set-Content -LiteralPath (Join-Path $sandbox 'safe\src\owner-token.js') -Value 'const owner_token = request.owner_token;'
Set-Content -LiteralPath (Join-Path $sandbox 'safe\src\example-config.js') -Value 'const api_key = "example-placeholder-token-1234567890";'
Set-Content -LiteralPath (Join-Path $sandbox 'resource-fixture\public\guide.txt') -Value 'public-resource'
Set-Content -LiteralPath (Join-Path $sandbox 'resource-fixture\src\__pycache__\cached.pyc') -Value 'compiled-cache'
Set-Content -LiteralPath (Join-Path $sandbox 'resource-fixture\sessions\web-sessions.sqlite3') -Value 'private-session'

& $scanner -Root (Join-Path $sandbox 'safe') | Out-Null

$resourceRoot = Join-Path $sandbox 'resource-package'
$resourceManifest = Join-Path $sandbox 'resource-manifest.json'
$resourceReport = Join-Path $sandbox 'reports\resource-package-report.json'
[ordered]@{
    package_root = $resourceRoot
    backup_keep = 1
    artifacts = @(
        [ordered]@{
            id = 'safe-artifact'
            source = 'tmp/tests/package-safety/safe/app.exe'
            target = 'bin/safe-app.exe'
        }
    )
    resources = @(
        [ordered]@{ id = 'launcher'; source = 'config/package-launcher.json'; target = 'config/package-launcher.json' },
        [ordered]@{ id = 'manifest'; source = 'config/package-manifest.json'; target = 'config/package-manifest.json' },
        [ordered]@{ id = 'filtered-resource'; source = 'tmp/tests/package-safety/resource-fixture'; target = 'resources' }
    )
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resourceManifest -Encoding UTF8
New-Item -ItemType Directory -Force -Path (Join-Path $resourceRoot 'backup'), (Join-Path $resourceRoot 'tmp\logs') | Out-Null
Set-Content -LiteralPath (Join-Path $resourceRoot 'backup\old.exe') -Value 'stale-backup'
Set-Content -LiteralPath (Join-Path $resourceRoot 'tmp\logs\runtime.log') -Value 'stale-log'
New-Item -ItemType Directory -Force -Path (Join-Path $resourceRoot 'bin') | Out-Null
Set-Content -LiteralPath (Join-Path $resourceRoot 'bin\coolzhu-desktop-console.exe') -Value 'removed-artifact'
Set-Content -LiteralPath (Join-Path $resourceRoot 'README.md') -Value 'stale-readme'
Set-Content -LiteralPath (Join-Path $resourceRoot 'package-report.json') -Value '{"developer_path":"C:\\Users\\private"}'
& (Join-Path $PSScriptRoot 'package-all.ps1') -Manifest $resourceManifest -SkipBuild -ReportPath $resourceReport | Out-Null
$stalePackageState = @(
    'backup', 'tmp', 'logs', 'sessions', 'bin\coolzhu-desktop-console.exe', 'README.md', 'package-report.json' |
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
if (-not (Test-Path -LiteralPath (Join-Path $resourceRoot 'bin\safe-app.exe') -PathType Leaf)) {
    throw 'safe manifest artifact was not packaged'
}
if (-not (Test-Path -LiteralPath (Join-Path $resourceRoot 'resources\public\guide.txt') -PathType Leaf)) {
    throw 'safe nested resource was not packaged'
}
if (
    (Test-Path -LiteralPath (Join-Path $resourceRoot 'resources\src\__pycache__\cached.pyc')) -or
    (Test-Path -LiteralPath (Join-Path $resourceRoot 'resources\sessions\web-sessions.sqlite3'))
) {
    throw 'blocked nested resource leaked into PackageRoot'
}
if (-not (Test-Path -LiteralPath $resourceReport -PathType Leaf)) {
    throw "package report missing outside PackageRoot: $resourceReport"
}
$resourceReportText = Get-Content -Raw -LiteralPath $resourceReport
if ($resourceReportText.IndexOf($workspace, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or $resourceReportText -match '(?i)[A-Z]:\\\\Users\\\\') {
    throw 'package report leaked an absolute developer path'
}
if (Test-Path -LiteralPath (Join-Path $resourceRoot 'package-report.json')) {
    throw 'package report must not be written into PackageRoot'
}

$preflightSentinel = Join-Path $resourceRoot 'preflight-sentinel.keep'
Set-Content -LiteralPath $preflightSentinel -Value 'must-survive-rejected-preflight'
$invalidInputManifest = Join-Path $sandbox 'invalid-input-manifest.json'
[ordered]@{
    package_root = $resourceRoot
    artifacts = @()
    resources = @(
        [ordered]@{ id = 'outside-input'; source = '../outside-workspace'; target = 'outside.txt' }
    )
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $invalidInputManifest -Encoding UTF8
$invalidInputMessage = $null
try {
    & (Join-Path $PSScriptRoot 'package-all.ps1') -Manifest $invalidInputManifest -SkipBuild -ReportPath $resourceReport | Out-Null
} catch {
    $invalidInputMessage = $_.Exception.Message
}
if ($invalidInputMessage -notlike '*release input must stay inside the workspace*') {
    throw "outside release input was not rejected: $invalidInputMessage"
}
if (-not (Test-Path -LiteralPath $preflightSentinel -PathType Leaf)) {
    throw 'PackageRoot was cleared before outside release input preflight completed'
}

$invalidTargetManifest = Join-Path $sandbox 'invalid-target-manifest.json'
[ordered]@{
    package_root = $resourceRoot
    artifacts = @()
    resources = @(
        [ordered]@{ id = 'outside-target'; source = 'config/package-launcher.json'; target = '../escaped.txt' }
    )
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $invalidTargetManifest -Encoding UTF8
$invalidTargetMessage = $null
try {
    & (Join-Path $PSScriptRoot 'package-all.ps1') -Manifest $invalidTargetManifest -SkipBuild -ReportPath $resourceReport | Out-Null
} catch {
    $invalidTargetMessage = $_.Exception.Message
}
if ($invalidTargetMessage -notlike '*release output must stay inside PackageRoot*') {
    throw "outside release output was not rejected: $invalidTargetMessage"
}
if (-not (Test-Path -LiteralPath $preflightSentinel -PathType Leaf)) {
    throw 'PackageRoot was cleared before outside release output preflight completed'
}

$unsafeRootMessage = $null
try {
    & (Join-Path $PSScriptRoot 'package-all.ps1') `
        -Manifest $resourceManifest `
        -PackageRoot (Join-Path $workspace 'scripts\unsafe-package-root') `
        -SkipBuild `
        -ReportPath $resourceReport | Out-Null
} catch {
    $unsafeRootMessage = $_.Exception.Message
}
if ($unsafeRootMessage -notlike '*workspace\package or a child of workspace\tmp*') {
    throw "unsafe PackageRoot was not rejected before cleanup: $unsafeRootMessage"
}

$unsafe = Join-Path $sandbox 'unsafe'
New-Item -ItemType Directory -Force -Path `
    (Join-Path $unsafe '.coolzhu'), `
    (Join-Path $unsafe '.claude'), `
    (Join-Path $unsafe '.superpowers'), `
    (Join-Path $unsafe 'src\__pycache__'), `
    (Join-Path $unsafe 'backup'), `
    (Join-Path $unsafe 'backup-20260728'), `
    (Join-Path $unsafe 'config') | Out-Null
Set-Content -LiteralPath (Join-Path $unsafe '.coolzhu\web-sessions.json') -Value '{}'
Set-Content -LiteralPath (Join-Path $unsafe '.coolzhu\clawbot-gateway.sqlite3') -Value 'sqlite-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe '.claude\launch.json') -Value '{}'
Set-Content -LiteralPath (Join-Path $unsafe '.superpowers\draft.md') -Value '# private draft'
Set-Content -LiteralPath (Join-Path $unsafe 'src\__pycache__\cached.pyc') -Value 'compiled-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'coolzhu.toml') -Value '[models]'
Set-Content -LiteralPath (Join-Path $unsafe '.env') -Value 'SAFE_TEST=true'
Set-Content -LiteralPath (Join-Path $unsafe 'chat.sqlite3') -Value 'sqlite-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'chat.sqlite3-wal') -Value 'sqlite-wal-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'chat.sqlite3-shm') -Value 'sqlite-shm-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'chat.sqlite3-journal') -Value 'sqlite-journal-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'cache.db-wal') -Value 'db-wal-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'backup\old.exe') -Value 'backup-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'backup-20260728\old.exe') -Value 'timestamped-backup-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'settings.bak') -Value 'backup-extension-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'settings.old') -Value 'old-extension-placeholder'
Set-Content -LiteralPath (Join-Path $unsafe 'private.pem') -Value '-----BEGIN PRIVATE KEY-----'
Set-Content -LiteralPath (Join-Path $unsafe 'config\credential.txt') -Value 'api_key="sk-package-safety-fixture-1234567890"'
Set-Content -LiteralPath (Join-Path $unsafe 'config\wechat-cookie.txt') -Value 'token="wx-cookie-fixture-1234567890"'
Set-Content -LiteralPath (Join-Path $unsafe 'config\refresh.txt') -Value 'refresh_token="refresh-fixture-value-1234567890"'
Set-Content -LiteralPath (Join-Path $unsafe 'config\request-url.txt') -Value 'https://example.invalid/?access_token=url-fixture-value-1234567890'
Set-Content -LiteralPath (Join-Path $unsafe 'config\credentials.json') -Value '{}'
Set-Content -LiteralPath (Join-Path $unsafe 'config\token-cache.json') -Value '{}'
Set-Content -LiteralPath (Join-Path $unsafe 'config\refresh-token.json') -Value '{}'
$largeCredential = Join-Path $unsafe 'config\large-credential.txt'
$largeWriter = [System.IO.StreamWriter]::new($largeCredential, $false)
try {
    for ($index = 0; $index -lt 35000; $index += 1) {
        $largeWriter.WriteLine(('safe-padding-{0:D5}-{1}' -f $index, ('x' * 64)))
    }
    $largeWriter.WriteLine('access_token="large-file-fixture-token-1234567890"')
} finally {
    $largeWriter.Dispose()
}

$unsafeMessage = $null
try {
    & $scanner -Root $unsafe | Out-Null
} catch {
    $unsafeMessage = $_.Exception.Message
}
if (-not $unsafeMessage) { throw 'unsafe package unexpectedly passed' }

foreach ($expected in @(
    '.coolzhu\web-sessions.json',
    '.coolzhu\clawbot-gateway.sqlite3',
    '.claude\launch.json',
    '.superpowers\draft.md',
    'src\__pycache__\cached.pyc',
    'coolzhu.toml',
    '.env',
    'chat.sqlite3',
    'chat.sqlite3-wal',
    'chat.sqlite3-shm',
    'chat.sqlite3-journal',
    'cache.db-wal',
    'backup\old.exe',
    'backup-20260728\old.exe',
    'settings.bak',
    'settings.old',
    'private.pem',
    'config\credential.txt',
    'config\wechat-cookie.txt',
    'config\refresh.txt',
    'config\request-url.txt',
    'config\credentials.json',
    'config\token-cache.json',
    'config\refresh-token.json',
    'config\large-credential.txt'
)) {
    if ($unsafeMessage -notlike "*$expected*") {
        throw "unsafe finding missing from report: $expected"
    }
}

$productWxs = Get-Content -Raw -LiteralPath (Join-Path $workspace 'installer\Product.wxs')
foreach ($requiredExclude in @(
    '**.sqlite-*',
    '**.sqlite3-*',
    '**.db-*',
    '**.bak',
    '**.old',
    '**package-report.json',
    '**token-cache.*',
    '**refresh-token.*'
)) {
    if ($productWxs.IndexOf($requiredExclude, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Product.wxs missing release exclusion: $requiredExclude"
    }
}

Write-Output 'PASS package-safety'
