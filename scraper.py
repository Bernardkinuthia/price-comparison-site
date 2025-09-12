#!/usr/bin/env python3
"""
Amazon Product Advertising API Price Fetcher
Uses official Amazon API to fetch product prices and information
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
                "ItemInfo.TechnicalInfo"
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
        
    def parse_api_response(self, response_data, original_asins):
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
                    
                    # Get title
                    title = "Unknown Product"
                    if 'ItemInfo' in item and 'Title' in item['ItemInfo']:
                        title = item['ItemInfo']['Title']['DisplayValue']
                    
                    # Get price
                    price = None
                    currency = '$'
                    if ('Offers' in item and 
                        'Listings' in item['Offers'] and 
                        len(item['Offers']['Listings']) > 0):
                        listing = item['Offers']['Listings'][0]
                        if 'Price' in listing:
                            price_amount = listing['Price']['Amount']
                            price = f"${price_amount:.2f}"
                            currency = listing['Price']['Currency']
                    
                    # Get additional info if available
                    features = []
                    if ('ItemInfo' in item and 
                        'Features' in item['ItemInfo'] and 
                        'DisplayValues' in item['ItemInfo']['Features']):
                        features = item['ItemInfo']['Features']['DisplayValues']
                    
                    product = {
                        'asin': asin,
                        'title': title,
                        'price': price,
                        'currency': currency,
                        'features': features,
                        'last_updated': datetime.now().isoformat(),
                        'price_available': price is not None,
                        'api_source': True
                    }
                    
                    products.append(product)
                    logger.info(f"✓ {asin}: {currency}{price if price else 'N/A'} - {title[:50]}...")
                    
                except Exception as e:
                    logger.error(f"Error parsing item: {e}")
        
        # Handle errors for individual items
        if 'Errors' in response_data['ItemsResult']:
            for error in response_data['ItemsResult']['Errors']:
                asin = error.get('Code', 'Unknown')
                logger.warning(f"✗ API Error for {asin}: {error.get('Message', 'Unknown error')}")
                
                # Still add the product with no price
                products.append({
                    'asin': asin,
                    'title': f"Product {asin}",
                    'price': None,
                    'currency': '$',
                    'features': [],
                    'last_updated': datetime.now().isoformat(),
                    'price_available': False,
                    'api_source': True,
                    'error': error.get('Message', 'Unknown error')
                })
        
        return products
    
    def run(self):
        """Main execution"""
        logger.info("🚀 Starting Amazon Product Advertising API fetcher...")
        
        # Read CSV
        try:
            df = pd.read_csv(self.csv_file)
            logger.info(f"Found {len(df)} products in CSV")
        except Exception as e:
            logger.error(f"Error reading CSV: {e}")
            return False
        
        all_products = []
        successful = 0
        
        # Get ASINs from CSV
        asins = []
        asin_to_row = {}
        
        for idx, row in df.iterrows():
            asin = row.get('asin', '').strip()
            if asin and not pd.isna(asin):
                asins.append(asin)
                asin_to_row[asin] = row
            else:
                logger.warning(f"No ASIN for row {idx + 1}, skipping")
        
        if not asins:
            logger.error("No valid ASINs found in CSV")
            return False
        
        logger.info(f"Processing {len(asins)} ASINs...")
        
        # Process ASINs in batches of 10 (API limit)
        batch_size = 10
        for i in range(0, len(asins), batch_size):
            batch_asins = asins[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}: ASINs {i+1}-{min(i+batch_size, len(asins))}")
            
            # Call Amazon API
            response = self.api_client.get_items(batch_asins)
            
            if response:
                batch_products = self.parse_api_response(response, batch_asins)
                
                # Merge with CSV data
                for product in batch_products:
                    asin = product['asin']
                    if asin in asin_to_row:
                        row = asin_to_row[asin]
                        # Add CSV columns to product
                        for col in df.columns:
                            if col != 'asin' and not pd.isna(row[col]):
                                product[col] = str(row[col])
                    
                    if product['price_available']:
                        successful += 1
                        
                    all_products.append(product)
            else:
                logger.error(f"Failed to get data for batch {i//batch_size + 1}")
                # Add failed products
                for asin in batch_asins:
                    product = {
                        'asin': asin,
                        'title': f"Product {asin}",
                        'price': None,
                        'currency': '$',
                        'features': [],
                        'last_updated': datetime.now().isoformat(),
                        'price_available': False,
                        'api_source': True,
                        'error': 'API request failed'
                    }
                    if asin in asin_to_row:
                        row = asin_to_row[asin]
                        for col in df.columns:
                            if col != 'asin' and not pd.isna(row[col]):
                                product[col] = str(row[col])
                    all_products.append(product)
            
            # Rate limiting - be respectful to the API
            if i + batch_size < len(asins):
                logger.info("Waiting 1 second before next batch...")
                time.sleep(1)
        
        # Save to JSON
        try:
            output_data = {
                'last_updated': datetime.now().isoformat(),
                'total_products': len(all_products),
                'successful_prices': successful,
                'api_used': True,
                'products': all_products
            }
            
            with open(self.output_file, 'w') as f:
                json.dump(output_data, f, indent=2, default=str)
            
            logger.info(f"✅ Saved {len(all_products)} products to {self.output_file}")
            logger.info(f"📊 Success rate: {successful}/{len(all_products)} ({successful/len(all_products)*100:.1f}%)")
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
