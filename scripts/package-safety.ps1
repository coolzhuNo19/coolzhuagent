param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    throw "package root not found: $Root"
}

$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/')
$rootPrefix = $resolvedRoot + [System.IO.Path]::DirectorySeparatorChar
$blockedPathPattern = '(?i)(^|[/\\])(\.coolzhu|backup|backups|tmp|logs?|sessions?)([/\\]|$)|web-sessions|coolzhu\.toml$|(^|[/\\])\.env($|\.)|\.(sqlite3?|db)$'
$textExtensions = @('.txt', '.json', '.toml', '.yaml', '.yml', '.ini', '.conf', '.config', '.md', '.ps1', '.cmd', '.bat', '.js', '.mjs', '.ts', '.tsx', '.html', '.css', '.rs')
$credentialPattern = '(?im)^\s*["'']?(api[_-]?key|access[_-]?token|token|secret|password)["'']?\s*[:=]\s*["''](?!(test|dummy|example|sample|access-token|saved-access-token|expired-access-token)\b)([A-Za-z0-9_\-\./+=]{16,})["'']'
$bearerPattern = '(?im)^\s*(authorization\s*:\s*bearer\s+)[A-Za-z0-9_\-\./+=]{8,}'
$findings = [System.Collections.Generic.List[object]]::new()

foreach ($file in Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force) {
    $relativePath = $file.FullName.Substring($rootPrefix.Length).Replace('/', '\')
    if ($relativePath -match $blockedPathPattern) {
        $findings.Add([pscustomobject]@{ path = $relativePath; reason = 'blocked-path' })
        continue
    }
    if ($file.Length -gt 2MB -or $textExtensions -notcontains $file.Extension.ToLowerInvariant()) {
        continue
    }
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
    if ($content -match $credentialPattern -or $content -match $bearerPattern) {
        $findings.Add([pscustomobject]@{ path = $relativePath; reason = 'credential-assignment' })
    }
}

$report = [ordered]@{
    scanned_at = (Get-Date).ToUniversalTime().ToString('o')
    root = $resolvedRoot
    file_count = @(Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse -Force).Count
    safe = ($findings.Count -eq 0)
    findings = @($findings)
}

if ($ReportPath) {
    $reportParent = Split-Path -Parent $ReportPath
    if ($reportParent) { New-Item -ItemType Directory -Force -Path $reportParent | Out-Null }
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
}

if ($findings.Count -gt 0) {
    $lines = @($findings | ForEach-Object { "- $($_.path) [$($_.reason)]" })
    throw "Package safety scan failed:`n$($lines -join "`n")"
}

[pscustomobject]$report
