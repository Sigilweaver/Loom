# Signs one Windows file with Azure Artifact Signing and checks the result.
#
# scripts/build.py --windows-sign calls it for the staged loom-server sidecar
# and hands it to Tauri as bundle.windows.signCommand, so Tauri signs the app
# exe after its final patch and then the installer. Signing the exe before
# `tauri bundle` does not work: bundling patches the exe and breaks the
# signature.
#
# Needs the ArtifactSigning PowerShell module and these variables (the
# windows-signing environment in CI): AZURE_TENANT_ID, AZURE_CLIENT_ID,
# AZURE_CLIENT_SECRET, AZURE_CODE_SIGNING_ENDPOINT, AZURE_CODE_SIGNING_ACCOUNT,
# AZURE_CERT_PROFILE_NAME.

param([Parameter(Mandatory = $true)][string]$Path)

$ErrorActionPreference = 'Stop'

$file = (Resolve-Path -LiteralPath $Path).Path
$params = @{
    Endpoint               = $env:AZURE_CODE_SIGNING_ENDPOINT
    CodeSigningAccountName = $env:AZURE_CODE_SIGNING_ACCOUNT
    CertificateProfileName = $env:AZURE_CERT_PROFILE_NAME
    Files                  = $file
    FileDigest             = 'SHA256'
    TimestampRfc3161       = 'http://timestamp.acs.microsoft.com'
    TimestampDigest        = 'SHA256'
}
foreach ($key in 'Endpoint', 'CodeSigningAccountName', 'CertificateProfileName') {
    if ([string]::IsNullOrWhiteSpace($params[$key])) {
        throw "sign-windows.ps1: $key is not set (see the variables listed at the top)"
    }
}

Invoke-ArtifactSigning @params

$sig = Get-AuthenticodeSignature -LiteralPath $file
if ($sig.Status -ne 'Valid') {
    throw "sign-windows.ps1: $file is '$($sig.Status)' after signing: $($sig.StatusMessage)"
}
Write-Host "Signed $file"
