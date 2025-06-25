#!/bin/bash

# Проверка Python 3
if ! command -v python3 &>/dev/null; then
  echo "Python 3 не найден. Установите его вручную."
  exit 1
fi

# Создание виртуального окружения
python3 -m venv venv
source venv/bin/activate

# Обновление pip
pip install --upgrade pip

# Установка зависимостей
pip install Flask beautifulsoup4 requests stanza stopwordsiso langdetect gunicorn

echo "✅ Установка завершена. Активация виртуального окружения:"
echo "source venv/bin/activate"
