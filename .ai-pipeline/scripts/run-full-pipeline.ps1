param(
    [ValidateSet("Full", "AuditOnly", "Verify")]
    [string]$Mode = "Full",
    [string]$DiffBase = "",
    [switch]$ApplySafeFixes,
    [switch]$SkipEmail,
    [switch]$Ci
)

$ErrorActionPreference = "Stop"

$ExitSuccess = 0
$ExitDangerousChange = 2
$ExitVerificationFailed = 3
$ExitEmailFailed = 4
$ExitPipelineError = 5

$startedAt = Get-Date
$script:PipelineStages = @()
$script:FailureStage = $null
$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root

function Initialize-AndroidToolingEnvironment {
    $javaCandidates = @(
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Android\Android Studio1\jbr",
        "C:\Program Files\Java\jdk-21",
        "C:\Program Files\Java\jdk-17"
    )

    if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME) -or !(Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
        foreach ($candidate in $javaCandidates) {
            if (Test-Path (Join-Path $candidate "bin\java.exe")) {
                $env:JAVA_HOME = $candidate
                break
            }
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $javaBin = Join-Path $env:JAVA_HOME "bin"
        $pathSeparator = [System.IO.Path]::PathSeparator
        if (($env:PATH -split [regex]::Escape([string]$pathSeparator)) -notcontains $javaBin) {
            $env:PATH = "$javaBin$pathSeparator$env:PATH"
        }
    }

    $sdkCandidates = @()
    if (Test-Path "local.properties") {
        $sdkLine = Get-Content -Path "local.properties" | Where-Object { $_ -match "^sdk\.dir=" } | Select-Object -First 1
        if ($sdkLine) {
            $sdkCandidates += (($sdkLine -replace "^sdk\.dir=", "") -replace "\\\\", "\")
        }
    }
    $sdkCandidates += @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$HOME\AppData\Local\Android\Sdk"
    )

    if ([string]::IsNullOrWhiteSpace($env:ANDROID_HOME) -or !(Test-Path $env:ANDROID_HOME)) {
        foreach ($candidate in $sdkCandidates) {
            if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
                $env:ANDROID_HOME = $candidate
                $env:ANDROID_SDK_ROOT = $candidate
                break
            }
        }
    }
}

Initialize-AndroidToolingEnvironment

$reportsDir = ".ai-pipeline/reports/latest"
$historyDir = ".ai-pipeline/reports/history"
$logsDir = Join-Path $reportsDir "logs"
$diffsDir = Join-Path $reportsDir "diffs"
$stateDir = ".ai-pipeline/state"

foreach ($dir in @($reportsDir, $historyDir, $logsDir, $diffsDir, $stateDir)) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Write-Json {
    param([string]$Path, [object]$Value, [int]$Depth = 12)
    ($Value | ConvertTo-Json -Depth $Depth) | Set-Content -Path $Path -Encoding UTF8
}

function Write-PipelineEvent {
    param(
        [string]$Stage,
        [string]$Message,
        [hashtable]$Data = @{}
    )

    $eventPath = Join-Path $logsDir "pipeline-events.jsonl"
    $event = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        stage = $Stage
        message = $Message
        data = $Data
    }
    ($event | ConvertTo-Json -Compress -Depth 8) | Add-Content -Path $eventPath -Encoding UTF8
    Write-Host "[$($event.timestamp)] $Stage - $Message"
}

function Set-PipelineStage {
    param(
        [string]$Stage,
        [ValidateSet("PASSED", "FAILED", "SKIPPED", "STARTED")]
        [string]$Status,
        [string]$Reason = $null
    )

    $record = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        stage = $Stage
        status = $Status
        reason = if ([string]::IsNullOrWhiteSpace($Reason)) { $null } else { Redact-SensitiveText $Reason }
    }
    $script:PipelineStages += [pscustomobject]$record
    if ($Status -eq "FAILED" -and [string]::IsNullOrWhiteSpace($script:FailureStage)) {
        $script:FailureStage = $Stage
    }
    Write-PipelineEvent $Stage $Status @{ reason = $record.reason }
}

