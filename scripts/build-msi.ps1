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
$applicationIcon = Join-Path $workspace 'docs\design-assets\coolzhu-icons-2026-08-27\final\app-icon-cz-moon-gate-lantern-v1.ico'
$distDir = Join-Path $workspace 'dist'
$localDotnetExe = Join-Path $workspace 'tmp\tools\dotnet\dotnet.exe'
$wixToolDir = Join-Path $workspace 'tmp\tools\wix'
$wixExe = Join-Path $wixToolDir 'wix.exe'
$wixDll = Join-Path $wixToolDir '.store\wix\5.0.2\wix\5.0.2\tools\net6.0\any\wix.dll'

if (Test-Path -LiteralPath $localDotnetExe -PathType Leaf) {
    $localDotnetRoot = Split-Path -Parent $localDotnetExe
    $env:DOTNET_ROOT = $localDotnetRoot
    $env:DOTNET_ROOT_X64 = $localDotnetRoot
}

function ConvertTo-WorkspaceRelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "installer output must stay inside workspace: $fullPath"
    }
    return $fullPath.Substring($workspacePrefix.Length).Replace('\', '/')
}

function Get-ReleaseSourceCommit {
    $gitOutput = @(& git -C $workspace rev-parse --verify HEAD 2>&1)
    $gitExitCode = $LASTEXITCODE
    if ($gitExitCode -ne 0) {
        throw "git rev-parse HEAD failed with exit code ${gitExitCode}: $($gitOutput -join ' ')"
    }
    $commit = ([string]($gitOutput | Select-Object -First 1)).Trim()
    if ($commit -notmatch '^[0-9a-fA-F]{40}$') {
        throw "git rev-parse HEAD returned an invalid commit: $commit"
    }
    return $commit.ToLowerInvariant()
}

function Get-ReleaseBuildTarget {
    $configuredTarget = [Environment]::GetEnvironmentVariable('CARGO_BUILD_TARGET', 'Process')
    if (-not [string]::IsNullOrWhiteSpace($configuredTarget)) {
        $target = $configuredTarget.Trim()
    } else {
        $cargoVersionOutput = @(& cargo -vV 2>&1)
        $cargoExitCode = $LASTEXITCODE
        if ($cargoExitCode -ne 0) {
            throw "cargo -vV failed with exit code ${cargoExitCode}: $($cargoVersionOutput -join ' ')"
        }
        $hostTargets = @(
            foreach ($line in $cargoVersionOutput) {
                $match = [regex]::Match([string]$line, '^host:\s*(\S+)\s*$')
                if ($match.Success) {
                    $match.Groups[1].Value
                }
            }
        )
        if ($hostTargets.Count -ne 1) {
            throw 'cargo -vV did not report exactly one host target'
        }
        $target = [string]$hostTargets[0]
    }
    if ($target -notmatch '^[A-Za-z0-9_.-]+$') {
        throw "invalid Cargo build target: $target"
    }
    return $target
}

function Assert-StagedCliVersion {
    param(
        [Parameter(Mandatory = $true)][string]$CliPath,
        [Parameter(Mandatory = $true)][string]$ExpectedVersion
    )

    if (-not (Test-Path -LiteralPath $CliPath -PathType Leaf)) {
        throw "staged CLI missing: $CliPath"
    }
    $versionOutput = @(& $CliPath --version 2>&1)
    $versionExitCode = $LASTEXITCODE
    if ($versionExitCode -ne 0) {
        throw "staged CLI --version failed with exit code $versionExitCode"
    }
    $reportedVersions = @(
        foreach ($line in $versionOutput) {
            $match = [regex]::Match([string]$line, '^\s*Version\s+(\d+\.\d+\.\d+)\s*$')
            if ($match.Success) {
                $match.Groups[1].Value
            }
        }
    )
    if ($reportedVersions.Count -ne 1) {
        throw 'staged CLI --version did not report exactly one three-part Version field'
    }
    $reportedVersion = [string]$reportedVersions[0]
    if (-not [string]::Equals($reportedVersion, $ExpectedVersion, [System.StringComparison]::Ordinal)) {
        throw "staged CLI version mismatch: MSI requests $ExpectedVersion but CLI reports $reportedVersion"
    }
    return $reportedVersion
}

