param(
    [switch]$SkipFirewall
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

if (-not (Test-Path (Join-Path $scriptDir 'node_modules'))) {
    Write-Host 'Installing server dependencies...'
    npm install --no-audit --no-fund
}

if (-not $SkipFirewall) {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        $ruleName = 'IndiEval API 5000'
        if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow | Out-Null
            Write-Host 'Firewall rule created for TCP 5000.'
        } else {
            Write-Host 'Firewall rule for TCP 5000 already exists.'
        }
    } else {
        Write-Host 'Firewall rule skipped because PowerShell is not running as Administrator.'
        Write-Host 'If remote access still fails, run this script as Administrator once.'
    }
}

Write-Host 'Starting backend on port 5000...'
npm start
