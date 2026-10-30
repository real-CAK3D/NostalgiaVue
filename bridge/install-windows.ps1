# NostalgiaVue Bridge — one-step Windows setup.
# Run in PowerShell:
#   irm https://raw.githubusercontent.com/real-CAK3D/NostalgiaVue/main/bridge/install-windows.ps1 | iex
# Optional: set these first to use different folders, e.g.  $NVMovies = 'D:\Films'
#   $NVRoot  (default E:\CAK3D-TV)   $NVMovies (default <root>\Movies)
#   $NVTV    (default <root>\TV Shows)   $NVRoms (default E:\ROMs)

$ErrorActionPreference = 'Stop'
$root   = if ($NVRoot)   { $NVRoot }   else { 'E:\CAK3D-TV' }
$movies = if ($NVMovies) { $NVMovies } else { Join-Path $root 'Movies' }
$tv     = if ($NVTV)     { $NVTV }     else { Join-Path $root 'TV Shows' }
$roms   = if ($NVRoms)   { $NVRoms }   else { 'E:\ROMs' }
$dir    = Join-Path $root 'bridge'
$raw    = 'https://raw.githubusercontent.com/real-CAK3D/NostalgiaVue/main/bridge'
$site   = 'https://nostalgiavue.vercel.app'

function Say($m) { Write-Host "`n>> $m" -ForegroundColor Cyan }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "NostalgiaVue Bridge setup" -ForegroundColor Yellow
Write-Host "  Movies : $movies`n  TV     : $tv`n  ROMs   : $roms`n  Bridge : $dir"

# 1. Python
Say 'Checking Python...'
$py = $null
foreach ($c in 'python', 'py') { if (Have $c) { try { & $c -c "import sys;assert sys.version_info>=(3,8)" 2>$null; if ($LASTEXITCODE -eq 0) { $py = $c; break } } catch {} } }
if (-not $py) {
  Say 'Installing Python 3 (winget)...'
  winget install -e --id Python.Python.3.12 --scope user --accept-source-agreements --accept-package-agreements | Out-Null
  Refresh-Path; $py = 'python'
}
$pyExe = (& $py -c "import sys;print(sys.executable)").Trim()
$pyw = Join-Path (Split-Path $pyExe) 'pythonw.exe'
if (-not (Test-Path $pyw)) { $pyw = $pyExe }

# 2. Tailscale
Say 'Checking Tailscale...'
if (-not (Have 'tailscale')) {
  $ts = 'C:\Program Files\Tailscale\tailscale.exe'
  if (Test-Path $ts) { $env:Path += ';C:\Program Files\Tailscale' }
  else {
    Say 'Installing Tailscale (winget)...'
    winget install -e --id Tailscale.Tailscale --accept-source-agreements --accept-package-agreements | Out-Null
    $env:Path += ';C:\Program Files\Tailscale'
  }
}
$status = $null
try { $status = tailscale status --json | ConvertFrom-Json } catch {}
if (-not $status -or $status.BackendState -ne 'Running') {
  Say 'Sign in to Tailscale in the window that opens (same account as your phone)...'
  tailscale up | Out-Null
  $status = tailscale status --json | ConvertFrom-Json
}
$dns = $status.Self.DNSName.TrimEnd('.')

# 3. FFmpeg (optional: lets tuning in land mid-show)
if (-not (Have 'ffprobe')) {
  Say 'Installing FFmpeg (optional, for show lengths)...'
  try { winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements | Out-Null; Refresh-Path } catch { Write-Host '   skipped' }
}

# 4. Bridge files + config
Say "Downloading the Bridge to $dir..."
New-Item -ItemType Directory -Force -Path $dir | Out-Null
foreach ($f in 'nostalgiavue_bridge.py', 'config.example.json', 'start-bridge.bat') {
  Invoke-WebRequest -UseBasicParsing "$raw/$f" -OutFile (Join-Path $dir $f)
}
$cfgPath = Join-Path $dir 'config.json'
if (Test-Path $cfgPath) {
  $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
  $token = $cfg.token
  Write-Host '   keeping your existing config.json and token'
} else {
  $token = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
  $media = [ordered]@{}
  if (Test-Path $movies) { $media.Movies = $movies.Replace('\', '/') } else { Write-Host "   (no folder at $movies yet)" -ForegroundColor DarkYellow }
  if (Test-Path $tv) { $media.TV = $tv.Replace('\', '/') } else { Write-Host "   (no folder at $tv yet)" -ForegroundColor DarkYellow }
  $cfg = [ordered]@{ name = $env:COMPUTERNAME; port = 8787; token = $token; media = $media; allow_origins = @($site, 'http://localhost:8080') }
  if (Test-Path $roms) { $cfg.roms = $roms.Replace('\', '/') }
  $cfg | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $cfgPath
}

# 5. Run it now and at every sign-in (hidden window)
Say 'Starting the Bridge...'
Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*nostalgiavue_bridge.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process -FilePath $pyw -ArgumentList "`"$dir\nostalgiavue_bridge.py`"" -WorkingDirectory $dir -WindowStyle Hidden
$startup = [Environment]::GetFolderPath('Startup')
$sh = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup 'NostalgiaVue Bridge.lnk'))
$sh.TargetPath = $pyw; $sh.Arguments = "`"$dir\nostalgiavue_bridge.py`""; $sh.WorkingDirectory = $dir; $sh.WindowStyle = 7; $sh.Save()

# 6. Share it on the tailnet over HTTPS
Say 'Sharing it over Tailscale (HTTPS)...'
Write-Host '   If Tailscale prints a login.tailscale.com link, open it and click Enable (one time only).' -ForegroundColor Yellow
tailscale serve --bg 8787
$url = "https://$dns"
Start-Sleep -Seconds 2
try { Invoke-RestMethod "http://127.0.0.1:8787/api/info?t=$token" | Out-Null; Write-Host '   Bridge is answering.' -ForegroundColor Green }
catch { Write-Host '   The Bridge did not answer locally; check that Python is installed and run start-bridge.bat to see errors.' -ForegroundColor Red }

# 7. Pair the TV: opens NostalgiaVue with the address + token filled in and channels assigned
$pair = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((@{ u = $url; t = $token } | ConvertTo-Json -Compress)))
Say 'Opening NostalgiaVue, already connected...'
Start-Process "$site/#pair=$pair"

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Bridge address : $url"
Write-Host "  Bridge token   : $token"
Write-Host "  To connect another device (phone, laptop), open this link on it with Tailscale on:"
Write-Host "  $site/#pair=$pair" -ForegroundColor Yellow
