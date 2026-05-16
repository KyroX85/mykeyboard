param(
    [string]$ReportsDir = ".ai-pipeline/reports/latest",
    [switch]$RunProgressive,
    [switch]$SkipMinimal
)

$ErrorActionPreference = "Stop"

function Get-EnvOrThrow {
    param([string]$Name, [string[]]$Aliases = @())
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        foreach ($alias in $Aliases) {
            $value = [Environment]::GetEnvironmentVariable($alias)
            if (-not [string]::IsNullOrWhiteSpace($value)) { break }
        }
    }
    if ([string]::IsNullOrWhiteSpace($value)) { throw "Missing required env var: $Name" }
    return $value
}

function Normalize-EmailAddress {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Value }
    $trimmed = $Value.Trim()
    if ($trimmed -match "mailto:([^\)\]]+)") { return $Matches[1] }
    return $trimmed.Trim("[", "]")
}

function New-MailAttachment {
    param([string]$Path)
    if (Test-Path $Path) { return New-Object System.Net.Mail.Attachment($Path) }
    return $null
}

function Send-DebugMessage {
    param(
        [string]$Stage,
        [string]$Subject,
        [string]$Body,
        [bool]$IsHtml,
        [string[]]$AttachmentPaths
    )

    $message = New-Object System.Net.Mail.MailMessage
    $message.From = $smtpFrom
    $message.To.Add($recipient)
    $message.Subject = $Subject
    $message.Body = $Body
    $message.IsBodyHtml = $IsHtml
    $message.Headers.Add("X-MyKeyboard-Debug-Stage", $Stage)
    $message.Headers.Add("X-MyKeyboard-Debug-Run", $debugRunId)

    $attachmentCount = 0
    foreach ($path in $AttachmentPaths) {
        $attachment = New-MailAttachment -Path $path
        if ($null -ne $attachment) {
            $message.Attachments.Add($attachment)
            $attachmentCount++
        }
    }

    $client = New-Object Net.Mail.SmtpClient($smtpHost, $smtpPort)
    $client.EnableSsl = $enableSsl
    $client.Credentials = New-Object System.Net.NetworkCredential($smtpUser, $smtpPass)
    $client.Timeout = $timeoutMs

    $started = Get-Date
    try {
        $client.Send($message)
        $finished = Get-Date
        [pscustomobject]@{
            stage = $Stage
            subject = $Subject
            smtpAccepted = $true
            bodyFormat = if ($IsHtml) { "html" } else { "plain-text" }
            attachmentCount = $attachmentCount
            durationSeconds = [Math]::Round(($finished - $started).TotalSeconds, 2)
            error = $null
        }
    }
    catch {
        $finished = Get-Date
        [pscustomobject]@{
            stage = $Stage
            subject = $Subject
            smtpAccepted = $false
            bodyFormat = if ($IsHtml) { "html" } else { "plain-text" }
            attachmentCount = $attachmentCount
            durationSeconds = [Math]::Round(($finished - $started).TotalSeconds, 2)
            error = $_.Exception.GetType().FullName
        }
    }
    finally {
        $message.Dispose()
        $client.Dispose()
    }
}

$projectName = if ($env:AI_PIPELINE_PROJECT_NAME) { $env:AI_PIPELINE_PROJECT_NAME } else { "MyKeyboard" }
$recipient = Normalize-EmailAddress (Get-EnvOrThrow "AI_PIPELINE_REPORT_RECIPIENT" @("SMTP_REPORT_RECIPIENT"))
$smtpHost = Get-EnvOrThrow "AI_PIPELINE_SMTP_HOST" @("SMTP_HOST")
$smtpPort = [int](Get-EnvOrThrow "AI_PIPELINE_SMTP_PORT" @("SMTP_PORT"))
$smtpUser = Normalize-EmailAddress (Get-EnvOrThrow "AI_PIPELINE_SMTP_USERNAME" @("SMTP_USERNAME"))
$smtpPass = Get-EnvOrThrow "AI_PIPELINE_SMTP_PASSWORD" @("SMTP_APP_PASSWORD", "SMTP_PASSWORD")
$smtpFrom = Normalize-EmailAddress (Get-EnvOrThrow "AI_PIPELINE_SMTP_FROM" @("SMTP_SENDER_EMAIL", "SMTP_FROM"))
$smtpProvider = if ($env:SMTP_PROVIDER) { $env:SMTP_PROVIDER } else { "" }
$enableSsl = if ($env:AI_PIPELINE_SMTP_ENABLE_SSL) { [bool]::Parse($env:AI_PIPELINE_SMTP_ENABLE_SSL) } elseif ($env:SMTP_ENABLE_SSL) { [bool]::Parse($env:SMTP_ENABLE_SSL) } else { ($smtpProvider -eq "GMAIL" -or $smtpHost -eq "smtp.gmail.com" -or $smtpPort -eq 587) }
$timeoutMs = if ($env:AI_PIPELINE_EMAIL_TIMEOUT_MS) { [int]$env:AI_PIPELINE_EMAIL_TIMEOUT_MS } else { 30000 }

if (!(Test-Path $ReportsDir)) { New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null }

$debugRunId = [guid]::NewGuid().ToString("N").Substring(0, 12)
$summaryPath = Join-Path $ReportsDir "summary.md"
$founderPath = Join-Path $ReportsDir "founder-report.md"
$pipelineSummaryPath = Join-Path $ReportsDir "pipeline-summary.json"

$results = @()
$minimalSubject = "MyKeyboard SMTP Delivery Test"
$plainBody = "MyKeyboard SMTP delivery test.`r`nDebug run: $debugRunId`r`nThis is plain text only and has no attachments."
$minimalAccepted = $true
if (-not $SkipMinimal.IsPresent) {
    $results += Send-DebugMessage -Stage "plain-text-no-attachments" -Subject $minimalSubject -Body $plainBody -IsHtml $false -AttachmentPaths @()
    $minimalAccepted = $results[0].smtpAccepted
}

if ($RunProgressive.IsPresent -and $minimalAccepted) {
    $results += Send-DebugMessage -Stage "html-no-attachments" -Subject "$minimalSubject HTML $debugRunId" -Body "<html><body><p>MyKeyboard SMTP delivery test.</p><p>Debug run: $debugRunId</p></body></html>" -IsHtml $true -AttachmentPaths @()
    $results += Send-DebugMessage -Stage "markdown-attachment" -Subject "$minimalSubject Markdown $debugRunId" -Body $plainBody -IsHtml $false -AttachmentPaths @($summaryPath)
    $results += Send-DebugMessage -Stage "multiple-attachments" -Subject "$minimalSubject Attachments $debugRunId" -Body $plainBody -IsHtml $false -AttachmentPaths @($summaryPath, $founderPath, $pipelineSummaryPath)
}

$output = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    debugRunId = $debugRunId
    projectName = $projectName
    smtpHost = $smtpHost
    smtpPort = $smtpPort
    enableSsl = $enableSsl
    senderDomain = (($smtpFrom -split "@") | Select-Object -Last 1)
    recipientDomain = (($recipient -split "@") | Select-Object -Last 1)
    senderEqualsRecipient = ($smtpFrom -ieq $recipient)
    note = "smtpAccepted means the SMTP server accepted the message submission; it does not prove inbox placement."
    results = $results
}

$debugPath = Join-Path $ReportsDir "email-delivery-debug.json"
($output | ConvertTo-Json -Depth 8) | Set-Content -Path $debugPath -Encoding UTF8

$output | ConvertTo-Json -Depth 8
