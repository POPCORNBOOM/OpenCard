[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Version,

  [switch]$SkipChecks,
  [switch]$NoPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory)]
    [string]$Command,

    [Parameter(Mandatory)]
    [string[]]$Arguments,

    [Parameter(Mandatory)]
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
  }
  finally {
    Pop-Location
  }
}

function Set-FirstRegexMatch {
  param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [string]$Pattern,

    [Parameter(Mandatory)]
    [string]$Replacement
  )

  $content = [System.IO.File]::ReadAllText($Path)
  $regex = [System.Text.RegularExpressions.Regex]::new(
    $Pattern,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )

  if (-not $regex.IsMatch($content)) {
    throw "Could not locate the version field in $Path"
  }

  $updated = $regex.Replace($content, $Replacement, 1)
  [System.IO.File]::WriteAllText($Path, $updated, [System.Text.UTF8Encoding]::new($false))
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = Read-Host 'Release version (for example 0.2.2)'
}

if ($Version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
  throw "Version must be a stable semantic version such as 0.2.2. Received: $Version"
}

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path (Join-Path $appRoot '..')).Path
$cargoRoot = Join-Path $appRoot 'src-tauri'
$cargoTomlPath = Join-Path $cargoRoot 'Cargo.toml'
$cargoLockPath = Join-Path $cargoRoot 'Cargo.lock'
$tauriConfigPath = Join-Path $cargoRoot 'tauri.conf.json'
$tag = "v$Version"

foreach ($command in @('git', 'node', 'npm.cmd', 'cargo')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command is unavailable: $command"
  }
}

$repositoryTopLevelOutput = (& git -C $repoRoot rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Expected a Git repository rooted at $repoRoot"
}
$repositoryTopLevel = (Resolve-Path $repositoryTopLevelOutput).Path
if ($repositoryTopLevel -ne $repoRoot) {
  throw "Expected a Git repository rooted at $repoRoot"
}

$workingTreeStatus = & git -C $repoRoot status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw 'Could not inspect the Git working tree.'
}
if ($workingTreeStatus) {
  throw 'The working tree is not clean. Commit or stash all changes before creating a release.'
}

$branch = (& git -C $repoRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw 'Releases cannot be created from a detached HEAD.'
}

$tauriConfig = Get-Content $tauriConfigPath -Raw | ConvertFrom-Json
$currentVersion = [System.Version]::Parse([string]$tauriConfig.version)
$nextVersion = [System.Version]::Parse($Version)
if ($nextVersion -le $currentVersion) {
  throw "The release version must be newer than the current version $currentVersion."
}

Write-Host "Preparing OpenCard $tag from branch $branch" -ForegroundColor Cyan
Invoke-NativeCommand -Command 'git' -Arguments @('fetch', 'origin', '--tags') -WorkingDirectory $repoRoot

& git -C $repoRoot rev-parse --verify --quiet "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) {
  throw "Tag already exists locally: $tag"
}

& git -C $repoRoot ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) {
  throw "Tag already exists on origin: $tag"
}

Write-Host 'Updating application versions...' -ForegroundColor Cyan
Invoke-NativeCommand -Command 'npm.cmd' -Arguments @(
  'version',
  $Version,
  '--no-git-tag-version',
  '--allow-same-version'
) -WorkingDirectory $appRoot

$updateJsonVersion = @'
const fs = require('node:fs');
const [filePath, version] = process.argv.slice(1);
const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
document.version = version;
fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
'@
Invoke-NativeCommand -Command 'node' -Arguments @(
  '-e',
  $updateJsonVersion,
  $tauriConfigPath,
  $Version
) -WorkingDirectory $repoRoot

Set-FirstRegexMatch `
  -Path $cargoTomlPath `
  -Pattern '(?ms)(^\[package\]\s*(?:(?!^\[).)*?^version\s*=\s*")[^"]+(")' `
  -Replacement "`${1}$Version`${2}"

Set-FirstRegexMatch `
  -Path $cargoLockPath `
  -Pattern '(?ms)(^\[\[package\]\]\s*\r?\nname\s*=\s*"OpenCard"\s*\r?\nversion\s*=\s*")[^"]+(")' `
  -Replacement "`${1}$Version`${2}"

if (-not $SkipChecks) {
  Write-Host 'Running frontend build...' -ForegroundColor Cyan
  Invoke-NativeCommand -Command 'npm.cmd' -Arguments @('run', 'build') -WorkingDirectory $appRoot

  Write-Host 'Running Rust checks...' -ForegroundColor Cyan
  Invoke-NativeCommand -Command 'cargo' -Arguments @(
    'check',
    '--manifest-path',
    $cargoTomlPath
  ) -WorkingDirectory $repoRoot
}

$versionFiles = @(
  'opencard-app/package.json',
  'opencard-app/package-lock.json',
  'opencard-app/src-tauri/Cargo.toml',
  'opencard-app/src-tauri/Cargo.lock',
  'opencard-app/src-tauri/tauri.conf.json'
)

Write-Host 'Creating release commit and tag...' -ForegroundColor Cyan
Invoke-NativeCommand -Command 'git' -Arguments (@('add', '--') + $versionFiles) -WorkingDirectory $repoRoot
Invoke-NativeCommand -Command 'git' -Arguments @('diff', '--cached', '--check') -WorkingDirectory $repoRoot
Invoke-NativeCommand -Command 'git' -Arguments @('commit', '-m', "chore(release): $tag") -WorkingDirectory $repoRoot
Invoke-NativeCommand -Command 'git' -Arguments @('tag', '-a', $tag, '-m', "OpenCard $tag") -WorkingDirectory $repoRoot

if ($NoPush) {
  Write-Host "Created $tag locally. Push was skipped because -NoPush was supplied." -ForegroundColor Yellow
  exit 0
}

Write-Host 'Pushing the release commit and tag atomically...' -ForegroundColor Cyan
Invoke-NativeCommand -Command 'git' -Arguments @(
  'push',
  '--atomic',
  'origin',
  "HEAD:refs/heads/$branch",
  "refs/tags/$tag"
) -WorkingDirectory $repoRoot

Write-Host "Released $tag. GitHub Actions will now build the desktop release." -ForegroundColor Green
