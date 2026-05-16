param(
    [string]$ReportsDir = ".ai-pipeline/reports/latest",
    [ValidateSet("PASSED", "FAILED", "DEGRADED", "BLOCKED", "SMTP-TEST")]
    [string]$Status = "PASSED"
)

$ErrorActionPreference = "Stop"
$script:EmailStages = @()
$script:FailureStage = $null

function Set-EmailStage {
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
    $script:EmailStages += [pscustomobject]$record
    if ($Status -eq "FAILED" -and [string]::IsNullOrWhiteSpace($script:FailureStage)) {
        $script:FailureStage = $Stage
    }
    Write-EmailEvent $Stage $Status @{ reason = $record.reason }
}

function Get-EnvOrThrow {
    param([string]$Name, [string[]]$Aliases = @())
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        foreach ($alias in $Aliases) {
            $value = [Environment]::GetEnvironmentVariable($alias)
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                break
            }
        }
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required env var: $Name"
    }
    return $value
}

function Normalize-EmailAddress {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Value }
    $trimmed = $Value.Trim()
    if ($trimmed -match "mailto:([^\)\]]+)") {
        return $Matches[1]
    }
    return $trimmed.Trim("[", "]")
}

function Should-SendNow {
    param([string]$StatePath, [int]$MinIntervalSeconds)
    if (!(Test-Path $StatePath)) { return $true }
    try {
        $last = (Get-Content -Raw -Path $StatePath | ConvertFrom-Json)
        if ($null -eq $last.sentAt) { return $true }
        $prev = [DateTimeOffset]::Parse($last.sentAt)
        $diff = (New-TimeSpan -Start $prev -End (Get-Date)).TotalSeconds
        return ($diff -ge $MinIntervalSeconds)
    }
    catch {
        return $true
    }
}

function Redact-SensitiveText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }
    $patterns = @(
        "(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+",
        "(?i)(authorization\s*:\s*bearer\s+)[a-z0-9\-\._]+",
        "(?i)(apikey\s*[:=]\s*)[^\s,;]+"
    )
    $out = $Text
    foreach ($pattern in $patterns) {
        $out = [System.Text.RegularExpressions.Regex]::Replace($out, $pattern, '$1[REDACTED]')
    }
    return $out
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

