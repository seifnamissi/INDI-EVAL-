# Copies the SQLite database file to the backups folder with a timestamp.
# Usage: run this script periodically (Task Scheduler) or manually.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dbPath = Join-Path $scriptDir "database.sqlite"
$backupDir = Join-Path $scriptDir "backups"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dest = Join-Path $backupDir "database_$timestamp.sqlite"

try {
    Copy-Item -Path $dbPath -Destination $dest -ErrorAction Stop
    Write-Output "Backup created: $dest"
} catch {
    Write-Output "Failed to create backup: $_"
}
