@echo off
chcp 65001 >nul
title Bybit Demo Proxy

cd /d "%~dp0"
node proxy.js

echo.
pause
