# Stop XAMPP Services Definitive
Write-Host "Shutting down XAMPP Apache and MySQL..." -ForegroundColor Cyan

function Stop-XAMPPProcess {
    param($ProcessName, $FriendlyName)
    $procs = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "Stopping $FriendlyName..." -NoNewline
        try {
            # Try to stop gracefully first
            $procs | Stop-Process -Force -ErrorAction Stop
            Write-Host " [STOPPED]" -ForegroundColor Green
        } catch {
            Write-Host " [FAILED to stop]" -ForegroundColor Red
            Write-Host "    Error: $($_.Exception.Message)"
        }
    } else {
        Write-Host "$FriendlyName is not running." -ForegroundColor Gray
    }
}

Stop-XAMPPProcess -ProcessName "httpd" -FriendlyName "Apache"
Stop-XAMPPProcess -ProcessName "mysqld" -FriendlyName "MySQL"

Write-Host "Cleanup complete." -ForegroundColor Cyan
