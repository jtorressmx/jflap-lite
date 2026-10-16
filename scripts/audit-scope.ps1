$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'src'))
$classesRoot = Join-Path $projectRoot 'target/classes'
$jarPath = Join-Path $projectRoot 'target/JFLAP.jar'
if (-not (Test-Path -LiteralPath $jarPath)) {
    throw 'Run .\mvnw.cmd clean verify before auditing the packaged application.'
}

$javaSettings = & java -XshowSettings:properties -version 2>&1
$javaHomeLine = $javaSettings | ForEach-Object { "$_" } | Where-Object { $_ -match '^\s*java.home = ' } | Select-Object -First 1
if (-not $javaHomeLine) { throw 'Could not find the active JDK.' }
$jdkRoot = ($javaHomeLine -split ' = ', 2)[1].Trim()
$jdeps = Join-Path $jdkRoot 'bin/jdeps.exe'
if (-not (Test-Path -LiteralPath $jdeps)) { $jdeps = Join-Path $jdkRoot 'bin/jdeps' }
if (-not (Test-Path -LiteralPath $jdeps)) { throw 'The active Java installation must include jdeps (a JDK).' }

$dependencies = & $jdeps '-verbose:class' '-filter:none' '--class-path' (Join-Path $projectRoot 'target/lib/*') $classesRoot
if ($LASTEXITCODE -ne 0) { throw "jdeps failed with exit code $LASTEXITCODE" }
$graph = @{}
foreach ($line in $dependencies) {
    if ($line -match '^\s+(\S+)\s+->\s+(\S+)') {
        $owner = $Matches[1]
        $dependency = $Matches[2]
        if (-not $graph.ContainsKey($owner)) { $graph[$owner] = [Collections.Generic.HashSet[string]]::new() }
        [void]$graph[$owner].Add($dependency)
    }
}
$reachable = [Collections.Generic.HashSet[string]]::new()
$queue = [Collections.Generic.Queue[string]]::new()
$queue.Enqueue('gui.Main')
# Main registers this AWT handler through a JVM property.
$queue.Enqueue('gui.ThrowableCatcher')
while ($queue.Count -gt 0) {
    $className = $queue.Dequeue()
    if (-not $reachable.Add($className)) { continue }
    foreach ($dependency in $graph[$className]) { $queue.Enqueue($dependency) }
}
$reachableSources = [Collections.Generic.HashSet[string]]::new()
foreach ($className in $reachable) { [void]$reachableSources.Add(($className -split '\$', 2)[0]) }
$sourceFiles = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -Filter '*.java' -File)
$unused = @()
$resourcePaths = [Collections.Generic.HashSet[string]]::new()
[void]$resourcePaths.Add('LICENSE')
foreach ($sourceFile in $sourceFiles) {
    $name = $sourceFile.FullName.Substring($sourceRoot.Length + 1).Replace('\', '.').Replace('/', '.') -replace '\.java$', ''
    if (-not $reachableSources.Contains($name)) { $unused += $name }
    if ($sourceFile.Length -eq 0) { throw "Empty source: $name" }
    $contents = [IO.File]::ReadAllText($sourceFile.FullName)
    if ($contents -match '(?m)^\s*(?:package|import)\s+(?:grammar|regular|pumping|automata\.(?:pda|mealy|vdg)|gui\.(?:grammar|regular|pumping|lsystem))\b') {
        throw "Removed package referenced by $name"
    }
    if ($contents -match '\b(?:TMState|TuringMachineBuildingBlocks|TMBBTransducer|BuildingBlockSimulateAction|BuildingBlockTool|BlockTransitionTool|EditBlockPane)\b') {
        throw "Removed Turing class referenced by $name"
    }
    foreach ($match in [regex]::Matches($contents, '"/((?:ICON|MEDIA|DOCS)/[^"\r\n]+)"')) {
        [void]$resourcePaths.Add($match.Groups[1].Value)
    }
}
if ($unused.Count) { throw "Unreachable source classes: $($unused -join ', ')" }
$unusedNested = @($graph.Keys | Where-Object { $_.Contains('$') -and -not $reachable.Contains($_) })
if ($unusedNested.Count) { throw "Unreachable nested classes: $($unusedNested -join ', ')" }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($jarPath)
try {
    $forbidden = @($archive.Entries | Where-Object {
        $_.FullName -match '^(grammar|regular|pumping|automata/(pda|mealy|vdg)|gui/(grammar|regular|pumping|lsystem))/' -or
        $_.FullName -match '/(?:TMState|TuringMachineBuildingBlocks|TMBBTransducer|BuildingBlockSimulateAction|BuildingBlockTool|BlockTransitionTool|EditBlockPane)(?:\$[^/]*)?\.class$' -or
        $_.FullName -match '^ICON/(?:blocks|blockTransition)\.gif$'
    })
    if ($forbidden.Count) { throw "Removed packages in JAR: $($forbidden.FullName -join ', ')" }
    foreach ($resource in $resourcePaths) {
        if (-not $archive.GetEntry($resource)) { throw "Missing packaged resource: $resource" }
    }
    $orphanResources = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | Where-Object {
        $_.Extension -ne '.java' -and -not $resourcePaths.Contains($_.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/'))
    })
    if ($orphanResources.Count) { throw "Unreferenced resources: $($orphanResources.FullName -join ', ')" }
    $report = [ordered]@{
        sourceClasses = $sourceFiles.Count
        unreachableSourceClasses = $unused.Count
        unreachableNestedClasses = $unusedNested.Count
        forbiddenJarEntries = $forbidden.Count
        referencedResources = $resourcePaths.Count
        unreferencedResources = $orphanResources.Count
    }
    $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'target/scope-audit.json') -Encoding UTF8
    $report | ConvertTo-Json
} finally {
    $archive.Dispose()
}
