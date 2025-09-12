#!/usr/bin/env python3
"""
Amazon Price Scraper and Website Updater - GitHub Actions Only
Reads Excel file from repository, fetches Amazon prices, updates HTML website
"""

import pandas as pd
import requests
from bs4 import BeautifulSoup
import json
import time
import random
import os
from datetime import datetime
import logging
from urllib.parse import urljoin
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AmazonPriceScraper:
    def __init__(self, excel_file='data/products.xlsx', html_file='public/index.html'):
        self.excel_file = excel_file
        self.html_file = html_file
        self.session = requests.Session()
        
        # Multiple User-Agent strings to rotate
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
    def get_headers(self):
        """Get randomized headers"""
        return {
            'User-Agent': random.choice(self.user_agents),
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'DNT': '1',
            'Upgrade-Insecure-Requests': '1',
        }
        
    def read_excel_data(self):
        """Read product data from Excel file"""
        try:
            if not os.path.exists(self.excel_file):
                logger.error(f"Excel file not found: {self.excel_file}")
                return None
                
            df = pd.read_excel(self.excel_file)
            logger.info(f"Successfully read {len(df)} products from {self.excel_file}")
            
            # Validate required columns
            required_columns = ['asin', 'affiliate_link']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                logger.warning(f"Missing columns: {missing_columns}")
            
            return df
        except Exception as e:
            logger.error(f"Error reading Excel file: {e}")
            return None
    
    def extract_asin_from_url(self, url):
        """Extract ASIN from Amazon URL"""
        if not url or pd.isna(url):
            return None
        
        # Try to extract ASIN from URL
        asin_patterns = [
            r'/dp/([A-Z0-9]{10})',
            r'/gp/product/([A-Z0-9]{10})',
            r'asin=([A-Z0-9]{10})',
            r'/product/([A-Z0-9]{10})',
        ]
        
        for pattern in asin_patterns:
            match = re.search(pattern, str(url))
            if match:
                return match.group(1)
        
        return None
    
    def get_amazon_price(self, asin, affiliate_link=None, max_retries=3):
        """Fetch price from Amazon using ASIN with retry logic"""
        if not asin:
            logger.warning("No ASIN provided")
            return None, None, None
        
        # Use affiliate link if provided, otherwise construct Amazon URL
        if affiliate_link and not pd.isna(affiliate_link):
            url = str(affiliate_link)
        else:
            url = f"https://www.amazon.com/dp/{asin}"
        
        for attempt in range(max_retries):
            try:
                # Random delay to avoid being blocked (longer delays for GitHub Actions)
                time.sleep(random.uniform(3, 8))
                
                headers = self.get_headers()
                response = self.session.get(url, headers=headers, timeout=15)
                
                if response.status_code == 503:
                    logger.warning(f"Service unavailable for ASIN {asin}, attempt {attempt + 1}")
                    time.sleep(random.uniform(10, 20))
                    continue
                    
                response.raise_for_status()
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Multiple price selectors to try (updated for current Amazon layout)
                price_selectors = [
                    '.a-price-whole',
                    '.a-price .a-offscreen',
                    '.a-price-current .a-offscreen',
                    '#priceblock_dealprice',
                    '#priceblock_ourprice',
                    '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
                    '.a-price-symbol + .a-price-whole',
                    '[data-a-price-whole]',
                    '.a-price-range .a-offscreen'
                ]
                
                price = None
                currency = '$'
                
                for selector in price_selectors:
                    price_element = soup.select_one(selector)
                    if price_element:
                        price_text = price_element.get_text().strip()
                        # Extract numeric price
                        price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(',', ''))
                        if price_match:
                            try:
                                price = float(price_match.group().replace(',', ''))
                                # Extract currency symbol if present
                                currency_match = re.search(r'[£€$¥]', price_text)
                                if currency_match:
                                    currency = currency_match.group()
                                break
                            except ValueError:
                                continue
                
                # Get product title
                title_selectors = ['#productTitle', '.product-title', 'h1.a-size-large']
                title = None
                for selector in title_selectors:
                    title_element = soup.select_one(selector)
                    if title_element:
                        title = title_element.get_text().strip()
                        break
                
                if not title:
                    title = "Unknown Product"
                
                if price:
                    logger.info(f"✓ Fetched price for {asin}: {currency}{price} - {title[:50]}...")
                    return price, title, currency
                else:
                    logger.warning(f"Could not find price for ASIN {asin}")
                    return None, title, currency
                    
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout for ASIN {asin}, attempt {attempt + 1}")
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error for ASIN {asin}, attempt {attempt + 1}: {e}")
            except Exception as e:
                logger.error(f"Unexpected error for ASIN {asin}, attempt {attempt + 1}: {e}")
            
            if attempt < max_retries - 1:
                time.sleep(random.uniform(5, 15))
        
        logger.error(f"Failed to fetch price for ASIN {asin} after {max_retries} attempts")
        return None, None, None
    
    def process_products(self):
        """Process all products from Excel and fetch their prices"""
        df = self.read_excel_data()
        if df is None:
            return None
        
        results = []
        successful_fetches = 0
        
        for index, row in df.iterrows():
            logger.info(f"Processing product {index + 1}/{len(df)}")
            
            # Get ASIN from the asin column or extract from affiliate_link
            asin = row.get('asin')
            if pd.isna(asin) or not asin:
                asin = self.extract_asin_from_url(row.get('affiliate_link', ''))
            
            if not asin:
                logger.warning(f"No ASIN found for row {index + 1}, skipping...")
                continue
            
            price, title, currency = self.get_amazon_price(asin, row.get('affiliate_link'))
            
            if price:
                successful_fetches += 1
            
            product_data = {
                'asin': asin,
                'title': title or f"Product {asin}",
                'price': price,
                'currency': currency,
                'output_wattage': str(row.get('output_wattage', '')),
                'battery_capacity': str(row.get('battery_capacity', '')),
                'fuel_type': str(row.get('fuel_type', '')),
                'engine_type': str(row.get('engine_type', '')),
                'condition': str(row.get('condition', '')),
                'link_text': str(row.get('link_text', 'Buy Now')),
                'affiliate_link': str(row.get('affiliate_link', '')),
                'last_updated': datetime.now().isoformat(),
                'fetch_successful': price is not None
            }
            
            results.append(product_data)
            
            # Add extra delay every few products to be respectful
            if (index + 1) % 5 == 0:
                logger.info("Taking a longer break...")
                time.sleep(random.uniform(15, 30))
        
        logger.info(f"Successfully fetched {successful_fetches}/{len(results)} prices")
        return results
    
    def save_data_json(self, data):
        """Save scraped data to JSON file"""
        os.makedirs('data', exist_ok=True)
        output_file = 'data/products-data.json'
        try:
            with open(output_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            logger.info(f"Saved {len(data)} products to {output_file}")
        except Exception as e:
            logger.error(f"Error saving JSON data: {e}")
    
    def create_basic_html_template(self):
        """Create a basic HTML template if none exists"""
        html_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Price Comparison Site</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { text-align: center; color: #333; }
        .last-updated { text-align: center; color: #666; margin-bottom: 20px; }
        .product-item { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .product-item h3 { margin: 0 0 15px 0; color: #333; }
        .product-specs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px; }
        .product-specs p { margin: 5px 0; }
        .price-info { display: flex; justify-content: space-between; align-items: center; }
        .price { font-size: 24px; font-weight: bold; color: #e47911; }
        .buy-link { background: #ff9900; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        .buy-link:hover { background: #e88700; }
        .no-price { color: #999; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Generator Price Comparison</h1>
        <div id="products-container">
            <!-- Products will be inserted here -->
        </div>
    </div>
</body>
</html>"""
        
        os.makedirs('public', exist_ok=True)
        with open(self.html_file, 'w', encoding='utf-8') as f:
            f.write(html_template)
        logger.info(f"Created basic HTML template at {self.html_file}")
    
    def update_html_file(self, data):
        """Update HTML file with new product data"""
        try:
            # Create HTML file if it doesn't exist
            if not os.path.exists(self.html_file):
                self.create_basic_html_template()
            
            with open(self.html_file, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')
            
            # Find or create products container
            products_container = soup.find(id='products-container')
            if not products_container:
                # If container doesn't exist, create it
                body = soup.find('body')
                if body:
                    container_div = soup.find(class_='container')
                    if container_div:
                        products_container = soup.new_tag('div', id='products-container')
                        container_div.append(products_container)
                else:
                    logger.error("No suitable container found in HTML")
                    return
            
            # Clear existing products
            products_container.clear()
            
            # Add updated timestamp
            timestamp_div = soup.new_tag('div', class_='last-updated')
            timestamp_div.string = f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
            products_container.append(timestamp_div)
            
            # Count successful prices
            successful_prices = len([p for p in data if p.get('price')])
            total_products = len(data)
            
            # Add summary
            summary_div = soup.new_tag('div', class_='summary')
            summary_div.string = f"Showing {successful_prices} of {total_products} products with current prices"
            products_container.append(summary_div)
            
            # Add products
            for product in data:
                product_div = soup.new_tag('div', class_='product-item')
                
                # Product title
                title_h3 = soup.new_tag('h3')
                title_h3.string = product['title']
                product_div.append(title_h3)
                
                # Product specifications
                specs_div = soup.new_tag('div', class_='product-specs')
                
                specs = [
                    ('Output Wattage', product.get('output_wattage', 'N/A')),
                    ('Battery Capacity', product.get('battery_capacity', 'N/A')),
                    ('Fuel Type', product.get('fuel_type', 'N/A')),
                    ('Engine Type', product.get('engine_type', 'N/A')),
                    ('Condition', product.get('condition', 'N/A')),
                ]
                
                for spec_name, spec_value in specs:
                    if spec_value and spec_value != 'N/A' and spec_value.strip():
                        spec_p = soup.new_tag('p')
                        strong = soup.new_tag('strong')
                        strong.string = f"{spec_name}: "
                        spec_p.append(strong)
                        spec_p.append(f"{spec_value}")
                        specs_div.append(spec_p)
                
                product_div.append(specs_div)
                
                # Price information
                price_div = soup.new_tag('div', class_='price-info')
                
                if product.get('price'):
                    price_span = soup.new_tag('span', class_='price')
                    currency = product.get('currency', '$')
                    price_span.string = f"{currency}{product['price']:.2f}"
                    price_div.append(price_span)
                    
                    if product.get('affiliate_link') and product['affiliate_link'] != 'nan':
                        buy_link = soup.new_tag('a', href=product['affiliate_link'], target='_blank', class_='buy-link')
                        buy_link.string = product.get('link_text', 'Buy Now')
                        price_div.append(buy_link)
                else:
                    no_price_span = soup.new_tag('span', class_='no-price')
                    no_price_span.string = "Price unavailable"
                    price_div.append(no_price_span)
                
                product_div.append(price_div)
                products_container.append(product_div)
            
            # Save updated HTML
            with open(self.html_file, 'w', encoding='utf-8') as f:
                f.write(str(soup.prettify()))
            
            logger.info(f"Updated HTML file: {self.html_file} with {len(data)} products")
            
        except Exception as e:
            logger.error(f"Error updating HTML file: {e}")
    
    def run(self):
        """Main execution method"""
        logger.info("🚀 Starting Amazon price scraper (GitHub Actions mode)...")
        
        # Process products
        data = self.process_products()
        if not data:
            logger.error("❌ No data to process")
            return False
        
        # Save data to JSON
        self.save_data_json(data)
        
        # Update HTML file
        self.update_html_file(data)
        
        successful_prices = len([p for p in data if p.get('price')])
        logger.info(f"✅ Scraping completed! Successfully updated {successful_prices}/{len(data)} product prices")
        return True

def main():
    """Main function"""
    try:
        scraper = AmazonPriceScraper()
        success = scraper.run()
        if not success:
            exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        exit(1)

if __name__ == "__main__":
    main()
