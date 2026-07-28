param(
    [string]$Version = '0.2.0',
    [ValidateSet('debug', 'release')]
    [string]$Configuration = 'debug',
    [string]$PackageRoot = 'package',
    [switch]$SkipPackageBuild
)

$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$workspacePath = [System.IO.Path]::GetFullPath($workspace).TrimEnd('\', '/')
$workspacePrefix = $workspacePath + [System.IO.Path]::DirectorySeparatorChar
$packageRootCandidate = if ([System.IO.Path]::IsPathRooted($PackageRoot)) {
    $PackageRoot
} else {
    Join-Path $workspace $PackageRoot
}
$packageRoot = [System.IO.Path]::GetFullPath($packageRootCandidate).TrimEnd('\', '/')
$productWxs = Join-Path $workspace 'installer\Product.wxs'
$distDir = Join-Path $workspace 'dist'
$localDotnetExe = Join-Path $workspace 'tmp\tools\dotnet\dotnet.exe'
$wixToolDir = Join-Path $workspace 'tmp\tools\wix'
$wixExe = Join-Path $wixToolDir 'wix.exe'

function ConvertTo-WorkspaceRelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "installer output must stay inside workspace: $fullPath"
    }
    return $fullPath.Substring($workspacePrefix.Length).Replace('\', '/')
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "MSI Version must be three-part numeric SemVer, got: $Version"
}

if (-not $SkipPackageBuild) {
    & (Join-Path $workspace 'scripts\package-all.ps1') `
        -Configuration $Configuration `
        -PackageRoot $packageRoot
}

if (-not (Test-Path -LiteralPath (Join-Path $packageRoot 'COOLZHU-AGENT.exe'))) {
    throw "Package launcher missing: $(Join-Path $packageRoot 'COOLZHU-AGENT.exe')"
}

if (-not (Test-Path -LiteralPath $productWxs)) {
    throw "WiX product file missing: $productWxs"
}

$packageSafetyReport = Join-Path $distDir "CoolzhuAgent-$Version-package-safety.json"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
& (Join-Path $workspace 'scripts\package-safety.ps1') -Root $packageRoot -ReportPath $packageSafetyReport | Out-Null

if (-not (Test-Path -LiteralPath $wixExe)) {
    $dotnetExe = if (Test-Path -LiteralPath $localDotnetExe) {
        $localDotnetExe
    } else {
        $cmd = Get-Command dotnet -ErrorAction SilentlyContinue
        if ($cmd) { $cmd.Source } else { $null }
    }
    $sdkList = if ($dotnetExe) { & $dotnetExe --list-sdks 2>$null } else { $null }
    if ($LASTEXITCODE -ne 0 -or -not $sdkList) {
        throw @"
.NET SDK is required to install WiX locally, but no SDK was found.
If download speed is slow, manually install .NET SDK 8 x64 into:
  $workspace\tmp\tools\dotnet
Download:
  https://dotnet.microsoft.com/download/dotnet/8.0
Then add that dotnet.exe to PATH for this shell and rerun scripts\build-msi.ps1.
"@
    }

    New-Item -ItemType Directory -Force -Path $wixToolDir | Out-Null
    & $dotnetExe tool install wix --tool-path $wixToolDir --version 5.0.2
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet tool install wix failed with exit code $LASTEXITCODE"
    }
}

$canonicalMsi = Join-Path $distDir "CoolzhuAgent-$Version.msi"
$outMsi = if (Test-Path -LiteralPath $canonicalMsi) {
    Join-Path $distDir "CoolzhuAgent-$Version-$(Get-Date -Format 'yyyyMMdd-HHmmss').msi"
} else {
    $canonicalMsi
}
$stagingMsi = Join-Path $distDir ".staging-CoolzhuAgent-$Version.msi"
if (Test-Path -LiteralPath $stagingMsi) {
    Remove-Item -LiteralPath $stagingMsi -Force
}

& $wixExe build $productWxs `
    -arch x64 `
    -d "Version=$Version" `
    -d "PackageRoot=$packageRoot" `
    -out $stagingMsi

if ($LASTEXITCODE -ne 0) {
    throw "wix build failed with exit code $LASTEXITCODE"
}

$msiHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $stagingMsi).Hash
Copy-Item -LiteralPath $stagingMsi -Destination $outMsi -Force
$publishedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outMsi).Hash
if ($publishedHash -ne $msiHash) {
    throw "published MSI hash mismatch: $outMsi"
}
$wixVersion = (& $wixExe --version | Select-Object -First 1)
$publishedMsiRelative = ConvertTo-WorkspaceRelativePath $outMsi
$packageSafetyReportRelative = ConvertTo-WorkspaceRelativePath $packageSafetyReport
$installerReport = [ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    version = $Version
    configuration = $Configuration
    msi = $publishedMsiRelative
    sha256 = $msiHash
    package_safety_report = $packageSafetyReportRelative
    wix_version = [string]$wixVersion
    signed = $false
    signing_status = 'unsigned'
}
$installerReportPath = Join-Path $distDir "CoolzhuAgent-$Version-installer-report.json"
$installerReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $installerReportPath -Encoding UTF8
$installerReport | ConvertTo-Json -Compress
