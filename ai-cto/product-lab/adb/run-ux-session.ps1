param(
  [string]$ApkPath = "app/build/outputs/apk/debug/app-debug.apk",
  [string]$OutputDir = "artifacts/product-lab",
  [string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
)

New-Item -ItemType Directory -Force $OutputDir | Out-Null
& $Adb wait-for-device
& $Adb reverse tcp:3000 tcp:3000
& $PSScriptRoot\install-latest-apk.ps1 -ApkPath $ApkPath -Adb $Adb
& $Adb shell ime enable com.example.mykeyboard/.KeyboardService
& $Adb shell ime set com.example.mykeyboard/.KeyboardService
& $PSScriptRoot\capture-screenshots.ps1 -OutputDir (Join-Path $OutputDir "screenshots") -Name "aritenis-keyboard" -Adb $Adb