function Get-EmailFailureClassification {
    param([string]$Message)

    if ([string]::IsNullOrWhiteSpace($Message)) { return "UNKNOWN" }
    if ($Message -match "(?i)auth|credential|5\.7\.8|username|password") { return "SMTP_AUTH_FAILURE" }
    if ($Message -match "(?i)rate|quota|too many|throttle|4\.7\.0|421") { return "RATE_LIMITED" }
    if ($Message -match "(?i)timeout|timed out|operation has timed out") { return "GITHUB_ACTION_TIMEOUT" }
    if ($Message -match "(?i)reject|denied|blocked|5\.7\.1|5\.4\.|550|554") { return "GMAIL_REJECTED" }
    if ($Message -match "(?i)report|summary|founder-report|missing summary") { return "REPORT_GENERATION_FAILED" }
    return "UNKNOWN"
}

function Write-EmailDeliveryAudit {
    param(
        [string]$EmailStatus,
        [string]$FailureClassification = $null,
        [string]$Message = $null,
        [bool]$Attempted = $false,
        [string]$Subject = $null
    )

    $audit = [ordered]@{
        generatedAt = (Get-Date).ToString("o")
        workflowStartedAt = $startedAt.ToString("o")
        commit = $commit
        branch = $branch
        mode = $Mode
        ci = $Ci.IsPresent
        workflowTriggered = $true
        workflowExecuted = $true
        emailStageEntered = $Attempted
        smtpAuthPassed = if ($EmailStatus -eq "PASSED") { $true } else { $false }
        gmailAccepted = if ($EmailStatus -eq "PASSED") { $true } else { $false }
        failureStage = $script:FailureStage
        stages = @($script:PipelineStages)
        attachmentsGenerated = [ordered]@{
            summary = Test-Path (Join-Path $reportsDir "summary.md")
            founderReport = Test-Path (Join-Path $reportsDir "founder-report.md")
            pipelineSummary = Test-Path (Join-Path $reportsDir "pipeline-summary.json")
        }
        emailSkippedReason = if ($EmailStatus -eq "SKIPPED") { $Message } else { $null }
        finalDeliveryState = $EmailStatus
        emailStatus = $EmailStatus
        emailAttempted = $Attempted
        failureClassification = $FailureClassification
        message = if ([string]::IsNullOrWhiteSpace($Message)) { $null } else { Redact-SensitiveText $Message }
        subject = $Subject
        smtpConfiguration = [ordered]@{
            hostConfigured = -not [string]::IsNullOrWhiteSpace($env:AI_PIPELINE_SMTP_HOST) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_HOST)
            portConfigured = -not [string]::IsNullOrWhiteSpace($env:AI_PIPELINE_SMTP_PORT) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_PORT)
            usernameConfigured = -not [string]::IsNullOrWhiteSpace($env:AI_PIPELINE_SMTP_USERNAME) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_USERNAME)
            passwordConfigured = -not [string]::IsNullOrWhiteSpace($env:AI_PIPELINE_SMTP_PASSWORD) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_APP_PASSWORD) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_PASSWORD)
            senderConfigured = -not [string]::IsNullOrWhiteSpace($env:AI_PIPELINE_SMTP_FROM) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_SENDER_EMAIL) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_SENDER) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_FROM)
            recipientConfigured = -not [string]::IsNullOrWhiteSpace($env:AI_PIPELINE_REPORT_RECIPIENT) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_REPORT_RECIPIENT) -or -not [string]::IsNullOrWhiteSpace($env:SMTP_RECIPIENT)
            tlsExpected = $true
        }
        inboxPlacementAssessment = [ordered]@{
            smtpAcceptedOnlyMeansProviderAcceptedMessage = $true
            inboxGuaranteed = $false
            inboxRisk = "low when sender and recipient are separate Gmail accounts and SPF/DKIM are managed by Gmail"
            spamRisk = "low-to-medium for automated reports; keep body concise and avoid attachment-heavy sends"
            promotionsRisk = "low-to-medium; Gmail can still classify automated mail outside Inbox"
        }
    }

    Write-Json -Path (Join-Path $reportsDir "email-delivery-audit.json") -Value $audit -Depth 12
    $heartbeatPath = Join-Path $reportsDir "last-successful-email.json"
    if ($EmailStatus -ne "PASSED" -and !(Test-Path $heartbeatPath)) {
        Write-Json -Path $heartbeatPath -Value ([ordered]@{
            generatedAt = (Get-Date).ToString("o")
            status = "NO_SUCCESS_RECORDED"
            lastSuccessfulEmailAt = $null
            note = "No successful SMTP delivery has been recorded in this reports directory yet."
        }) -Depth 5
    }
}

