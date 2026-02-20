# Git Security Check - Run before pushing
Write-Host 'Git Security Check' -ForegroundColor Cyan
Write-Host '==================' -ForegroundColor Cyan

# Check for tracked .env files
$tracked = git ls-files | Select-String '\.env' | Where-Object { $_ -notmatch '\.env\.(example|production\.example)' }
if ($tracked) {
    Write-Host 'ERROR: .env files are tracked in git!' -ForegroundColor Red
    $tracked
    exit 1
}

# Check for staged .env files  
$staged = git diff --cached --name-only | Select-String '\.env' | Where-Object { $_ -notmatch '\.env\.(example|production\.example)' }
if ($staged) {
    Write-Host 'ERROR: .env files are staged!' -ForegroundColor Red
    $staged
    Write-Host 'Run: git reset HEAD <file>' -ForegroundColor Yellow
    exit 1
}

Write-Host 'OK: No secrets detected. Safe to commit.' -ForegroundColor Green
exit 0
