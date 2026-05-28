param(
  [string]$OutputDir = "artifacts/product-lab/screenshots",
  [string]$Name = "aritenis-keyboard",
  [string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
)

New-Item -ItemType Directory -Force $OutputDir | Out-Null
& $Adb wait-for-device
& $Adb exec-out screencap -p > (Join-Path $OutputDir "$Name.png")
