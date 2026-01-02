/**
 * Docusaurus plugin to remove Google Fonts imports from build output
 * This is necessary because Infima (the CSS framework) imports Inter from Google Fonts
 * We self-host Inter for privacy reasons
 */

const fs = require('fs');
const path = require('path');

module.exports = function removeGoogleFontsPlugin(context, options) {
    return {
        name: 'remove-google-fonts',

        async postBuild({ outDir }) {
            const cssDir = path.join(outDir, 'assets', 'css');

            if (!fs.existsSync(cssDir)) {
                return;
            }

            const files = fs.readdirSync(cssDir);

            for (const file of files) {
                if (file.endsWith('.css')) {
                    const filePath = path.join(cssDir, file);
                    let content = fs.readFileSync(filePath, 'utf8');

                    // Remove Google Fonts @import statements
                    const googleFontsRegex = /@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/gi;

                    if (googleFontsRegex.test(content)) {
                        content = content.replace(googleFontsRegex, '/* Google Fonts import removed - using self-hosted fonts */');
                        fs.writeFileSync(filePath, content);
                        console.log(`[remove-google-fonts] Removed Google Fonts import from ${file}`);
                    }
                }
            }
        },
    };
};
