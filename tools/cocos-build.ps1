# Cocos Creator 命令行构建。Cocos 构建完不会自己退出，这里盯日志，看到结束标记就结束进程。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File tools/cocos-build.ps1 -Config tools/build-wechatgame.json
param(
    [Parameter(Mandatory = $true)][string]$Config,
    [string]$Creator = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe',
    [int]$TimeoutSec = 600
)

$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = (Resolve-Path $Config).Path

$log = Join-Path $env:TEMP 'cocos-build.log'
$err = Join-Path $env:TEMP 'cocos-build.err'
Remove-Item $log, $err -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath $Creator -PassThru -NoNewWindow `
    -ArgumentList "--project `"$project`" --build `"configPath=$configPath`"" `
    -RedirectStandardOutput $log -RedirectStandardError $err

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$finished = $false
while ((Get-Date) -lt $deadline -and -not $proc.HasExited) {
    Start-Sleep -Seconds 2
    if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'build Task \(.*\) Finished' -Quiet)) {
        $finished = $true
        break
    }
}

# 结束构建进程及其子进程
$children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($proc.Id)" -ErrorAction SilentlyContinue
foreach ($c in $children) { Stop-Process -Id $c.ProcessId -Force -ErrorAction SilentlyContinue }
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }

$errors = Select-String -Path $log -Pattern ' - error:|error TS\d+' -ErrorAction SilentlyContinue
if ($errors) { $errors | Select-Object -First 20 | ForEach-Object { $_.Line } }

if ($finished -and -not $errors) {
    Write-Output "构建成功，日志：$log"
    exit 0
}
Write-Output "构建失败或超时，日志：$log"
exit 1
