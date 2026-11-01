# Compatibility wrapper: the maintained script lives in eventsss-main.
$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "eventsss-main\scripts\maintenance\repair-publiclanding.ps1"

if (-not (Test-Path $scriptPath)) {
    throw "Maintained repair script not found: $scriptPath"
}

& $scriptPath
