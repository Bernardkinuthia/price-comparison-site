import csv, json, os, datetime, time
import hashlib, hmac, base64
from urllib.parse import quote, urlencode
import requests

# Amazon credentials from GitHub secrets
access_key = os.getenv("AMAZON_ACCESS_KEY")
secret_key = os.getenv("AMAZON_SECRET_KEY")
associate_tag = os.getenv("AMAZON_ASSOCIATE_TAG")

class AmazonPAAPI:
    def __init__(self, access_key, secret_key, associate_tag, region="us-east-1"):
        self.access_key = access_key
        self.secret_key = secret_key
        self.associate_tag = associate_tag
        self.region = region
        self.host = "webservices.amazon.com"
        self.marketplace = "www.amazon.com"
    
    def _get_signature(self, string_to_sign):
        """Generate AWS signature"""
        signing_key = ("AWS4" + self.secret_key).encode('utf-8')
        date_key = hmac.new(signing_key, datetime.datetime.utcnow().strftime('%Y%m%d').encode('utf-8'), hashlib.sha256).digest()
        region_key = hmac.new(date_key, self.region.encode('utf-8'), hashlib.sha256).digest()
        service_key = hmac.new(region_key, 'ProductAdvertisingAPI'.encode('utf-8'), hashlib.sha256).digest()
        request_key = hmac.new(service_key, 'aws4_request'.encode('utf-8'), hashlib.sha256).digest()
        signature = hmac.new(request_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
        return signature
    
    def get_items(self, asin_list):
        """Get item information from Amazon PA-API"""
        if isinstance(asin_list, str):
            asin_list = [asin_list]
        
        # Request payload
        payload = {
            "ItemIds": asin_list,
            "Resources": [
                "ItemInfo.Title",
                "Offers.Listings.Price"
            ],
            "PartnerTag": self.associate_tag,
            "PartnerType": "Associates",
            "Marketplace": self.marketplace
        }
        
        # Headers
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Encoding': 'amz-1.0',
            'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
            'Host': self.host
        }
        
        # Current timestamp
        timestamp = datetime.datetime.utcnow()
        amz_date = timestamp.strftime('%Y%m%dT%H%M%SZ')
        date_stamp = timestamp.strftime('%Y%m%d')
        
        # Create canonical request
        canonical_headers = f"content-type:application/json; charset=utf-8\nhost:{self.host}\nx-amz-date:{amz_date}\nx-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n"
        signed_headers = "content-type;host;x-amz-date;x-amz-target"
        payload_json = json.dumps(payload, separators=(',', ':'))
        payload_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
        
        canonical_request = f"POST\n/paapi5/getitems\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
        
        # Create string to sign
        credential_scope = f"{date_stamp}/{self.region}/ProductAdvertisingAPI/aws4_request"
        string_to_sign = f"AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
        
        # Create signature
        signature = self._get_signature(string_to_sign)
        
        # Create authorization header
        authorization_header = f"AWS4-HMAC-SHA256 Credential={self.access_key}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
        
        # Add auth headers
        headers['Authorization'] = authorization_header
        headers['X-Amz-Date'] = amz_date
        
        # Make request
        url = f"https://{self.host}/paapi5/getitems"
        
        try:
            response = requests.post(url, headers=headers, data=payload_json, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"API Error {response.status_code}: {response.text}")
                return None
        except Exception as e:
            print(f"Request error: {e}")
            return None

# Initialize API client
if not all([access_key, secret_key, associate_tag]):
    print("❌ Missing Amazon API credentials")
    exit(1)

amazon_api = AmazonPAAPI(access_key, secret_key, associate_tag)

# Function to clean BOM from string
def remove_bom(text):
    """Remove UTF-8 BOM from string"""
    if text.startswith('\ufeff'):
        return text[1:]
    return text

# Read products from CSV
products = []
try:
    print("📖 Reading products from CSV...")
    
    # Read with UTF-8-SIG encoding to handle BOM automatically
    with open("products.csv", newline="", encoding="utf-8-sig") as csvfile:
        content = csvfile.read()
        print(f"🔍 File size: {len(content)} characters")
    
    # Reset file pointer and read with csv module
    with open("products.csv", newline="", encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile)
        headers = reader.fieldnames
        print(f"🔍 CSV Headers: {headers}")
        
        if not headers:
            raise Exception("No headers found in CSV file")
        
        # Clean headers (remove BOM and whitespace)
        if headers:
            cleaned_headers = []
            for name in headers:
                if name:
                    cleaned_name = remove_bom(name.strip())
                    cleaned_headers.append(cleaned_name)
                else:
                    cleaned_headers.append(name)
            reader.fieldnames = cleaned_headers
            print(f"🔍 Cleaned Headers: {reader.fieldnames}")
        
        row_count = 0
        for row in reader:
            row_count += 1
            # Clean row data
            cleaned_row = {}
            for k, v in row.items():
                clean_key = remove_bom(k.strip()) if k else k
                clean_value = v.strip() if v else v
                cleaned_row[clean_key] = clean_value
            
            # Debug: Print the actual key names for first row
            if row_count == 1:
                print(f"🔍 First row keys: {list(cleaned_row.keys())}")
                print(f"🔍 First row ASIN value: '{cleaned_row.get('asin', 'KEY_NOT_FOUND')}'")
            
            # Check if ASIN exists and is valid
            asin = cleaned_row.get('asin', '').strip()
            if asin and len(asin) == 10 and asin.isalnum():  # Amazon ASINs are 10 alphanumeric characters
                products.append(cleaned_row)
                print(f"  ✅ Row {row_count}: ASIN '{asin}' - Valid")
            else:
                print(f"  ⚠️ Row {row_count}: ASIN '{asin}' - Invalid or missing (length: {len(asin) if asin else 0})")
        
    print(f"✅ Successfully loaded {len(products)} valid products from {row_count} total rows")
    
