@echo off
rem Sobe uma aplicacao low-code (Bolt ou Lovable) com Supabase local, via Docker.
rem Uso: subir bolt restaurante_pedidos ^| subir lovable restaurante_pedidos ^| subir -Parar
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker\lowcode\subir.ps1" %*
