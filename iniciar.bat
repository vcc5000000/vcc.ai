@echo off
rem 1) Instala Node.js 18 o superior desde https://nodejs.org
rem 2) Cambia el nombre y el correo de abajo (la SEC exige un contacto real)
set SEC_CONTACT=Tu Nombre tucorreo@dominio.com
rem 3) OPCIONAL, para el botón "Redactar con IA": pega aqui tu clave de la API de Anthropic (console.anthropic.com).
rem    No la compartas ni la subas a ningun sitio. Si la dejas vacia, el informe usa el borrador automatico.
set ANTHROPIC_API_KEY=
rem 4) BUZON DE SOLICITUDES (WhatsApp -> correo). Crea una "contrasena de aplicacion" de Google para ese correo
rem    (Cuenta Google > Seguridad > Verificacion en 2 pasos > Contrasenas de aplicaciones) y pegala abajo. Solo se LEE el correo.
set MAIL_USER=vcc5000000@gmail.com
set GMAIL_APP_PASSWORD=
set PORT=3001
cd /d "%~dp0"
echo Cerrando versiones anteriores de Node...
taskkill /F /IM node.exe >nul 2>&1
start "" http://localhost:%PORT%
node server.js
pause
