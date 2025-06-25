
$python = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Error "❌ Python 3 не найден. Установите его вручную с https://www.python.org/downloads/"
    exit 1
}


python3 -m venv venv


.\venv\Scripts\Activate.ps1

# pip
python -m pip install --upgrade pip


pip install Flask beautifulsoup4 requests stanza stopwordsiso langdetect gunicorn

Write-Host "✅ Установка завершена. Чтобы активировать окружение снова:"
Write-Host "`n.\\venv\\Scripts\\Activate.ps1"
