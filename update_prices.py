import csv, json, os, datetime
from paapi5_python_sdk.api.default_api import DefaultApi
from paapi5_python_sdk.models.get_items_request import GetItemsRequest
from paapi5_python_sdk.models.partner_type import PartnerType
from paapi5_python_sdk.rest import ApiException

# Amazon credentials from GitHub secrets (injected as env variables)
access_key = os.getenv("AMAZON_ACCESS_KEY")
secret_key = os.getenv("AMAZON_SECRET_KEY")
associate_tag = os.getenv("AMAZON_ASSOCIATE_TAG")

# Initialize Amazon API client
host = "webservices.amazon.com"
region = "us-east-1"

default_api = DefaultApi(
    access_key=access_key, 
    secret_key=secret_key, 
    host=host, 
    region=region
)

def get_product_info(asin_list):
    """Get product information from Amazon API"""
    get_items_request = GetItemsRequest(
        partner_tag=associate_tag,
        partner_type=PartnerType.ASSOCIATES,
        marketplace="www.amazon.com",
        item_ids=asin_list,
        resources=[
            "Images.Primary.Medium",
            "ItemInfo.Title",
            "Offers.Listings.Price"
        ]
    )
    
    try:
        response = default_api.get_items(get_items_request)
        return response
    except ApiException as e:
        print(f"API Exception: {e}")
        return None

# Read products from CSV with better error handling
products = []
try:
    with open("products.csv", newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        # Clean the fieldnames to remove any whitespace
        reader.fieldnames = [name.strip() if name else name for name in reader.fieldnames]
        
        for row in reader:
            # Clean the row data as well
            cleaned_row = {k.strip(): v.strip() if v else v for k, v in row.items()}
            # Only add if ASIN exists and is not empty
            if cleaned_row.get('asin') and cleaned_row['asin'].strip():
                products.append(cleaned_row)
    print(f"✅ Successfully read {len(products)} products from CSV")
    
    # Debug: Print the first product to verify structure
    if products:
        print(f"🔍 First product keys: {list(products[0].keys())}")
        print(f"🔍 First product ASIN: '{products[0].get('asin', 'MISSING')}'")
        
except UnicodeDecodeError as e:
    print(f"UTF-8 encoding failed: {e}")
    # Try with error handling to skip problematic characters
    with open("products.csv", newline="", encoding="utf-8", errors="replace") as csvfile:
        reader = csv.DictReader(csvfile)
        reader.fieldnames = [name.strip() if name else name for name in reader.fieldnames]
        for row in reader:
            cleaned_row = {k.strip(): v.strip() if v else v for k, v in row.items()}
            if cleaned_row.get('asin') and cleaned_row['asin'].strip():
                products.append(cleaned_row)
    print(f"✅ Read {len(products)} products with character replacement")
    
except Exception as e:
    print(f"Error reading CSV: {e}")
    # Last resort - try latin-1 encoding
    with open("products.csv", newline="", encoding="latin-1") as csvfile:
        reader = csv.DictReader(csvfile)
        reader.fieldnames = [name.strip() if name else name for name in reader.fieldnames]
        for row in reader:
            cleaned_row = {k.strip(): v.strip() if v else v for k, v in row.items()}
            if cleaned_row.get('asin') and cleaned_row['asin'].strip():
                products.append(cleaned_row)
    print(f"✅ Read {len(products)} products with latin-1 encoding")

results = []

# Process products in batches (Amazon API allows up to 10 items per request)
batch_size = 10
for i in range(0, len(products), batch_size):
    batch = products[i:i + batch_size]
    asin_list = [product['asin'] for product in batch]
    
    print(f"🔍 Processing batch with ASINs: {asin_list}")
    
    try:
        response = get_product_info(asin_list)
        
        if response and hasattr(response, 'items_result') and response.items_result:
            # Create a lookup dict for easier access
            batch_lookup = {product['asin']: product for product in batch}
            
            for item in response.items_result.items:
                asin = item.asin
                original_product = batch_lookup.get(asin, {})
                
                # Try to get price from different possible locations
                price = "N/A"
                try:
                    if (hasattr(item, 'offers') and item.offers and 
                        hasattr(item.offers, 'listings') and item.offers.listings and
                        len(item.offers.listings) > 0 and 
                        hasattr(item.offers.listings[0], 'price') and item.offers.listings[0].price):
                        
                        price_obj = item.offers.listings[0].price
                        if hasattr(price_obj, 'display_amount'):
                            price = price_obj.display_amount
                        elif hasattr(price_obj, 'amount'):
                            price = str(price_obj.amount)
                except Exception as price_error:
                    print(f"⚠️ Price extraction error for {asin}: {price_error}")
                
                # Get title
                title = original_product.get('title', 'N/A')
                try:
                    if (hasattr(item, 'item_info') and item.item_info and 
                        hasattr(item.item_info, 'title') and item.item_info.title and
                        hasattr(item.item_info.title, 'display_value')):
                        title = item.item_info.title.display_value
                except Exception as title_error:
                    print(f"⚠️ Title extraction error for {asin}: {title_error}")
                
                results.append({
                    "asin": asin,
                    "title": title,
                    "affiliate_link": original_product.get("affiliate_link", "N/A"),
                    "price": price,
                    "last_updated": datetime.datetime.utcnow().isoformat()
                })
                
                print(f"✅ Successfully processed {asin}: {price}")
        else:
            # Handle case where API call failed
            for product in batch:
                results.append({
                    "asin": product.get("asin", "N/A"),
                    "title": product.get("title", "N/A"),
                    "affiliate_link": product.get("affiliate_link", "N/A"),
                    "price": "N/A",
                    "error": "API response failed",
                    "last_updated": datetime.datetime.utcnow().isoformat()
                })
                print(f"❌ API failed for {product.get('asin', 'unknown')}")
        
    except Exception as e:
        print(f"❌ Batch processing error: {str(e)}")
        # Add error entries for this batch
        for product in batch:
            results.append({
                "asin": product.get("asin", "N/A"),
                "title": product.get("title", "N/A"),
                "affiliate_link": product.get("affiliate_link", "N/A"),
                "price": "N/A",
                "error": str(e),
                "last_updated": datetime.datetime.utcnow().isoformat()
            })

# Save results to JSON
with open("prices.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"✅ prices.json updated with {len(results)} products")

# Print summary
successful_prices = sum(1 for r in results if r.get('price') != 'N/A')
print(f"📊 Successfully retrieved {successful_prices}/{len(results)} prices")
