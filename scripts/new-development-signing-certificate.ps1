[CmdletBinding()]
param(
    [string]$Subject = 'CN=Coolzhu Agent Development Publisher',
    [ValidateRange(1, 5)]
    [int]$ValidityYears = 3,
    [string]$OutputDirectory = 'dist/development-signing',
    [switch]$InstallInTrustedPublisher
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$outputCandidate = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory
} else {
    Join-Path $workspace $OutputDirectory
}
$outputPath = [System.IO.Path]::GetFullPath($outputCandidate)

$certificate = @(
    Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Subject -eq $Subject -and
            $_.HasPrivateKey -and
            $_.NotAfter -gt (Get-Date).AddDays(30)
        } |
        Sort-Object NotAfter -Descending
) | Select-Object -First 1

if (-not $certificate) {
    $certificate = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Subject `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -KeyAlgorithm RSA `
        -KeyLength 3072 `
        -HashAlgorithm SHA256 `
        -KeyExportPolicy NonExportable `
        -NotAfter (Get-Date).AddYears($ValidityYears)
}

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$certificatePath = Join-Path $outputPath 'CoolzhuAgent-Development-Publisher.cer'
Export-Certificate -Cert $certificate -FilePath $certificatePath -Force | Out-Null

if ($InstallInTrustedPublisher) {
    $storePath = 'Cert:\CurrentUser\TrustedPublisher'
    $alreadyTrusted = Get-ChildItem $storePath -ErrorAction SilentlyContinue |
        Where-Object { $_.Thumbprint -eq $certificate.Thumbprint } |
        Select-Object -First 1
    if (-not $alreadyTrusted) {
        Import-Certificate -FilePath $certificatePath -CertStoreLocation $storePath | Out-Null
    }
}

$metadata = [ordered]@{
    warning = 'DEVELOPMENT CERTIFICATE ONLY. Do not use this certificate for a public release.'
    subject = $certificate.Subject
    thumbprint = $certificate.Thumbprint
    not_before = $certificate.NotBefore.ToUniversalTime().ToString('o')
    not_after = $certificate.NotAfter.ToUniversalTime().ToString('o')
    public_certificate = $certificatePath
    private_key_exported = $false
    installed_in_trusted_publisher = [bool]$InstallInTrustedPublisher
    root_trust_installed = [bool](
        Get-ChildItem Cert:\CurrentUser\Root -ErrorAction SilentlyContinue |
            Where-Object { $_.Thumbprint -eq $certificate.Thumbprint } |
            Select-Object -First 1
    )
    trust_note = 'A self-signed development certificate still requires an explicit, interactive trust decision on each test computer.'
}
$metadataPath = Join-Path $outputPath 'certificate-metadata.json'
$metadata | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
$metadata | ConvertTo-Json -Compress
