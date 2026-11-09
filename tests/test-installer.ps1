param([Parameter(Mandatory=$true)][string]$NsisCompiler)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$testRoot = Join-Path $repo ('artifacts/installer-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$payload = Join-Path $testRoot 'payload.txt'
[IO.File]::WriteAllText($payload, 'new application fixture')
$installer = Join-Path $testRoot 'replace-test.exe'
& $NsisCompiler /INPUTCHARSET UTF8 /V2 "/DTEST_OUTPUT=$installer" "/DTEST_PAYLOAD=$payload" (Join-Path $PSScriptRoot 'installer-update.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Test installer compilation failed' }
foreach ($case in @('fresh','replace','locked','recovery')) {
    $target = Join-Path $testRoot $case
    New-Item -ItemType Directory -Path $target | Out-Null
    $app = Join-Path $target 'PixelVolume.exe'
    $sentinel = Join-Path $target 'preferences.txt'
    [IO.File]::WriteAllText($sentinel, 'preserve user preferences')
    if ($case -ne 'fresh') { [IO.File]::WriteAllText($app, 'old application fixture') }
    if ($case -eq 'recovery') { [IO.File]::WriteAllText((Join-Path $target 'PixelVolume.update-backup.exe'), 'earlier recovery fixture') }
    $lock = $null
    try {
        if ($case -eq 'locked') { $lock = [IO.File]::Open($app, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read) }
        $process = Start-Process -FilePath $installer -ArgumentList "/S /D=$target" -WindowStyle Hidden -Wait -PassThru
    } finally { if ($lock) { $lock.Dispose() } }
    $expected = if ($case -in @('locked','recovery')) { 3 } else { 0 }
    if ($process.ExitCode -ne $expected) { throw "Unexpected $case exit: $($process.ExitCode)" }
    $expectedContent = if ($expected -eq 0) { 'new application fixture' } else { 'old application fixture' }
    if ([IO.File]::ReadAllText($app) -ne $expectedContent) { throw "Incorrect application: $case" }
    if ([IO.File]::ReadAllText($sentinel) -ne 'preserve user preferences') { throw 'Preferences changed' }
    if (Test-Path -LiteralPath (Join-Path $target 'PixelVolume.update-new.exe')) { throw 'Staged file remained' }
    if ($case -eq 'recovery' -and [IO.File]::ReadAllText((Join-Path $target 'PixelVolume.update-backup.exe')) -ne 'earlier recovery fixture') { throw 'Recovery copy changed' }
    Write-Output "Installer isolated case passed: $case"
}
