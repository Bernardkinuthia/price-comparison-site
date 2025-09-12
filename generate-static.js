const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_URL = 'https://raw.githubusercontent.com/Bernardkinuthia/price-comparison-site/main/product_names.csv';
const JSON_URL = 'https://raw.githubusercontent.com/Bernardkinuthia/price-comparison-site/main/prices.json';
const TEMPLATE_FILE = 'index.template.html';
const OUTPUT_FILE = 'index.html';

// Helper functions
function fetchURL(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parseCSVLine(line) {
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

function parseCSVData(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = parseCSVLine(lines[i]);
        const product = {};
        
        headers.forEach((header, index) => {
            product[header] = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
        });
        
        products.push(product);
    }
    
    return products;
}

function determineProductType(wattage) {
    const watts = parseInt(wattage) || 0;
    if (watts <= 500) return 'small_wattage';
    if (watts <= 1500) return 'medium_wattage';
    return 'large_wattage';
}

function formatPrice(price) {
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

function formatCapacity(capacity) {
    if (!capacity || capacity === '0') return '';
    return capacity.toString().includes('Wh') ? capacity : capacity + 'Wh';
}

function formatFuelType(fuelType) {
    if (!fuelType) return 'N/A';
    return fuelType.charAt(0).toUpperCase() + fuelType.slice(1);
}

function formatEngineType(engineType) {
    if (!engineType) return 'N/A';
    return engineType.charAt(0).toUpperCase() + engineType.slice(1);
}

function formatCondition(condition) {
    if (!condition) return 'New';
    return condition.charAt(0).toUpperCase() + condition.slice(1);
}

function extractBrandFromLink(affiliateUrl) {
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

function calculatePricePerWatt(price, wattage) {
    if (!price || price === 'Price unavailable' || !wattage) return 'N/A';
    
    const priceValue = parseFloat(price.replace(/[$,]/g, ''));
    const wattageValue = parseFloat(wattage);
    
    if (wattageValue > 0 && !isNaN(priceValue) && priceValue > 0) {
        const pricePerWatt = (priceValue / wattageValue).toFixed(2);
        return '$' + pricePerWatt;
    }
    
    return 'N/A';
}

async function generateStaticSite() {
    try {
        console.log('Fetching data from GitHub...');
        
        // Fetch CSV and JSON data
        const [csvText, jsonText] = await Promise.all([
            fetchURL(CSV_URL),
            fetchURL(JSON_URL)
        ]);
        
        console.log('Data fetched successfully');
        
        // Parse CSV data
        let products = parseCSVData(csvText);
        console.log(`Parsed ${products.length} products from CSV`);
        
        // Parse and apply JSON price updates
        const priceData = JSON.parse(jsonText);
        console.log(`Parsed ${priceData.length} price updates from JSON`);
        
        // Update products with latest prices
        products.forEach(product => {
            const matchingPrice = priceData.find(item => 
                item.link === product.link || item.link === product.affiliate_url
            );
            
            if (matchingPrice && matchingPrice.price && matchingPrice.price !== "N/A") {
                product.price = matchingPrice.price;
                product.last_updated = matchingPrice.last_updated;
            }
        });
        
        // Read template HTML
        const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
        
        // Generate product rows HTML
        let productRowsHTML = '';
        let validPriceCount = 0;
        
        products.forEach(product => {
            const price = formatPrice(product.price);
            if (price !== 'Price unavailable') validPriceCount++;
            
            const wattage = product.output_wattage || '0';
            const pricePerWatt = calculatePricePerWatt(price, wattage);
            const capacity = formatCapacity(product.battery_capacity);
            const fuelType = formatFuelType(product.fuel_type);
            const engineType = formatEngineType(product.engine_type);
            const condition = formatCondition(product.condition);
            
            // Extract brand for filtering
            const brand = extractBrandFromLink(product.affiliate_url || product.link || '');
            
            // Determine product type for filtering
            const productType = determineProductType(wattage);
            
            // Create affiliate link HTML
            let affiliateLinkHTML = 'N/A';
            if (product.link && product.affiliate_url) {
                affiliateLinkHTML = `<a href="${product.link}" target="_blank" rel="noopener noreferrer">${product.affiliate_url}</a>`;
            } else if (product.link) {
                affiliateLinkHTML = `<a href="${product.link}" target="_blank" rel="noopener noreferrer">${product.link}</a>`;
            } else if (product.affiliate_url && product.affiliate_url.includes('<a href=')) {
                affiliateLinkHTML = product.affiliate_url;
            } else if (product.affiliate_url) {
                affiliateLinkHTML = product.affiliate_url;
            }
            
            // Create table row
            productRowsHTML += `
                <tr class="generator" 
                    data-product-key="${product.product_key || ''}" 
                    data-product-type="${productType}" 
                    data-condition="${(product.condition || 'new').toLowerCase()}" 
                    data-capacity="${product.battery_capacity || '0'}" 
                    data-wattage="${wattage}" 
                    data-fuel-type="${(product.fuel_type || 'gasoline').toLowerCase().replace(' ', '_')}" 
                    data-engine-type="${(product.engine_type || 'electric').toLowerCase().replace(' ', '_')}" 
                    data-brand="${brand}">
                    <td>${price}</td>
                    <td>${pricePerWatt}</td>
                    <td>${wattage}</td>
                    <td>${capacity}</td>
                    <td>${fuelType}</td>
                    <td>${engineType}</td>
                    <td>${condition}</td>
                    <td class="name">${affiliateLinkHTML}</td>
                </tr>
            `;
        });
        
        // Replace placeholders in template
        const now = new Date();
        const lastUpdated = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        
        let outputHTML = template.replace('<!-- PRODUCT_DATA_PLACEHOLDER -->', productRowsHTML);
        outputHTML = outputHTML.replace('<!-- LAST_UPDATED_PLACEHOLDER -->', lastUpdated);
        outputHTML = outputHTML.replace('<!-- PRODUCT_COUNT_PLACEHOLDER -->', `${products.length} (${validPriceCount} with prices, ${products.length - validPriceCount} price unavailable)`);
        
        // Remove the loading indicator
        outputHTML = outputHTML.replace('<div id="loading">Loading products...</div>', '');
        
        // Write the final HTML file
        fs.writeFileSync(OUTPUT_FILE, outputHTML);
        
        console.log(`Static site generated successfully!`);
        console.log(`- Products: ${products.length}`);
        console.log(`- Output file: ${OUTPUT_FILE}`);
        
    } catch (error) {
        console.error('Error generating static site:', error);
    }
}

// Run the generator
generateStaticSite();
