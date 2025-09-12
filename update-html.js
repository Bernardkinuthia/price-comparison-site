const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

// Load price data
async function loadPriceData() {
  try {
    const pricesPath = path.join(__dirname, '../data/prices.json');
    const pricesData = await fs.readFile(pricesPath, 'utf8');
    return JSON.parse(pricesData);
  } catch (error) {
    console.error('Error loading price data:', error.message);
    throw error;
  }
}

// Load HTML file
async function loadHtmlFile() {
  try {
    const htmlPath = path.join(__dirname, '../public/index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    return htmlContent;
  } catch (error) {
    console.error('Error loading HTML file:', error.message);
    throw error;
  }
}

// Calculate price per watt
function calculatePricePerWatt(price, wattage) {
  if (!price || !wattage || price <= 0 || wattage <= 0) {
    return null;
  }
  return (price / wattage).toFixed(3);
}

// Format price display
function formatPrice(price) {
  if (!price || price <= 0) {
    return 'N/A';
  }
  return `$${Number(price).toFixed(2)}`;
}

// Update HTML with new prices
async function updateHtmlWithPrices(htmlContent, priceData) {
  const $ = cheerio.load(htmlContent);
  
  let updatedCount = 0;
  let totalProducts = 0;
  
  // Find all generator rows
  $('tr.generator').each((index, element) => {
    totalProducts++;
    const $row = $(element);
    const productKey = $row.attr('data-product-key');
    
    if (!productKey) {
      console.warn(`Row ${index} missing data-product-key attribute`);
      return;
    }
    
    const priceInfo = priceData.prices[productKey];
    
    if (priceInfo) {
      const price = priceInfo.price;
      const wattage = parseInt($row.attr('data-wattage'));
      
      // Update price in data attribute
      $row.attr('data-price', price || 0);
      
      // Update price cell
      const $priceCell = $row.find('.price');
      $priceCell.text(formatPrice(price));
      
      // Update price per watt cell
      const $pricePerWattCell = $row.find('.price-per-watt');
      const pricePerWatt = calculatePricePerWatt(price, wattage);
      if (pricePerWatt) {
        $pricePerWattCell.text(`$${pricePerWatt}`);
      } else {
        $pricePerWattCell.text('N/A');
      }
      
      console.log(`✓ Updated ${productKey}: ${formatPrice(price)} ($${pricePerWatt || 'N/A'}/W)`);
      updatedCount++;
    } else {
      console.warn(`⚠ No price data found for product: ${productKey}`);
    }
  });
  
  // Update last updated timestamp
  const now = new Date();
  const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
  $('#update-timestamp').text(timestamp);
  
  // Update product count
  $('#product-count').text(totalProducts.toString());
  
  console.log(`\nHTML Update Summary:`);
  console.log(`Total products in HTML: ${totalProducts}`);
  console.log(`Updated products: ${updatedCount}`);
  console.log(`Update rate: ${((updatedCount / totalProducts) * 100).toFixed(1)}%`);
  
  return $.html();
}

// Add sorting functionality to HTML
function addSortingScript(htmlContent) {
  const $ = cheerio.load(htmlContent);
  
  // Check if sorting script already exists
  if ($('script:contains("sortTable")').length > 0) {
    console.log('Sorting script already exists, skipping addition');
    return $.html();
  }
  
  const sortingScript = `
  // Table sorting functionality
  function sortTable(columnIndex) {
    const table = document.getElementById('powerprices-body');
    const rows = Array.from(table.getElementsByTagName('tr'));
    
    // Toggle sort direction
    const currentDir = table.getAttribute('data-sort-dir') || 'asc';
    const newDir = currentDir === 'asc' ? 'desc' : 'asc';
    table.setAttribute('data-sort-dir', newDir);
    
    rows.sort((a, b) => {
      let aVal = a.getElementsByTagName('td')[columnIndex].textContent.trim();
      let bVal = b.getElementsByTagName('td')[columnIndex].textContent.trim();
      
      // Handle price columns (remove $ and convert to number)
      if (columnIndex <= 1) {
        aVal = aVal === 'N/A' ? -1 : parseFloat(aVal.replace('$', ''));
        bVal = bVal === 'N/A' ? -1 : parseFloat(bVal.replace('$', ''));
      }
      // Handle numeric columns
      else if (columnIndex === 2 || columnIndex === 3) {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }
      
      if (newDir === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    // Re-append sorted rows
    rows.forEach(row => table.appendChild(row));
  }
  
  // Add click handlers to headers
  document.addEventListener('DOMContentLoaded', function() {
    const headers = document.querySelectorAll('#powerprices-head th');
    headers.forEach((header, index) => {
      if (index < 4) { // Only make first 4 columns sortable
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTable(index));
        header.title = 'Click to sort';
      }
    });
    
    // Initial sort by price per watt (ascending, excluding N/A values)
    sortTable(1);
  });`;
  
  // Add the script before the closing body tag
  $('body').append(`<script>${sortingScript}</script>`);
  
  console.log('Added table sorting functionality');
  return $.html();
}

// Save updated HTML file
async function saveHtmlFile(htmlContent) {
  try {
    const htmlPath = path.join(__dirname, '../public/index.html');
    
    // Ensure public directory exists
    await fs.mkdir(path.dirname(htmlPath), { recursive: true });
    
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`Updated HTML saved to ${htmlPath}`);
  } catch (error) {
    console.error('Error saving HTML file:', error.message);
    throw error;
  }
}

