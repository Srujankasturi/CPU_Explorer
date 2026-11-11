@echo off
title CPU Performance Explorer
echo Starting CPU Performance Explorer...
echo.
where py >nul 2>nul
if %errorlevel% equ 0 (
    set PY_CMD=py
) else (
    set PY_CMD=python
)
%PY_CMD% -m pip install -r backend/requirements.txt
echo.
%PY_CMD% run.py
pause

