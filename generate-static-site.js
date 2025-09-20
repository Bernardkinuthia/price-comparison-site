// generate-static-site.js
const fs = require('fs');
const path = require('path');

async function generateStaticSite() {
    try {
        console.log('🚀 Starting static site generation...');
        
        // Check if products.json exists
        if (!fs.existsSync('products.json')) {
            console.warn('⚠️ products.json not found, creating empty data structure');
            const emptyData = [];
            fs.writeFileSync('products.json', JSON.stringify(emptyData, null, 2));
        }
        
        // Check if template exists
        if (!fs.existsSync('index-template.html')) {
            console.error('❌ index-template.html not found');
            console.log('📝 Please ensure you have renamed your index.html to index-template.html');
            process.exit(1);
        }
        
        // Read the products JSON data (now expecting array format)
        const productsData = JSON.parse(fs.readFileSync('products.json', 'utf8'));
        console.log(`📊 Loaded ${productsData.length || 0} products from JSON`);
        
        // Display sample product structure for debugging
        if (productsData.length > 0) {
            console.log('📋 Sample product structure:');
            const sample = productsData[0];
            Object.keys(sample).forEach(key => {
                console.log(`  ${key}: ${sample[key]}`);
            });
        }
        
        // Read the HTML template
        let htmlTemplate = fs.readFileSync('index-template.html', 'utf8');
        console.log('📄 Template loaded successfully');
        
        console.log(`🏗️ Processing ${productsData.length} products from scraper output...`);
        
        // Generate rows with actual price data from the scraper structure
        let tbodyHtml = '';
        let successfulPrices = 0;
        
        // Process products directly from the JSON array (scraper output structure)
        productsData.forEach((product, index) => {
            if (!product) return;
            
            let price = 'N/A';
            let pricePerWatt = 'N/A';
            let dataPrice = '0';
            
            // Extract price from scraper structure
            if (product.price) {
                let priceValue = 0;
                if (typeof product.price === 'string') {
                    // If price is a string like "$123.45", extract the number
                    priceValue = parseFloat(product.price.replace(/[^\d.]/g, ''));
                    price = product.price.startsWith('
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productsData.length} products`);
        
        // Replace the tbody content in the template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️ Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp - try to get from first product that has one, or use current time
        let timestamp = 'Unknown';
        const productWithTimestamp = productsData.find(p => p.timestamp || p.last_updated);
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } else {
            // Fallback to current time
            const now = new Date();
            timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove the old dynamic price fetching script that expects the old JSON structure
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed old dynamic price fetching script');
        } else {
            // Fallback: look for any fetch script that might be using the old structure
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed old dynamic price fetching script (fallback)');
            }
        }
        
        // Write the final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('✅ Static site generated successfully!');
        console.log(`📊 Updated ${successfulPrices} out of ${productsData.length} products with current prices`);
        console.log(`🕒 Last updated: ${timestamp}`);
        console.log(`📄 Generated index.html (${fs.statSync('index.html').size} bytes)`);
        
        return {
            success: true,
            totalProducts: productsData.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generator
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite;) ? product.price : '
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productRows.length} products`);
        
        // Replace the tbody content in the template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️ Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp - try to get from first product that has one, or use current time
        let timestamp = 'Unknown';
        const productWithTimestamp = productsData.find(p => p.timestamp || p.last_updated);
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } else {
            // Fallback to current time
            const now = new Date();
            timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove the old dynamic price fetching script that expects the old JSON structure
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed old dynamic price fetching script');
        } else {
            // Fallback: look for any fetch script that might be using the old structure
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed old dynamic price fetching script (fallback)');
            }
        }
        
        // Write the final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('✅ Static site generated successfully!');
        console.log(`📊 Updated ${successfulPrices} out of ${productRows.length} products with current prices`);
        console.log(`🕒 Last updated: ${timestamp}`);
        console.log(`📄 Generated index.html (${fs.statSync('index.html').size} bytes)`);
        
        return {
            success: true,
            totalProducts: productRows.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generator
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite; + priceValue.toFixed(2);
                } else if (typeof product.price === 'number') {
                    // If price is already a number
                    priceValue = product.price;
                    price = '
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productRows.length} products`);
        
        // Replace the tbody content in the template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️ Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp - try to get from first product that has one, or use current time
        let timestamp = 'Unknown';
        const productWithTimestamp = productsData.find(p => p.timestamp || p.last_updated);
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } else {
            // Fallback to current time
            const now = new Date();
            timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove the old dynamic price fetching script that expects the old JSON structure
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed old dynamic price fetching script');
        } else {
            // Fallback: look for any fetch script that might be using the old structure
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed old dynamic price fetching script (fallback)');
            }
        }
        
        // Write the final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('✅ Static site generated successfully!');
        console.log(`📊 Updated ${successfulPrices} out of ${productRows.length} products with current prices`);
        console.log(`🕒 Last updated: ${timestamp}`);
        console.log(`📄 Generated index.html (${fs.statSync('index.html').size} bytes)`);
        
        return {
            success: true,
            totalProducts: productRows.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generator
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite; + priceValue.toFixed(2);
                } else if (product.price_amount && typeof product.price_amount === 'number') {
                    // Fallback to price_amount if available
                    priceValue = product.price_amount;
                    price = '
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productRows.length} products`);
        
        // Replace the tbody content in the template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️ Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp - try to get from first product that has one, or use current time
        let timestamp = 'Unknown';
        const productWithTimestamp = productsData.find(p => p.timestamp || p.last_updated);
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } else {
            // Fallback to current time
            const now = new Date();
            timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove the old dynamic price fetching script that expects the old JSON structure
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed old dynamic price fetching script');
        } else {
            // Fallback: look for any fetch script that might be using the old structure
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed old dynamic price fetching script (fallback)');
            }
        }
        
        // Write the final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('✅ Static site generated successfully!');
        console.log(`📊 Updated ${successfulPrices} out of ${productRows.length} products with current prices`);
        console.log(`🕒 Last updated: ${timestamp}`);
        console.log(`📄 Generated index.html (${fs.statSync('index.html').size} bytes)`);
        
        return {
            success: true,
            totalProducts: productRows.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generator
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite; + priceValue.toFixed(2);
                }
                
                if (priceValue > 0) {
                    // Calculate price per watt using running_wattage
                    const runningWattage = parseFloat(product.running_wattage);
                    if (runningWattage && runningWattage > 0) {
                        const pricePerWattValue = priceValue / runningWattage;
                        pricePerWatt = '
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productRows.length} products`);
        
        // Replace the tbody content in the template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️ Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp - try to get from first product that has one, or use current time
        let timestamp = 'Unknown';
        const productWithTimestamp = productsData.find(p => p.timestamp || p.last_updated);
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } else {
            // Fallback to current time
            const now = new Date();
            timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove the old dynamic price fetching script that expects the old JSON structure
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed old dynamic price fetching script');
        } else {
            // Fallback: look for any fetch script that might be using the old structure
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed old dynamic price fetching script (fallback)');
            }
        }
        
        // Write the final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('✅ Static site generated successfully!');
        console.log(`📊 Updated ${successfulPrices} out of ${productRows.length} products with current prices`);
        console.log(`🕒 Last updated: ${timestamp}`);
        console.log(`📄 Generated index.html (${fs.statSync('index.html').size} bytes)`);
        
        return {
            success: true,
            totalProducts: productRows.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generator
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite; + pricePerWattValue.toFixed(3);
                    }
                    dataPrice = priceValue.toString();
                    successfulPrices++;
                    console.log(`✅ ${product.asin || index}: ${price}`);
                } else {
                    console.log(`⚠️ ${product.asin || index}: Invalid price value - ${product.price}`);
                }
            } else {
                console.log(`❌ ${product.asin || index}: No price data found`);
            }
            
            // Clean and format the data from scraper output
            const runningWatts = product.running_wattage || 'N/A';
            const startingWatts = product.starting_wattage || 'N/A';
            const runTime = product.run_time || 'N/A';
            const fuelType = product.fuel_type || 'N/A';
            const capacity = product.capacity || 'N/A';
            const weight = product.weight || 'N/A';
            const linkText = product.link_text || 'View Product';
            const affiliateLink = product.affiliate_link || '#';
            
            // Generate unique key for data attributes
            const productKey = product.asin || `product-${index}`;
            
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
                        <td class="affiliate-link"><a href="${affiliateLink}" target="_blank" rel="noopener noreferrer">${linkText}</a></td>
                    </tr>`;
        });
        
        console.log(`💰 Found prices for ${successfulPrices} out of ${productRows.length} products`);
        
        // Replace the tbody content in the template
        const tbodyRegex = /<tbody id="powerprices-body" lang="en">[\s\S]*?<\/tbody>/;
        if (htmlTemplate.match(tbodyRegex)) {
            htmlTemplate = htmlTemplate.replace(tbodyRegex, `<tbody id="powerprices-body" lang="en">${tbodyHtml}
                </tbody>`);
            console.log('✅ Updated tbody content');
        } else {
            console.warn('⚠️ Could not find tbody with id="powerprices-body" in template');
        }
        
        // Update timestamp - try to get from first product that has one, or use current time
        let timestamp = 'Unknown';
        const productWithTimestamp = productsData.find(p => p.timestamp || p.last_updated);
        if (productWithTimestamp) {
            const updateTime = new Date(productWithTimestamp.timestamp || productWithTimestamp.last_updated);
            timestamp = updateTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } else {
            // Fallback to current time
            const now = new Date();
            timestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        }

        htmlTemplate = htmlTemplate.replace(
            /<span id="update-timestamp">.*?<\/span>/,
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove the old dynamic price fetching script that expects the old JSON structure
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed old dynamic price fetching script');
        } else {
            // Fallback: look for any fetch script that might be using the old structure
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[^']*products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed old dynamic price fetching script (fallback)');
            }
        }
        
        // Write the final HTML file
        fs.writeFileSync('index.html', htmlTemplate);
        
        console.log('✅ Static site generated successfully!');
        console.log(`📊 Updated ${successfulPrices} out of ${productRows.length} products with current prices`);
        console.log(`🕒 Last updated: ${timestamp}`);
        console.log(`📄 Generated index.html (${fs.statSync('index.html').size} bytes)`);
        
        return {
            success: true,
            totalProducts: productRows.length,
            successfulPrices: successfulPrices,
            timestamp: timestamp
        };
        
    } catch (error) {
        console.error('❌ Error generating static site:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the generator
if (require.main === module) {
    generateStaticSite();
}

module.exports = generateStaticSite;
