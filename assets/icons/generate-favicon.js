#!/usr/bin/env node

/**
 * Favicon Generator Script for Sigilweaver
 * 
 * This script converts the SVG logo to various favicon formats:
 * - favicon.ico (16x16, 32x32, 48x48 multi-resolution)
 * - apple-touch-icon.png (180x180)
 * - icon-192.png (192x192 for PWA)
 * - icon-512.png (512x512 for PWA)
 * 
 * Usage: node generate-favicon.js
 * 
 * Requirements:
 * - npm install sharp svg2png-many
 */

const fs = require('fs').promises;
const path = require('path');

// Try to use sharp for conversion (install with: npm install sharp)
async function generateFavicons() {
    console.log('🎨 Generating favicons from SVG logo...');
    
    try {
        // Check if sharp is available
        const sharp = require('sharp');
        
        const svgPath = path.join(__dirname, 'assets', 'sigilweaver-logo.svg');
        const svgBuffer = await fs.readFile(svgPath);
        
        // Generate different sizes
        const sizes = [
            { size: 16, name: 'favicon-16x16.png' },
            { size: 32, name: 'favicon-32x32.png' },
            { size: 48, name: 'favicon-48x48.png' },
            { size: 180, name: 'apple-touch-icon.png' },
            { size: 192, name: 'icon-192.png' },
            { size: 512, name: 'icon-512.png' }
        ];
        
        console.log('📐 Generating PNG files...');
        for (const { size, name } of sizes) {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(path.join(__dirname, 'assets', name));
            console.log(`  ✅ Generated ${name} (${size}x${size})`);
        }
        
        // Create ICO file from multiple PNGs
        console.log('🔨 Creating favicon.ico...');
        await createIcoFile();
        
        console.log('✨ All favicons generated successfully!');
        console.log('\n📋 Don\'t forget to add these to your HTML:');
        console.log('   <link rel="icon" type="image/x-icon" href="/assets/icons/favicon.ico">');
        console.log('   <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png">');
        console.log('   <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png">');
        console.log('   <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">');
        
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log('⚠️  Sharp not found. Installing dependencies...');
            await installDependencies();
        } else {
            console.error('❌ Error generating favicons:', error.message);
            await fallbackGeneration();
        }
    }
}

async function createIcoFile() {
    try {
        // Try to use png-to-ico for better ICO generation
        const pngToIco = require('png-to-ico');
        
        const sizes = [16, 32, 48];
        const buffers = [];
        
        for (const size of sizes) {
            const pngPath = path.join(__dirname, 'assets', `favicon-${size}x${size}.png`);
            buffers.push(await fs.readFile(pngPath));
        }
        
        const icoBuffer = await pngToIco(buffers);
        await fs.writeFile(path.join(__dirname, 'assets', 'favicon.ico'), icoBuffer);
        console.log('  ✅ Generated favicon.ico (16x16, 32x32, 48x48)');
        
    } catch (error) {
        console.log('  ⚠️  png-to-ico not available, using 32x32 PNG as ICO fallback');
        // Fallback: copy 32x32 PNG as ICO
        const png32 = await fs.readFile(path.join(__dirname, 'assets', 'favicon-32x32.png'));
        await fs.writeFile(path.join(__dirname, 'assets', 'favicon.ico'), png32);
        console.log('  ✅ Generated favicon.ico (32x32 fallback)');
    }
}

async function installDependencies() {
    const { spawn } = require('child_process');
    
    console.log('📦 Installing required dependencies...');
    
    return new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install', 'sharp', 'png-to-ico'], {
            stdio: 'inherit',
            cwd: __dirname
        });
        
        npm.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Dependencies installed successfully!');
                console.log('🔄 Re-running favicon generation...');
                generateFavicons().then(resolve).catch(reject);
            } else {
                console.log('❌ Failed to install dependencies. Trying fallback method...');
                fallbackGeneration().then(resolve).catch(reject);
            }
        });
    });
}

async function fallbackGeneration() {
    console.log('🛠️  Using fallback method (requires ImageMagick or manual conversion)');
    console.log('\n💡 Manual generation options:');
    console.log('');
    console.log('Option 1 - Using ImageMagick (if installed):');
    console.log('  convert assets/icons/sigilweaver-logo.svg -resize 16x16 assets/icons/favicon-16x16.png');
    console.log('  convert assets/icons/sigilweaver-logo.svg -resize 32x32 assets/icons/favicon-32x32.png');
    console.log('  convert assets/icons/sigilweaver-logo.svg -resize 48x48 assets/icons/favicon-48x48.png');
    console.log('  convert assets/icons/favicon-16x16.png assets/icons/favicon-32x32.png assets/icons/favicon-48x48.png assets/icons/favicon.ico');
    console.log('');
    console.log('Option 2 - Online tools:');
    console.log('  • Upload assets/icons/sigilweaver-logo.svg to https://realfavicongenerator.net/');
    console.log('  • Or use https://favicon.io/favicon-converter/');
    console.log('');
    console.log('Option 3 - Install dependencies manually:');
    console.log('  npm install sharp png-to-ico');
    console.log('  node generate-favicon.js');
}

// Create package.json if it doesn't exist
async function ensurePackageJson() {
    const packagePath = path.join(__dirname, 'package.json');
    
    try {
        await fs.access(packagePath);
    } catch (error) {
        console.log('📄 Creating package.json...');
        const packageJson = {
            "name": "sigilweaver-website",
            "version": "1.0.0",
            "description": "Sigilweaver website favicon generation",
            "scripts": {
                "generate-favicon": "node generate-favicon.js"
            },
            "devDependencies": {
                "sharp": "^0.32.0",
                "png-to-ico": "^2.1.8"
            }
        };
        
        await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
        console.log('✅ Created package.json');
    }
}

// Main execution
async function main() {
    console.log('🎭 Sigilweaver Favicon Generator');
    console.log('================================\n');
    
    await ensurePackageJson();
    await generateFavicons();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateFavicons };
