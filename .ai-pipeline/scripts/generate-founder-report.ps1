param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("PASSED", "FAILED", "DEGRADED", "BLOCKED")]
    [string]$Status,
    [string]$ReportsDir = ".ai-pipeline/reports/latest",
    [string]$HistoryDir = ".ai-pipeline/reports/history"
)

$ErrorActionPreference = "Stop"

function Read-JsonFile {
    param([string]$Path, [object]$Fallback = $null)
    if (Test-Path $Path) {
        return (Get-Content -Raw -Path $Path | ConvertFrom-Json)
    }
    return $Fallback
}

function Count-Items {
    param([object]$Value)
    if ($null -eq $Value) { return 0 }
    if ($Value -is [System.Array]) { return $Value.Count }
    return 1
}

function Redact-SensitiveText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }
    $patterns = @(
        "(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+",
        "(?i)(supabase\.key\s*=\s*)[^\s]+",
        "(?i)(apikey\s*[:=]\s*)[^\s,;]+",
        "(?i)authorization\s*:\s*bearer\s+[a-z0-9\-\._]+",
        "(?i)keystroke[s]?\s*[:=]\s*.*",
        "(?i)(typed|raw[_-]?input|typed[_-]?content)\s*[:=]\s*.*"
    )
    $out = $Text
    foreach ($p in $patterns) {
        $out = [System.Text.RegularExpressions.Regex]::Replace($out, $p, "[REDACTED]")
    }
    return $out
}

function Get-StatusIcon {
    param([string]$Value)
    $pass = [char]::ConvertFromUtf32(0x2705)
    $warning = [char]::ConvertFromUtf32(0x26A0)
    $blocked = [char]::ConvertFromUtf32(0x274C)
    switch ($Value) {
        "PASSED" { return "$pass PASS" }
        "BLOCKED" { return "$blocked BLOCKED" }
        "FAILED" { return "$blocked FAILED" }
        "DEGRADED" { return "$warning WARNING" }
        default { return "$warning WARNING" }
    }
}

function Get-TrendLabel {
    param([string]$Value)
    $improving = [char]::ConvertFromUtf32(0x1F4C8)
    $degrading = [char]::ConvertFromUtf32(0x1F4C9)
    $stable = [char]::ConvertFromUtf32(0x27A1)
    switch ($Value) {
        "improving" { return "$improving improving" }
        "worsening" { return "$degrading degrading" }
        default { return "$stable stable" }
    }
}

function Select-TopMessages {
    param([object[]]$Findings, [int]$Limit = 3)
    $messages = @()
    $seenCategories = @{}
    $sorted = @(
        $Findings |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_.message) } |
            Sort-Object @{ Expression = {
                switch ("$($_.severity)".ToLowerInvariant()) {
                    "critical" { 0 }
                    "high" { 1 }
                    "medium" { 2 }
                    default { 3 }
                }
            }}
    )

    foreach ($finding in $sorted) {
        if ($messages.Count -ge $Limit) { break }
        $category = if ([string]::IsNullOrWhiteSpace($finding.category)) { "risk" } else { "$($finding.category)" }
        if ($seenCategories.ContainsKey($category)) { continue }
        $seenCategories[$category] = $true
        $messages += Redact-SensitiveText "${category}: $($finding.message)"
    }

    return $messages
}

function Set-TextFileWithRetry {
    param(
        [string]$Path,
        [string]$Value,
        [int]$Retries = 3
    )

    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        try {
            $Value | Set-Content -Path $Path -Encoding UTF8
            return
        }
        catch {
            if ($attempt -eq $Retries) { throw }
            Start-Sleep -Milliseconds (150 * $attempt)
        }
    }
}

if (!(Test-Path $ReportsDir)) {
    New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null
}
if (!(Test-Path $HistoryDir)) {
    New-Item -ItemType Directory -Path $HistoryDir -Force | Out-Null
}

$audit = Read-JsonFile -Path (Join-Path $ReportsDir "audit.json") -Fallback @{}
$verification = Read-JsonFile -Path (Join-Path $ReportsDir "verification.json") -Fallback @{}
$performance = Read-JsonFile -Path (Join-Path $ReportsDir "performance.json") -Fallback @{}
$architecture = Read-JsonFile -Path (Join-Path $ReportsDir "architecture.json") -Fallback @{}
$safeFixes = Read-JsonFile -Path (Join-Path $ReportsDir "safe-fixes.json") -Fallback @()
$dangerous = Read-JsonFile -Path (Join-Path $ReportsDir "dangerous-changes.json") -Fallback @()

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
$commitHash = ((git rev-parse --short HEAD) 2>$null)
if ([string]::IsNullOrWhiteSpace($commitHash)) { $commitHash = "unknown" }

$projectName = $env:AI_PIPELINE_PROJECT_NAME
if ([string]::IsNullOrWhiteSpace($projectName)) { $projectName = "UnknownProject" }

$changedFiles = @()
if ($audit.changedFiles) { $changedFiles = @($audit.changedFiles) }

$severityCounts = @{
    critical = 0
    high = 0
    medium = 0
    low = 0
}

$allFindings = @()
if ($audit.findings) { $allFindings += @($audit.findings) }
if ($architecture.findings) { $allFindings += @($architecture.findings) }
if ($performance.findings) { $allFindings += @($performance.findings) }
if ($dangerous.findings) { $allFindings += @($dangerous.findings) }

foreach ($f in $allFindings) {
    $sev = "$($f.severity)".ToLowerInvariant()
    if ($severityCounts.ContainsKey($sev)) { $severityCounts[$sev] += 1 }
}

$highestRisk = "LOW"
if ($severityCounts.critical -gt 0) { $highestRisk = "CRITICAL" }
elseif ($severityCounts.high -gt 0) { $highestRisk = "HIGH" }
elseif ($severityCounts.medium -gt 0) { $highestRisk = "MEDIUM" }

$verificationPassed = $verification.status -eq "passed" -or ([string]::IsNullOrWhiteSpace($verification.status) -and $Status -eq "PASSED")

$confidence = 0.78
if ($verificationPassed) { $confidence = 0.9 }
if ($Status -eq "FAILED" -or $Status -eq "BLOCKED") { $confidence = 0.55 }
if ($severityCounts.critical -gt 0) { $confidence = [Math]::Min($confidence, 0.6) }

$riskCategories = @()
if ($severityCounts.critical -gt 0 -or $severityCounts.high -gt 0) { $riskCategories += "delivery-risk" }
if (Count-Items $dangerous.findings -gt 0) { $riskCategories += "change-control-risk" }
if (Count-Items $performance.findings -gt 0) { $riskCategories += "performance-risk" }
if (Count-Items $architecture.findings -gt 0) { $riskCategories += "architecture-drift-risk" }
if ($riskCategories.Count -eq 0) { $riskCategories += "low-operational-risk" }

$trendFile = Join-Path $HistoryDir "report-index.jsonl"
$trend = "stable"
$previousReports = @()
if (Test-Path $trendFile) {
    $previousReports = @(
        Get-Content -Path $trendFile |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Last 5 |
            ForEach-Object { $_ | ConvertFrom-Json }
    )
    $previous = $previousReports | Select-Object -Last 1
    if ($previous) {
        if ($previous.highestRisk -eq "LOW" -and $highestRisk -in @("MEDIUM", "HIGH", "CRITICAL")) { $trend = "worsening" }
        elseif ($previous.highestRisk -in @("HIGH", "CRITICAL") -and $highestRisk -in @("LOW", "MEDIUM")) { $trend = "improving" }
    }
}

$severityWeights = @{
    critical = 30
    high = 18
    medium = 8
    low = 3
}
$currentDebtPenalty =
    ($severityCounts.critical * $severityWeights.critical) +
    ($severityCounts.high * $severityWeights.high) +
    ($severityCounts.medium * $severityWeights.medium) +
    ($severityCounts.low * $severityWeights.low)
$previousDebtPenalty = 0
if ($previousReports.Count -gt 0) {
    $lastSeverity = ($previousReports | Select-Object -Last 1).severity
    if ($lastSeverity) {
        $previousDebtPenalty =
            ([int]$lastSeverity.critical * $severityWeights.critical) +
            ([int]$lastSeverity.high * $severityWeights.high) +
            ([int]$lastSeverity.medium * $severityWeights.medium) +
            ([int]$lastSeverity.low * $severityWeights.low)
    }
}
$resolvedIssueDecay = [Math]::Max(0, $previousDebtPenalty - $currentDebtPenalty)
$recoveryMomentumBonus = if ($trend -eq "improving") { 8 } elseif ($trend -eq "worsening") { -8 } else { 0 }
$stabilizationBonus = if ($verificationPassed -and (Count-Items $dangerous.findings) -eq 0 -and $highestRisk -in @("LOW", "MEDIUM")) { 7 } else { 0 }
$technicalDebtAgingPenalty = [Math]::Min(12, [Math]::Max(0, $currentDebtPenalty - $resolvedIssueDecay) / 10)
$ctoHealthScore = [Math]::Round(
    [Math]::Max(
        0,
        [Math]::Min(
            100,
            74 - ($currentDebtPenalty / 3) - $technicalDebtAgingPenalty + $stabilizationBonus + $recoveryMomentumBonus + [Math]::Min(10, $resolvedIssueDecay / 4)
        )
    )
)

