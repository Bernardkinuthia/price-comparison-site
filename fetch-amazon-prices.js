const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
  accessKey: process.env.AMAZON_ACCESS_KEY_ID,
  secretKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  partnerTag: process.env.AMAZON_ASSOCIATE_TAG,
  region: process.env.AMAZON_REGION || 'us-east-1',
  host: 'webservices.amazon.com'
};

// Validate configuration
function validateConfig() {
  const required = ['accessKey', 'secretKey', 'partnerTag'];
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Load products configuration
async function loadProductsConfig() {
  try {
    const configPath = path.join(__dirname, '../config/products-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading products config:', error.message);
    throw error;
  }
}

// Initialize Amazon API client
function createApiClient() {
  const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
  defaultClient.accessKey = CONFIG.accessKey;
  defaultClient.secretKey = CONFIG.secretKey;
  defaultClient.host = CONFIG.host;
  defaultClient.region = CONFIG.region;
  
  return new ProductAdvertisingAPIv1.DefaultApi();
}

// Create batch requests (Amazon API allows up to 10 ASINs per request)
function createBatchRequests(products, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize));
  }
  return batches;
}

// Fetch prices for a batch of products
async function fetchPriceBatch(api, productBatch, partnerTag) {
  const asins = productBatch.map(p => p.asin);
  
  const getItemsRequest = new ProductAdvertisingAPIv1.GetItemsRequest();
  getItemsRequest['PartnerTag'] = partnerTag;
  getItemsRequest['PartnerType'] = ProductAdvertisingAPIv1.PartnerType.ASSOCIATES;
  getItemsRequest['Marketplace'] = 'www.amazon.com';
  getItemsRequest['Condition'] = ProductAdvertisingAPIv1.Condition.NEW;
  getItemsRequest['ItemIds'] = asins;
  getItemsRequest['Resources'] = [
    ProductAdvertisingAPIv1.GetItemsResource.OFFERS_LISTINGS_PRICE,
    ProductAdvertisingAPIv1.GetItemsResource.ITEM_INFO_TITLE,
    ProductAdvertisingAPIv1.GetItemsResource.OFFERS_LISTINGS_AVAILABILITY,
    ProductAdvertisingAPIv1.GetItemsResource.OFFERS_LISTINGS_CONDITION,
    ProductAdvertisingAPIv1.GetItemsResource.OFFERS_SUMMARIES_LOWEST_PRICE
  ];

  try {
    console.log(`Fetching prices for ASINs: ${asins.join(', ')}`);
    const response = await api.getItems(getItemsRequest);
    
    if (response['ItemsResult'] && response['ItemsResult']['Items']) {
      return response['ItemsResult']['Items'];
    } else if (response['Errors']) {
      console.error('API Errors:', response['Errors']);
      return [];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching batch:', error.message);
    return [];
  }
}

// Extract price information from API response
function extractPriceInfo(item) {
  const priceInfo = {
    asin: item['ASIN'],
    price: null,
    currency: 'USD',
    availability: 'Unknown',
    condition: 'New',
    lastUpdated: new Date().toISOString()
  };

  try {
    // Try to get price from different sources
    if (item['Offers'] && item['Offers']['Listings'] && item['Offers']['Listings'].length > 0) {
      const listing = item['Offers']['Listings'][0];
      
      if (listing['Price'] && listing['Price']['Amount']) {
        priceInfo.price = parseFloat(listing['Price']['Amount']);
        priceInfo.currency = listing['Price']['Currency'] || 'USD';
      }
      
      if (listing['Availability'] && listing['Availability']['Message']) {
        priceInfo.availability = listing['Availability']['Message'];
      }
      
      if (listing['Condition'] && listing['Condition']['Value']) {
        priceInfo.condition = listing['Condition']['Value'];
      }
    }
    
    // Fallback to offers summary
    if (!priceInfo.price && item['Offers'] && item['Offers']['Summaries']) {
      const summaries = item['Offers']['Summaries'];
      if (summaries.length > 0 && summaries[0]['LowestPrice']) {
        priceInfo.price = parseFloat(summaries[0]['LowestPrice']['Amount']);
        priceInfo.currency = summaries[0]['LowestPrice']['Currency'] || 'USD';
      }
    }
    
  } catch (error) {
    console.error(`Error extracting price for ASIN ${item['ASIN']}:`, error.message);
  }

  return priceInfo;
}

// Add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load existing price data
async function loadExistingPrices() {
  try {
    const pricesPath = path.join(__dirname, '../data/prices.json');
    const pricesData = await fs.readFile(pricesPath, 'utf8');
    return JSON.parse(pricesData);
  } catch (error) {
    console.log('No existing price data found, starting fresh');
    return { lastUpdated: null, prices: {} };
  }
}

// Save price data
async function savePriceData(priceData) {
  const pricesPath = path.join(__dirname, '../data/prices.json');
  
  // Ensure data directory exists
  await fs.mkdir(path.dirname(pricesPath), { recursive: true });
  
  await fs.writeFile(pricesPath, JSON.stringify(priceData, null, 2));
  console.log(`Price data saved to ${pricesPath}`);
}

// Main execution function
async function main() {
  try {
    console.log('Starting Amazon price fetch...');
    
    // Validate configuration
    validateConfig();
    
    // Load configuration and existing prices
    const config = await loadProductsConfig();
    const existingPrices = await loadExistingPrices();
    
    // Initialize API client
    const api = createApiClient();
    
    // Create batches for API requests
    const batches = createBatchRequests(config.products);
    
    console.log(`Processing ${config.products.length} products in ${batches.length} batches...`);
    
    const updatedPrices = { ...existingPrices.prices };
    let successCount = 0;
    let errorCount = 0;
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length}...`);
      
      try {
        const items = await fetchPriceBatch(api, batch, CONFIG.partnerTag);
        
        // Process each item in the batch
        for (const item of items) {
          const priceInfo = extractPriceInfo(item);
          const product = batch.find(p => p.asin === item['ASIN']);
          
          if (product) {
            updatedPrices[product.key] = priceInfo;
            
            if (priceInfo.price) {
              console.log(`✓ ${product.key}: $${priceInfo.price}`);
              successCount++;
            } else {
              console.log(`⚠ ${product.key}: No price available`);
              errorCount++;
            }
          }
        }
        
        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          const delayMs = config.settings?.retry_delay_ms || 2000;
          console.log(`Waiting ${delayMs}ms before next batch...`);
          await delay(delayMs);
        }
        
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error.message);
        errorCount += batch.length;
      }
    }
    
    // Save updated price data
    const finalPriceData = {
      lastUpdated: new Date().toISOString(),
      prices: updatedPrices,
      stats: {
        totalProducts: config.products.length,
        successfulUpdates: successCount,
        errors: errorCount,
        lastRun: new Date().toISOString()
      }
    };
    
    await savePriceData(finalPriceData);
    
    console.log('\n=== Price Fetch Summary ===');
    console.log(`Total products: ${config.products.length}`);
    console.log(`Successful updates: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Success rate: ${((successCount / config.products.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Fatal error in price fetch:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
