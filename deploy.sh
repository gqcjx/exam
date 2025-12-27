#!/bin/bash

echo "========================================"
echo "Building project..."
echo "========================================"
npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "Build failed! Please fix the errors above."
    exit 1
fi

echo ""
echo "========================================"
echo "Build successful! Deploying to Netlify..."
echo "========================================"
netlify deploy --prod

if [ $? -ne 0 ]; then
    echo ""
    echo "Deployment failed! Please check the errors above."
    exit 1
fi

echo ""
echo "========================================"
echo "Deployment successful!"
echo "========================================"

