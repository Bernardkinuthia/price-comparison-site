#!/usr/bin/env python3
"""
Amazon Product Advertising API Price Fetcher
Uses official Amazon API to fetch product prices and information
Updated to work with generator specifications CSV structure
"""

import pandas as pd
import json
import os
import logging
from datetime import datetime
import time
import hashlib
import hmac
import urllib.parse
import requests
from xml.etree import ElementTree as ET

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AmazonAPIClient:
    def __init__(self, access_key, secret_key, partner_tag, region='us-east-1'):
        self.access_key = access_key
        self.secret_key = secret_key
        self.partner_tag = partner_tag
        self.region = region
        self.service = 'ProductAdvertisingAPI'
        self.host = f'webservices.amazon.com'
        self.endpoint = f'https://{self.host}/paapi5/getitems'
        
    def _sign_request(self, method, canonical_uri, query_string, payload, timestamp):
        """Create AWS Signature Version 4"""
        
        # Step 1: Create canonical request
        canonical_headers = f'host:{self.host}\nx-amz-date:{timestamp}\n'
        signed_headers = 'host;x-amz-date'
        payload_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        
        canonical_request = f'{method}\n{canonical_uri}\n{query_string}\n{canonical_headers}\n{signed_headers}\n{payload_hash}'
        
        # Step 2: Create string to sign
        algorithm = 'AWS4-HMAC-SHA256'
        credential_scope = f'{timestamp[:8]}/{self.region}/{self.service}/aws4_request'
        string_to_sign = f'{algorithm}\n{timestamp}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()}'
        
        # Step 3: Calculate signature
        def sign(key, msg):
            return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()
        
        def get_signature_key(key, date_stamp, region_name, service_name):
            k_date = sign(('AWS4' + key).encode('utf-8'), date_stamp)
            k_region = sign(k_date, region_name)
            k_service = sign(k_region, service_name)
            k_signing = sign(k_service, 'aws4_request')
            return k_signing
        
        signing_key = get_signature_key(self.secret_key, timestamp[:8], self.region, self.service)
        signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
        
        return signature
    
    def get_items(self, asins, resources=None):
        """Get items from Amazon PA API"""
        if not resources:
            resources = [
                "ItemInfo.Title",
                "Offers.Listings.Price",
                "ItemInfo.Features",
                "ItemInfo.TechnicalInfo",
                "Images.Primary.Medium"
            ]
        
        # Ensure asins is a list
        if isinstance(asins, str):
            asins = [asins]
        
        # Limit to 10 ASINs per request (API limit)
        asins = asins[:10]
        
        timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        
        payload = {
            "ItemIds": asins,
            "Resources": resources,
            "PartnerTag": self.partner_tag,
            "PartnerType": "Associates",
            "Marketplace": "www.amazon.com"
        }
        
        payload_json = json.dumps(payload)
        
        # Create signature
        signature = self._sign_request('POST', '/paapi5/getitems', '', payload_json, timestamp)
        
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
            'Content-Encoding': 'amz-1.0',
            'X-Amz-Date': timestamp,
            'Authorization': f'AWS4-HMAC-SHA256 Credential={self.access_key}/{timestamp[:8]}/{self.region}/{self.service}/aws4_request, SignedHeaders=host;x-amz-date, Signature={signature}'
        }
        
        try:
            response = requests.post(self.endpoint, headers=headers, data=payload_json, timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"API request failed: {e}")
            return None