except Exception as e:
    print(f"❌ Error reading CSV: {e}")
    # Try to read raw file for debugging
    try:
        with open("products.csv", "r", encoding="utf-8") as f:
            lines = f.readlines()
            print(f"🔍 First few lines of CSV:")
            for i, line in enumerate(lines[:5]):
                print(f"  Line {i+1}: {repr(line)}")
        
        # Also try reading the first line to check for BOM
        with open("products.csv", "rb") as f:
            first_bytes = f.read(10)
            print(f"🔍 First 10 bytes of file: {first_bytes}")
            if first_bytes.startswith(b'\xef\xbb\xbf'):
                print("🔍 UTF-8 BOM detected in file!")
    except:
        pass
    exit(1)

if not products:
    print("❌ No valid products found")
    exit(1)

# Process products
results = []
print(f"\n🚀 Starting to process {len(products)} products...")

for i, product in enumerate(products, 1):
    asin = product['asin']
    print(f"\n📦 Processing {i}/{len(products)}: {asin}")
    
    try:
        # Call Amazon API
        response = amazon_api.get_items([asin])
        
        if not response:
            raise Exception("No response from Amazon API")
        
        # Check for errors in response
        if 'Errors' in response:
            error_msg = response['Errors'][0].get('Message', 'Unknown API error')
            raise Exception(f"API Error: {error_msg}")
        
        if 'ItemsResult' not in response or 'Items' not in response['ItemsResult']:
            raise Exception("Invalid response structure")
        
        items = response['ItemsResult']['Items']
        if not items:
            raise Exception("No items returned")
        
        item = items[0]
        
        # Extract price
        price = "N/A"
        try:
            offers = item.get('Offers', {})
            listings = offers.get('Listings', [])
            if listings:
                price_info = listings[0].get('Price', {})
                price = price_info.get('DisplayAmount', price_info.get('Amount', 'N/A'))
        except Exception as price_error:
            print(f"  ⚠️ Price extraction failed: {price_error}")
        
        # Extract title
        title = product.get('title', 'N/A')
        try:
            item_info = item.get('ItemInfo', {})
            title_info = item_info.get('Title', {})
            api_title = title_info.get('DisplayValue')
            if api_title:
                title = api_title
        except Exception as title_error:
            print(f"  ⚠️ Title extraction failed: {title_error}")
        
        # Create result
        result = {
            "asin": asin,
            "title": title,
            "affiliate_link": product.get("affiliate_link", "N/A"),
            "price": price,
            "last_updated": datetime.datetime.utcnow().isoformat()
        }
        
        results.append(result)
        print(f"  ✅ Success: Price = {price}")
        
        # Rate limiting - Amazon allows 1 request per second for free tier
        time.sleep(1)
        
    except Exception as e:
        error_msg = str(e)
        print(f"  ❌ Failed: {error_msg}")
        
        result = {
            "asin": asin,
            "title": product.get("title", "N/A"),
            "affiliate_link": product.get("affiliate_link", "N/A"),
            "price": "N/A",
            "error": error_msg,
            "last_updated": datetime.datetime.utcnow().isoformat()
        }
        results.append(result)

# Save results
print(f"\n💾 Saving results to prices.json...")
try:
    with open("prices.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("✅ File saved successfully")
except Exception as e:
    print(f"❌ Error saving file: {e}")

# Summary
successful = sum(1 for r in results if r.get('price') != 'N/A' and 'error' not in r)
failed = len(results) - successful

print(f"\n📊 SUMMARY:")
print(f"  Total processed: {len(results)}")
print(f"  Successful: {successful}")
print(f"  Failed: {failed}")

if failed > 0:
    print(f"\n❌ Failed items:")
    for r in results:
        if 'error' in r:
            print(f"  - {r['asin']}: {r['error']}")

print(f"\n🎉 Process completed!")
