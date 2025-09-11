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
        for row in reader:
            products.append(row)
    print(f"✅ Successfully read {len(products)} products from CSV")
except UnicodeDecodeError as e:
    print(f"UTF-8 encoding failed: {e}")
    # Try with error handling to skip problematic characters
    with open("products.csv", newline="", encoding="utf-8", errors="replace") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            products.append(row)
    print(f"✅ Read {len(products)} products with character replacement")
except Exception as e:
    print(f"Error reading CSV: {e}")
    # Last resort - try latin-1 encoding
    with open("products.csv", newline="", encoding="latin-1") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            products.append(row)
    print(f"✅ Read {len(products)} products with latin-1 encoding")

results = []
for product in products:
    try:
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
        results.append({
            "asin": product["asin"],
            "title": product["title"],
            "affiliate_link": product["affiliate_link"],
            "price": "N/A",
            "error": str(e),
            "last_updated": datetime.datetime.utcnow().isoformat()
        })

# Save results to JSON
with open("prices.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("✅ prices.json updated with", len(results), "products")
