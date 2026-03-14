Param(
    [switch]$Visible
)

$WindowStyle = if ($Visible) { "Normal" } else { "Hidden" }
$ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

function Check-Service {
    param($ProcessName, $FriendlyName)
    Write-Host "Verifying $FriendlyName..." -NoNewline
    
    $timeout = 10 # seconds
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        $proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host " [RUNNING]" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }
    
    Write-Host " [FAILED]" -ForegroundColor Red
    return $false
}

try {
    # Start XAMPP Services
    Write-Host "Starting XAMPP Services..." -ForegroundColor Cyan

    # Apache
    if (Get-Process -Name "httpd" -ErrorAction SilentlyContinue) {
        Write-Host "Apache is already running." -ForegroundColor Yellow
    } else {
        Write-Host "Starting Apache..."
        Start-Process "c:\xampp\apache_start.bat" -WindowStyle $WindowStyle
    }

    # MySQL
    if (Get-Process -Name "mysqld" -ErrorAction SilentlyContinue) {
        Write-Host "MySQL is already running." -ForegroundColor Yellow
    } else {
        Write-Host "Starting MySQL..."
        Start-Process "c:\xampp\mysql_start.bat" -WindowStyle $WindowStyle
    }

    # Verification
    $apacheOk = Check-Service -ProcessName "httpd" -FriendlyName "Apache"
    $mysqlOk = Check-Service -ProcessName "mysqld" -FriendlyName "MySQL"

    if (-not $apacheOk -or -not $mysqlOk) {
        Write-Host "`n[!] Troubleshooting Tip:" -ForegroundColor Yellow
        Write-Host "1. Check the XAMPP Control Panel for error logs."
        Write-Host "2. Common issue: Port 80 or 3306 might be in use."
        Write-Host "3. Try running 'bun run dev:debug' to see the startup windows.`n"
    }

    # Start Dev Server
    Write-Host "Starting Dev Server (bun start)..." -ForegroundColor Cyan
    bun start
}
finally {
    # This block attempts to run when the script is terminated
    # Note: Controlled termination (like Ctrl+C) might bypass this depending on the shell environment
    Write-Host "`nTerminating. Attempting to stop XAMPP services..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File "$ScriptsDir\stop.ps1"
}
