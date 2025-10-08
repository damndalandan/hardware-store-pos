# MariaDB Deployment Script for POS System
# Run this script to set up the database

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "  MariaDB Deployment for Hardware Store POS System" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Step 1: Create Database and User
Write-Host "STEP 1: Creating Database and User" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Please enter your MariaDB root password when prompted..." -ForegroundColor Yellow
Write-Host ""

$sqlScript = @"
-- Create database
CREATE DATABASE IF NOT EXISTS pos_hardware_store
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS 'pos_user'@'localhost' 
  IDENTIFIED BY 'POS_Secure_2025!';

-- Grant privileges
GRANT ALL PRIVILEGES ON pos_hardware_store.* 
  TO 'pos_user'@'localhost';

FLUSH PRIVILEGES;

-- Verify
SELECT 'Database created successfully!' as status;
SHOW DATABASES LIKE 'pos_hardware_store';
"@

# Save SQL to temp file
$sqlScript | Out-File -FilePath ".\temp-setup.sql" -Encoding UTF8

# Execute SQL
try {
    Write-Host "Executing database setup..." -ForegroundColor Cyan
    Get-Content ".\temp-setup.sql" | mysql -u root -p
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Database and user created successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n✗ Failed to create database. Please check the error above." -ForegroundColor Red
        exit 1
    }
} finally {
    # Clean up temp file
    Remove-Item ".\temp-setup.sql" -ErrorAction SilentlyContinue
}

Write-Host ""

# Step 2: Verify Connection
Write-Host "STEP 2: Verifying Database Connection" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""

try {
    $testResult = mysql -u pos_user -p"POS_Secure_2025!" pos_hardware_store -e "SELECT 'Connection successful!' as status, DATABASE() as current_database;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully connected to database!" -ForegroundColor Green
        Write-Host $testResult
    } else {
        Write-Host "✗ Failed to connect with pos_user" -ForegroundColor Red
        Write-Host $testResult
        exit 1
    }
} catch {
    Write-Host "✗ Connection test failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Install Dependencies
Write-Host "STEP 3: Installing Node.js Dependencies" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# Step 4: Build TypeScript
Write-Host "STEP 4: Building TypeScript Code" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ TypeScript compilation failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ TypeScript compiled successfully!" -ForegroundColor Green
Write-Host ""

# Step 5: Run Database Migration
Write-Host "STEP 5: Running Database Migration" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""

node dist/database/migrate.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Migration failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Database tables created successfully!" -ForegroundColor Green
Write-Host ""

# Step 6: Seed Database (Optional)
Write-Host "STEP 6: Seeding Database with Sample Data" -ForegroundColor Green
Write-Host "---------------------------------------" -ForegroundColor Green
Write-Host ""

$seed = Read-Host "Do you want to seed the database with sample data? (Y/n)"

if ($seed -eq "" -or $seed -eq "Y" -or $seed -eq "y") {
    node dist/database/seed.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database seeded successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Default Admin Credentials:" -ForegroundColor Yellow
        Write-Host "  Username: admin" -ForegroundColor White
        Write-Host "  Password: admin123" -ForegroundColor White
    } else {
        Write-Host "✗ Seeding failed" -ForegroundColor Red
    }
} else {
    Write-Host "Skipping database seeding..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend is ready! To start the server, run:" -ForegroundColor Green
Write-Host "  npm run dev     (development mode)" -ForegroundColor White
Write-Host "  npm start       (production mode)" -ForegroundColor White
Write-Host ""
Write-Host "Database Details:" -ForegroundColor Yellow
Write-Host "  Database: pos_hardware_store" -ForegroundColor White
Write-Host "  User: pos_user" -ForegroundColor White
Write-Host "  Host: localhost:3306" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Start the backend: npm run dev" -ForegroundColor White
Write-Host "  2. Start the frontend: cd ../frontend && npm run dev" -ForegroundColor White
Write-Host "  3. Open browser: http://localhost:3000" -ForegroundColor White
Write-Host "  4. Login with admin credentials (if seeded)" -ForegroundColor White
Write-Host ""
