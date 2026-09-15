@echo off
:: Casa Torino — instalar confianza QZ Tray (quita "Untrusted website")
:: Ejecutar como Administrador en el PC de la caja

setlocal
set "URL=https://casa-torino-web.vercel.app/assets/qz/override.crt"
set "TMP=%TEMP%\casa-torino-override.crt"
set "QZDIR=C:\Program Files\QZ Tray"
set "APPDATA_QZ=%APPDATA%\qz"

echo.
echo === Casa Torino / QZ Tray ===
echo Descargando certificado...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL%' -OutFile '%TMP%' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
  echo ERROR: no se pudo descargar el certificado. Revisa Internet.
  pause
  exit /b 1
)

if not exist "%QZDIR%" (
  echo ERROR: No encuentro QZ Tray en:
  echo   %QZDIR%
  echo Instala QZ Tray desde https://qz.io/download y vuelve a ejecutar esto.
  pause
  exit /b 1
)

echo Cerrando QZ Tray...
taskkill /IM qz-tray.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Copiando certificado a QZ Tray...
copy /Y "%TMP%" "%QZDIR%\override.crt" >nul
if errorlevel 1 (
  echo ERROR: no pude escribir en Program Files. Ejecuta este .bat como Administrador.
  echo Clic derecho en el archivo - Ejecutar como administrador
  pause
  exit /b 1
)

if not exist "%APPDATA_QZ%" mkdir "%APPDATA_QZ%"
copy /Y "%TMP%" "%APPDATA_QZ%\override.crt" >nul

:: Preferencia explícita en properties (por si acaso)
set "PROP=%QZDIR%\qz-tray.properties"
if exist "%PROP%" (
  findstr /i /c:"authcert.override" "%PROP%" >nul
  if errorlevel 1 (
    echo authcert.override=C:\\Program Files\\QZ Tray\\override.crt>> "%PROP%"
  )
)

echo Arrancando QZ Tray...
start "" "%QZDIR%\qz-tray.exe"

echo.
echo LISTO.
echo 1. Abre el TPV: https://casa-torino-web.vercel.app/tpv.html
echo 2. Recarga la pagina (F5)
echo 3. Pulsa "Probar ticket"
echo.
echo Si aun sale el aviso: marca Remember + Allow UNA vez.
echo Luego ya no deberia volver.
echo.
pause
