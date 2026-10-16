param(
    [switch]$SkipBuild,
    [string]$OutputDirectory = 'dist'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($env:OS -ne 'Windows_NT') { throw 'Create the Windows executable on Windows.' }

$javaSettings = & java -XshowSettings:properties -version 2>&1
$javaHomeLine = $javaSettings | ForEach-Object { "$_" } | Where-Object { $_ -match '^\s*java.home = ' } | Select-Object -First 1
if (-not $javaHomeLine) { throw 'Could not find the active JDK.' }
$jdkRoot = ($javaHomeLine -split ' = ', 2)[1].Trim()
$jpackage = Join-Path $jdkRoot 'bin/jpackage.exe'
if (-not (Test-Path -LiteralPath $jpackage)) { throw 'The active JDK must include jpackage (JDK 17 or newer).' }

Push-Location $projectRoot
try {
    if (-not $SkipBuild) {
        & (Join-Path $projectRoot 'mvnw.cmd') -B -ntp clean verify
        if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
        & (Join-Path $PSScriptRoot 'audit-scope.ps1')
    }
    $appJar = Join-Path $projectRoot 'target/JFLAP.jar'
    if (-not (Test-Path -LiteralPath $appJar)) { throw 'Build the application before packaging.' }
    $outputRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
    $imageRoot = Join-Path $outputRoot 'JFLAP-Lite'
    $zipPath = Join-Path $outputRoot 'JFLAP-Lite-Windows-x64.zip'
    if ((Test-Path -LiteralPath $imageRoot) -or (Test-Path -LiteralPath $zipPath)) {
        throw "Output already exists. Choose a new folder with -OutputDirectory. Existing packages are preserved."
    }

    $staging = Join-Path $projectRoot ('target/windows-package-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    Copy-Item -LiteralPath $appJar -Destination (Join-Path $staging 'JFLAP.jar')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'target/lib') -Destination (Join-Path $staging 'lib') -Recurse
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

    & $jpackage --type app-image --name JFLAP-Lite --app-version 7.1.0 `
        --input $staging --dest $outputRoot --main-jar JFLAP.jar --main-class gui.Main `
        --vendor 'JFLAP Lite' --description 'Finite automata and Turing machines' `
        --add-modules 'java.base,java.desktop,java.xml,java.logging,java.prefs,jdk.charsets,jdk.localedata,jdk.unsupported,jdk.xml.dom,jdk.crypto.ec' `
        --jlink-options '--strip-debug --no-man-pages --no-header-files' `
        --java-options '-Dfile.encoding=UTF-8'
    if ($LASTEXITCODE -ne 0) { throw "jpackage failed with exit code $LASTEXITCODE" }

    Copy-Item -LiteralPath (Join-Path $projectRoot 'src/LICENSE') -Destination (Join-Path $imageRoot 'LICENSE.txt')
    @'
JFLAP Lite para Windows x64

Abre JFLAP-Lite.exe para comenzar.
Java ya esta incluido: no necesitas instalarlo.
Conserva toda esta carpeta; el ejecutable utiliza app/ y runtime/.
Si recibiste el ZIP, extraelo completamente antes de abrir el ejecutable.

Incluye automatas finitos y Turing estandar, multicinta y con bloques.
Proyecto original: JFLAP, Duke University. Consulta LICENSE.txt.
'@ | Set-Content -LiteralPath (Join-Path $imageRoot 'LEEME.txt') -Encoding UTF8

    Compress-Archive -LiteralPath $imageRoot -DestinationPath $zipPath -CompressionLevel Optimal
    Get-Item -LiteralPath (Join-Path $imageRoot 'JFLAP-Lite.exe'), $zipPath | Select-Object FullName, Length
} finally {
    Pop-Location
}
