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

    // Fetch data from URL
    async fetchData(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    // Parse CSV data
    parseCSVData(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        this.productsData = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = this.parseCSVLine(lines[i]);
            const product = {};
            
            headers.forEach((header, index) => {
                product[header] = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
            });
            
            this.productsData.push(product);
        }
        
        console.log(`Parsed ${this.productsData.length} products from CSV`);
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

    // Update product prices from JSON
    updateProductPrices(priceData) {
        console.log('Updating prices for', this.productsData.length, 'products');
        let matchedCount = 0;
        let updatedCount = 0;
        
        this.productsData.forEach((product, index) => {
            const matchingPriceEntry = priceData.find(priceItem => 
                priceItem.link === product.link
            );
            
            if (matchingPriceEntry) {
                matchedCount++;
                
                if (matchingPriceEntry.price && matchingPriceEntry.price !== "N/A") {
                    product.price = matchingPriceEntry.price;
                    product.last_updated = matchingPriceEntry.last_updated;
                    updatedCount++;
                }
            }
        });
        
        console.log(`Price update complete: ${matchedCount} matched, ${updatedCount} updated`);
    }

    // Helper functions
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

    // Generate HTML table rows
    generateTableRows() {
        return this.productsData.map(product => {
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

            return `<tr class="generator" ${dataAttributes}>${cellsHtml}</tr>`;
        }).join('\n                ');
    }

    // Generate statistics
    generateStats() {
        const now = new Date();
        const validPriceCount = this.productsData.filter(p => {
            const price = p.price;
            return price && price !== '0' && price !== '' && price !== 'N/A' && parseFloat(price.toString().replace(/[$,]/g, '')) > 0;
        }).length;
        
        const unavailableCount = this.productsData.length - validPriceCount;
        
        return `Last updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()} | Showing ${this.productsData.length} products (${validPriceCount} with prices, ${unavailableCount} price unavailable)`;
    }

    // Main build function
    async build() {
        console.log('Starting static site generation...');
        
        try {
            // Fetch CSV data
            console.log('Fetching CSV data...');
            const csvText = await this.fetchData(this.csvUrl);
            this.parseCSVData(csvText);
            
            // Fetch price data
            console.log('Fetching price data...');
            try {
                const priceText = await this.fetchData(this.pricesUrl);
                this.priceData = JSON.parse(priceText);
                this.updateProductPrices(this.priceData);
            } catch (error) {
                console.warn('Could not fetch price data, using CSV prices:', error.message);
            }
            
            // Read template
            console.log('Reading HTML template...');
            const template = fs.readFileSync(this.templatePath, 'utf8');
            
            // Generate table rows
            console.log('Generating table rows...');
            const tableRows = this.generateTableRows();
            
            // Generate stats
            const stats = this.generateStats();
            
            // Replace placeholders in template
            const finalHtml = template
                .replace('{{TABLE_ROWS}}', tableRows)
                .replace('{{LAST_UPDATED_INFO}}', stats)
                .replace('{{PRODUCT_COUNT}}', this.productsData.length.toString());
            
            // Write output file
            console.log('Writing output file...');
            fs.writeFileSync(this.outputPath, finalHtml);
            
            console.log(`✅ Static site generated successfully!`);
            console.log(`📊 Generated ${this.productsData.length} product rows`);
            console.log(`📄 Output: ${this.outputPath}`);
            
        } catch (error) {
            console.error('❌ Build failed:', error);
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
