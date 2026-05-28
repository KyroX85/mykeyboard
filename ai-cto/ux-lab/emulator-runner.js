function buildEmulatorUxLabPlan({
  apkPath = 'app/build/outputs/apk/debug/app-debug.apk',
  packageName = 'com.example.mykeyboard',
  imeService = 'com.example.mykeyboard/.KeyboardService',
  screenshotFile = 'artifacts/ux/aritenis-keyboard.png'
} = {}) {
  return {
    purpose: 'Build latest repo APK, run it in an emulator, and capture keyboard UI evidence.',
    mutationPolicy: 'analysis-only until founder approval',
    privacy: {
      rawTextStored: false,
      screenshotsMayContainTypedProbeText: true,
      recommendedProbeText: 'neutral test phrases only'
    },
    commands: [
      '.\\gradlew.bat :app:assembleDebug',
      `adb install -r "${apkPath}"`,
      `adb shell ime enable ${imeService}`,
      `adb shell ime set ${imeService}`,
      `adb shell monkey -p ${packageName} 1`,
      `adb exec-out screencap -p > "${screenshotFile}"`
    ],
    validation: [
      'APK exists before install',
      'emulator is listed by adb devices',
      'IME is enabled before screenshot',
      'screenshot file exists and is non-empty',
      'no raw private text is typed into the probe surface'
    ]
  };
}

module.exports = {
  buildEmulatorUxLabPlan
};
