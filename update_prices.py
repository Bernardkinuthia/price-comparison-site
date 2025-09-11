import csv, json, os, datetime
from amazon_paapi import AmazonApi

# Amazon credentials from GitHub secrets (injected as env variables)
access_key = os.getenv("AMAZON_ACCESS_KEY")
secret_key = os.getenv("AMAZON_SECRET_KEY")
associate_tag = os.getenv("AMAZON_ASSOCIATE_TAG")

# Initialize Amazon API client
amazon = AmazonApi(access_key, secret_key, associate_tag, "US")

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
            products.append(cleaned_row)
    print(f"✅ Successfully read {len(products)} products from CSV")
    
    # Debug: Print the first product to verify structure
    if products:
        print(f"🔍 First product keys: {list(products[0].keys())}")
        print(f"🔍 First product: {products[0]}")
        
except UnicodeDecodeError as e:
    print(f"UTF-8 encoding failed: {e}")
    # Try with error handling to skip problematic characters
    with open("products.csv", newline="", encoding="utf-8", errors="replace") as csvfile:
        reader = csv.DictReader(csvfile)
        reader.fieldnames = [name.strip() if name else name for name in reader.fieldnames]
        for row in reader:
            cleaned_row = {k.strip(): v.strip() if v else v for k, v in row.items()}
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
            products.append(cleaned_row)
    print(f"✅ Read {len(products)} products with latin-1 encoding")

results = []
for product in products:
    try:
        # Add some debugging for the problematic line
        print(f"🔍 Processing product with ASIN: {product.get('asin', 'MISSING')}")
        
        response = amazon.get_items(product["asin"])
        item = response["ItemsResult"]["Items"][0]
        
        # Try to get price from different possible locations
        price = "N/A"
        try:
            price = item["Offers"]["Listings"][0]["Price"]["DisplayAmount"]
        except (KeyError, IndexError):
            try:
                price = item["Offers"]["Listings"][0]["Price"]["Amount"]
            except (KeyError, IndexError):
                pass
        
        results.append({
            "asin": product["asin"],
            "title": product["title"],
            "affiliate_link": product["affiliate_link"],
            "price": price,
            "last_updated": datetime.datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error processing {product.get('asin', 'unknown ASIN')}: {str(e)}")
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

print("✅ prices.json updated with", len(results), "products")