function Redact-SensitiveText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }
    $patterns = @(
        "(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+",
        "(?i)(supabase\.key\s*=\s*)[^\s]+",
        "(?i)(authorization\s*:\s*bearer\s+)[a-z0-9\-\._]+",
        "(?i)(apikey\s*[:=]\s*)[^\s,;]+",
        "(?i)(keystroke[s]?\s*[:=]\s*).*"
    )
    $out = $Text
    foreach ($pattern in $patterns) {
        $out = [System.Text.RegularExpressions.Regex]::Replace($out, $pattern, '$1[REDACTED]')
    }
    return $out
}

function Invoke-GitLines {
    param([string[]]$GitArgs)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git @GitArgs 2>$null
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0 -or $null -eq $output) { return @() }
    return @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-BranchName {
    $branch = ((git rev-parse --abbrev-ref HEAD) 2>$null)
    if ([string]::IsNullOrWhiteSpace($branch)) { return "unknown" }
    return $branch.Trim()
}

function Get-CommitHash {
    $hash = ((git rev-parse --short HEAD) 2>$null)
    if ([string]::IsNullOrWhiteSpace($hash)) { return "unknown" }
    return $hash.Trim()
}

function Resolve-DiffArgs {
    param([string]$PipelineMode, [string]$ExplicitBase)

    if (-not [string]::IsNullOrWhiteSpace($ExplicitBase)) {
        return @($ExplicitBase, "HEAD")
    }

    if ($PipelineMode -eq "AuditOnly") {
        $hasParent = (& git rev-parse --verify "HEAD~1" 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($hasParent)) {
            return @("HEAD~1", "HEAD")
        }
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null)
        $upstreamExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($upstreamExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($upstream)) {
        return @("$upstream...HEAD")
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $hasPrevious = (& git rev-parse --verify "HEAD~1" 2>$null)
        $previousExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($previousExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($hasPrevious)) {
        return @("HEAD~1", "HEAD")
    }

    return @("HEAD")
}

function Get-ChangedFiles {
    param([string[]]$DiffArgs)

    $files = @()
    if ($DiffArgs.Count -eq 1 -and $DiffArgs[0] -eq "HEAD") {
        $files += Invoke-GitLines -GitArgs @("diff", "--name-only", "HEAD")
    }
    else {
        $files += Invoke-GitLines -GitArgs (@("diff", "--name-only") + $DiffArgs)
    }

    $files += Invoke-GitLines -GitArgs @("diff", "--name-only")
    $files += Invoke-GitLines -GitArgs @("diff", "--name-only", "--cached")
    $files += Invoke-GitLines -GitArgs @("ls-files", "--others", "--exclude-standard")
    return @(
        $files |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Where-Object { ($_ -replace "\\", "/") -notmatch "^\.ai-pipeline/(reports|state)/" } |
            Sort-Object -Unique
    )
}

function Get-DiffText {
    param([string[]]$DiffArgs, [string]$File)

    $chunks = @()
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        if ($DiffArgs.Count -eq 1 -and $DiffArgs[0] -eq "HEAD") {
            $chunks += ((git diff --unified=0 -- $File) 2>$null) -join "`n"
        }
        else {
            $chunks += ((git diff --unified=0 @DiffArgs -- $File) 2>$null) -join "`n"
        }

        $chunks += ((git diff --unified=0 -- $File) 2>$null) -join "`n"
        $chunks += ((git diff --cached --unified=0 -- $File) 2>$null) -join "`n"
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    return ($chunks | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n"
}

function New-Finding {
    param(
        [string]$Severity,
        [string]$Category,
        [string]$File,
        [string]$Message,
        [bool]$RequiresApproval = $false
    )
    [pscustomobject]@{
        severity = $Severity
        category = $Category
        file = $File
        message = $Message
        requiresHumanApproval = $RequiresApproval
        safeAutoFix = $false
    }
}

function Test-TaskExists {
    param([string]$TasksOutput, [string]$TaskName)
    return ($TasksOutput -match "(?m)^\s*($([regex]::Escape($TaskName))|app:$([regex]::Escape($TaskName)))\s")
}

function Resolve-GradleTaskPath {
    param([string]$TasksOutput, [string]$TaskName)
    if ($TasksOutput -match "(?m)^\s*$([regex]::Escape($TaskName))\s") { return $TaskName }
    if ($TasksOutput -match "(?m)^\s*app:$([regex]::Escape($TaskName))\s") { return "app:$TaskName" }
    return $TaskName
}

function Get-GradleCommand {
    if ($env:OS -eq "Windows_NT" -and (Test-Path ".\gradlew.bat")) {
        return ".\gradlew.bat"
    }
    return "./gradlew"
}

function Invoke-NativeCapture {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Command @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    [pscustomobject]@{
        output = @($output)
        exitCode = $exitCode
    }
}

function Invoke-GradleTask {
    param(
        [string]$TaskName,
        [bool]$Required,
        [string]$TasksOutput,
        [bool]$TasksProbeFailed = $false
    )

    $logPath = Join-Path $logsDir "$TaskName.log"
    $exists = if ($TasksProbeFailed -and $Required) { $true } else { Test-TaskExists -TasksOutput $TasksOutput -TaskName $TaskName }
    if (-not $exists) {
        $status = if ($Required) { "failed" } else { "skipped" }
        "Gradle task '$TaskName' was not found." | Set-Content -Path $logPath -Encoding UTF8
        return [pscustomobject]@{
            name = $TaskName
            status = $status
            required = $Required
            exitCode = if ($Required) { 1 } else { 0 }
            log = $logPath
            startedAt = (Get-Date).ToString("o")
            finishedAt = (Get-Date).ToString("o")
        }
    }

    $taskStarted = Get-Date
    $gradle = Get-GradleCommand
    $taskPath = Resolve-GradleTaskPath -TasksOutput $TasksOutput -TaskName $TaskName
    $result = Invoke-NativeCapture -Command $gradle -Arguments @($taskPath, "--stacktrace")
    $exitCode = $result.exitCode
    $result.output | Set-Content -Path $logPath -Encoding UTF8
    $taskFinished = Get-Date

    [pscustomobject]@{
        name = $TaskName
        status = if ($exitCode -eq 0) { "passed" } else { "failed" }
        required = $Required
        exitCode = $exitCode
        log = $logPath
        startedAt = $taskStarted.ToString("o")
        finishedAt = $taskFinished.ToString("o")
        durationSeconds = [Math]::Round(($taskFinished - $taskStarted).TotalSeconds, 2)
    }
}

function Classify-Changes {
    param([string[]]$Files, [string[]]$DiffArgs)

    $safe = @()
    $risky = @()
    $dangerousFindings = @()

    foreach ($file in $Files) {
        $normalized = $file -replace "\\", "/"
        $diffText = Get-DiffText -DiffArgs $DiffArgs -File $file
        $isDangerous = $false

        if ($normalized -match "^(\.ai-pipeline|\.github)/") {
            $safe += $file
            continue
        }

        if ($normalized -match "(^|/)AndroidManifest\.xml$") {
            $dangerousFindings += New-Finding "high" "android-manifest" $file "AndroidManifest changed. Review permissions, components, and IME metadata." $true
            $isDangerous = $true
        }
        if ($diffText -match "uses-permission|android:permission") {
            $dangerousFindings += New-Finding "high" "permissions" $file "Permission-related diff detected." $true
            $isDangerous = $true
        }
        if ($diffText -match "android:exported|<service|<receiver|<provider|<activity") {
            $dangerousFindings += New-Finding "high" "exported-components" $file "Android component declaration changed." $true
            $isDangerous = $true
        }
        if ($normalized -match "config\.properties|supabase|ConfigManager|KeyboardService\.kt" -and $diffText -match "supabase|typing_logs|logEvent|JSONObject|payload|Authorization|apikey|auth|gotrue") {
            $dangerousFindings += New-Finding "high" "telemetry-or-supabase" $file "Telemetry or Supabase payload/auth surface changed." $true
            $isDangerous = $true
        }
        if ($normalized -match "KeyboardService\.kt" -and $diffText -match "onStartInput|onFinishInput|onFinishInputView|onCreateInputView|onWindowHidden|onDestroy|InputMethodService") {
            $dangerousFindings += New-Finding "medium" "ime-lifecycle" $file "Input method lifecycle behavior changed." $true
            $isDangerous = $true
        }
        if ($diffText -match "CoroutineScope|Dispatchers|SupervisorJob|launch|async|Handler|Looper|Thread|synchronized|Atomic|OkHttpClient") {
            $dangerousFindings += New-Finding "medium" "threading-concurrency" $file "Threading, coroutine, handler, or async network behavior changed." $true
            $isDangerous = $true
        }
        if ($normalized -match "(^|/)(build\.gradle\.kts|settings\.gradle\.kts|libs\.versions\.toml|gradle\.properties)$") {
            $dangerousFindings += New-Finding "medium" "dependency-or-build-config" $file "Build, dependency, or Gradle configuration changed." $true
            $isDangerous = $true
        }
        if ($normalized -match "keystore|proguard-rules\.pro" -or $diffText -match "signingConfig|storeFile|storePassword|keyAlias|keyPassword|minifyEnabled|shrinkResources") {
            $dangerousFindings += New-Finding "high" "signing-release-config" $file "Signing, release, or shrinker configuration changed." $true
            $isDangerous = $true
        }

        if ($isDangerous) {
            $risky += $file
        }
        else {
            $safe += $file
        }
    }

    [pscustomobject]@{
        safe = @($safe | Sort-Object -Unique)
        risky = @($risky | Sort-Object -Unique)
        dangerousFindings = @($dangerousFindings)
    }
}

function Save-DiffArtifacts {
    param([string[]]$DiffArgs)

    $diffPath = Join-Path $diffsDir "changed-files.diff"
    if ($DiffArgs.Count -eq 1 -and $DiffArgs[0] -eq "HEAD") {
        $diff = & git diff HEAD 2>$null
    }
    else {
        $diff = & git diff @DiffArgs 2>$null
    }
    (Redact-SensitiveText ($diff -join "`n")) | Set-Content -Path $diffPath -Encoding UTF8
    return $diffPath
}

function Invoke-SafeFixes {
    param([string]$TasksOutput)

    $safeFixes = @()
    $rollbackPatch = Join-Path $stateDir "pre-safe-fix.patch"
    $safeFixPatch = Join-Path $stateDir "safe-fixes.patch"
    $redactedSafeFixPatch = Join-Path $diffsDir "safe-fixes.redacted.patch"

    $preDiff = & git diff 2>$null
    $preDiff | Set-Content -Path $rollbackPatch -Encoding UTF8

    if (Test-TaskExists -TasksOutput $TasksOutput -TaskName "ktlintFormat") {
        $gradle = Get-GradleCommand
        $logPath = Join-Path $logsDir "ktlintFormat.log"
        $result = Invoke-NativeCapture -Command $gradle -Arguments @("ktlintFormat", "--stacktrace")
        $exitCode = $result.exitCode
        $result.output | Set-Content -Path $logPath -Encoding UTF8
        $safeFixes += [pscustomobject]@{
            type = "ktlintFormat"
            status = if ($exitCode -eq 0) { "applied" } else { "failed" }
            rollbackPatch = $rollbackPatch
            log = $logPath
        }
    }
    else {
        $safeFixes += [pscustomobject]@{
            type = "ktlintFormat"
            status = "skipped"
            reason = "Gradle task not configured"
            rollbackPatch = $rollbackPatch
        }
    }

    $postDiff = & git diff 2>$null
    $postDiff | Set-Content -Path $safeFixPatch -Encoding UTF8
    (Redact-SensitiveText ($postDiff -join "`n")) | Set-Content -Path $redactedSafeFixPatch -Encoding UTF8
    foreach ($fix in $safeFixes) {
        $fix | Add-Member -NotePropertyName patchArtifact -NotePropertyValue $redactedSafeFixPatch -Force
        $fix | Add-Member -NotePropertyName rollbackPatch -NotePropertyValue $rollbackPatch -Force
    }
    return @($safeFixes)
}

$commit = Get-CommitHash
$branch = Get-BranchName
Set-PipelineStage "WORKFLOW_TRIGGERED" "PASSED"
Set-PipelineStage "JOB_STARTED" "PASSED"
Set-PipelineStage "PIPELINE_STARTED" "PASSED"
$diffArgs = Resolve-DiffArgs -PipelineMode $Mode -ExplicitBase $DiffBase
$changedFiles = Get-ChangedFiles -DiffArgs $diffArgs
$diffArtifact = Save-DiffArtifacts -DiffArgs $diffArgs
$classification = Classify-Changes -Files $changedFiles -DiffArgs $diffArgs
$dangerousDetected = @($classification.dangerousFindings).Count -gt 0

Write-Json -Path (Join-Path $reportsDir "changed-files.json") -Value ([ordered]@{
    commit = $commit
    branch = $branch
    mode = $Mode
    diffArgs = $diffArgs
    changedFiles = $changedFiles
    safe = $classification.safe
    risky = $classification.risky
})

Write-Json -Path (Join-Path $reportsDir "dangerous-changes.json") -Value ([ordered]@{
    status = if ($dangerousDetected) { "requires_human_approval" } else { "clear" }
    findings = @($classification.dangerousFindings)
    diffArtifact = $diffArtifact
})

$auditFindings = @()
if ($dangerousDetected) {
    $auditFindings += @($classification.dangerousFindings)
}
if ($changedFiles.Count -eq 0) {
    $auditFindings += New-Finding "low" "change-detection" "" "No changed files detected for this pipeline run." $false
}

Write-Json -Path (Join-Path $reportsDir "audit.json") -Value ([ordered]@{
    status = if ($dangerousDetected) { "requires_human_approval" } else { "completed" }
    changedFiles = $changedFiles
    safeFiles = $classification.safe
    riskyFiles = $classification.risky
    findings = $auditFindings
    regressionRisks = @(
        if ($dangerousDetected) { "Risky source areas changed and require human review before push or merge." }
    )
})

$gradle = Get-GradleCommand
$tasksOutputPath = Join-Path $logsDir "gradle-tasks.log"
$tasksResult = Invoke-NativeCapture -Command $gradle -Arguments @("tasks", "--all")
$tasksProbeFailed = ($tasksResult.exitCode -ne 0)
$tasksOutput = $tasksResult.output -join "`n"
$tasksOutput | Set-Content -Path $tasksOutputPath -Encoding UTF8

$safeFixes = @()
if ($ApplySafeFixes.IsPresent -and -not $dangerousDetected) {
    $safeFixes = Invoke-SafeFixes -TasksOutput $tasksOutput
}
elseif ($ApplySafeFixes.IsPresent -and $dangerousDetected) {
    $safeFixes = @([pscustomobject]@{
        type = "safe-fixes"
        status = "skipped"
        reason = "Dangerous change detected; human approval required"
    })
}
Write-Json -Path (Join-Path $reportsDir "safe-fixes.json") -Value $safeFixes

$tasks = @()
if ($Mode -ne "AuditOnly") {
    $tasks += Invoke-GradleTask -TaskName "ktlintCheck" -Required $false -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
    $tasks += Invoke-GradleTask -TaskName "detekt" -Required $false -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
    $tasks += Invoke-GradleTask -TaskName "lintDebug" -Required $true -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
    $tasks += Invoke-GradleTask -TaskName "testDebugUnitTest" -Required $true -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
    $tasks += Invoke-GradleTask -TaskName "assembleDebug" -Required $true -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
}
else {
    $tasks += Invoke-GradleTask -TaskName "ktlintCheck" -Required $false -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
    $tasks += Invoke-GradleTask -TaskName "detekt" -Required $false -TasksOutput $tasksOutput -TasksProbeFailed $tasksProbeFailed
}

$failingTasks = @($tasks | Where-Object { $_.status -eq "failed" -and $_.required })
$verificationStatus = if ($failingTasks.Count -eq 0) { "passed" } else { "failed" }
if ($Mode -eq "AuditOnly") { $verificationStatus = "not_run" }

Write-Json -Path (Join-Path $reportsDir "verification.json") -Value ([ordered]@{
    status = $verificationStatus
    mode = $Mode
    tasks = $tasks
    failingTasks = $failingTasks
})

Write-Json -Path (Join-Path $reportsDir "architecture.json") -Value ([ordered]@{
    status = "generated"
    findings = @($classification.dangerousFindings | Where-Object { $_.category -in @("android-manifest", "exported-components", "ime-lifecycle", "dependency-or-build-config") })
})

Write-Json -Path (Join-Path $reportsDir "performance.json") -Value ([ordered]@{
    status = "generated"
    findings = @($classification.dangerousFindings | Where-Object { $_.category -eq "threading-concurrency" })
})

$reportStatus = if ($dangerousDetected) { "BLOCKED" } elseif ($verificationStatus -eq "failed") { "FAILED" } else { "PASSED" }
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $scriptDir "generate-founder-report.ps1") -Status $reportStatus -ReportsDir $reportsDir -HistoryDir $historyDir
Set-PipelineStage "REPORT_GENERATED" "PASSED"

$emailStatus = "not_attempted"
$emailError = $null
$emailFailureClassification = $null
if (-not $SkipEmail.IsPresent -and $Mode -ne "AuditOnly" -and $verificationStatus -eq "passed" -and -not $dangerousDetected) {
    try {
        Set-PipelineStage "SMTP_AUTH_STARTED" "STARTED"
        Set-PipelineStage "SMTP_SUBMISSION_STARTED" "STARTED"
        & (Join-Path $scriptDir "send-email-summary.ps1") -ReportsDir $reportsDir -Status "PASSED"
        $deliveryAuditPath = Join-Path $reportsDir "email-delivery-audit.json"
        $deliveryStatus = "PASSED"
        if (Test-Path $deliveryAuditPath) {
            $deliveryAudit = Get-Content -Raw -Path $deliveryAuditPath | ConvertFrom-Json
            if ($deliveryAudit.emailStatus) { $deliveryStatus = "$($deliveryAudit.emailStatus)" }
        }
        if ($deliveryStatus -ne "PASSED") {
            throw "Email sender completed without SMTP acceptance. EMAIL_STATUS=$deliveryStatus"
        }
        $emailStatus = "sent"
        Set-PipelineStage "SMTP_AUTH_SUCCESS" "PASSED"
        Set-PipelineStage "SMTP_SUBMISSION_SUCCESS" "PASSED"
        Set-PipelineStage "GMAIL_ACCEPTED" "PASSED"
        Set-PipelineStage "EMAIL_SENT" "PASSED"
    }
    catch {
        $emailStatus = "failed"
        $emailError = $_.Exception.Message
        $emailFailureClassification = Get-EmailFailureClassification -Message $emailError
        Set-PipelineStage "EMAIL_SENT" "FAILED" $emailError
    }
}
elseif ($SkipEmail.IsPresent -or $Mode -eq "AuditOnly") {
    $emailStatus = "skipped"
    Set-PipelineStage "EMAIL_SENT" "SKIPPED" "Email skipped by pipeline mode or SkipEmail flag."
    Write-EmailDeliveryAudit -EmailStatus "SKIPPED" -Attempted $false -Message "Email skipped by pipeline mode or SkipEmail flag."
}
elseif ($verificationStatus -ne "passed") {
    $emailStatus = "skipped"
    Set-PipelineStage "EMAIL_SENT" "SKIPPED" "Email skipped because verification did not pass."
    Write-EmailDeliveryAudit -EmailStatus "SKIPPED" -Attempted $false -Message "Email skipped because verification did not pass."
}
elseif ($dangerousDetected) {
    $emailStatus = "skipped"
    Set-PipelineStage "EMAIL_SENT" "SKIPPED" "Email skipped because dangerous changes require human approval."
    Write-EmailDeliveryAudit -EmailStatus "SKIPPED" -Attempted $false -Message "Email skipped because dangerous changes require human approval."
}

$finishedAt = Get-Date
$riskCounts = [ordered]@{
    safe = @($classification.safe).Count
    risky = @($classification.risky).Count
    dangerous = @($classification.dangerousFindings).Count
}

$pipelineSummary = [ordered]@{
    generatedAt = $finishedAt.ToString("o")
    commit = $commit
    branch = $branch
    mode = $Mode
    ci = $Ci.IsPresent
    status = $reportStatus
    buildDurationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 2)
    changedFileCounts = [ordered]@{
        total = @($changedFiles).Count
        safe = @($classification.safe).Count
        risky = @($classification.risky).Count
    }
    riskCounts = $riskCounts
    dangerousChangeDetected = $dangerousDetected
    requiresHumanApproval = $dangerousDetected
    failingTasks = @($failingTasks | Select-Object name, log, exitCode)
    ciStatus = if ($Ci.IsPresent) { $reportStatus } else { "local" }
    emailStatus = $emailStatus
    emailError = $emailError
    emailFailureClassification = $emailFailureClassification
    auditStatus = if ($dangerousDetected) { "requires_human_approval" } else { "completed" }
    reportsDir = $reportsDir
    diffArtifact = $diffArtifact
}

