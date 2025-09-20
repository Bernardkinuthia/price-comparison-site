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
            const runningWatts = product.running_wattage || 'N/A';
            const startingWatts = product.starting_wattage || 'N/A';
            const runTime = product.run_time || 'N/A';
            const fuelType = product.fuel_type || 'N/A';
            const capacity = product.capacity || 'N/A';
            const weight = product.weight || 'N/A';
            const linkText = product.link_text || 'View Product';
            const affiliateLink = product.affiliate_link || '#';
            const productKey = product.asin || `product-${index}`;
            
            // Generate table row with clickable affiliate link
            tbodyHtml += `
                    <tr class="generator" data-product-key="${productKey}" data-running-wattage="${runningWatts}" data-starting-wattage="${startingWatts}" data-capacity="${capacity}" data-fuel-type="${fuelType}" data-weight="${weight}" data-price="${dataPrice}">
                        <td class="price">${price}</td>
                        <td class="price-per-watt">${pricePerWatt}</td>
                        <td class="running-watts">${runningWatts}</td>
                        <td class="starting-watts">${startingWatts}</td>
                        <td class="run-time">${runTime}</td>
                        <td class="fuel-type">${fuelType}</td>
                        <td class="capacity">${capacity}</td>
                        <td class="weight">${weight}</td>
                        <td class="affiliate-link"><a href="${affiliateLink}" target="_blank" rel="noopener noreferrer nofollow">${linkText}</a></td>
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
                console.log('🔄 Created fallback index.html');
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
