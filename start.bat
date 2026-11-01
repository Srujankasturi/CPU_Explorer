@echo off
title CPU Performance Explorer
echo Starting CPU Performance Explorer...
echo.
py -m pip install -r backend/requirements.txt
echo.
py run.py
pause

