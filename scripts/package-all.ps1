param(
  [string]$Manifest = 'config/package-manifest.json',
  [ValidateSet('debug', 'release')]
  [string]$Configuration = 'debug',
  [switch]$SkipBuild,
  [string]$PackageRoot
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path '.').Path
$manifestPath = if ([System.IO.Path]::IsPathRooted($Manifest)) {
  $Manifest
} else {
  Join-Path $repo $Manifest
}

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "package manifest not found: $manifestPath"
}

$manifestData = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$resolvedPackageRoot = if ($PackageRoot) {
  if ([System.IO.Path]::IsPathRooted($PackageRoot)) { $PackageRoot } else { Join-Path $repo $PackageRoot }
} elseif ($manifestData.package_root) {
  if ([System.IO.Path]::IsPathRooted($manifestData.package_root)) { $manifestData.package_root } else { Join-Path $repo $manifestData.package_root }
} else {
  Join-Path $repo 'package'
}

$backupKeep = if ($manifestData.backup_keep) { [int]$manifestData.backup_keep } else { 10 }
$binRoot = Join-Path $resolvedPackageRoot 'bin'
$backupRoot = Join-Path $repo 'tmp\package-backups'
$logRoot = Join-Path $repo 'tmp/logs'
New-Item -ItemType Directory -Force -Path $resolvedPackageRoot | Out-Null
$resolvedPackagePath = (Resolve-Path -LiteralPath $resolvedPackageRoot).Path.TrimEnd('\', '/')
if ($resolvedPackagePath.Equals($repo.TrimEnd('\', '/'), [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "package root must not be the workspace root: $resolvedPackagePath"
}
foreach ($relative in @('backup', 'tmp', 'logs', 'log', 'sessions', '.coolzhu', 'web-sessions.json', 'coolzhu.toml', '.env', '.claw-todos.json')) {
  $stalePath = Join-Path $resolvedPackagePath $relative
  $staleFull = [System.IO.Path]::GetFullPath($stalePath)
  if (-not $staleFull.StartsWith($resolvedPackagePath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "refuse to clean outside package root: $staleFull"
  }
  if (Test-Path -LiteralPath $staleFull) {
    Remove-Item -LiteralPath $staleFull -Recurse -Force
    Write-Host "remove stale blocked package state: $staleFull"
  }
}
New-Item -ItemType Directory -Force -Path $binRoot, $backupRoot, $logRoot | Out-Null

function Expand-PackageToken {
  param([string]$Value)
  if ($null -eq $Value) { return $null }
  return $Value.Replace('{profile}', $Configuration).Replace('{configuration}', $Configuration)
}

function Resolve-RepoPath {
  param([string]$Path)
  $expanded = Expand-PackageToken $Path
  if ([System.IO.Path]::IsPathRooted($expanded)) {
    return $expanded
  }
  return Join-Path $repo $expanded
}

function Resolve-PackagePath {
  param([string]$Path)
  $expanded = Expand-PackageToken $Path
  if ([System.IO.Path]::IsPathRooted($expanded)) {
    return $expanded
  }
  return Join-Path $resolvedPackageRoot $expanded
}

function Get-OptionalHash {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function Invoke-ArtifactBuild {
  param([object]$Artifact)
  if ($SkipBuild) {
    Write-Host "skip build: $($Artifact.id)"
    return
  }
  if (-not $Artifact.build) {
    Write-Host "no build command: $($Artifact.id)"
    return
  }

  $command = [string]$Artifact.build.command
  $args = @()
  if ($Artifact.build.args) {
    $args = @($Artifact.build.args | ForEach-Object { Expand-PackageToken ([string]$_) })
  }
  if ($Configuration -eq 'release' -and $Artifact.build.append_release_arg -ne $false) {
    if (-not ($args -contains '--release')) {
      $args += '--release'
    }
  }
  $workingDir = if ($Artifact.build.working_dir) { Resolve-RepoPath ([string]$Artifact.build.working_dir) } else { $repo }
  Write-Host "build $($Artifact.id): $command $($args -join ' ')"
  Push-Location $workingDir
  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $command @args
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      throw "build failed for $($Artifact.id) with exit code $exitCode"
    }
  } finally {
    $ErrorActionPreference = $previousErrorAction
    Pop-Location
  }
}

function Backup-ExistingArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$ExistingPath,
    [Parameter(Mandatory = $true)][int]$Keep
  )
  if (-not (Test-Path -LiteralPath $ExistingPath)) {
    return
  }
  $leaf = Split-Path -Leaf $ExistingPath
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($leaf)
  $ext = [System.IO.Path]::GetExtension($leaf)
  $artifactBackupDir = Join-Path $backupRoot $leaf
  New-Item -ItemType Directory -Force -Path $artifactBackupDir | Out-Null
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
  $backupPath = Join-Path $artifactBackupDir "$stem.$timestamp$ext"
  Copy-Item -LiteralPath $ExistingPath -Destination $backupPath -Force
  Write-Host "backup $leaf -> $backupPath"

  $resolvedBackupDir = (Resolve-Path -LiteralPath $artifactBackupDir).Path
  $resolvedBackupRoot = (Resolve-Path -LiteralPath $backupRoot).Path
  if (-not $resolvedBackupDir.StartsWith($resolvedBackupRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "refuse to prune outside package backup root: $resolvedBackupDir"
  }

  $pattern = "$stem.*$ext"
  $oldBackups = @(Get-ChildItem -LiteralPath $artifactBackupDir -Filter $pattern -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -Skip $Keep)
  foreach ($old in $oldBackups) {
    Remove-Item -LiteralPath $old.FullName -Force
    Write-Host "prune old backup $($old.FullName)"
  }
}

function Publish-Artifact {
  param([object]$Artifact)
  $source = Resolve-RepoPath ([string]$Artifact.source)
  $target = Resolve-PackagePath ([string]$Artifact.target)
  if (-not (Test-Path -LiteralPath $source)) {
    throw "artifact source missing for $($Artifact.id): $source"
  }
  $targetParent = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetParent | Out-Null

  $sourceHash = Get-OptionalHash $source
  $targetHash = Get-OptionalHash $target
  $shouldCopy = $true
  if ($targetHash -and $sourceHash -eq $targetHash) {
    $sourceTime = (Get-Item -LiteralPath $source).LastWriteTimeUtc
    $targetTime = (Get-Item -LiteralPath $target).LastWriteTimeUtc
    $shouldCopy = $sourceTime -gt $targetTime
  }

  if (-not $shouldCopy) {
    Write-Host "unchanged $($Artifact.id): $target"
    return [pscustomobject]@{
      id = $Artifact.id
      source = $source
      target = $target
      copied = $false
      sha256 = $sourceHash
    }
  }

  if (Test-Path -LiteralPath $target) {
    Backup-ExistingArtifact -ExistingPath $target -Keep $backupKeep
  }
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "publish $($Artifact.id): $source -> $target"
  return [pscustomobject]@{
    id = $Artifact.id
    source = $source
    target = $target
    copied = $true
    sha256 = $sourceHash
  }
}

function Assert-PackageChildPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $resolvedPath = if (Test-Path -LiteralPath $Path) {
    (Resolve-Path -LiteralPath $Path).Path
  } else {
    $parent = Split-Path -Parent $Path
    $leaf = Split-Path -Leaf $Path
    $resolvedParent = (Resolve-Path -LiteralPath $parent).Path
    Join-Path $resolvedParent $leaf
  }
  $resolvedRoot = (Resolve-Path -LiteralPath $resolvedPackageRoot).Path
  if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "refuse to modify resource outside package root: $resolvedPath"
  }
}

