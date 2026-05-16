param(
    [ValidateSet("PASSED", "FAILED", "DEGRADED", "BLOCKED")]
    [string]$Status = "PASSED",
    [switch]$SendEmail = $true
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$reportsDir = ".ai-pipeline/reports/latest"
$statusPath = ".ai-pipeline/reports/latest/reporting-status.json"

if (!(Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

try {
    & (Join-Path $scriptDir "generate-founder-report.ps1") -Status $Status -ReportsDir $reportsDir
    $reportGenerated = $true
}
catch {
    $reportGenerated = $false
    $errorMessage = $_.Exception.Message
}

$emailSent = $false
$emailError = $null
if ($reportGenerated -and $SendEmail.IsPresent) {
    try {
        & (Join-Path $scriptDir "send-email-summary.ps1") -ReportsDir $reportsDir -Status $Status
        $emailSent = $true
    }
    catch {
        $emailError = $_.Exception.Message
    }
}

$result = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    status = $Status
    reportGenerated = $reportGenerated
    emailAttempted = $SendEmail.IsPresent
    emailSent = $emailSent
    error = $errorMessage
    emailError = $emailError
}

($result | ConvertTo-Json -Depth 5) | Set-Content -Path $statusPath -Encoding UTF8

if (-not $reportGenerated) {
    Write-Error "Reporting stage failed: $errorMessage"
    exit 3
}

if ($SendEmail.IsPresent -and -not $emailSent -and $null -ne $emailError) {
    Write-Error "Email stage failed: $emailError"
    exit 4
}

Write-Host "Reporting stage completed."
exit 0
