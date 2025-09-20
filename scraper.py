#!/usr/bin/env python3
"""
Streamlined EcommerceAPI Product Price Fetcher
Simplified and optimized for better error handling and JSON output
"""

import pandas as pd
import json
import os
import logging
from datetime import datetime
import time
import requests

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EcommerceAPIClient:
    def __init__(self, api_key, domain='com'):
        self.api_key = api_key
        self.domain = domain
        self.base_url = 'https://api.ecommerceapi.io/amazon/product'
        
    def get_product(self, asin):
        """Get product from EcommerceAPI"""
        params = {
            'api_key': self.api_key,
            'asin': asin,
            'domain': self.domain
        }
        
        try:
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for ASIN {asin}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error for ASIN {asin}: {e}")
            return None

class EcommerceProductFetcher:
    def __init__(self, csv_file='product_asin.csv', output_file='products.json'):
        self.csv_file = csv_file
        self.output_file = output_file
        
        # Get API credentials from environment variables
        self.api_key = os.environ.get('ECOMMERCE_API_KEY')
        
        if not self.api_key:
            logger.error("Missing required environment variable: ECOMMERCE_API_KEY")
            raise ValueError("Missing EcommerceAPI credentials")
        
        self.api_client = EcommerceAPIClient(self.api_key)
        
    def clean_value(self, value):
        """Clean CSV values - handle NaN, empty strings, etc."""
        if pd.isna(value) or value == '' or value is None:
            return None
        return str(value).strip()
    
    def parse_api_response(self, response_data, asin, csv_data):
        """Parse EcommerceAPI response and extract product information"""
        if not response_data:
            return None
        
        try:
            # Extract price from response
            price = None
            price_amount = None
            
            # Try different possible price fields in the API response
            price_fields = ['price', 'current_price', 'list_price', 'sale_price']
            for field in price_fields:
                if field in response_data and response_data[field]:
                    price_str = str(response_data[field])
                    # Extract numeric value from price string
                    import re
                    price_match = re.search(r'[\d,]+\.?\d*', price_str.replace(',', ''))
                    if price_match:
                        price_amount = float(price_match.group())
                        price = f"${price_amount:.2f}"
                        break
            
            # If no price found in standard fields, try nested structures
            if not price and 'pricing' in response_data:
                pricing = response_data['pricing']
                if isinstance(pricing, dict):
                    for field in price_fields:
                        if field in pricing and pricing[field]:
                            price_str = str(pricing[field])
                            import re
                            price_match = re.search(r'[\d,]+\.?\d*', price_str.replace(',', ''))
                            if price_match:
                                price_amount = float(price_match.group())
                                price = f"${price_amount:.2f}"
                                break
            
            product = {
                'asin': asin,
                'running_wattage': self.clean_value(csv_data.get('running_wattage')),
                'starting_wattage': self.clean_value(csv_data.get('starting_wattage')),
                'capacity': self.clean_value(csv_data.get('capacity')),
                'run_time': self.clean_value(csv_data.get('run_time')),
                'fuel_type': self.clean_value(csv_data.get('fuel_type')),
                'weight': self.clean_value(csv_data.get('weight')),
                'link_text': self.clean_value(csv_data.get('link_text')),
                'affiliate_link': self.clean_value(csv_data.get('affiliate_link')),
                'price': price,
                'price_amount': price_amount,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if price:
                logger.info(f"✓ {asin}: {price}")
            else:
                logger.warning(f"⚠ {asin}: No price found")
            
            return product
            
        except Exception as e:
            logger.error(f"Error parsing response for ASIN {asin}: {e}")
            return None
    
    def create_fallback_product(self, asin, csv_data):
        """Create product with CSV data only (no price)"""
        return {
            'asin': asin,
            'running_wattage': self.clean_value(csv_data.get('running_wattage')),
            'starting_wattage': self.clean_value(csv_data.get('starting_wattage')),
            'capacity': self.clean_value(csv_data.get('capacity')),
            'run_time': self.clean_value(csv_data.get('run_time')),
            'fuel_type': self.clean_value(csv_data.get('fuel_type')),
            'weight': self.clean_value(csv_data.get('weight')),
            'link_text': self.clean_value(csv_data.get('link_text')),
            'affiliate_link': self.clean_value(csv_data.get('affiliate_link')),
            'price': None,
            'price_amount': None,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def run(self):
        """Main execution"""
        logger.info("🚀 Starting EcommerceAPI Product Fetcher...")
        
        try:
            # Read CSV
            df = pd.read_csv(self.csv_file)
            logger.info(f"Found {len(df)} products in CSV")
            
            if 'asin' not in df.columns:
                logger.error("Missing required 'asin' column in CSV")
                return False
                
        except Exception as e:
            logger.error(f"Error reading CSV: {e}")
            return False
        
        # Prepare valid ASINs and mapping
        asin_to_csv_data = {}
        valid_asins = []
        
        for _, row in df.iterrows():
            asin = str(row.get('asin', '')).strip()
            if asin and not pd.isna(row.get('asin')) and asin != 'nan':
                valid_asins.append(asin)
                asin_to_csv_data[asin] = row.to_dict()
        
        if not valid_asins:
            logger.error("No valid ASINs found in CSV")
            # Create empty products file to prevent downstream errors
            with open(self.output_file, 'w') as f:
                json.dump([], f, indent=2)
            return False
        
        logger.info(f"Processing {len(valid_asins)} valid ASINs...")
        
        all_products = []
        successful_prices = 0
        
        # Process each ASIN individually (EcommerceAPI doesn't support batch requests)
        for i, asin in enumerate(valid_asins):
            logger.info(f"Processing ASIN {i+1}/{len(valid_asins)}: {asin}")
            
            csv_data = asin_to_csv_data[asin]
            response = self.api_client.get_product(asin)
            
            if response:
                product = self.parse_api_response(response, asin, csv_data)
                if product:
                    all_products.append(product)
                    if product['price']:
                        successful_prices += 1
                else:
                    # Fallback to CSV data only
                    all_products.append(self.create_fallback_product(asin, csv_data))
                    logger.warning(f"✗ {asin}: Using CSV data only")
            else:
                # API failed, use CSV data only
                all_products.append(self.create_fallback_product(asin, csv_data))
                logger.warning(f"✗ {asin}: API failed, using CSV data only")
            
            # Rate limiting - be respectful to the API
            if i < len(valid_asins) - 1:
                time.sleep(0.5)  # 500ms delay between requests
        
        # Sort by price (items with prices first, then by price ascending)
        all_products.sort(key=lambda x: (x['price'] is None, x['price_amount'] or float('inf')))
        
        # Save JSON with proper error handling
        try:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(all_products, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ Saved {len(all_products)} products to {self.output_file}")
            logger.info(f"📊 Success rate: {successful_prices}/{len(all_products)} ({successful_prices/len(all_products)*100:.1f}%)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving JSON: {e}")
            # Create empty file as fallback
            try:
                with open(self.output_file, 'w') as f:
                    json.dump([], f)
                logger.info("Created empty products.json as fallback")
            except:
                pass
            return False

if __name__ == "__main__":
    try:
        fetcher = EcommerceProductFetcher()
        success = fetcher.run()
        exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        # Ensure empty products.json exists for downstream processes
        try:
            with open('products.json', 'w') as f:
                json.dump([], f)
        except:
            pass
        exit(1)