function Copy-PackageResource {
  param([object]$Resource)
  $source = Resolve-RepoPath ([string]$Resource.source)
  $target = Resolve-PackagePath ([string]$Resource.target)
  if (-not (Test-Path -LiteralPath $source)) {
    if ($Resource.optional -eq $true) {
      Write-Host "skip optional resource $($Resource.id): $source"
      return
    }
    throw "resource source missing for $($Resource.id): $source"
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Assert-PackageChildPath -Path $target
  if ((Get-Item -LiteralPath $source).PSIsContainer) {
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
    }
  } else {
    if (Test-Path -LiteralPath $target -PathType Container) {
      Remove-Item -LiteralPath $target -Recurse -Force
    }
    Copy-Item -LiteralPath $source -Destination $target -Force
  }
  Write-Host "resource $($Resource.id): $source -> $target"
}

$results = @()
foreach ($artifact in @($manifestData.artifacts)) {
  Invoke-ArtifactBuild -Artifact $artifact
  $results += Publish-Artifact -Artifact $artifact
}

foreach ($resource in @($manifestData.resources)) {
  Copy-PackageResource -Resource $resource
}

& (Join-Path $repo 'scripts/package-safety.ps1') -Root $resolvedPackageRoot | Out-Null

$report = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  configuration = $Configuration
  manifest = $manifestPath
  package_root = $resolvedPackageRoot
  backup_keep = $backupKeep
  artifacts = $results
}

$reportPath = Join-Path $resolvedPackageRoot 'package-report.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host "package report: $reportPath"