$safeFixCount = Count-Items $safeFixes
$dangerCount = Count-Items $dangerous.findings
$failingTasks = @()
if ($verification.failingTasks) { $failingTasks = @($verification.failingTasks) }
$changedFilePreview = @($changedFiles | Select-Object -First 10)

$recommendations = @()
if ($dangerCount -gt 0) { $recommendations += "Require human approval for dangerous-change set before merge." }
if ($severityCounts.high -gt 0 -or $severityCounts.critical -gt 0) { $recommendations += "Prioritize high/critical findings in the next commit cycle." }
if ($verification.status -ne "passed") { $recommendations += "Stabilize build/test pipeline before accepting new refactors." }
if (Count-Items $performance.findings -gt 0) { $recommendations += "Address top performance warning on input latency path." }
if ($recommendations.Count -eq 0) {
    $recommendations += "Continue current cadence and monitor drift/performance trends over the next 5 runs."
}

$improvements = @()
if ($dangerCount -gt 0) { $improvements += "Review telemetry, lifecycle, and threading changes before push." }
if ($verification.status -eq "passed") { $improvements += "Keep Gradle verification green while narrowing the risky diff." } else { $improvements += "Restore compile/test confidence before feature work." }
if (Count-Items $performance.findings -gt 0) { $improvements += "Add latency baseline thresholds to future reports." }
if ($improvements.Count -lt 3) { $improvements += "Add trend history for prediction quality and acceptance rate." }
if ($improvements.Count -lt 3) { $improvements += "Keep founder email compact; use artifacts only for drill-down." }

$topRisks = @(Select-TopMessages -Findings $allFindings -Limit 3)
if ($topRisks.Count -eq 0) { $topRisks = @("No high-signal risks detected in this run.") }

$buildResult = if ($verification.status -eq "passed") { "passed" } elseif ([string]::IsNullOrWhiteSpace($verification.status)) { "unknown" } else { "$($verification.status)" }
$dangerStatus = if ($dangerCount -gt 0) { "requires human approval ($dangerCount)" } else { "clear" }
$decision = if ($Status -eq "BLOCKED" -or $dangerCount -gt 0) {
    "REVIEW telemetry changes"
}
elseif ($verification.status -ne "passed") {
    "INVESTIGATE build failure"
}
else {
    "APPROVE push"
}
$oneThing = if ($dangerCount -gt 0) {
    "The approval gate is protecting telemetry and input-path changes; review those before shipping."
}
elseif ($verification.status -eq "passed") {
    "The engineering loop is green; keep momentum on prediction quality."
}
else {
    "Restore build confidence before adding more product surface."
}

$report = [ordered]@{
    schemaVersion = "1.0"
    generatedAt = $timestamp
    project = $projectName
    commit = $commitHash
    status = $Status
    executiveSummary = @{
        overallRisk = $highestRisk
        confidence = [Math]::Round($confidence, 2)
        trend = $trend
        ctoHealthScore = $ctoHealthScore
        resolvedIssueDecay = $resolvedIssueDecay
        recoveryMomentumBonus = $recoveryMomentumBonus
        stabilizationBonus = $stabilizationBonus
        changedFiles = $changedFiles.Count
        concise = "Pipeline $Status with risk $highestRisk and confidence $([Math]::Round($confidence,2))."
    }
    severity = $severityCounts
    riskCategories = $riskCategories
    technicalAudit = @{
        findingsCount = $allFindings.Count
        topFindings = @($allFindings | Select-Object -First 5)
    }
    regressionRisks = @($audit.regressionRisks)
    performanceWarnings = @($performance.findings)
    architectureDrift = @($architecture.findings)
    safeFixesApplied = @($safeFixes)
    dangerousChangesDetected = @($dangerous.findings)
    buildTestResults = $verification
    recommendedNextPriorities = $recommendations
}

$jsonPath = Join-Path $ReportsDir "founder-report.json"
$mdPath = Join-Path $ReportsDir "founder-report.md"
$summaryPath = Join-Path $ReportsDir "summary.md"
$discordPath = Join-Path $ReportsDir "summary.discord.txt"
$telegramPath = Join-Path $ReportsDir "summary.telegram.txt"

Set-TextFileWithRetry -Path $jsonPath -Value ($report | ConvertTo-Json -Depth 12)

$md = @"
# Founder AI Audit Report

