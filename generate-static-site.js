const fs = require('fs');
const path = require('path');

async function generateStaticSite() {
    try {
        console.log('🚀 Starting static site generation...');
        
        // Ensure products.json exists with fallback
        let productsData = [];
        if (fs.existsSync('products.json')) {
            try {
                const rawData = fs.readFileSync('products.json', 'utf8');
                if (rawData.trim()) {
                    productsData = JSON.parse(rawData);
                    if (!Array.isArray(productsData)) {
                        console.warn('products.json is not an array, converting to empty array');
                        productsData = [];
                    }
                } else {
                    console.warn('products.json is empty, using empty array');
                    productsData = [];
                }
            } catch (parseError) {
                console.error('Error parsing products.json:', parseError.message);
                console.log('Creating empty products array as fallback');
                productsData = [];
            }
        } else {
            console.warn('products.json not found, creating empty array');
            productsData = [];
            // Create empty file for future runs
            fs.writeFileSync('products.json', JSON.stringify([], null, 2));
        }
        
        console.log(`📦 Loaded ${productsData.length} products from JSON`);
        
        // Check template file
        if (!fs.existsSync('index-template.html')) {
            console.error('❌ index-template.html not found');
            console.log('Please ensure you have renamed your index.html to index-template.html');
            process.exit(1);
        }
        
        // Read HTML template
        let htmlTemplate = fs.readFileSync('index-template.html', 'utf8');
        console.log('✅ Template loaded successfully');
        
        // Helper function to determine product type based on wattage
        function getProductType(runningWattage) {
            const watts = parseFloat(runningWattage) || 0;
            if (watts <= 500) return 'small_wattage';
            if (watts <= 1500) return 'medium_wattage';
            return 'large_wattage';
        }
        
        // Helper function to extract and normalize brand names from product title
        function extractAndNormalizeBrand(productTitle) {
            if (!productTitle) return 'other_brand';
            
            const title = productTitle.toLowerCase();
            
            // Check for brand names in the product title
            const brandChecks = [
                { keywords: ['honda'], brand: 'honda' },
                { keywords: ['yamaha'], brand: 'yamaha' },
                { keywords: ['generac'], brand: 'generac' },
                { keywords: ['champion'], brand: 'champion' },
                { keywords: ['westinghouse'], brand: 'westinghouse' },
                { keywords: ['zerokor'], brand: 'zerokor' },
                { keywords: ['ef ecoflow', 'ecoflow'], brand: 'ef_ecoflow' },
                { keywords: ['bluetti'], brand: 'bulleti' },
                { keywords: ['jackery'], brand: 'jackery' },
                { keywords: ['anker'], brand: 'anker' },
                { keywords: ['marbero'], brand: 'marbero' },
                { keywords: ['oupes'], brand: 'oupes' },
                { keywords: ['grecell'], brand: 'grecell' },
                { keywords: ['allwei'], brand: 'allwei' },
                { keywords: ['allpowers'], brand: 'allpowers' },
                { keywords: ['pecron'], brand: 'pecron' },
                { keywords: ['dji'], brand: 'other_brand' },
                { keywords: ['litheli'], brand: 'other_brand' }
            ];
            
            for (const check of brandChecks) {
                if (check.keywords.some(keyword => title.includes(keyword))) {
                    return check.brand;
                }
            }
            
            return 'other_brand';
        }
        
        // Helper function to normalize fuel type
        function normalizeFuelType(fuelType) {
            if (!fuelType) return 'gasoline';
            
            const fuel = fuelType.toLowerCase().trim();
            
            const fuelMap = {
                'gasoline': 'gasoline',
                'gas': 'gasoline',
                'diesel': 'diesel',
                'propane': 'propane',
                'dual fuel': 'dual_fuel',
                'dual-fuel': 'dual_fuel',
                'tri fuel': 'tri_fuel',
                'tri-fuel': 'tri_fuel',
                'solar': 'solar',
                'battery': 'battery',
                'electric': 'battery'
            };
            
            return fuelMap[fuel] || 'gasoline';
        }
        
        // Generate table rows
        let tbodyHtml = '';
        let successfulPrices = 0;
        
        productsData.forEach((product, index) => {
            if (!product || typeof product !== 'object') {
                console.warn(`Skipping invalid product at index ${index}`);
                return;
            }
            
            // Extract and clean price data
            let price = 'N/A';
            let pricePerWatt = 'N/A';
            let dataPrice = '0';
            
            if (product.price) {
                let priceValue = 0;
                
                if (typeof product.price === 'string') {
                    priceValue = parseFloat(product.price.replace(/[^\d.]/g, ''));
                    price = product.price.startsWith('$') ? product.price : `$${priceValue.toFixed(2)}`;
                } else if (typeof product.price === 'number') {
                    priceValue = product.price;
                    price = `$${priceValue.toFixed(2)}`;
                } else if (product.price_amount && typeof product.price_amount === 'number') {
                    priceValue = product.price_amount;
                    price = `$${priceValue.toFixed(2)}`;
                }
                
                if (priceValue > 0) {
                    // Calculate price per watt
                    const runningWattage = parseFloat(product.running_wattage || 0);
                    if (runningWattage > 0) {
                        const pricePerWattValue = priceValue / runningWattage;
                        pricePerWatt = `$${pricePerWattValue.toFixed(3)}`;
                    }
                    dataPrice = priceValue.toString();
                    successfulPrices++;
                    console.log(`✅ ${product.asin || `Product ${index + 1}`}: ${price}`);
                } else {
                    console.log(`⚠️  ${product.asin || `Product ${index + 1}`}: Invalid price value`);
                }
            } else {
                console.log(`❌ ${product.asin || `Product ${index + 1}`}: No price data`);
            }
            
            // Clean and format product data with fallbacks
            const runningWatts = parseFloat(product.running_wattage) || 0;
            const startingWatts = parseFloat(product.starting_wattage) || 0;
            const runTime = parseFloat(product.run_time) || 0;
            const fuelType = product.fuel_type || 'gasoline';
            const capacity = parseFloat(product.capacity) || 0;
            const weight = parseFloat(product.weight) || 0;
            const linkText = product.link_text || 'View Product';
            const affiliateLink = product.affiliate_link || '#';
            const productKey = product.asin || `product-${index}`;
            
            // Extract brand from product title (link text)
            const extractedBrand = extractAndNormalizeBrand(linkText);
            
            // Normalize data for filters
            const normalizedFuelType = normalizeFuelType(fuelType);
            const productType = getProductType(runningWatts);
            
            // Format display values
            const displayRunningWatts = runningWatts > 0 ? runningWatts : 'N/A';
            const displayStartingWatts = startingWatts > 0 ? startingWatts : 'N/A';
            const displayRunTime = runTime > 0 ? runTime : 'N/A';
            const displayCapacity = capacity > 0 ? capacity : 'N/A';
            const displayWeight = weight > 0 ? weight : 'N/A';
            
            // Generate table row with ALL required data attributes for filtering
            tbodyHtml += `
                    <tr class="generator" 
                        data-product-key="${productKey}" 
                        data-running-wattage="${runningWatts}" 
                        data-starting-wattage="${startingWatts}" 
                        data-capacity="${capacity}" 
                        data-fuel-type="${normalizedFuelType}" 
                        data-weight="${weight}" 
                        data-price="${dataPrice}"
                        data-brand="${extractedBrand}"
                        data-product-type="${productType}"
                        data-run-time="${runTime}">
                        <td class="price">${price}</td>
                        <td class="price-per-watt">${pricePerWatt}</td>
                        <td>${displayRunningWatts}</td>
                        <td>${displayStartingWatts}</td>
                        <td>${displayRunTime}</td>
                        <td>${fuelType}</td>
                        <td>${displayCapacity}</td>
                        <td>${displayWeight}</td>
                        <td class="name"><a href="${affiliateLink}" target="_blank" rel="noopener noreferrer">${linkText}</a></td>
                    </tr>`;
        });
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productsData.length} products`);
        
        // Update tbody content in template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, 
                `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️  Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp
        let timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        
        // Try to get timestamp from most recent product
        const productWithTimestamp = productsData
            .filter(p => p && (p.timestamp || p.last_updated))
            .sort((a, b) => new Date(b.timestamp || b.last_updated) - new Date(a.timestamp || a.last_updated))[0];
            
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        // Update timestamp in HTML
        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove old dynamic price fetching scripts (both Amazon and generic)
        const scriptPatterns = [
            // Amazon-specific patterns
            /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?amazon[\s\S]*?<\/script>/i,
            /<script>[\s\S]*?ProductAdvertising[\s\S]*?<\/script>/,
            /<script>[\s\S]*?paapi[\s\S]*?<\/script>/,
            /<script>[\s\S]*?aws[\s\S]*?<\/script>/,
            // Generic dynamic fetching patterns
            /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/,
            /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/,
            // Any script that mentions API keys or dynamic loading
            /<script>[\s\S]*?(api_key|API_KEY|apikey)[\s\S]*?<\/script>/i
        ];
        
        scriptPatterns.forEach((pattern, index) => {
            if (htmlTemplate.match(pattern)) {
                htmlTemplate = htmlTemplate.replace(pattern, '');
                console.log(`✅ Removed old dynamic script (pattern ${index + 1})`);
            }
        });
        
        // Add comment indicating static generation
        const staticComment = `
<!-- 
    This page was statically generated with EcommerceAPI data.
    All prices are embedded directly in the HTML for optimal performance.
    Last updated: ${timestamp}
-->
`;
        
        // Insert comment before closing head tag
        htmlTemplate = htmlTemplate.replace('</head>', `${staticComment}</head>`);
        
        // Write final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('🎉 Static site generated successfully!');
        console.log(`📊 Summary:`);
        console.log(`   • Total products: ${productsData.length}`);
        console.log(`   • Products with prices: ${successfulPrices}`);
        console.log(`   • Success rate: ${productsData.length > 0 ? (successfulPrices/productsData.length*100).toFixed(1) : 0}%`);
        console.log(`   • Last updated: ${timestamp}`);
        console.log(`   • File size: ${(fs.statSync('index.html').size / 1024).toFixed(1)} KB`);
        console.log(`   • Data source: EcommerceAPI`);
        
        return {
            success: true,
            totalProducts: productsData.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Create minimal fallback HTML if possible
        try {
            if (fs.existsSync('index-template.html')) {
                let fallbackHtml = fs.readFileSync('index-template.html', 'utf8');
                
                // Clear tbody and add error message
                fallbackHtml = fallbackHtml.replace(
                    /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/,
                    '<tbody id="powerprices-body" lang="en"><tr><td colspan="9">Error loading product data from EcommerceAPI. Please check the logs.</td></tr></tbody>'
                );
                
                // Update timestamp
                const errorTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
                fallbackHtml = fallbackHtml.replace(
                    /<span id="update-timestamp">.*?<\/span>/,
                    `<span id="update-timestamp">${errorTime}</span>`
                );
                
                // Update product count
                fallbackHtml = fallbackHtml.replace(
                    /<span id="product-count">\d*<\/span>/,
                    '<span id="product-count">0</span>'
                );
                
                fs.writeFileSync('index.html', fallbackHtml);
                console.log('📄 Created fallback index.html');
            }
        } catch (fallbackError) {
            console.error('Failed to create fallback HTML:', fallbackError.message);
        }
        
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite;
