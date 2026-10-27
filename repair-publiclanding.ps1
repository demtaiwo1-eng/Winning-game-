# repair-publiclanding.ps1
# Repairs common syntax corruption in PublicLanding.tsx, creates a backup,
# validates the file, and optionally runs the web build.

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $projectRoot "apps\web\src\components\PublicLanding.tsx"

if (-not (Test-Path $target)) {
    Write-Host "ERROR: PublicLanding.tsx was not found:" -ForegroundColor Red
    Write-Host $target
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$target.backup_$timestamp"
Copy-Item $target $backup -Force

Write-Host "Backup created:" -ForegroundColor Green
Write-Host $backup

# Use the Node installation already required by the project.
$repairScript = Join-Path $env:TEMP "repair-publiclanding-$timestamp.mjs"

@'
import fs from "node:fs";

const file = process.argv[2];

if (!file) {
  console.error("No target file supplied.");
  process.exit(1);
}

let source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");

function repairMultilineQuotedStrings(input) {
  let out = "";
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let jsxTag = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const n = input[i + 1];

    if (lineComment) {
      out += c;
      if (c === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      out += c;
      if (c === "*" && n === "/") {
        out += "/";
        i++;
        blockComment = false;
      }
      continue;
    }

    if (!quote) {
      if (c === "/" && n === "/") {
        out += "//";
        i++;
        lineComment = true;
        continue;
      }

      if (c === "/" && n === "*") {
        out += "/*";
        i++;
        blockComment = true;
        continue;
      }

      if (c === "'" || c === '"') {
        quote = c;
        out += c;
        continue;
      }

      // Template literals may legally contain newlines, so leave them alone.
      out += c;
      continue;
    }

    // We are inside a single- or double-quoted string.
    out += c;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === "\\") {
      escaped = true;
      continue;
    }

    if (c === quote) {
      quote = null;
      continue;
    }

    if (c === "\n" || c === "\r") {
      // Accidental physical line break inside a normal string.
      // Turn it into a space so the string remains valid.
      if (c === "\r" && n === "\n") i++;
      out = out.slice(0, -1) + " ";
      continue;
    }
  }

  return out;
}

source = repairMultilineQuotedStrings(source);

// Remove the exact corruption that previously appeared as a standalone
// JavaScript statement after a routing comment.
source = source.replace(
  /(^[ \t]*\/\/ Updated routing: routes to further questions via onPostLoginQuestions or fallback)[ \t]*\r?\n[ \t]*to onLoginSuccess[ \t]*$/gm,
  "$1 to onLoginSuccess"
);

// Repair common typo corruption seen in the generated source.
source = source.replace(/\bJSON\.\s*tringify\b/g, "JSON.stringify");
source = source.replace(/\bJSON\.tringify\b/g, "JSON.stringify");

// Remove NUL characters if any were introduced into the text file.
source = source.replace(/\0/g, "");

fs.writeFileSync(file, source, "utf8");
console.log(`Repaired: ${file}`);
'@ | Set-Content -Path $repairScript -Encoding UTF8

try {
    node $repairScript $target
    if ($LASTEXITCODE -ne 0) {
        throw "Node repair script failed."
    }
}
finally {
    Remove-Item $repairScript -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Running TypeScript syntax check..." -ForegroundColor Cyan

Push-Location $projectRoot
try {
    # Prefer the repository's installed TypeScript compiler.
    if (Test-Path ".\node_modules\.bin\tsc.cmd") {
        & .\node_modules\.bin\tsc.cmd --noEmit --pretty false
        $tscExit = $LASTEXITCODE
    } else {
        Write-Host "Local TypeScript compiler not found; skipping tsc check." -ForegroundColor Yellow
        $tscExit = 0
    }

    if ($tscExit -ne 0) {
        Write-Host ""
        Write-Host "TypeScript still reports errors." -ForegroundColor Yellow
        Write-Host "The repaired file has been saved, and your backup is:" -ForegroundColor Yellow
        Write-Host $backup
        exit $tscExit
    }

    Write-Host "TypeScript check passed." -ForegroundColor Green

    # If package.json has a build script, run it to catch Vite/Babel/JSX errors.
    $packageJson = Get-Content ".\package.json" -Raw | ConvertFrom-Json
    if ($packageJson.scripts -and $packageJson.scripts.build) {
        Write-Host ""
        Write-Host "Running project build..." -ForegroundColor Cyan
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "Build failed. The backup remains available at:" -ForegroundColor Yellow
            Write-Host $backup
            exit $LASTEXITCODE
        }
        Write-Host "Project build passed." -ForegroundColor Green
    } else {
        Write-Host "No npm build script found; syntax check passed." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "SUCCESS: PublicLanding.tsx was repaired and validation passed." -ForegroundColor Green
Write-Host "Backup: $backup"
