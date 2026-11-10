$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $root 'worker')

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}

npm install --no-fund --no-audit
npx wrangler login

if (-not (Test-Path vapid.json)) { npx web-push generate-vapid-keys --json | Out-File vapid.json -Encoding ascii }
$v = Get-Content vapid.json -Raw | ConvertFrom-Json

npx wrangler deploy
$v.publicKey | npx wrangler secret put VAPID_PUBLIC
$v.privateKey | npx wrangler secret put VAPID_PRIVATE

$url = (Read-Host 'Lipeste adresa https://peron-push....workers.dev afisata mai sus').Trim().TrimEnd('/')
Set-Content (Join-Path $root 'config.js') "window.PERON_PUSH = '$url';" -Encoding ascii
Invoke-RestMethod "$url/key" | Out-Null
Write-Host "Server notificari OK: $url" -ForegroundColor Green