if ($dangerousDetected) {
    Set-PipelineStage "PIPELINE_FINISHED" "FAILED" "Dangerous change detected; human approval required."
}
elseif ($verificationStatus -eq "failed") {
    Set-PipelineStage "PIPELINE_FINISHED" "FAILED" "Required Gradle verification task failed."
}
elseif ($emailStatus -eq "failed") {
    Set-PipelineStage "PIPELINE_FINISHED" "FAILED" $emailError
}
else {
    Set-PipelineStage "PIPELINE_FINISHED" "PASSED"
}

Write-Json -Path (Join-Path $reportsDir "pipeline-summary.json") -Value $pipelineSummary
if ($emailStatus -eq "sent") {
    Write-EmailDeliveryAudit -EmailStatus "PASSED" -Attempted $true -Message "SMTP accepted message submission."
}
elseif ($emailStatus -eq "failed") {
    Write-EmailDeliveryAudit -EmailStatus "FAILED" -FailureClassification $emailFailureClassification -Message $emailError -Attempted $true
}
elseif ($emailStatus -eq "skipped") {
    $skipReason = if ($dangerousDetected) {
        "Email skipped because dangerous changes require human approval."
    }
    elseif ($verificationStatus -ne "passed") {
        "Email skipped because verification did not pass."
    }
    else {
        "Email skipped by pipeline mode or SkipEmail flag."
    }
    Write-EmailDeliveryAudit -EmailStatus "SKIPPED" -Message $skipReason -Attempted $false
}
Write-Json -Path (Join-Path $reportsDir "reporting-status.json") -Value ([ordered]@{
    generatedAt = $finishedAt.ToString("o")
    status = $reportStatus
    reportGenerated = $true
    emailAttempted = ($emailStatus -in @("sent", "failed"))
    emailSent = ($emailStatus -eq "sent")
    emailError = $emailError
    emailFailureClassification = $emailFailureClassification
})

($pipelineSummary | ConvertTo-Json -Compress -Depth 12) | Add-Content -Path (Join-Path $historyDir "report-index.jsonl") -Encoding UTF8

if ($dangerousDetected) {
    Write-Host "Pipeline blocked: dangerous change detected. Human approval required."
    exit $ExitDangerousChange
}
if ($verificationStatus -eq "failed") {
    Write-Host "Pipeline failed: required Gradle verification task failed."
    exit $ExitVerificationFailed
}
if ($emailStatus -eq "failed") {
    Write-Host "Pipeline failed: founder email delivery failed ($emailFailureClassification)."
    exit $ExitEmailFailed
}

Write-Host "Pipeline completed: $reportStatus"
exit $ExitSuccess