function Write-EmailEvent {
    param(
        [string]$Stage,
        [string]$Message,
        [hashtable]$Data = @{}
    )

    $logsDir = Join-Path $ReportsDir "logs"
    if (!(Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
    $event = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        stage = $Stage
        message = $Message
        data = $Data
    }
    ($event | ConvertTo-Json -Compress -Depth 8) | Add-Content -Path (Join-Path $logsDir "pipeline-events.jsonl") -Encoding UTF8
    Write-Host "[$($event.timestamp)] $Stage - $Message"
}

function Write-EmailDeliveryAudit {
    param(
        [string]$EmailStatus,
        [bool]$Attempted,
        [string]$FailureClassification = $null,
        [string]$Message = $null,
        [string]$Subject = $null,
        [int]$AttachmentCount = 0,
        [bool]$FallbackUsed = $false
    )

    $audit = [ordered]@{
        generatedAt = (Get-Date).ToString("o")
        workflowTriggered = $true
        workflowExecuted = $true
        emailStageEntered = $Attempted
        smtpAuthPassed = if ($EmailStatus -eq "PASSED") { $true } else { $false }
        gmailAccepted = if ($EmailStatus -eq "PASSED") { $true } else { $false }
        failureStage = $script:FailureStage
        stages = @($script:EmailStages)
        attachmentsGenerated = [ordered]@{
            summary = Test-Path (Join-Path $ReportsDir "summary.md")
            founderReport = Test-Path (Join-Path $ReportsDir "founder-report.md")
            pipelineSummary = Test-Path (Join-Path $ReportsDir "pipeline-summary.json")
        }
        emailSkippedReason = if ($EmailStatus -eq "SKIPPED") { $Message } else { $null }
        finalDeliveryState = $EmailStatus
        emailStatus = $EmailStatus
        emailAttempted = $Attempted
        failureClassification = $FailureClassification
        message = if ([string]::IsNullOrWhiteSpace($Message)) { $null } else { Redact-SensitiveText $Message }
        subject = $Subject
        fallbackUsed = $FallbackUsed
        smtpAcceptedMeansProviderAcceptedSubmission = ($EmailStatus -eq "PASSED")
        smtpConfiguration = [ordered]@{
            host = $smtpHost
            port = $smtpPort
            tlsEnabled = $enableSsl
            provider = $smtpProvider
            senderRecipientSeparated = ($smtpFrom -ne $recipient)
            usernameConfigured = -not [string]::IsNullOrWhiteSpace($smtpUser)
            passwordConfigured = -not [string]::IsNullOrWhiteSpace($smtpPass)
            senderConfigured = -not [string]::IsNullOrWhiteSpace($smtpFrom)
            recipientConfigured = -not [string]::IsNullOrWhiteSpace($recipient)
        }
        artifacts = [ordered]@{
            summaryExists = Test-Path (Join-Path $ReportsDir "summary.md")
            founderReportExists = Test-Path (Join-Path $ReportsDir "founder-report.md")
            pipelineSummaryExists = Test-Path (Join-Path $ReportsDir "pipeline-summary.json")
            attachmentCount = $AttachmentCount
        }
        inboxPlacementAssessment = [ordered]@{
            inboxGuaranteed = $false
            inboxRisk = "low when Gmail SMTP accepts mail from a dedicated sender to a separate founder inbox"
            spamRisk = "low-to-medium; check Spam if SMTP passes but Inbox is empty"
            promotionsRisk = "low-to-medium; compact plain-text summaries reduce Promotions risk"
        }
    }
    ($audit | ConvertTo-Json -Depth 12) | Set-Content -Path (Join-Path $ReportsDir "email-delivery-audit.json") -Encoding UTF8

    $heartbeatPath = Join-Path $ReportsDir "last-successful-email.json"
    if ($EmailStatus -ne "PASSED" -and !(Test-Path $heartbeatPath)) {
        @{
            generatedAt = (Get-Date).ToString("o")
            status = "NO_SUCCESS_RECORDED"
            lastSuccessfulEmailAt = $null
            note = "No successful SMTP delivery has been recorded in this reports directory yet."
        } | ConvertTo-Json | Set-Content -Path $heartbeatPath -Encoding UTF8
    }
}

function Invoke-SmtpSendWithRetry {
    param(
        [System.Net.Mail.SmtpClient]$Client,
        [System.Net.Mail.MailMessage]$MailMessage,
        [int]$Attempts,
        [int]$BackoffSeconds
    )

    $attempt = 1
    while ($attempt -le $Attempts) {
        try {
            $Client.Send($MailMessage)
            return
        }
        catch {
            if ($attempt -ge $Attempts) { throw }
            Start-Sleep -Seconds ($BackoffSeconds * $attempt)
            $attempt++
        }
    }
}

$projectName = if ($env:AI_PIPELINE_PROJECT_NAME) { $env:AI_PIPELINE_PROJECT_NAME } else { "UnknownProject" }
$recipient = Normalize-EmailAddress (Get-EnvOrThrow "AI_PIPELINE_REPORT_RECIPIENT" @("SMTP_REPORT_RECIPIENT", "SMTP_RECIPIENT"))
$smtpHost = Get-EnvOrThrow "AI_PIPELINE_SMTP_HOST" @("SMTP_HOST")
$smtpPort = [int](Get-EnvOrThrow "AI_PIPELINE_SMTP_PORT" @("SMTP_PORT"))
$smtpUser = Normalize-EmailAddress (Get-EnvOrThrow "AI_PIPELINE_SMTP_USERNAME" @("SMTP_USERNAME"))
$smtpPass = Get-EnvOrThrow "AI_PIPELINE_SMTP_PASSWORD" @("SMTP_APP_PASSWORD", "SMTP_PASSWORD")
$smtpFrom = Normalize-EmailAddress (Get-EnvOrThrow "AI_PIPELINE_SMTP_FROM" @("SMTP_SENDER_EMAIL", "SMTP_SENDER", "SMTP_FROM"))
$sendOnStatus = if ($env:AI_PIPELINE_SEND_ON_STATUS) { $env:AI_PIPELINE_SEND_ON_STATUS } else { "PASSED" }
$smtpProvider = if ($env:SMTP_PROVIDER) { $env:SMTP_PROVIDER } else { "" }
$defaultEnableSsl = ($smtpProvider -eq "GMAIL" -or $smtpHost -eq "smtp.gmail.com" -or $smtpPort -eq 587)
$enableSsl = if ($env:AI_PIPELINE_SMTP_ENABLE_SSL) { [bool]::Parse($env:AI_PIPELINE_SMTP_ENABLE_SSL) } elseif ($env:SMTP_ENABLE_SSL) { [bool]::Parse($env:SMTP_ENABLE_SSL) } else { $defaultEnableSsl }
$maxRetries = if ($env:AI_PIPELINE_EMAIL_MAX_RETRIES) { [int]$env:AI_PIPELINE_EMAIL_MAX_RETRIES } else { 3 }
$backoff = if ($env:AI_PIPELINE_EMAIL_RETRY_BACKOFF_SECONDS) { [int]$env:AI_PIPELINE_EMAIL_RETRY_BACKOFF_SECONDS } else { 5 }
$minInterval = if ($env:AI_PIPELINE_EMAIL_MIN_INTERVAL_SECONDS) { [int]$env:AI_PIPELINE_EMAIL_MIN_INTERVAL_SECONDS } else { 30 }
$timeoutMs = if ($env:AI_PIPELINE_EMAIL_TIMEOUT_MS) { [int]$env:AI_PIPELINE_EMAIL_TIMEOUT_MS } else { 30000 }
$attachMode = if ($env:AI_PIPELINE_EMAIL_ATTACHMENTS) { $env:AI_PIPELINE_EMAIL_ATTACHMENTS.ToLowerInvariant() } else { "risk-only" }

if ($smtpPort -lt 1 -or $smtpPort -gt 65535) { throw "AI_PIPELINE_SMTP_PORT must be between 1 and 65535." }
if ($maxRetries -lt 1) { throw "AI_PIPELINE_EMAIL_MAX_RETRIES must be at least 1." }
if ($backoff -lt 0) { throw "AI_PIPELINE_EMAIL_RETRY_BACKOFF_SECONDS must be zero or greater." }
if ($minInterval -lt 0) { throw "AI_PIPELINE_EMAIL_MIN_INTERVAL_SECONDS must be zero or greater." }
if ($timeoutMs -lt 1000) { throw "AI_PIPELINE_EMAIL_TIMEOUT_MS must be at least 1000." }
if ($attachMode -notin @("none", "risk-only", "all")) { throw "AI_PIPELINE_EMAIL_ATTACHMENTS must be one of: none, risk-only, all." }
Set-EmailStage "WORKFLOW_TRIGGERED" "PASSED"
Set-EmailStage "JOB_STARTED" "PASSED"
Set-EmailStage "PIPELINE_STARTED" "PASSED"

if ($smtpFrom -eq $recipient) {
    Set-EmailStage "SMTP_AUTH_STARTED" "FAILED" "SMTP sender and recipient are identical."
    Write-EmailDeliveryAudit -EmailStatus "FAILED" -Attempted $false -FailureClassification "GMAIL_REJECTED" -Message "SMTP sender and recipient must be different for reliable Gmail delivery."
    throw "SMTP sender and recipient must be different for reliable Gmail delivery."
}

if ($sendOnStatus -ne "ALL" -and $sendOnStatus -ne $Status) {
    Set-EmailStage "EMAIL_SENT" "SKIPPED" "Status '$Status' does not match AI_PIPELINE_SEND_ON_STATUS '$sendOnStatus'."
    Write-EmailDeliveryAudit -EmailStatus "SKIPPED" -Attempted $false -Message "Email skipped because status does not match send policy."
    throw "Email skipped because status '$Status' does not match AI_PIPELINE_SEND_ON_STATUS '$sendOnStatus'."
}

$summaryPath = Join-Path $ReportsDir "summary.md"
$founderPath = Join-Path $ReportsDir "founder-report.md"
$pipelineSummaryPath = Join-Path $ReportsDir "pipeline-summary.json"
if (!(Test-Path $summaryPath)) {
    Set-EmailStage "REPORT_GENERATED" "FAILED" "Missing summary file: $summaryPath"
    Write-EmailDeliveryAudit -EmailStatus "FAILED" -Attempted $false -FailureClassification "REPORT_GENERATION_FAILED" -Message "Missing summary file."
    throw "Missing summary file: $summaryPath"
}
Set-EmailStage "REPORT_GENERATED" "PASSED"

$commitHash = ((git rev-parse --short HEAD) 2>$null)
if ([string]::IsNullOrWhiteSpace($commitHash)) { $commitHash = "unknown" }
$stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ssK")
$subject = "[${projectName}][${Status}][${commitHash}] AI Audit Report - ${stamp}"

$rateStateDir = ".ai-pipeline/state"
if (!(Test-Path $rateStateDir)) { New-Item -ItemType Directory -Path $rateStateDir -Force | Out-Null }
$rateStatePath = Join-Path $rateStateDir "email-rate-state.json"
if (!(Should-SendNow -StatePath $rateStatePath -MinIntervalSeconds $minInterval)) {
    Set-EmailStage "EMAIL_SENT" "SKIPPED" "Duplicate-send protection blocked send inside $minInterval second window."
    Write-EmailDeliveryAudit -EmailStatus "SKIPPED" -Attempted $false -FailureClassification "RATE_LIMITED" -Message "Email skipped because the rate-limit window is active."
    throw "Email skipped because the rate-limit window is active."
}

$mailBody = Get-Content -Raw -Path $summaryPath

$message = New-Object System.Net.Mail.MailMessage
$message.From = $smtpFrom
$message.To.Add($recipient)
$message.Subject = $subject
$message.Body = $mailBody
$message.IsBodyHtml = $false

$shouldAttachFounderReport = (
    $attachMode -eq "all" -or
    ($attachMode -eq "risk-only" -and $Status -in @("BLOCKED", "FAILED"))
)

if ($shouldAttachFounderReport -and (Test-Path $founderPath)) {
    $founderAttachment = New-Object System.Net.Mail.Attachment($founderPath)
    $message.Attachments.Add($founderAttachment)
}

$client = New-Object Net.Mail.SmtpClient($smtpHost, $smtpPort)
$client.EnableSsl = $enableSsl
$client.Credentials = New-Object System.Net.NetworkCredential($smtpUser, $smtpPass)
$client.Timeout = $timeoutMs

Set-EmailStage "SMTP_AUTH_STARTED" "STARTED" "TLS=$enableSsl timeoutMs=$timeoutMs"
Set-EmailStage "SMTP_SUBMISSION_STARTED" "STARTED" "host=$smtpHost port=$smtpPort attachments=$($message.Attachments.Count)"
Write-EmailEvent "SMTP_SUBMISSION_STARTED" "SMTP send started." @{
    host = $smtpHost
    port = $smtpPort
    tlsEnabled = $enableSsl
    timeoutMs = $timeoutMs
    maxRetries = $maxRetries
    retryBackoffSeconds = $backoff
    senderRecipientSeparated = ($smtpFrom -ne $recipient)
    attachmentCount = $message.Attachments.Count
}

$fallbackUsed = $false
try {
    Invoke-SmtpSendWithRetry -Client $client -MailMessage $message -Attempts $maxRetries -BackoffSeconds $backoff
}
catch {
    $primaryError = $_.Exception.Message
    Set-EmailStage "SMTP_SUBMISSION_STARTED" "FAILED" $primaryError

    $message.Dispose()
    $fallbackUsed = $true
    Start-Sleep -Seconds ([Math]::Max(1, $backoff))

    $message = New-Object System.Net.Mail.MailMessage
    $message.From = $smtpFrom
    $message.To.Add($recipient)
    $message.Subject = $subject
    $message.Body = "MyKeyboard AI Audit Report`r`nStatus: $Status`r`nCommit: $commitHash`r`nGenerated: $stamp`r`nPrimary rich summary failed; this minimal fallback confirms the reporting path is alive. Full artifacts remain in GitHub Actions and .ai-pipeline/reports/latest."
    $message.IsBodyHtml = $false

    try {
        Set-EmailStage "SMTP_SUBMISSION_STARTED" "STARTED" "Plain-text fallback retry started."
        Invoke-SmtpSendWithRetry -Client $client -MailMessage $message -Attempts 1 -BackoffSeconds 0
    }
    catch {
        $fallbackError = $_.Exception.Message
        $classification = Get-EmailFailureClassification -Message $fallbackError
        Set-EmailStage "SMTP_SUBMISSION_STARTED" "FAILED" $fallbackError
        Write-EmailDeliveryAudit -EmailStatus "FAILED" -Attempted $true -FailureClassification $classification -Message $fallbackError -Subject $subject -AttachmentCount 0 -FallbackUsed $fallbackUsed
        throw
    }
}

Set-EmailStage "SMTP_AUTH_SUCCESS" "PASSED"
Set-EmailStage "SMTP_SUBMISSION_SUCCESS" "PASSED"
Set-EmailStage "GMAIL_ACCEPTED" "PASSED" "Gmail SMTP accepted the message submission. Inbox placement is not guaranteed by SMTP."
Set-EmailStage "EMAIL_SENT" "PASSED"
Set-EmailStage "PIPELINE_FINISHED" "PASSED"
Write-EmailEvent "GMAIL_ACCEPTED" "SMTP provider accepted the message submission." @{
    fallbackUsed = $fallbackUsed
    attachmentCount = $message.Attachments.Count
}
Write-EmailDeliveryAudit -EmailStatus "PASSED" -Attempted $true -Message "SMTP provider accepted message submission." -Subject $subject -AttachmentCount $message.Attachments.Count -FallbackUsed $fallbackUsed

@{
    sentAt = (Get-Date).ToString("o")
    recipient = $recipient
    subject = $subject
    attachmentMode = $attachMode
    attachmentCount = $message.Attachments.Count
} | ConvertTo-Json | Set-Content -Path $rateStatePath -Encoding UTF8

@{
    sentAt = (Get-Date).ToString("o")
    recipient = $recipient
    subject = $subject
    status = "PASSED"
    fallbackUsed = $fallbackUsed
    smtpAccepted = $true
    attachmentCount = $message.Attachments.Count
} | ConvertTo-Json | Set-Content -Path (Join-Path $ReportsDir "last-successful-email.json") -Encoding UTF8

$message.Dispose()
$client.Dispose()
