// generate-static-site.js
const fs = require('fs');
const path = require('path');

async function generateStaticSite() {
    try {
        console.log('🚀 Starting static site generation...');
        
        // Check if products.json exists
        if (!fs.existsSync('products.json')) {
            console.warn('⚠️ products.json not found, creating empty data structure');
            const emptyData = {
                products: [],
                total_products: 0,
                successful_prices: 0
            };
            fs.writeFileSync('products.json', JSON.stringify(emptyData, null, 2));
        }
        
        // Check if template exists
        if (!fs.existsSync('index-template.html')) {
            console.error('❌ index-template.html not found');
            console.log('📝 Please ensure you have renamed your index.html to index-template.html');
            process.exit(1);
        }
        
        // Read the products JSON data
        const productsData = JSON.parse(fs.readFileSync('products.json', 'utf8'));
        console.log(`📊 Loaded ${productsData.products?.length || 0} products from JSON`);
        
        // Read the HTML template
        let htmlTemplate = fs.readFileSync('index-template.html', 'utf8');
        console.log('📄 Template loaded successfully');
        
        // Define your products with their data attributes
        const productRows = [
            {
                key: 'dji-power-1000-portable',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '1024',
                wattage: '2200',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'other_brand',
                capacityDisplay: '1024Wh',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4nuXr7n',
                name: 'DJI Power 1000 Portable Power Station, 1024Wh LiFePO4 Battery, 2200W (Peak 2600W) AC/140W USB-C Output, 23db Ultra-Silent, Solar Generator For Home Backup, Camping(Solar Panel Optional)'
            },
            {
                key: 'bluetti-ac70-768wh',
                productType: 'medium_wattage',
                condition: 'new',
                capacity: '768',
                wattage: '1000',
                fuelType: 'battery',
                engineType: 'electric',
                brand: 'bulleti',
                capacityDisplay: '768',
                fuelTypeDisplay: 'Battery',
                link: 'https://amzn.to/3Keq1LE',
                name: 'BLUETTI Solar Generator AC70, 768Wh LiFePO4 Battery Backup w/ 2 1000W AC Outlets (Power Lifting 2000W), 100W Type-C, for Road Trip, Off-grid, Power Outage (Solar Panel Optional)'
            },
            {
                key: 'ecoflow-river-2-pro',
                productType: 'small_wattage',
                condition: 'new',
                capacity: '768',
                wattage: '800',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'ef_ecoflow',
                capacityDisplay: '768',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/47D9dI1',
                name: 'EF ECOFLOW Portable Power Station RIVER 2 Pro, 768Wh LiFePO4 Battery, 70 Min Fast Charging, 4X300W AC Outlets, Solar Generator for Outdoor Camping/RVs/Home Use Black'
            },
            {
                key: 'anker-solix-f2000',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '767',
                wattage: '2400',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'anker',
                capacityDisplay: '2048',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/3VvFERD',
                name: 'Anker SOLIX F2000 Portable Power Station, Powerhouse 767, 2400W Solar Generator, GaNPrime Battery Generators for Home Use, LiFePO4 Power Station for Outdoor Camping, and RVs (Solar Panel Optional)'
            },
            {
                key: 'jackery-5000-plus',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '5040',
                wattage: '7200',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'jackery',
                capacityDisplay: '5040',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/46eaByB',
                name: 'Jackery Solar Generator 5000 Plus Portable Power Station with 2x 500W Solar Panels and Smart Transfer Switch, 5040Wh Power Station, 7200W AC Output Solar Generator for Home Use, Emergency Backup'
            },
            {
                key: 'dabbsson-2000l',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '2048',
                wattage: '2200',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'other_brand',
                capacityDisplay: '2048',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4pdQbyt',
                name: 'DABBSSON 2000L Solar Generator(2025 New), 2048Wh Semi-Solid LiFePO4, 2200W AC Output&8, P-Boost 3300W, Compact&Lightweight, 1.3X Runtime, Portable Power Station for Camping/Home/RV'
            },
            {
                key: 'zerokor-300w-portable',
                productType: 'small_wattage',
                condition: 'new',
                capacity: '380',
                wattage: '300',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'zerokor',
                capacityDisplay: '380',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4n0UDyW',
                name: 'ZeroKor Portable Solar Generator, 300W Portable Power Station with Foldable 60W Solar Panel, 110V Pure Sine Wave 280Wh Lithium Battery Pack with USB DC AC Outlet for Home Use RV Van Outdoor Camping-Orange'
            },
            {
                key: 'grecell-1000w-100w-solar-panel',
                productType: 'medium_wattage',
                condition: 'new',
                capacity: '999',
                wattage: '1000',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'grecell',
                capacityDisplay: '999',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4niyXhi',
                name: 'GRECELL 1000W Portable Power Station With 2x 100W Solar Panels, 999Wh Backup Lithium Battery, Pure Sine Wave AC Outlet, 60W PD Quick Charge Solar Generator Set for Outdoor Emergency Camping Travel'
            },
            {
                key: 'allpowers-600w-299wh',
                productType: 'small_wattage',
                condition: 'new',
                capacity: '299',
                wattage: '600',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'allpowers',
                capacityDisplay: '299',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4605svc',
                name: 'ALLPOWERS 600W Portable Power Station, 299Wh LiFePO4 Battery Backup, R600(Peak 1200w) Solar Generator, 1 Hour Full Charge Solar Power Bank, for Home Outdoor Travel Emergency RV'
            },
            {
                key: 'pecron-e1000lfp',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '1024',
                wattage: '1800',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'pecron',
                capacityDisplay: '1024',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/3JVcLeZ',
                name: 'Pecron Portable Power Station E1000LFP, 1024Wh/1800W LiFePO4 Battery Backup, Solar Generator, Expandable to 4096Wh, Fast Charging Power Station for Emergencies, Camping, RV, Home Use'
            },
            {
                key: 'ampace-portable-power-station-andes-300-266wh-batt',
                productType: 'small_wattage',
                condition: 'new',
                capacity: '266',
                wattage: '300',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'other_brand',
                capacityDisplay: '266Wh',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4n2c1U1',
                name: 'AMPACE Portable Power Station Andes 300, 266Wh Battery with 300W AC/100W USB-C Output, 1Hr Fast Charging, 8.2lbs Solar Generator for RV, Outdoors, Camping batteries, Traveling, (Solar Panel Optional)'
            },
            {
                key: 'growatt-portable-power-station-infinity-2000-black',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '2048',
                wattage: '2400',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'other_brand',
                capacityDisplay: '2048Wh',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4nMYAaD',
                name: 'GROWATT Portable Power Station ✓INFINITY 2000 Black Electric Solar Generator✓2048Wh LifePO4 Battery,2400W AC Output for Home Use, Outdoor Camping, RVs and Emergency Backup(Solar Panel Optional)'
            },
            {
                key: 'litheli-portable-power-station-eclair-1000-1800w-s',
                productType: 'large_wattage',
                condition: 'new',
                capacity: '1069',
                wattage: '1800',
                fuelType: 'solar',
                engineType: 'electric',
                brand: 'other_brand',
                capacityDisplay: '1069Wh',
                fuelTypeDisplay: 'Solar',
                link: 'https://amzn.to/4n88zY8',
                name: 'Litheli Portable Power Station Eclair 1000, 1800W Solar Generator, 1069Wh Outdoor Generator, 1H Fast Charging LiFePO4 Power Station for Outdoor Camping, Emergency and RVs(Solar Panels Optional)'
            }
        ];
        
        console.log(`🏗️ Processing ${productRows.length} product rows...`);
        
        // Generate rows with actual price data
        let tbodyHtml = '';
        let successfulPrices = 0;
        
        productRows.forEach(row => {
            // Find matching product in JSON data
            const product = productsData.products?.find(p => p.affiliate_link === row.link);
            
            let price = 'N/A';
            let pricePerWatt = 'N/A';
            let dataPrice = '0';
            
            if (product && product.price_available) {
                price = product.price;
                const priceValue = parseFloat(product.price.replace(/[^\d.]/g, ''));
                const wattage = parseInt(row.wattage);
                
                if (wattage > 0 && priceValue > 0) {
                    const pricePerWattValue = priceValue / wattage;
                    pricePerWatt = '$' + pricePerWattValue.toFixed(3);
                }
                dataPrice = priceValue.toString();
                successfulPrices++;
            }
            
            tbodyHtml += `
                    <tr class="generator" data-product-key="${row.key}" data-product-type="${row.productType}" data-condition="${row.condition}" data-capacity="${row.capacity}" data-wattage="${row.wattage}" data-fuel-type="${row.fuelType}" data-engine-type="${row.engineType}" data-brand="${row.brand}" data-price="${dataPrice}">
                        <td class="price">${price}</td>
                        <td class="price-per-watt">${pricePerWatt}</td>
                        <td>${row.wattage}</td>
                        <td>${row.capacityDisplay}</td>
                        <td>${row.fuelTypeDisplay}</td>
                        <td>Electric</td>
                        <td>New</td>
                        <td class="name"><a href="${row.link}" target="_blank" rel="noopener noreferrer">${row.name}</a></td>
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
        
        // Update timestamp
        const now = new Date();
        const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        htmlTemplate = htmlTemplate.replace(
            '<span id="update-timestamp"></span>',
            `<span id="update-timestamp">${timestamp}</span>`
        );
        
        // Update product count
        htmlTemplate = htmlTemplate.replace(
            /<span id="product-count">\d*<\/span>/,
            `<span id="product-count">${successfulPrices}</span>`
        );
        
        // Remove only the dynamic price fetching script, preserve the filtering script
        const dynamicScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded', function\(\) \{[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com[\s\S]*?<\/script>/;
        if (htmlTemplate.match(dynamicScriptRegex)) {
            htmlTemplate = htmlTemplate.replace(dynamicScriptRegex, '');
            console.log('✅ Removed dynamic price fetching script');
        } else {
            // Fallback: look for the specific fetch script
            const fetchScriptRegex = /<script>[\s\S]*?fetch\('https:\/\/raw\.githubusercontent\.com\/Bernardkinuthia\/price-comparison-site\/main\/products\.json'\)[\s\S]*?<\/script>/;
            if (htmlTemplate.match(fetchScriptRegex)) {
                htmlTemplate = htmlTemplate.replace(fetchScriptRegex, '');
                console.log('✅ Removed dynamic price fetching script (fallback)');
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
