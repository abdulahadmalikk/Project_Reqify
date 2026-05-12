@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: ============================================================
::  REQIFY  —  Unit Test Runner Menu
::  Place this file in: python_ai_engine\
::  Usage: double-click or run from CMD
:: ============================================================

:UNIT_MENU
cls
echo.
echo  ====================================================
echo        REQIFY AI ENGINE — UNIT TEST RUNNER
echo  ====================================================
echo.
echo   Select a module to test:
echo.
echo     [1]  FR / NFR Classifier        (test_fr_nfr_classifier.py)
echo     [2]  NFR Subcategorizer         (test_nfr_subcategorizer.py)
echo     [3]  Ambiguity Checker          (test_ambiguity_checker.py)
echo     [4]  Conflict Detector          (test_conflict_detector.py)
echo     [5]  Completeness Checker       (test_completeness_checker.py)
echo     [6]  Prioritizer                (test_prioritizer.py)
echo     [7]  Risk Estimator             (test_risk_estimator.py)
echo     [8]  Impact Analyzer            (test_impact_analyzer.py)
echo     [9]  Exit
echo.
set /p UNIT_CHOICE=  Enter choice (1-9): 

if "%UNIT_CHOICE%"=="1" set TEST_FILE=test/test_fr_nfr_classifier.py    & set MODULE_NAME=FR / NFR Classifier
if "%UNIT_CHOICE%"=="2" set TEST_FILE=test/test_nfr_subcategorizer.py   & set MODULE_NAME=NFR Subcategorizer
if "%UNIT_CHOICE%"=="3" set TEST_FILE=test/test_ambiguity_checker.py    & set MODULE_NAME=Ambiguity Checker
if "%UNIT_CHOICE%"=="4" set TEST_FILE=test/test_conflict_detector.py    & set MODULE_NAME=Conflict Detector
if "%UNIT_CHOICE%"=="5" set TEST_FILE=test/test_completeness_checker.py & set MODULE_NAME=Completeness Checker
if "%UNIT_CHOICE%"=="6" set TEST_FILE=test/test_prioritizer.py          & set MODULE_NAME=Prioritizer
if "%UNIT_CHOICE%"=="7" set TEST_FILE=test/test_risk_estimator.py       & set MODULE_NAME=Risk Estimator
if "%UNIT_CHOICE%"=="8" set TEST_FILE=test/test_impact_analyzer.py      & set MODULE_NAME=Impact Analyzer
if "%UNIT_CHOICE%"=="9" goto EXIT

if not defined TEST_FILE (
    echo.
    echo  [!] Invalid choice. Try again.
    timeout /t 2 >nul
    goto UNIT_MENU
)

call :RUN_TESTS "%TEST_FILE%" "%MODULE_NAME%"
set TEST_FILE=
set MODULE_NAME=
goto UNIT_MENU


:: ============================================================
:: Subroutine: RUN_TESTS <file> <module-name>
:RUN_TESTS
cls
echo.
echo  ====================================================
echo   UNIT TEST: %~2
echo  ====================================================
echo.
venv_win\Scripts\python.exe -m pytest "%~1" -v
echo.
if %errorlevel% EQU 0 (
    echo  [RESULT]  ALL TESTS PASSED
) else (
    echo  [RESULT]  SOME TESTS FAILED  — see output above
)
echo.
pause
goto :eof


:: ============================================================
:EXIT
echo.
echo  Goodbye!
timeout /t 1 >nul
exit /b 0