## 1. Executive Summary
- Project: $projectName
- Commit: $commitHash
- Status: $Status
- Overall Risk: $highestRisk
- Confidence: $([Math]::Round($confidence, 2))
- Trend: $trend
- CTO Health Score: $ctoHealthScore/100
- Recovery Momentum Bonus: $recoveryMomentumBonus
- Stabilization Bonus: $stabilizationBonus
- Resolved Issue Decay: $resolvedIssueDecay
- Generated: $timestamp

## 2. Technical Audit
- Findings Count: $($allFindings.Count)
- Severity: critical=$($severityCounts.critical), high=$($severityCounts.high), medium=$($severityCounts.medium), low=$($severityCounts.low)

## 3. Regression Risks
$((@($audit.regressionRisks) | ForEach-Object { "- " + (Redact-SensitiveText "$_") }) -join "`n")

## 4. Performance Warnings
$((@($performance.findings) | ForEach-Object { "- " + (Redact-SensitiveText "$($_.message)") }) -join "`n")

## 5. Architecture Drift
$((@($architecture.findings) | ForEach-Object { "- " + (Redact-SensitiveText "$($_.message)") }) -join "`n")

## 6. Safe Fixes Applied
- Count: $safeFixCount
$((@($safeFixes) | ForEach-Object { "- " + (Redact-SensitiveText "$_") }) -join "`n")

## 7. Dangerous Changes Detected
- Count: $dangerCount
$((@($dangerous.findings) | ForEach-Object { "- " + (Redact-SensitiveText "$($_.message)") }) -join "`n")

## 8. Build/Test Results
- Verification Status: $($verification.status)
- Failing Tasks: $($failingTasks.Count)
$((@($verification.tasks) | ForEach-Object { "- $($_.name): $($_.status)" }) -join "`n")

## 9. Recommended Next Priorities
$((@($recommendations) | ForEach-Object { "- " + (Redact-SensitiveText "$_") }) -join "`n")
"@

if ([string]::IsNullOrWhiteSpace($md)) { $md = "# Founder AI Audit Report`nNo report content generated." }
$md = Redact-SensitiveText $md
Set-TextFileWithRetry -Path $mdPath -Value $md

$summary = @"
MyKeyboard Founder Brief

Status: $(Get-StatusIcon $Status)
Build verification: $buildResult
Dangerous changes: $dangerStatus
Trend: $(Get-TrendLabel $trend)
Readiness: $([Math]::Round($confidence * 100))%
CTO health: ${ctoHealthScore}/100

Top 3 risks:
1. $($topRisks[0])
2. $(if ($topRisks.Count -gt 1) { $topRisks[1] } else { "No additional risk." })
3. $(if ($topRisks.Count -gt 2) { $topRisks[2] } else { "No additional risk." })

Top 3 improvements:
1. $($improvements[0])
2. $($improvements[1])
3. $($improvements[2])

Key product metrics:
- Runtime metrics tracked: latency, suggestion acceptance, prediction hit rate.
- Current baseline: pending first reviewed telemetry run.
- Verification health: $($verification.tasks.Count) tasks checked, $($failingTasks.Count) failing.

Founder Decision: $decision

One Thing That Matters Most Today:
$oneThing
"@
$summary = Redact-SensitiveText $summary
Set-TextFileWithRetry -Path $summaryPath -Value $summary

$discordSummary = "[${projectName}] ${Status} | ${commitHash} | Risk=${highestRisk} | Confidence=$([Math]::Round($confidence,2)) | SafeFixes=${safeFixCount} | Dangerous=${dangerCount}"
$telegramSummary = "${projectName} ${Status}`nCommit: ${commitHash}`nRisk: ${highestRisk}`nConfidence: $([Math]::Round($confidence,2))`nTop Priority: $($recommendations[0])"

if ($env:AI_PIPELINE_ENABLE_DISCORD_SUMMARY -eq "true") {
    Set-TextFileWithRetry -Path $discordPath -Value (Redact-SensitiveText $discordSummary)
}
if ($env:AI_PIPELINE_ENABLE_TELEGRAM_SUMMARY -eq "true") {
    Set-TextFileWithRetry -Path $telegramPath -Value (Redact-SensitiveText $telegramSummary)
}

$indexObj = @{
    generatedAt = $timestamp
    commit = $commitHash
    status = $Status
    highestRisk = $highestRisk
    confidence = [Math]::Round($confidence, 2)
    severity = $severityCounts
}
($indexObj | ConvertTo-Json -Compress) | Add-Content -Path $trendFile -Encoding UTF8

Write-Host "Generated: $mdPath"
Write-Host "Generated: $jsonPath"
Write-Host "Generated: $summaryPath"
