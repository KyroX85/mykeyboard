param(
  [string]$ApkPath = "app/build/outputs/apk/debug/app-debug.apk",
  [string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
)

if (!(Test-Path $ApkPath)) {
  throw "APK not found: $ApkPath"
}

& $Adb wait-for-device
& $Adb install -r $ApkPath
