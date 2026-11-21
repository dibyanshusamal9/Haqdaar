param(
  [string]$ArchivePath = (Join-Path $PSScriptRoot '..\..\..\assets\source\animation\haqdaar-hero-frames.zip')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceDirectory = Join-Path $siteRoot '.impeccable\source-frames'
[System.IO.Directory]::CreateDirectory($sourceDirectory) | Out-Null
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath))
try {
  $entries = @($archive.Entries | Where-Object { $_.Name -match '^ezgif-frame-\d+\.png$' })
  if ($entries.Count -ne 160) { throw "Expected 160 source frames, found $($entries.Count)." }
  foreach ($entry in $entries) {
    # Use the basename only; archive paths cannot escape the source directory.
    $destination = Join-Path $sourceDirectory $entry.Name
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
  }
} finally {
  $archive.Dispose()
}

& node (Join-Path $PSScriptRoot 'encode-scroll-frames.mjs') $sourceDirectory
if ($LASTEXITCODE -ne 0) { throw 'Frame encoding failed.' }
