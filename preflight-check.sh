#!/bin/bash

# Pre-Flight Deployment Check Script
# Run this before deploying to production

echo "🚀 Pure App Weave - Pre-Deployment Check"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2 - File missing: $1"
        ((ERRORS++))
    fi
}

# Function to check if string exists in file
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${YELLOW}⚠${NC} $3"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓${NC} $3"
    fi
}

echo "📁 Checking Configuration Files..."
echo "-----------------------------------"
check_file "backend/.env.production" "Backend production environment file"
check_file ".env.production" "Frontend production environment file"
check_file "backend/Dockerfile" "Backend Dockerfile"
check_file "docker-compose.yml" "Docker Compose configuration"
check_file "ecosystem.config.cjs" "PM2 ecosystem configuration"
check_file "netlify.toml" "Netlify configuration"
check_file "vercel.json" "Vercel configuration"
echo ""

echo "🔐 Checking Environment Variables..."
echo "-------------------------------------"
if [ -f "backend/.env.production" ]; then
    check_content "backend/.env.production" "CHANGE_THIS_TO" "Backend JWT_SECRET is set to production value"
    check_content "backend/.env.production" "your-mongodb" "Backend MongoDB URI is configured"
    check_content "backend/.env.production" "your-domain" "Backend allowed origins configured"
else
    echo -e "${RED}✗${NC} Cannot check backend environment variables - file missing"
    ((ERRORS++))
fi

if [ -f ".env.production" ]; then
    check_content ".env.production" "your-backend-domain" "Frontend API URL is configured"
else
    echo -e "${RED}✗${NC} Cannot check frontend environment variables - file missing"
    ((ERRORS++))
fi
echo ""

echo "📦 Checking Dependencies..."
echo "---------------------------"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Frontend dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Frontend dependencies not installed - run: npm install"
    ((WARNINGS++))
fi

if [ -d "backend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Backend dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Backend dependencies not installed - run: cd backend && npm install"
    ((WARNINGS++))
fi
echo ""

echo "🏗️  Testing Build Process..."
echo "-----------------------------"
echo "Building frontend..."
if npm run build:prod > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend builds successfully"
else
    echo -e "${RED}✗${NC} Frontend build failed - check npm run build:prod"
    ((ERRORS++))
fi
echo ""

echo "🔍 Checking Git Status..."
echo "-------------------------"
if [ -d ".git" ]; then
    # Check for uncommitted changes
    if [[ -z $(git status -s) ]]; then
        echo -e "${GREEN}✓${NC} No uncommitted changes"
    else
        echo -e "${YELLOW}⚠${NC} You have uncommitted changes"
        ((WARNINGS++))
    fi
    
    # Check for .env files in git
    if git ls-files | grep -q "\.env$"; then
        echo -e "${RED}✗${NC} .env files are tracked in Git - remove them!"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓${NC} Environment files not tracked in Git"
    fi
else
    echo -e "${YELLOW}⚠${NC} Not a Git repository"
    ((WARNINGS++))
fi
echo ""

echo "🧪 Checking Backend Health..."
echo "------------------------------"
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend is running and responding"
else
    echo -e "${YELLOW}⚠${NC} Backend is not running on localhost:5000"
    echo "  This is OK if testing remotely, but verify backend works before deploying"
    ((WARNINGS++))
fi
echo ""

echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠ Minor warnings found. Review before deploying.${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ Errors found! Fix these before deploying.${NC}"
    exit 1
fi
