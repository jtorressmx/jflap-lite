param(
    [switch]$SkipBuild,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Files
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$javaCommand = Get-Command java -ErrorAction Stop
$inputFiles = @($Files | ForEach-Object { (Resolve-Path -LiteralPath $_).Path })

Push-Location $projectRoot
try {
    if (-not $SkipBuild) {
        & (Join-Path $projectRoot 'mvnw.cmd') -B -ntp package
        if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
    }
    if (-not (Test-Path -LiteralPath 'target/JFLAP.jar')) {
        throw 'Build the project first with .\mvnw.cmd package.'
    }
    # Keep local preferences with the generated application.
    Set-Location (Join-Path $projectRoot 'target')
    & $javaCommand.Source -jar JFLAP.jar @inputFiles
    if ($LASTEXITCODE -ne 0) { throw "JFLAP exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}
