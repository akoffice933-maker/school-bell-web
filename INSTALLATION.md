# 📦 Подробная инструкция по установке и запуску

> Полное пошаговое руководство по установке, настройке и запуску **«Школьный звонок Pro · Web Edition»** на Windows, macOS и Linux.

---

## 📑 Содержание

1. [Быстрый старт (TL;DR)](#-быстрый-старт-tldr)
2. [Установка Node.js и npm](#-установка-nodejs-и-npm)
3. [Получение исходного кода](#-получение-исходного-кода)
4. [Установка зависимостей проекта](#-установка-зависимостей-проекта)
5. [Запуск в режиме разработки](#-запуск-в-режиме-разработки)
6. [Сборка для продакшена](#-сборка-для-продакшена)
7. [Запуск продакшен-сборки](#-запуск-продакшен-сборки)
8. [Установка как PWA (нативное приложение)](#-установка-как-pwa-нативное-приложение)
9. [Развёртывание на сервере](#-развёртывание-на-сервере)
10. [Решение проблем при установке](#-решение-проблем-при-установке)

---

## ⚡ Быстрый старт (TL;DR)

Для опытных пользователей — три команды:

```bash
git clone https://github.com/akoffice933-maker/school-bell.git
cd school-bell
npm install
npm run dev
```

Откройте в браузере: **http://localhost:5173/**

> Всё! Приложение запущено в режиме разработки. 🎉

---

## 🛠 Установка Node.js и npm

`Node.js` — это среда выполнения JavaScript, в которой работает Vite и весь инструментарий проекта.
`npm` (Node Package Manager) — менеджер пакетов, идёт в комплекте с Node.js.

### Минимальные требования

- **Node.js** ≥ 18.0 (рекомендуется **20 LTS** или **22 LTS**)
- **npm** ≥ 9.0 (идёт с Node.js)
- ~300 МБ свободного места на диске (Node.js + зависимости + сборка)

### Windows

#### Способ 1: Официальный установщик (рекомендуется)

1. Перейдите на [https://nodejs.org/](https://nodejs.org/).
2. Скачайте **LTS-версию** для Windows (`.msi` файл, 64-bit).
3. Запустите скачанный файл.
4. В мастере установки:
   - ✅ Примите лицензионное соглашение.
   - ✅ Оставьте путь по умолчанию `C:\Program Files\nodejs\`.
   - ✅ **Отметьте** «Automatically install the necessary tools» (установит Chocolatey, Python и т.д.).
   - Нажмите **Next → Install**.
5. После установки **перезапустите терминал** (cmd / PowerShell / Windows Terminal).
6. Проверьте:
   ```powershell
   node -v
   # v20.x.x
   npm -v
   # 10.x.x
   ```

#### Способ 2: Через winget

```powershell
winget install OpenJS.NodeJS.LTS
```

#### Способ 3: Через Chocolatey

```powershell
choco install nodejs-lts
```

#### Способ 4: Через nvm-windows (для продвинутых)

Позволяет держать несколько версий Node.js одновременно.

```powershell
# Установка nvm-windows
winget install CoreyButler.NVMforWindows

# Установка Node.js LTS
nvm install lts
nvm use lts
```

### macOS

#### Способ 1: Через Homebrew (рекомендуется)

```bash
# Установите Homebrew, если ещё не установлен
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установите Node.js
brew install node@20
brew link --force node@20
```

#### Способ 2: Официальный установщик

1. Скачайте `.pkg` с [https://nodejs.org/](https://nodejs.org/).
2. Запустите установщик, следуйте инструкциям.

#### Способ 3: Через nvm (для продвинутых)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
nvm use --lts
```

Проверка:

```bash
node -v
npm -v
```

### Linux (Ubuntu / Debian / Mint)

#### Способ 1: Через NodeSource (рекомендуется)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Способ 2: Через nvm (для продвинутых)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
nvm use --lts
```

#### Способ 3: Через apt (может быть устаревшая версия)

```bash
sudo apt update
sudo apt install nodejs npm
```

Проверка:

```bash
node -v
npm -v
```

### Linux (Fedora / RHEL / CentOS)

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs npm
```

### Linux (Arch / Manjaro)

```bash
sudo pacman -S nodejs npm
```

---

## 📥 Получение исходного кода

### Вариант 1: Клонировать через Git (рекомендуется)

#### Установка Git (если ещё не установлен)

- **Windows**: скачайте с [https://git-scm.com/download/win](https://git-scm.com/download/win).
- **macOS**: `brew install git` или установите Xcode Command Line Tools (`xcode-select --install`).
- **Linux**: `sudo apt install git` (Debian/Ubuntu) или `sudo dnf install git` (Fedora).

#### Клонирование

```bash
# HTTPS (подходит для всех)
git clone https://github.com/akoffice933-maker/school-bell.git

# или SSH (если настроен SSH-ключ)
git clone git@github.com:akoffice933-maker/school-bell.git

# Переходим в папку проекта
cd school-bell
```

### Вариант 2: Скачать ZIP-архив

1. Перейдите на [https://github.com/akoffice933-maker/school-bell](https://github.com/akoffice933-maker/school-bell).
2. Нажмите зелёную кнопку **«Code»** → **«Download ZIP»**.
3. Распакуйте архив в любую папку.
4. Откройте терминал в этой папке.

### Вариант 3: Через GitHub CLI

```bash
gh repo clone akoffice933-maker/school-bell
cd school-bell
```

---

## 📚 Установка зависимостей проекта

В корневой папке проекта (`school-bell/`) выполните:

```bash
npm install
```

Эта команда:

1. Прочитает файл `package.json`.
2. Скачает все перечисленные пакеты и их зависимости.
3. Создаст папку `node_modules/` (≈ 200 МБ).
4. Создаст файл `package-lock.json` (если его нет).

### Альтернативные пакетные менеджеры

Если вы предпочитаете `yarn` или `pnpm`:

```bash
# Yarn
npm install -g yarn
yarn install
yarn dev

# pnpm (быстрее всех)
npm install -g pnpm
pnpm install
pnpm dev
```

### Проверка установки

После `npm install` в папке проекта должны появиться:

```
school-bell/
├── node_modules/      ← создано (пакеты)
├── package-lock.json  ← создано (точный список версий)
└── ...
```

Чтобы убедиться, что все ключевые пакеты установлены:

```bash
npm list --depth=0
```

Должны быть видны: `react`, `react-dom`, `vite`, `tailwindcss`, `@vitejs/plugin-react` и др.

---

## 🚀 Запуск в режиме разработки

Режим разработки — для активной работы с кодом: есть **горячая перезагрузка** (HMR), подробные ошибки, source maps.

```bash
npm run dev
```

В консоли появится:

```
  VITE v7.3.2  ready in 412 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.10:5173/
```

- **Local** — адрес для открытия на том же компьютере.
- **Network** — адрес для открытия с других устройств в локальной сети (телефон, планшет, другой ПК).

Откройте в браузере: **http://localhost:5173/**

### Доступ с других устройств (опционально)

По умолчанию Vite слушает только `localhost`. Чтобы разрешить доступ с других устройств в локальной сети:

```bash
npm run dev -- --host
```

или отредактируйте `vite.config.ts`:

```ts
export default defineConfig({
  server: {
    host: true, // слушать на 0.0.0.0
    port: 5173,
  },
  plugins: [react(), tailwindcss(), viteSingleFile()],
});
```

### Остановка сервера

В терминале нажмите **Ctrl + C**.

---

## 🏗 Сборка для продакшена

Когда вы готовы опубликовать приложение:

```bash
npm run build
```

Команда выполнит:

1. Транспиляцию TypeScript → JavaScript.
2. Сборку React-бандла.
3. Обработку CSS (Tailwind → минифицированный CSS).
4. Оптимизацию изображений, шрифтов, аудио.
5. Бандлинг и минификацию (esbuild).
6. **Благодаря `vite-plugin-singlefile` собирает всё в один файл `dist/index.html`**.

Готовая сборка появится в папке `dist/`:

```
dist/
└── index.html      ← всё приложение в одном файле (~ 1-3 МБ)
```

### Особенности singlefile-сборки

- ✅ **Весь JS, CSS, SVG** встроены прямо в HTML.
- ✅ Можно открыть двойным кликом — работает!
- ✅ Удобно для офлайн-распространения (USB, email).
- ✅ Не нужны серверные маршруты, всё в одном файле.

Если нужна стандартная многофайловая сборка (JS отдельно, CSS отдельно), отключите `vite-plugin-singlefile` в `vite.config.ts`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()], // без viteSingleFile
});
```

---

## ▶ Запуск продакшен-сборки

### Локальный просмотр

```bash
npm run preview
```

Поднимет мини-сервер на `http://localhost:4173/`.

### Запуск из папки `dist/`

#### Вариант A: Через любой статический сервер

Самый простой — `npx serve`:

```bash
npx serve dist
# или
npx http-server dist -p 8080
```

#### Вариант B: Через Python (если установлен)

```bash
# Python 3
python -m http.server 8080 --directory dist
```

#### Вариант C: Через nginx / Apache

Скопируйте содержимое `dist/` в `/var/www/html/` (или любую другую папку веб-сервера) и откройте в браузере.

#### Вариант D: Просто открыть файл

`dist/index.html` — это самодостаточный файл. Можно просто открыть его двойным кликом.

> ⚠️ **Внимание:** Service Worker и PWA могут работать некорректно при открытии через `file://`. Для PWA лучше использовать HTTP(S).

---

## 📱 Установка как PWA (нативное приложение)

### Windows / macOS / Linux (Chrome, Edge, Яндекс.Браузер)

1. Откройте приложение в браузере.
2. В правой части адресной строки появится иконка **«Установить»** (⊕ или 🖥️).
3. Кликните по ней → **«Установить»**.
4. Подтвердите установку в диалоговом окне.
5. Приложение появится:
   - **Windows**: в меню «Пуск» и в `C:\Users\<user>\AppData\Local\`.
   - **macOS**: в Launchpad.
   - **Linux**: в меню приложений (зависит от DE).

После установки приложение работает в **отдельном окне без адресной строки** и поддерживает **офлайн-режим**.

### Android (Chrome, Edge, Яндекс.Браузер)

1. Откройте в браузере.
2. Появится баннер **«Добавить на главный экран»** или нажмите ⋮ → **«Установить»**.
3. Подтвердите.
4. Иконка появится на рабочем столе.

### iOS / iPadOS (Safari)

1. Откройте в Safari.
2. Нажмите кнопку **«Поделиться»** (квадрат со стрелкой вверх).
3. Прокрутите вниз → **«На экран Домой»**.
4. Нажмите **«Добавить»**.

### Проверка PWA-режима

1. Откройте DevTools (F12).
2. Перейдите на вкладку **Application** → **Manifest**.
3. Должны быть видны иконки 192×192 и 512×512, `name`, `start_url`, `display: standalone`.
4. На вкладке **Service Workers** должен быть зарегистрированный SW со статусом **activated**.

---

## 🌐 Развёртывание на сервере

### GitHub Pages (бесплатно)

#### Способ 1: Через ветку `gh-pages`

1. Установите `gh-pages`:
   ```bash
   npm install -D gh-pages
   ```

2. Добавьте в `package.json`:
   ```json
   "scripts": {
     "deploy": "gh-pages -d dist"
   }
   ```

3. Отключите singlefile для корректной работы на субпути (если репо не `username.github.io`):
   ```ts
   // vite.config.ts
   export default defineConfig({
     base: '/school-bell/',  // или '/' для username.github.io
     plugins: [react(), tailwindcss()], // без singlefile
   });
   ```

4. Соберите и задеплойте:
   ```bash
   npm run build
   npm run deploy
   ```

5. В настройках репозитория: **Settings → Pages → Branch: gh-pages**.

#### Способ 2: Через GitHub Actions

Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Netlify (бесплатно, drag-and-drop)

1. Зайдите на [https://app.netlify.com/drop](https://app.netlify.com/drop).
2. Перетащите папку `dist/` в окно браузера.
3. Готово — приложение доступно по сгенерированному URL.

### Vercel (бесплатно)

```bash
npm install -g vercel
vercel
```

Следуйте инструкциям в консоли.

### Cloudflare Pages (бесплатно)

1. Зайдите на [https://pages.cloudflare.com/](https://pages.cloudflare.com/).
2. Подключите репозиторий.
3. Build command: `npm run build`, Output: `dist`.

### Свой сервер (VPS / dedicated)

#### nginx

```nginx
server {
server_name your-domain.com www.your-domain.com;
    root /var/www/school-bell/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кеширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Сжатие
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
```

```bash
# Копируем сборку
sudo cp -r dist/* /var/www/school-bell/

# Перезапускаем nginx
sudo nginx -t
sudo systemctl reload nginx
```

#### Apache

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/school-bell/dist

    <Directory /var/www/school-bell/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # SPA fallback
    FallbackResource /index.html
</VirtualHost>
```

```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

### Docker (опционально)

Создайте `Dockerfile`:

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Соберите и запустите:

```bash
docker build -t school-bell .
docker run -d -p 8080:80 school-bell
```

Откройте: http://localhost:8080/

---

## 🔧 Решение проблем при установке

### ❌ `node: command not found`

**Причина:** Node.js не установлен или не добавлен в PATH.

**Решение:**
1. Установите Node.js по [инструкции выше](#-установка-nodejs-и-npm).
2. **Перезапустите терминал** (закройте и откройте заново).
3. Проверьте: `node -v` и `npm -v`.

### ❌ `npm install` завершается с ошибкой EACCES (Linux/macOS)

**Причина:** Нет прав на запись в системные папки npm.

**Решение:**

```bash
# Способ 1: использовать nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
nvm use --lts

# Способ 2: сменить владельца папки npm
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### ❌ `npm install` зависает или падает на `node-gyp` / `python`

**Причина:** Не установлены инструменты сборки (Python, Visual Studio Build Tools, make).

**Решение:**

- **Windows**: `npm install -g windows-build-tools` или установите [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/).
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt install build-essential python3`

### ❌ `Error: EADDRINUSE :::5173`

**Причина:** Порт 5173 уже занят другим приложением.

**Решение:**

```bash
# Запустить на другом порту
npm run dev -- --port 3000
```

Или закройте процесс, занимающий порт 5173.

### ❌ Проблемы с зависимостями / устаревший lockfile

**Решение:**

```bash
# Удалить старые зависимости и lockfile
rm -rf node_modules package-lock.json
# На Windows:
# rmdir /s /q node_modules
# del package-lock.json

# Переустановить
npm install
```

### ❌ Звонки не воспроизводятся (Web Audio)

**Причина:** Браузер блокирует автозапуск звука без взаимодействия пользователя.

**Решение:**
1. Кликните в любом месте страницы — это «разблокирует» звук.
2. Убедитесь, что в браузере не выключен звук на вкладке (иконка динамика в табе).

### ❌ Микрофон не работает в записи

**Причина:** Браузер не получил разрешение на использование микрофона.

**Решение:**
1. Кликните на 🔒 / 🎤 в адресной строке → **«Разрешить»** микрофон.
2. Перезагрузите страницу.
3. Убедитесь, что в системе не занят микрофон другим приложением (Zoom, Skype, Discord).

### ❌ PWA не устанавливается

**Причина:** Не выполнены требования PWA.

**Решение:**
1. **HTTPS обязателен** для PWA. На `http://localhost` PWA работает, но на любом другом хосте нужен HTTPS.
2. Проверьте DevTools → Application → Manifest — нет ли ошибок.
3. Service Worker должен быть зарегистрирован (Application → Service Workers).
4. В iOS Safari кнопка «Установить» отсутствует — добавляйте через «Поделиться» → «На экран Домой».

### ❌ Ошибки при `npm run build`

**Причина:** Обычно — TypeScript-ошибки или несовместимые версии пакетов.

**Решение:**

```bash
# Проверить TypeScript
npx tsc --noEmit

# Обновить зависимости
npm update

# Если всё совсем плохо — переустановить
rm -rf node_modules package-lock.json
npm install
```

### ❌ `git` не найден (Windows)

**Решение:** Скачайте и установите Git с [https://git-scm.com/download/win](https://git-scm.com/download/win). При установке оставьте все настройки по умолчанию.

---

## 📞 Поддержка

Если у вас возникли проблемы, не описанные здесь:

1. 📖 Перечитайте [README.md](./README.md) — там есть раздел **«Решение проблем»**.
2. 🐛 Создайте [Issue на GitHub](https://github.com/akoffice933-maker/school-bell/issues).
3. 📧 Свяжитесь с автором: [github.com/akoffice933-maker](https://github.com/akoffice933-maker).

При создании Issue укажите:
- Версию Node.js (`node -v`).
- Версию npm (`npm -v`).
- Операционную систему.
- Полный текст ошибки из консоли.
- Шаги для воспроизведения.

---

<p align="center">
  Удачи в использовании! 🚀
</p>

