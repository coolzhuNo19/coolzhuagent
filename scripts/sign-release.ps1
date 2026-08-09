[CmdletBinding(DefaultParameterSetName = 'Thumbprint')]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true, ParameterSetName = 'Thumbprint')]
    [string]$CertificateThumbprint,

    [Parameter(Mandatory = $true, ParameterSetName = 'Pfx')]
    [string]$PfxPath,

    [Parameter(ParameterSetName = 'Pfx')]
    [string]$PfxPasswordEnvironmentVariable = 'COOLZHU_SIGNING_PFX_PASSWORD',

    [string]$TimestampUrl = 'http://timestamp.digicert.com',
    [switch]$SkipTimestamp,
    [switch]$AllowUntrustedCertificate,
    [switch]$IncludePowerShellScripts,
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'
$codeSigningEku = '1.3.6.1.5.5.7.3.3'

function Test-CodeSigningCertificate {
    param([Parameter(Mandatory = $true)]$Certificate)

    if (-not $Certificate.HasPrivateKey) {
        throw "signing certificate has no private key: $($Certificate.Subject)"
    }
    if ($Certificate.NotAfter -le (Get-Date)) {
        throw "signing certificate has expired: $($Certificate.NotAfter.ToString('o'))"
    }
    $ekuOids = @($Certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | ForEach-Object {
        $_.EnhancedKeyUsages | ForEach-Object { $_.Value }
    })
    if ($ekuOids -notcontains $codeSigningEku) {
        throw "certificate is not valid for code signing: $($Certificate.Subject)"
    }
}

function Resolve-SigningCertificate {
    if ($PSCmdlet.ParameterSetName -eq 'Pfx') {
        $fullPfxPath = [System.IO.Path]::GetFullPath($PfxPath)
        if (-not (Test-Path -LiteralPath $fullPfxPath -PathType Leaf)) {
            throw "PFX file not found: $fullPfxPath"
        }
        $passwordText = [Environment]::GetEnvironmentVariable($PfxPasswordEnvironmentVariable)
        if ([string]::IsNullOrWhiteSpace($passwordText)) {
            throw "PFX password environment variable is empty: $PfxPasswordEnvironmentVariable"
        }
        $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet -bor
            [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
        return [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
            $fullPfxPath,
            $passwordText,
            $flags
        )
    }

    $normalizedThumbprint = ($CertificateThumbprint -replace '\s', '').ToUpperInvariant()
    $certificate = @(
        Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -ErrorAction SilentlyContinue |
            Where-Object { $_.Thumbprint -eq $normalizedThumbprint }
    ) | Select-Object -First 1
    if (-not $certificate) {
        throw "code-signing certificate not found by thumbprint: $normalizedThumbprint"
    }
    return $certificate
}

function Get-SigningTargets {
    param([Parameter(Mandatory = $true)][string]$InputPath)

    $resolved = Resolve-Path -LiteralPath $InputPath -ErrorAction Stop
    if ((Get-Item -LiteralPath $resolved.Path).PSIsContainer) {
        $extensions = @('.exe', '.dll')
        if ($IncludePowerShellScripts) {
            $extensions += @('.ps1', '.psm1')
        }
        return @(
            Get-ChildItem -LiteralPath $resolved.Path -Recurse -File |
                Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() } |
                Sort-Object FullName
        )
    }

    return @((Get-Item -LiteralPath $resolved.Path))
}

$certificate = Resolve-SigningCertificate
Test-CodeSigningCertificate -Certificate $certificate
$targets = @(Get-SigningTargets -InputPath $Path)
if ($targets.Count -eq 0) {
    throw "no signable files found: $Path"
}

$results = [System.Collections.Generic.List[object]]::new()
foreach ($target in $targets) {
    $signatureParameters = @{
        FilePath = $target.FullName
        Certificate = $certificate
        HashAlgorithm = 'SHA256'
        IncludeChain = 'All'
        Force = $true
    }
    if (-not $SkipTimestamp) {
        if ([string]::IsNullOrWhiteSpace($TimestampUrl)) {
            throw 'TimestampUrl is required unless SkipTimestamp is set.'
        }
        $signatureParameters.TimestampServer = $TimestampUrl
    }

    Set-AuthenticodeSignature @signatureParameters | Out-Null
    $signature = Get-AuthenticodeSignature -LiteralPath $target.FullName
    if (-not $signature.SignerCertificate) {
        throw "file remains unsigned after signing: $($target.FullName)"
    }
    if ($signature.SignerCertificate.Thumbprint -ne $certificate.Thumbprint) {
        throw "unexpected signer certificate after signing: $($target.FullName)"
    }
    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid -and -not $AllowUntrustedCertificate) {
        throw "signature is not trusted for '$($target.FullName)': $($signature.Status) - $($signature.StatusMessage)"
    }
    if ($signature.Status -in @(
        [System.Management.Automation.SignatureStatus]::NotSigned,
        [System.Management.Automation.SignatureStatus]::HashMismatch,
        [System.Management.Automation.SignatureStatus]::NotSupported
    )) {
        throw "signature verification failed for '$($target.FullName)': $($signature.Status)"
    }

    $results.Add([ordered]@{
        path = $target.FullName
        status = [string]$signature.Status
        signer_subject = $signature.SignerCertificate.Subject
        signer_thumbprint = $signature.SignerCertificate.Thumbprint
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $target.FullName).Hash
    })
}

$report = [ordered]@{
    signed_at = (Get-Date).ToUniversalTime().ToString('o')
    signer_subject = $certificate.Subject
    signer_thumbprint = $certificate.Thumbprint
    certificate_not_after = $certificate.NotAfter.ToUniversalTime().ToString('o')
    timestamp_url = if ($SkipTimestamp) { $null } else { $TimestampUrl }
    allow_untrusted_certificate = [bool]$AllowUntrustedCertificate
    file_count = $results.Count
    files = $results
}

if ($ReportPath) {
    $fullReportPath = [System.IO.Path]::GetFullPath($ReportPath)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fullReportPath) | Out-Null
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $fullReportPath -Encoding UTF8
}

$report | ConvertTo-Json -Depth 8 -Compress
