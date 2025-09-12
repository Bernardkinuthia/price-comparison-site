#!/usr/bin/env python3
"""
Simplified Amazon Price Scraper - Just JSON Output
Reads CSV file, fetches Amazon prices, saves to JSON in root directory
"""

import pandas as pd
import requests
from bs4 import BeautifulSoup
import json
import time
import random
import logging
from datetime import datetime
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimplePriceScraper:
    def __init__(self, csv_file='product_asin.csv', output_file='products.json'):
        self.csv_file = csv_file
        self.output_file = output_file
        self.session = requests.Session()
        
        # User agents for rotation
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ]
        
    def get_headers(self):
        return {
            'User-Agent': random.choice(self.user_agents),
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
        }
    
    def get_amazon_price(self, asin, affiliate_link=None):
        """Fetch price from Amazon"""
        if not asin:
            return None, None, '$'
        
        url = affiliate_link if affiliate_link and not pd.isna(affiliate_link) else f"https://www.amazon.com/dp/{asin}"
        
        try:
            time.sleep(random.uniform(2, 5))  # Be respectful
            
            response = self.session.get(url, headers=self.get_headers(), timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Price selectors
            price_selectors = [
                '.a-price-whole',
                '.a-price .a-offscreen',
                '.a-price-current .a-offscreen',
                '#priceblock_dealprice',
                '#priceblock_ourprice'
            ]
            
            price = None
            for selector in price_selectors:
                element = soup.select_one(selector)
                if element:
                    price_text = element.get_text().strip()
                    price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(',', ''))
                    if price_match:
                        try:
                            price = float(price_match.group().replace(',', ''))
                            break
                        except ValueError:
                            continue
            
            # Get title
            title_element = soup.select_one('#productTitle')
            title = title_element.get_text().strip() if title_element else f"Product {asin}"
            
            if price:
                logger.info(f"✓ {asin}: ${price} - {title[:50]}...")
            else:
                logger.warning(f"✗ No price found for {asin}")
                
            return price, title, '$'
            
        except Exception as e:
            logger.error(f"Error fetching {asin}: {e}")
            return None, None, '$'
    
    def run(self):
        """Main execution"""
        logger.info("🚀 Starting simplified price scraper...")
        
        # Read CSV
        try:
            df = pd.read_csv(self.csv_file)
            logger.info(f"Found {len(df)} products in CSV")
        except Exception as e:
            logger.error(f"Error reading CSV: {e}")
            return False
        
        results = []
        successful = 0
        
        # Process each product
        for idx, row in df.iterrows():
            logger.info(f"Processing {idx + 1}/{len(df)}")
            
            asin = row.get('asin', '').strip()
            if not asin or pd.isna(asin):
                logger.warning(f"No ASIN for row {idx + 1}, skipping")
                continue
            
            price, title, currency = self.get_amazon_price(asin, row.get('affiliate_link'))
            
            product = {
                'asin': asin,
                'title': title,
                'price': price,
                'currency': currency,
                'affiliate_link': str(row.get('affiliate_link', '')),
                'last_updated': datetime.now().isoformat(),
                'price_available': price is not None
            }
            
            # Add any other columns from CSV
            for col in df.columns:
                if col not in ['asin', 'affiliate_link'] and not pd.isna(row[col]):
                    product[col] = str(row[col])
            
            results.append(product)
            
            if price:
                successful += 1
        
        # Save to JSON in root directory
        try:
            with open(self.output_file, 'w') as f:
                json.dump({
                    'last_updated': datetime.now().isoformat(),
                    'total_products': len(results),
                    'successful_prices': successful,
                    'products': results
                }, f, indent=2, default=str)
            
            logger.info(f"✅ Saved {len(results)} products to {self.output_file}")
            logger.info(f"📊 Success rate: {successful}/{len(results)} ({successful/len(results)*100:.1f}%)")
            return True
            
        except Exception as e:
            logger.error(f"Error saving JSON: {e}")
            return False

if __name__ == "__main__":
    scraper = SimplePriceScraper()
    success = scraper.run()
    exit(0 if success else 1)