// Generate summary report
async function generateSummaryReport(priceData) {
  const report = {
    lastUpdated: priceData.lastUpdated,
    stats: priceData.stats,
    priceRanges: {},
    availableProducts: 0,
    unavailableProducts: 0
  };
  
  const prices = Object.values(priceData.prices)
    .filter(p => p.price && p.price > 0)
    .map(p => p.price);
  
  if (prices.length > 0) {
    report.priceRanges = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
    };
    report.availableProducts = prices.length;
  }
  
  report.unavailableProducts = Object.keys(priceData.prices).length - report.availableProducts;
  
  const reportPath = path.join(__dirname, '../data/summary-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n=== Price Summary Report ===');
  console.log(`Available products: ${report.availableProducts}`);
  console.log(`Unavailable products: ${report.unavailableProducts}`);
  if (report.priceRanges.min) {
    console.log(`Price range: $${report.priceRanges.min} - $${report.priceRanges.max}`);
    console.log(`Average price: $${report.priceRanges.average}`);
  }
  
  return report;
}

// Main execution function
async function main() {
  try {
    console.log('Starting HTML update process...');
    
    // Load price data
    const priceData = await loadPriceData();
    
    // Load current HTML
    let htmlContent = await loadHtmlFile();
    
    // Update HTML with new prices
    htmlContent = await updateHtmlWithPrices(htmlContent, priceData);
    
    // Add sorting functionality if not present
    htmlContent = addSortingScript(htmlContent);
    
    // Save updated HTML
    await saveHtmlFile(htmlContent);
    
    // Generate summary report
    await generateSummaryReport(priceData);
    
    console.log('✅ HTML update completed successfully!');
    
  } catch (error) {
    console.error('Error in HTML update process:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

// Load price data
async function loadPriceData() {
  try {
    const pricesPath = path.join(__dirname, '../data/prices.json');
    const pricesData = await fs.readFile(pricesPath, 'utf8');
    return JSON.parse(pricesData);
  } catch (error) {
    console.error('Error loading price data:', error.message);
    throw error;
  }
}

// Load HTML file
async function loadHtmlFile() {
  try {
    const htmlPath = path.join(__dirname, '../public/index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    return htmlContent;
  } catch (error) {
    console.error('Error loading HTML file:', error.message);
    throw error;
  }
}

// Calculate price per watt
function calculatePricePerWatt(price, wattage) {
  if (!price || !wattage || price <= 0 || wattage <= 0) {
    return null;
  }
  return (price / wattage).toFixed(3);
}

// Format price display
function formatPrice(price) {
  if (!price || price <= 0) {
    return 'N/A';
  }
  return `$${Number(price).toFixed(2)}`;
}

// Update HTML with new prices
async function updateHtmlWithPrices(htmlContent, priceData) {
  const $ = cheerio.load(htmlContent);
  
  let updatedCount = 0;
  let totalProducts = 0;
  
  // Find all generator rows
  $('tr.generator').each((index, element) => {
    totalProducts++;
    const $row = $(element);
    const productKey = $row.attr('data-product-key');
    
    if (!productKey) {
      console.warn(`Row ${index} missing data-product-key attribute`);
      return;
    }
    
    const priceInfo = priceData.prices[productKey];
    
    if (priceInfo) {
      const price = priceInfo.price;
      const wattage = parseInt($row.attr('data-wattage'));
      
      // Update price in data attribute
      $row.attr('data-price', price || 0);
      
      // Update price cell
      const $priceCell = $row.find('.price');
      $priceCell.text(formatPrice(price));
      
      // Update price per watt cell
      const $pricePerWattCell = $row.find('.price-per-watt');
      const pricePerWatt = calculatePricePerWatt(price, wattage);
      if (pricePerWatt) {
        $pricePerWattCell.text(`$${pricePerWatt}`);
      } else {
        $pricePerWattCell.text('N/A');
      }
      
      console.log(`✓ Updated ${productKey}: ${formatPrice(price)} ($${pricePerWatt || 'N/A'}/W)`);
      updatedCount++;
    } else {
      console.warn(`⚠ No price data found for product: ${productKey}`);
    }
  });
  
  // Update last updated timestamp
  const now = new Date();
  const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
  $('#update-timestamp').text(timestamp);
  
  // Update product count
  $('#product-count').text(totalProducts.toString());
  
  console.log(`\nHTML Update Summary:`);
  console.log(`Total products in HTML: ${totalProducts}`);
  console.log(`Updated products: ${updatedCount}`);
  console.log(`Update rate: ${((updatedCount / totalProducts) * 100).toFixed(1)}%`);
  
  return $.html();
}

// Add sorting functionality to HTML
function addSortingScript(htmlContent) {
  const $ = cheerio.load(htmlContent);
  
  // Check if sorting script already exists
  if ($('script:contains("sortTable")').length > 0) {
    console.log('Sorting script already exists, skipping addition');
    return $.html();
  }
  
  const sortingScript = `
  // Table sorting functionality
  function sortTable(columnIndex) {
    const table = document.getElementById('powerprices-body');
    const rows = Array.from(table.getElementsByTagName('tr'));
    
    // Toggle sort direction
    const currentDir = table.getAttribute('data-sort-dir') || 'asc';
    const newDir = currentDir === 'asc' ? 'desc' : 'asc';
    table.setAttribute('data-sort-dir', newDir);
    
    rows.sort((a, b) => {
      let aVal = a.getElementsByTagName('td')[columnIndex].textContent.trim();
      let bVal = b.getElementsByTagName('td')[columnIndex].textContent.trim();
      
      // Handle price columns (remove $ and convert to number)
      if (columnIndex <= 1) {
        aVal = aVal === 'N/A' ? -1 : parseFloat(aVal.replace('$', ''));
        bVal = bVal === 'N/A' ? -1 : parseFloat(bVal.replace('$', ''));
      }
      // Handle numeric columns
      else if (columnIndex === 2 || columnIndex === 3) {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }
      
      if (newDir === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    // Re-append sorted rows
    rows.forEach(row => table.appendChild(row));
  }
  
  // Add click handlers to headers
  document.addEventListener('DOMContentLoaded', function() {
    const headers = document.querySelectorAll('#powerprices-head th');
    headers.forEach((header, index) => {
      if (index < 4) { // Only make first 4 columns sortable
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTable(index));
        header.title = 'Click to sort';
      }
    });
    
    // Initial sort by price per watt (ascending, excluding N/A values)
    sortTable(1);
  });`;
  
  // Add the script before the closing body tag
  $('body').append(`<script>${sortingScript}</script>`);
  
  console.log('Added table sorting functionality');
  return $.html();
}

// Save updated HTML file
async function saveHtmlFile(htmlContent) {
  try {
    const htmlPath = path.join(__dirname, '../public/index.html');
    
    // Ensure public directory exists
    await fs.mkdir(path.dirname(htmlPath), { recursive: true });
    
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`Updated HTML saved to ${htmlPath}`);
  } catch (error) {
    console.error('Error saving HTML file:', error.message);
    throw error;
  }
}

// Generate summary report
async function generateSummaryReport(priceData) {
  const report = {
    lastUpdated: priceData.lastUpdated,
    stats: priceData.stats,
    priceRanges: {},
    availableProducts: 0,
    unavailableProducts: 0
  };
  
  const prices = Object.values(priceData.prices)
    .filter(p => p.price && p.price > 0)
    .map(p => p.price);
  
  if (prices.length > 0) {
    report.priceRanges = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
    };
    report.availableProducts = prices.length;
  }
  
  report.unavailableProducts = Object.keys(priceData.prices).length - report.availableProducts;
  
  const reportPath = path.join(__dirname, '../data/summary-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n=== Price Summary Report ===');
  console.log(`Available products: ${report.availableProducts}`);
  console.log(`Unavailable products: ${report.unavailableProducts}`);
  if (report.priceRanges.min) {
    console.log(`Price range: $${report.priceRanges.min} - $${report.priceRanges.max}`);
    console.log(`Average price: $${report.priceRanges.average}`);
  }
  
  return report;
}

// Main execution function
async function main() {
  try {
    console.log('Starting HTML update process...');
    
    // Load price data
    const priceData = await loadPriceData();
    
    // Load current HTML
    let htmlContent = await loadHtmlFile();
    
    // Update HTML with new prices
    htmlContent = await updateHtmlWithPrices(htmlContent, priceData);
    
    // Add sorting functionality if not present
    htmlContent = addSortingScript(htmlContent);
    
    // Save updated HTML
    await saveHtmlFile(htmlContent);
    
    // Generate summary report
    await generateSummaryReport(priceData);
    
    console.log('✅ HTML update completed successfully!');
    
  } catch (error) {
    console.error('Error in HTML update process:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
