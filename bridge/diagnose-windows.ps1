# NostalgiaVue Bridge checkup. Run in PowerShell:
#   irm https://raw.githubusercontent.com/real-CAK3D/NostalgiaVue/main/bridge/diagnose-windows.ps1 | iex
# Prints a short report (token hidden) and copies it to the clipboard.
$root = if ($NVRoot) { $NVRoot } else { 'E:\CAK3D-TV' }
$dir = Join-Path $root 'bridge'
$r = New-Object System.Collections.Generic.List[string]
function Line($ok, $what, $detail = '') { $r.Add(('{0} {1}{2}' -f ($(if ($ok) { '[OK] ' } else { '[XX] ' }), $what, $(if ($detail) { " - $detail" } else { '' })))) }

$cfgPath = Join-Path $dir 'config.json'
$cfg = $null; $token = ''
if (Test-Path $cfgPath) {
  try { $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json; $token = $cfg.token; Line $true 'config.json' ("media: " + (($cfg.media.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join '; ')) }
  catch { Line $false 'config.json unreadable' $_.Exception.Message }
  foreach ($p in $cfg.media.PSObject.Properties) { if (-not (Test-Path $p.Value)) { Line $false "folder missing" $p.Value } }
} else { Line $false 'config.json not found' $cfgPath }

$log = Join-Path $dir 'bridge-error.log'
if (Test-Path $log) { Line $false 'bridge-error.log' ((Get-Content $log | Select-Object -Last 3) -join ' | ') }

$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) { Line $true 'Python' ((& python --version 2>&1) | Out-String).Trim() } else { Line $false 'Python not on PATH' }

$proc = Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*nostalgiavue_bridge.py*' }
Line ([bool]$proc) 'Bridge process running' $(if ($proc) { "pid $($proc.ProcessId -join ',')" } else { 'not running' })

try { $i = Invoke-RestMethod "http://127.0.0.1:8787/api/info?t=$token" -TimeoutSec 5; Line $true 'Bridge answers on this PC' "$($i.name) v$($i.version), roots: $($i.roots -join ', ')" }
catch { Line $false 'Bridge does not answer on 127.0.0.1:8787' $_.Exception.Message }

$ts = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $ts -and (Test-Path 'C:\Program Files\Tailscale\tailscale.exe')) { $env:Path += ';C:\Program Files\Tailscale'; $ts = $true }
$dns = ''
if ($ts) {
  try { $st = tailscale status --json | ConvertFrom-Json; $dns = $st.Self.DNSName.TrimEnd('.'); Line ($st.BackendState -eq 'Running') 'Tailscale' "$($st.BackendState), this PC is $dns" } catch { Line $false 'Tailscale status failed' $_.Exception.Message }
  $serve = (tailscale serve status 2>&1 | Out-String).Trim()
  Line ($serve -match '8787') 'tailscale serve' ($serve -replace '\s+', ' ')
} else { Line $false 'Tailscale not installed' }

if ($dns) {
  $url = "https://$dns"
  try { $h = Invoke-RestMethod "$url/api/info?t=$token" -TimeoutSec 10; Line $true "HTTPS address works" "$url" }
  catch { Line $false "HTTPS address fails" "$url - $($_.Exception.Message)" }
  try {
    $resp = Invoke-WebRequest "$url/api/info" -Method Options -Headers @{ Origin = 'https://nostalgiavue.vercel.app'; 'Access-Control-Request-Method' = 'GET'; 'Access-Control-Request-Private-Network' = 'true' } -UseBasicParsing -TimeoutSec 10
    Line ([bool]$resp.Headers['Access-Control-Allow-Origin']) 'Browser permission (CORS)' "allow-origin: $($resp.Headers['Access-Control-Allow-Origin']); private-network: $($resp.Headers['Access-Control-Allow-Private-Network'])"
  } catch { Line $false 'Browser permission check failed' $_.Exception.Message }
  $r.Add("Bridge address for the TV: $url")
}
$r.Add("Token length: $($token.Length) (hidden)")

$report = "NostalgiaVue Bridge checkup`n" + ($r -join "`n")
Write-Host $report
try { Set-Clipboard $report; Write-Host "`n(Copied to clipboard - paste it to Claude.)" -ForegroundColor Green } catch {}