class AmazonProductFetcher:
    def __init__(self, csv_file='product_asin.csv', output_file='products.json'):
        self.csv_file = csv_file
        self.output_file = output_file
        
        # Get API credentials from environment variables
        self.access_key = os.environ.get('AMAZON_ACCESS_KEY')
        self.secret_key = os.environ.get('AMAZON_SECRET_KEY')
        self.partner_tag = os.environ.get('AMAZON_PARTNER_TAG')
        
        if not all([self.access_key, self.secret_key, self.partner_tag]):
            logger.error("Missing required environment variables:")
            logger.error("- AMAZON_ACCESS_KEY")
            logger.error("- AMAZON_SECRET_KEY") 
            logger.error("- AMAZON_PARTNER_TAG")
            raise ValueError("Missing Amazon API credentials")
        
        self.api_client = AmazonAPIClient(
            self.access_key, 
            self.secret_key, 
            self.partner_tag
        )
        
    def parse_api_response(self, response_data, asin_to_csv_data):
        """Parse Amazon API response and extract product information"""
        products = []
        
        if not response_data or 'ItemsResult' not in response_data:
            logger.error("Invalid API response")
            return products
        
        # Handle successful items
        if 'Items' in response_data['ItemsResult']:
            for item in response_data['ItemsResult']['Items']:
                try:
                    asin = item['ASIN']
                    csv_data = asin_to_csv_data.get(asin, {})
                    
                    # Get price from API
                    price = None
                    price_amount = None
                    if ('Offers' in item and 
                        'Listings' in item['Offers'] and 
                        len(item['Offers']['Listings']) > 0):
                        listing = item['Offers']['Listings'][0]
                        if 'Price' in listing:
                            price_amount = float(listing['Price']['Amount'])
                            price = f"${price_amount:.2f}"
                    
                    # Build streamlined product object
                    product = {
                        'running_wattage': self._clean_csv_value(csv_data.get('running_wattage')),
                        'starting_wattage': self._clean_csv_value(csv_data.get('starting_wattage')),
                        'capacity': self._clean_csv_value(csv_data.get('capacity')),
                        'run_time': self._clean_csv_value(csv_data.get('run_time')),
                        'fuel_type': self._clean_csv_value(csv_data.get('fuel_type')),
                        'weight': self._clean_csv_value(csv_data.get('weight')),
                        'link_text': self._clean_csv_value(csv_data.get('link_text')),
                        'affiliate_link': self._clean_csv_value(csv_data.get('affiliate_link')),
                        'asin': asin,
                        'price': price,
                        'price_amount': price_amount
                    }
                    
                    products.append(product)
                    logger.info(f"✓ {asin}: {price if price else 'N/A'} - {csv_data.get('link_text', 'Unknown')}...")
                    
                except Exception as e:
                    logger.error(f"Error parsing item {asin}: {e}")
        
        # Handle errors for individual items
        if 'Errors' in response_data['ItemsResult']:
            for error in response_data['ItemsResult']['Errors']:
                asin_from_error = None
                # Try to extract ASIN from error message or use Code
                error_code = error.get('Code', 'Unknown')
                if len(error_code) == 10:  # ASINs are typically 10 characters
                    asin_from_error = error_code
                
                logger.warning(f"✗ API Error for {error_code}: {error.get('Message', 'Unknown error')}")
                
                # Find corresponding CSV data
                csv_data = {}
                if asin_from_error and asin_from_error in asin_to_csv_data:
                    csv_data = asin_to_csv_data[asin_from_error]
                
                # Still add the product with no price but with CSV data
                product = {
                    'running_wattage': self._clean_csv_value(csv_data.get('running_wattage')),
                    'starting_wattage': self._clean_csv_value(csv_data.get('starting_wattage')),
                    'capacity': self._clean_csv_value(csv_data.get('capacity')),
                    'run_time': self._clean_csv_value(csv_data.get('run_time')),
                    'fuel_type': self._clean_csv_value(csv_data.get('fuel_type')),
                    'weight': self._clean_csv_value(csv_data.get('weight')),
                    'link_text': self._clean_csv_value(csv_data.get('link_text')),
                    'affiliate_link': self._clean_csv_value(csv_data.get('affiliate_link')),
                    'asin': asin_from_error or error_code,
                    'price': None,
                    'price_amount': None
                }
                
                products.append(product)
        
        return products
    
    def _clean_csv_value(self, value):
        """Clean CSV values - handle NaN, empty strings, etc."""
        if pd.isna(value) or value == '' or value is None:
            return None
        return str(value).strip()
    
    def run(self):
        """Main execution"""
        logger.info("🚀 Starting Amazon Product Advertising API fetcher...")
        
        # Read CSV with new structure
        try:
            df = pd.read_csv(self.csv_file)
            logger.info(f"Found {len(df)} products in CSV")
            logger.info(f"CSV columns: {list(df.columns)}")
            
            # Validate required columns
            required_columns = ['asin']
            expected_columns = ['running_wattage', 'starting_wattage', 'capacity', 'run_time', 
                              'fuel_type', 'weight', 'link_text', 'affiliate_link', 'asin']
            
            missing_required = [col for col in required_columns if col not in df.columns]
            if missing_required:
                logger.error(f"Missing required columns: {missing_required}")
                return False
                
            missing_expected = [col for col in expected_columns if col not in df.columns]
            if missing_expected:
                logger.warning(f"Missing expected columns (will use None): {missing_expected}")
                
        except Exception as e:
            logger.error(f"Error reading CSV: {e}")
            return False
        
        all_products = []
        successful = 0
        
        # Create mapping from ASIN to CSV row data
        asin_to_csv_data = {}
        valid_asins = []
        
        for idx, row in df.iterrows():
            asin = str(row.get('asin', '')).strip()
            if asin and not pd.isna(row.get('asin')) and asin != 'nan':
                valid_asins.append(asin)
                # Convert row to dict for easier access
                row_dict = {}
                for col in df.columns:
                    row_dict[col] = row[col]
                asin_to_csv_data[asin] = row_dict
            else:
                logger.warning(f"No valid ASIN for row {idx + 1}: '{asin}', skipping")
        
        if not valid_asins:
            logger.error("No valid ASINs found in CSV")
            return False
        
        logger.info(f"Processing {len(valid_asins)} valid ASINs...")
        
        # Process ASINs in batches of 10 (API limit)
        batch_size = 10
        for i in range(0, len(valid_asins), batch_size):
            batch_asins = valid_asins[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}: ASINs {i+1}-{min(i+batch_size, len(valid_asins))}")
            
            # Create batch CSV data mapping
            batch_csv_data = {asin: asin_to_csv_data[asin] for asin in batch_asins}
            
            # Call Amazon API
            response = self.api_client.get_items(batch_asins)
            
            if response:
                batch_products = self.parse_api_response(response, batch_csv_data)
                
                for product in batch_products:
                    if product['price']:
                        successful += 1
                    all_products.append(product)
            else:
                logger.error(f"Failed to get data for batch {i//batch_size + 1}")
                # Add failed products with CSV data
                for asin in batch_asins:
                    csv_data = asin_to_csv_data[asin]
                    product = {
                        'running_wattage': self._clean_csv_value(csv_data.get('running_wattage')),
                        'starting_wattage': self._clean_csv_value(csv_data.get('starting_wattage')),
                        'capacity': self._clean_csv_value(csv_data.get('capacity')),
                        'run_time': self._clean_csv_value(csv_data.get('run_time')),
                        'fuel_type': self._clean_csv_value(csv_data.get('fuel_type')),
                        'weight': self._clean_csv_value(csv_data.get('weight')),
                        'link_text': self._clean_csv_value(csv_data.get('link_text')),
                        'affiliate_link': self._clean_csv_value(csv_data.get('affiliate_link')),
                        'asin': asin,
                        'price': None,
                        'price_amount': None
                    }
                    all_products.append(product)
            
            # Rate limiting - be respectful to the API
            if i + batch_size < len(valid_asins):
                logger.info("Waiting 1 second before next batch...")
                time.sleep(1)
        
        # Sort products by price (products with prices first, then by price ascending)
        all_products.sort(key=lambda x: (x['price'] is None, x['price_amount'] or float('inf')))
        
        # Save streamlined JSON
        try:
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(all_products, f, indent=2, default=str, ensure_ascii=False)
            
            logger.info(f"✅ Saved {len(all_products)} products to {self.output_file}")
            logger.info(f"📊 Success rate: {successful}/{len(all_products)} ({successful/len(all_products)*100:.1f}%)")
            
            # Display sample output structure
            if all_products:
                logger.info("\n📋 Sample product structure:")
                sample = all_products[0]
                for key, value in sample.items():
                    logger.info(f"  {key}: {value}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving JSON: {e}")
            return False

if __name__ == "__main__":
    try:
        fetcher = AmazonProductFetcher()
        success = fetcher.run()
        exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        exit(1)
