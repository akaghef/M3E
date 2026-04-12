@echo off
setlocal

set "REPO_ROOT=%~dp0..\.."
pushd "%REPO_ROOT%" || exit /b 1

set "M3E_AI_ENABLED=1"
set "M3E_AI_PROVIDER=ollama"
set "M3E_AI_TRANSPORT=openai-compatible"
set "M3E_AI_BASE_URL=http://localhost:11434/v1"
set "M3E_AI_API_KEY=ollama"
set "M3E_AI_MODEL=gemma3:4b"
set "M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE=%REPO_ROOT%\beta\prompts\linear-agent\system.txt"
set "M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE=%REPO_ROOT%\beta\prompts\linear-agent\tree-to-linear.txt"
set "M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE=%REPO_ROOT%\beta\prompts\linear-agent\linear-to-tree.txt"
set "M3E_TOPIC_SUGGEST_PROMPT_FILE=%REPO_ROOT%\beta\prompts\topic-agent\topic-suggest.txt"
set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "M3E_SEED_DB_PATH=%M3E_HOME%\seeds\core-seed.sqlite"
set "M3E_DATA_DIR=%M3E_HOME%\workspaces\sandbox"
set "M3E_DB_FILE=data.sqlite"
set "M3E_DOC_ID=akaghef-beta"
set "M3E_WORKSPACE_ID=sandbox"
if not exist "%M3E_HOME%\seeds" mkdir "%M3E_HOME%\seeds" >nul 2>&1
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%" >nul 2>&1
if not exist "%M3E_SEED_DB_PATH%" if exist "%REPO_ROOT%\install\assets\seeds\core-seed.sqlite" copy /Y "%REPO_ROOT%\install\assets\seeds\core-seed.sqlite" "%M3E_SEED_DB_PATH%" >nul
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul

echo Launching Beta with local Gemma (provider=%M3E_AI_PROVIDER%, model=%M3E_AI_MODEL%)
npm --prefix beta start
set "EXIT_CODE=%ERRORLEVEL%"

popd
endlocal & exit /b %EXIT_CODE%
