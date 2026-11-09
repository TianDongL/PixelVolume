param(
    [Parameter(Mandatory=$true)][string]$NsisCompiler,
    [Parameter(Mandatory=$true)][string]$WebViewBootstrapper,
    [string]$Dotnet = 'dotnet'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$signature = Get-AuthenticodeSignature -LiteralPath $WebViewBootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'Use a valid Microsoft-signed WebView2 Evergreen Bootstrapper.'
}
$publish = Join-Path $root 'artifacts/windows-publish'
& $Dotnet publish (Join-Path $root 'windows/PixelVolume.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=None -p:DebugSymbols=false -o $publish
if ($LASTEXITCODE -ne 0) { throw 'Windows publish failed' }
New-Item -ItemType Directory -Force -Path (Join-Path $publish 'Licenses') | Out-Null
Copy-Item -Path (Join-Path $root 'licenses/*.txt') -Destination (Join-Path $publish 'Licenses')
Copy-Item -LiteralPath (Join-Path $root 'installer/Readme-Windows.txt') -Destination (Join-Path $publish 'Readme.txt')
[xml]$project = Get-Content -LiteralPath (Join-Path $root 'windows/PixelVolume.csproj')
$version = [string]$project.Project.PropertyGroup.Version
$output = Join-Path $root "artifacts/PixelVolume-$version-Windows-x64-Setup.exe"
& $NsisCompiler /INPUTCHARSET UTF8 /V3 "/DPUBLISH_DIR=$publish" "/DOUTPUT_FILE=$output" "/DBOOTSTRAPPER=$WebViewBootstrapper" (Join-Path $root 'installer/windows.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }
Get-FileHash -LiteralPath $output -Algorithm SHA256
