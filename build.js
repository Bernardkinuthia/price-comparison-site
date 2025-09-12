const fs = require('fs');
const path = require('path');
const https = require('https');

class StaticSiteGenerator {
    constructor() {
        this.productsData = [];
        this.priceData = [];
        this.csvUrl = 'https://raw.githubusercontent.com/Bernardkinuthia/price-comparison-site/main/product_names.csv';
        this.pricesUrl = 'https://raw.githubusercontent.com/Bernardkinuthia/price-comparison-site/main/prices.json';
        this.templatePath = './index-template.html';
        this.outputPath = './index.html';
    }

    // Enhanced fetchData with better error handling and debugging
    async fetchData(url) {
        console.log(`📡 Attempting to fetch: ${url}`);
        
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                timeout: 30000, // 30 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; StaticSiteBuilder/1.0)'
                }
            }, (res) => {
                console.log(`📡 Response status: ${res.statusCode} for ${url}`);
                console.log(`📡 Response headers:`, res.headers);
                
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage} for ${url}`));
                    return;
                }
                
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                    console.log(`📡 Received chunk, total size: ${data.length} bytes`);
                });
                
                res.on('end', () => {
                    console.log(`✅ Fetch completed, total size: ${data.length} bytes`);
                    console.log(`📝 First 200 chars: ${data.substring(0, 200)}`);
                    resolve(data);
                });
            });
            
            request.on('error', (error) => {
                console.error(`❌ Request error for ${url}:`, error);
                reject(error);
            });
            
            request.on('timeout', () => {
                console.error(`⏱️ Request timeout for ${url}`);
                request.destroy();
                reject(new Error(`Request timeout for ${url}`));
            });
        });
    }

    // Parse CSV data with enhanced logging
    parseCSVData(csvText) {
        console.log(`🔍 Parsing CSV data... (${csvText.length} characters)`);
        
        if (!csvText || csvText.trim().length === 0) {
            console.error('❌ CSV data is empty!');
            return;
        }
        
        const lines = csvText.trim().split('\n');
        console.log(`📊 Found ${lines.length} lines in CSV`);
        
        if (lines.length < 2) {
            console.error('❌ CSV has no data rows (only header or empty)');
            return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        console.log(`📋 Headers found:`, headers);
        
        this.productsData = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            try {
                const values = this.parseCSVLine(lines[i]);
                const product = {};
                
                headers.forEach((header, index) => {
                    product[header] = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
                });
                
                this.productsData.push(product);
                
                // Log first few products for debugging
                if (i <= 3) {
                    console.log(`🔍 Sample product ${i}:`, JSON.stringify(product, null, 2));
                }
                
            } catch (error) {
                console.error(`❌ Error parsing line ${i}:`, lines[i], error);
            }
        }
        
        console.log(`✅ Successfully parsed ${this.productsData.length} products from CSV`);
        
        if (this.productsData.length === 0) {
            console.error('❌ WARNING: No products were parsed!');
        }
    }

    // Parse CSV line with quote handling
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    // Update product prices from JSON with enhanced logging
    updateProductPrices(priceData) {
        console.log(`💰 Updating prices for ${this.productsData.length} products`);
        console.log(`💰 Price data contains ${priceData.length} entries`);
        
        let matchedCount = 0;
        let updatedCount = 0;
        
        this.productsData.forEach((product, index) => {
            const matchingPriceEntry = priceData.find(priceItem => 
                priceItem.link === product.link
            );
            
            if (matchingPriceEntry) {
                matchedCount++;
                console.log(`🔗 Match found for product ${index}: ${product.link}`);
                
                if (matchingPriceEntry.price && matchingPriceEntry.price !== "N/A") {
                    product.price = matchingPriceEntry.price;
                    product.last_updated = matchingPriceEntry.last_updated;
                    updatedCount++;
                    console.log(`💲 Updated price: ${matchingPriceEntry.price}`);
                }
            }
        });
        
        console.log(`✅ Price update complete: ${matchedCount} matched, ${updatedCount} updated`);
    }

    // Helper functions (keeping original implementations)
    determineProductType(wattage) {
        const watts = parseInt(wattage) || 0;
        if (watts <= 500) return 'small_wattage';
        if (watts <= 1500) return 'medium_wattage';
        return 'large_wattage';
    }

    formatPrice(price) {
        if (!price || price === '0' || price === '' || price === 'N/A') {
            return 'Price unavailable';
        }
        
        if (typeof price === 'string' && price.startsWith('$')) {
            return price;
        }
        
        const numPrice = parseFloat(price.toString().replace(/[$,]/g, ''));
        if (isNaN(numPrice) || numPrice <= 0) {
            return 'Price unavailable';
        }
        return '$' + numPrice.toFixed(2);
    }

    formatCapacity(capacity) {
        if (!capacity || capacity === '0') return '';
        return capacity.toString().includes('Wh') ? capacity : capacity + 'Wh';
    }

    formatFuelType(fuelType) {
        if (!fuelType) return 'N/A';
        return fuelType.charAt(0).toUpperCase() + fuelType.slice(1);
    }

    formatEngineType(engineType) {
        if (!engineType) return 'N/A';
        return engineType.charAt(0).toUpperCase() + engineType.slice(1);
    }

    formatCondition(condition) {
        if (!condition) return 'New';
        return condition.charAt(0).toUpperCase() + condition.slice(1);
    }

    formatAffiliateLink(product) {
        if (product.link && product.affiliate_url) {
            const displayText = product.affiliate_url.trim();
            return `<a href="${product.link}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
        }
        
        if (product.link) {
            return `<a href="${product.link}" target="_blank" rel="noopener noreferrer">${product.link}</a>`;
        }
        
        if (product.affiliate_url && product.affiliate_url.includes('<a href=')) {
            return product.affiliate_url;
        }
        
        return product.affiliate_url || 'N/A';
    }

    extractBrandFromLink(affiliateUrl) {
        if (!affiliateUrl) return 'other_brand';
        
        const brandMap = {
            'honda': 'honda',
            'yamaha': 'yamaha', 
            'generac': 'generac',
            'champion': 'champion',
            'westinghouse': 'westinghouse',
            'zerokor': 'zerokor',
            'ecoflow': 'ef_ecoflow',
            'bulleti': 'bulleti',
            'jackery': 'jackery',
            'anker': 'anker',
            'marbero': 'marbero',
            'oupes': 'oupes',
            'grecell': 'grecell',
            'allwei': 'allwei',
            'allpowers': 'allpowers',
            'pecron': 'pecron'
        };
        
        const textToCheck = affiliateUrl.toLowerCase();
        
        for (const [key, value] of Object.entries(brandMap)) {
            if (textToCheck.includes(key)) {
                return value;
            }
        }
        
        return 'other_brand';
    }

    calculatePricePerWatt(product) {
        const priceText = this.formatPrice(product.price);
        
        if (priceText === 'Price unavailable') {
            return 'N/A';
        }
        
        const price = parseFloat(priceText.replace(/[$,]/g, ''));
        const wattage = parseFloat(product.output_wattage || '0');
        
        if (wattage > 0 && !isNaN(price) && price > 0) {
            return '$' + (price / wattage).toFixed(2);
        }
        
        return 'N/A';
    }

    // Generate HTML table rows with enhanced logging
    generateTableRows() {
        console.log(`🏗️ Generating table rows for ${this.productsData.length} products`);
        
        if (this.productsData.length === 0) {
            console.error('❌ No products to generate rows for!');
            return '';
        }
        
        const rows = this.productsData.map((product, index) => {
            const brandFromLink = this.extractBrandFromLink(product.affiliate_url || product.link || '');
            
            const dataAttributes = [
                `data-product-key="${product.product_key || ''}"`,
                `data-product-type="${this.determineProductType(product.output_wattage)}"`,
                `data-condition="${(product.condition || 'new').toLowerCase()}"`,
                `data-capacity="${product.battery_capacity || '0'}"`,
                `data-wattage="${product.output_wattage || '0'}"`,
                `data-fuel-type="${(product.fuel_type || 'gasoline').toLowerCase().replace(' ', '_')}"`,
                `data-engine-type="${(product.engine_type || 'electric').toLowerCase().replace(' ', '_')}"`,
                `data-brand="${brandFromLink}"`
            ].join(' ');

            const cells = [
                this.formatPrice(product.price),
                this.calculatePricePerWatt(product),
                product.output_wattage || '0',
                this.formatCapacity(product.battery_capacity),
                this.formatFuelType(product.fuel_type),
                this.formatEngineType(product.engine_type),
                this.formatCondition(product.condition),
                this.formatAffiliateLink(product)
            ];

            const cellsHtml = cells.map((cellContent, index) => {
                if (index === 7) { // Last column (affiliate link)
                    return `<td class="name">${cellContent}</td>`;
                } else {
                    return `<td>${cellContent}</td>`;
                }
            }).join('');

            // Log first few rows for debugging
            if (index < 3) {
                console.log(`🔍 Sample row ${index}:`, cells);
            }

            return `<tr class="generator" ${dataAttributes}>${cellsHtml}</tr>`;
        });
        
        console.log(`✅ Generated ${rows.length} table rows`);
        return rows.join('\n                ');
    }

    // Generate statistics
    generateStats() {
        const now = new Date();
        const validPriceCount = this.productsData.filter(p => {
            const price = p.price;
            return price && price !== '0' && price !== '' && price !== 'N/A' && parseFloat(price.toString().replace(/[$,]/g, '')) > 0;
        }).length;
        
        const unavailableCount = this.productsData.length - validPriceCount;
        
        const stats = `Last updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()} | Showing ${this.productsData.length} products (${validPriceCount} with prices, ${unavailableCount} price unavailable)`;
        console.log(`📊 Generated stats: ${stats}`);
        return stats;
    }

    // Main build function with enhanced error handling
    async build() {
        console.log('🚀 Starting static site generation...');
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📁 Working directory: ${process.cwd()}`);
        console.log(`📂 Files in directory:`, fs.readdirSync('.').filter(f => !f.startsWith('.')));
        
        try {
            // Fetch CSV data
            console.log('📋 Fetching CSV data...');
            const csvText = await this.fetchData(this.csvUrl);
            
            if (!csvText || csvText.trim().length === 0) {
                throw new Error('CSV data is empty or null');
            }
            
            this.parseCSVData(csvText);
            
            if (this.productsData.length === 0) {
                throw new Error('No products were parsed from CSV data');
            }
            
            // Fetch price data
            console.log('💰 Fetching price data...');
            try {
                const priceText = await this.fetchData(this.pricesUrl);
                if (priceText && priceText.trim().length > 0) {
                    this.priceData = JSON.parse(priceText);
                    console.log(`💰 Parsed ${this.priceData.length} price entries`);
                    this.updateProductPrices(this.priceData);
                } else {
                    console.warn('⚠️ Price data is empty, using CSV prices only');
                }
            } catch (error) {
                console.warn('⚠️ Could not fetch/parse price data, using CSV prices:', error.message);
            }
            
            // Check template file
            console.log('📄 Checking HTML template...');
            if (!fs.existsSync(this.templatePath)) {
                throw new Error(`Template file not found: ${this.templatePath}`);
            }
            
            // Read template
            const template = fs.readFileSync(this.templatePath, 'utf8');
            console.log(`📄 Template loaded (${template.length} characters)`);
            
            if (template.length === 0) {
                throw new Error('Template file is empty');
            }
            
            // Generate table rows
            console.log('🏗️ Generating table rows...');
            const tableRows = this.generateTableRows();
            
            if (!tableRows || tableRows.trim().length === 0) {
                throw new Error('Generated table rows are empty');
            }
            
            // Generate stats
            const stats = this.generateStats();
            
            // Replace placeholders in template
            console.log('🔄 Replacing placeholders in template...');
            let finalHtml = template;
            
            // Check for required placeholders
            const requiredPlaceholders = ['{{TABLE_ROWS}}', '{{LAST_UPDATED_INFO}}', '{{PRODUCT_COUNT}}'];
            const missingPlaceholders = requiredPlaceholders.filter(placeholder => !template.includes(placeholder));
            
            if (missingPlaceholders.length > 0) {
                console.warn('⚠️ Missing placeholders in template:', missingPlaceholders);
            }
            
            finalHtml = finalHtml
                .replace('{{TABLE_ROWS}}', tableRows)
                .replace('{{LAST_UPDATED_INFO}}', stats)
                .replace('{{PRODUCT_COUNT}}', this.productsData.length.toString());
            
            console.log(`📏 Final HTML size: ${finalHtml.length} characters`);
            
            // Write output file
            console.log('💾 Writing output file...');
            fs.writeFileSync(this.outputPath, finalHtml);
            
            // Verify output file was created
            if (fs.existsSync(this.outputPath)) {
                const outputSize = fs.statSync(this.outputPath).size;
                console.log(`✅ Output file created successfully: ${this.outputPath} (${outputSize} bytes)`);
            } else {
                throw new Error('Output file was not created');
            }
            
            console.log(`🎉 Static site generated successfully!`);
            console.log(`📊 Generated ${this.productsData.length} product rows`);
            console.log(`📄 Output: ${this.outputPath}`);
            
        } catch (error) {
            console.error('❌ Build failed:', error);
            console.error('🔍 Error stack:', error.stack);
            
            // Create a minimal error page
            const errorHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Build Error</title>
</head>
<body>
    <h1>Build Error</h1>
    <p>The static site build failed: ${error.message}</p>
    <p>Check the build logs for more details.</p>
</body>
</html>`;
            
            try {
                fs.writeFileSync(this.outputPath, errorHtml);
                console.log('📄 Error page written to output file');
            } catch (writeError) {
                console.error('❌ Could not write error page:', writeError);
            }
            
            process.exit(1);
        }
    }
}

// Run the build
if (require.main === module) {
    const generator = new StaticSiteGenerator();
    generator.build();
}

module.exports = StaticSiteGenerator;
