<#
Run from any directory:
  pwsh -NoProfile -File scripts/verify-ephinta.ps1

Without an Android SDK, pass -SkipAndroid and treat Android as unverified.
Pass -InstallOnConnectedDevice only when you want the debug app installed on
the single authorized device connected through adb.
#>
param(
  [switch]$SkipAndroid,
  [switch]$SkipBrowser,
  [switch]$InstallOnConnectedDevice
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Stop-Verification([string]$Message) {
  throw "FAIL: $Message"
}

function Invoke-CheckedCommand([string]$Name, [string]$Command, [string[]]$Arguments) {
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Stop-Verification "$Name failed with exit code $exitCode."
  }
}

function Invoke-Npm([string]$Name, [string[]]$Arguments) {
  Invoke-CheckedCommand $Name "npm" $Arguments
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $repositoryRoot "eventsss123/eventsss-main"
$previousLocation = Get-Location
$originalEnvironment = @{
  DATABASE_URL = $env:DATABASE_URL
  DATABASE_MODE = $env:DATABASE_MODE
  NODE_ENV = $env:NODE_ENV
  JWT_SECRET = $env:JWT_SECRET
}

try {
  if ($SkipAndroid -and $InstallOnConnectedDevice) {
    Stop-Verification "-InstallOnConnectedDevice cannot be used with -SkipAndroid."
  }
  if (-not (Test-Path (Join-Path $appRoot "package.json"))) {
    Stop-Verification "The EPHINTA app workspace was not found at '$appRoot'."
  }
  if (-not (Test-Path (Join-Path $appRoot "package-lock.json"))) {
    Stop-Verification "The app workspace package-lock.json is missing."
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
      -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Stop-Verification "Node.js 20+ and npm are required."
  }

  $nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
  if ($LASTEXITCODE -ne 0 -or $nodeMajor -lt 20) {
    Stop-Verification "Node.js 20 or newer is required."
  }

  Push-Location $appRoot

  # API checks validate and generate Prisma without connecting to a database.
  # Give them an explicitly local test URL rather than inheriting a live URL.
  $env:DATABASE_URL = "postgresql://ess:ess@127.0.0.1:5432/ess?schema=public"
  $env:DATABASE_MODE = "local"
  $env:NODE_ENV = "test"
  $env:JWT_SECRET = "local-only-test-secret-change-this-1234567890"

  Invoke-Npm "Install locked dependencies" @("ci")
  Invoke-Npm "API, web unit, and KYC checks" @("run", "check")
  Invoke-Npm "Production web build" @("run", "build:web")
  Invoke-Npm "Production API build" @("run", "build", "-w", "apps/api")
  if ($SkipBrowser) {
    Write-Host "NOT VERIFIED: browser E2E was explicitly skipped; the Linux browser workflow owns database-backed journeys." -ForegroundColor Yellow
  } else {
    Invoke-Npm "Install Playwright Chromium" @("exec", "--workspace", "@ess/web", "--", "playwright", "install", "chromium")
    Invoke-Npm "Desktop and mobile browser journeys" @("run", "test:e2e", "-w", "apps/web")
  }
  Invoke-Npm "Strict design quality audit" @("run", "design:audit:strict", "-w", "apps/web")

  if ($SkipAndroid) {
    Write-Host "NOT VERIFIED: Android build checks were explicitly skipped." -ForegroundColor Yellow
  } else {
    $androidRoot = Join-Path $appRoot "apps/mobile/android"
    $gradleWrapper = Join-Path $androidRoot "gradlew.bat"
    if (-not (Test-Path $gradleWrapper)) {
      Stop-Verification "Android Gradle wrapper is missing at '$gradleWrapper'."
    }
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
      Stop-Verification "Java 21 is required for Android verification."
    }
    $javaVersionOutput = (& java -version 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or $javaVersionOutput -notmatch 'version "21(?:\.|")') {
      Stop-Verification "Android verification requires Java 21. Detected: $($javaVersionOutput.Trim())"
    }
    $localProperties = Join-Path $androidRoot "local.properties"
    $sdkPathConfigured = -not [string]::IsNullOrWhiteSpace($env:ANDROID_HOME) -or
      -not [string]::IsNullOrWhiteSpace($env:ANDROID_SDK_ROOT) -or
      ((Test-Path $localProperties -PathType Leaf) -and
        (Select-String -Path $localProperties -Pattern '^\s*sdk\.dir\s*=' -Quiet))
    if (-not $sdkPathConfigured) {
      Stop-Verification "Android SDK is missing. Set ANDROID_HOME or ANDROID_SDK_ROOT, configure sdk.dir in android/local.properties, or rerun with -SkipAndroid and treat Android as unverified."
    }

    Invoke-Npm "Sync web assets and Capacitor plugins" @("run", "sync", "-w", "@ess/mobile")
    Invoke-CheckedCommand "Android lint, unit tests, and debug APK build" $gradleWrapper @(
      "-p", $androidRoot, "lint", "testDebugUnitTest", "assembleDebug"
    )

    $apkPath = Join-Path $androidRoot "app/build/outputs/apk/debug/app-debug.apk"
    if (-not (Test-Path $apkPath) -or (Get-Item $apkPath).Length -eq 0) {
      Stop-Verification "Android debug APK was not produced at '$apkPath'."
    }
    Write-Host "PASS: Android debug APK created at $apkPath" -ForegroundColor Green

    if ($InstallOnConnectedDevice) {
      if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        Stop-Verification "-InstallOnConnectedDevice requires adb on PATH."
      }
      $deviceLines = @(& adb devices)
      if ($LASTEXITCODE -ne 0) {
        Stop-Verification "Could not query Android devices with adb."
      }
      $devices = @($deviceLines | Select-Object -Skip 1 | Where-Object { $_ -match "^\S+\s+device$" })
      if ($devices.Count -ne 1) {
        Stop-Verification "Expected exactly one authorized adb device; found $($devices.Count)."
      }
      Invoke-CheckedCommand "Install debug APK on connected Android device" "adb" @("install", "-r", $apkPath)
      Invoke-CheckedCommand "Launch EPHINTA on connected Android device" "adb" @(
        "shell", "am", "start", "-W", "-n", "com.ephinta.app/.MainActivity"
      )
    } else {
      Write-Host "NOT VERIFIED: no Android device install/launch test was requested." -ForegroundColor Yellow
    }
  }

  Write-Host "`nPASS: all requested local verification stages completed." -ForegroundColor Green
  Write-Host "This does not validate live payment/email/KYC providers, staging or production endpoints, production data, or release signing."
  Write-Host "No deploy, database migration, production-data operation, or signing-key creation was performed."
} finally {
  if ((Get-Location).Path -eq $appRoot) {
    Pop-Location
  }
  $env:DATABASE_URL = $originalEnvironment.DATABASE_URL
  $env:DATABASE_MODE = $originalEnvironment.DATABASE_MODE
  $env:NODE_ENV = $originalEnvironment.NODE_ENV
  $env:JWT_SECRET = $originalEnvironment.JWT_SECRET
  Set-Location $previousLocation
}
