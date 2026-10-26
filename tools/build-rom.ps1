# Assembles a Space Shuttle disassembly with DASM and checks the result's MD5
# against the cartridge (5894c9c0c1e7e29f3ab86c6d3f673361).
# usage: tools/build-rom.ps1 [source.asm]   (default: tools/build/space_shuttle_raw.asm)
# Output: tools/build/space_shuttle.{bin,lst,sym} (git-ignored).
# DASM runs in a temp folder because Windows' Controlled Folder Access stops
# it writing under Documents; the results are copied back afterwards.
param([string]$Source = (Join-Path $PSScriptRoot 'build\space_shuttle_raw.asm'))
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force $out | Out-Null
$tmp = Join-Path ([IO.Path]::GetTempPath()) 'space-shuttle-rom-build'
New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item $Source (Join-Path $tmp 'space_shuttle.asm') -Force
Copy-Item (Join-Path $PSScriptRoot 'dasm\vcs.h') $tmp -Force
Copy-Item (Join-Path $PSScriptRoot 'dasm\macro.h') $tmp -Force
Push-Location $tmp
try {
  # passed as an array: PowerShell mangles some DASM flags written inline
  $dasmArgs = @('space_shuttle.asm', '-f3', '-ospace_shuttle.bin', '-lspace_shuttle.lst', '-sspace_shuttle.sym')
  & (Join-Path $PSScriptRoot 'dasm\dasm.exe') @dasmArgs
  if ($LASTEXITCODE -ne 0) { throw "DASM failed ($LASTEXITCODE)" }
} finally { Pop-Location }
foreach ($f in 'space_shuttle.bin', 'space_shuttle.lst', 'space_shuttle.sym') { Copy-Item (Join-Path $tmp $f) $out -Force }
$md5 = (Get-FileHash (Join-Path $out 'space_shuttle.bin') -Algorithm MD5).Hash.ToLower()
if ($md5 -eq '5894c9c0c1e7e29f3ab86c6d3f673361') { Write-Output "OK: byte-identical to the cartridge ($md5)" }
else { Write-Output "MISMATCH: $md5"; exit 1 }