function Invoke-WithReleaseBuildEnvironment {
    param(
        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$Environment,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    $environmentNames = @($Environment.Keys | ForEach-Object { [string]$_ })
    $previousEnvironment = @{}
    foreach ($name in $environmentNames) {
        $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    try {
        foreach ($entry in $Environment.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, 'Process')
        }
        & $Action
    } finally {
        foreach ($name in $environmentNames) {
            [Environment]::SetEnvironmentVariable(
                $name,
                $previousEnvironment[$name],
                'Process'
            )
        }
    }
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "MSI Version must be three-part numeric SemVer, got: $Version"
}

if (-not $SkipPackageBuild) {
    $releaseBuildEnvironment = [ordered]@{
        COOLZHU_RELEASE_VERSION = $Version
        COOLZHU_BUILD_DATE = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
        COOLZHU_GIT_SHA = Get-ReleaseSourceCommit
        COOLZHU_BUILD_TARGET = Get-ReleaseBuildTarget
    }
    Invoke-WithReleaseBuildEnvironment -Environment $releaseBuildEnvironment -Action {
        & (Join-Path $workspace 'scripts\package-all.ps1') `
            -Configuration $Configuration `
            -PackageRoot $packageRoot
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $packageRoot 'COOLZHU-AGENT.exe'))) {
    throw "Package launcher missing: $(Join-Path $packageRoot 'COOLZHU-AGENT.exe')"
}
$stagedCliVersion = Assert-StagedCliVersion `
    -CliPath (Join-Path $packageRoot 'bin\coolzhu-cli.exe') `
    -ExpectedVersion $Version

if (-not (Test-Path -LiteralPath $productWxs)) {
    throw "WiX product file missing: $productWxs"
}
if (-not (Test-Path -LiteralPath $applicationIcon -PathType Leaf)) {
    throw "Application icon missing: $applicationIcon"
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

$useLocalDotnetForWix = Test-Path -LiteralPath $localDotnetExe -PathType Leaf
if ($useLocalDotnetForWix -and -not (Test-Path -LiteralPath $wixDll -PathType Leaf)) {
    throw "WiX tool assembly missing: $wixDll"
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

$wixBuildArgs = @(
    'build',
    $productWxs,
    '-arch', 'x64',
    '-d', "Version=$Version",
    '-d', "PackageRoot=$packageRoot",
    '-d', "ApplicationIcon=$applicationIcon",
    '-out', $stagingMsi
)
if ($useLocalDotnetForWix) {
    & $localDotnetExe $wixDll @wixBuildArgs
    $wixExitCode = $LASTEXITCODE
} else {
    & $wixExe @wixBuildArgs
    $wixExitCode = $LASTEXITCODE
}

if ($wixExitCode -ne 0) {
    throw "wix build failed with exit code $wixExitCode"
}

$msiHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $stagingMsi).Hash
Copy-Item -LiteralPath $stagingMsi -Destination $outMsi -Force
$publishedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outMsi).Hash
if ($publishedHash -ne $msiHash) {
    throw "published MSI hash mismatch: $outMsi"
}
$wixVersion = if ($useLocalDotnetForWix) {
    & $localDotnetExe $wixDll --version | Select-Object -First 1
} else {
    & $wixExe --version | Select-Object -First 1
}
$publishedMsiRelative = ConvertTo-WorkspaceRelativePath $outMsi
$packageSafetyReportRelative = ConvertTo-WorkspaceRelativePath $packageSafetyReport
$installerReport = [ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    version = $Version
    cli_version = $stagedCliVersion
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
