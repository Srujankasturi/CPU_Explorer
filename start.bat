@echo off
title CPU Performance Explorer
echo Starting CPU Performance Explorer...
echo.
python -m pip install -r backend/requirements.txt
echo.
python run.py
pause

