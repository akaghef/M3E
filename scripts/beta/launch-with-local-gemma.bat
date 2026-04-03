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
set "M3E_DATA_DIR=%REPO_ROOT%\beta\data"

echo Launching Beta with local Gemma (provider=%M3E_AI_PROVIDER%, model=%M3E_AI_MODEL%)
npm --prefix beta start
set "EXIT_CODE=%ERRORLEVEL%"

popd
endlocal & exit /b %EXIT_CODE%
