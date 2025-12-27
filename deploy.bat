@echo off
echo ========================================
echo Building project...
echo ========================================
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo Build failed! Please fix the errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================
echo Build successful! Deploying to Netlify...
echo ========================================
call netlify deploy --prod

if %errorlevel% neq 0 (
    echo.
    echo Deployment failed! Please check the errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================
echo Deployment successful!
echo ========================================
pause

