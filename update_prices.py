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
        if reader.fieldnames:
            reader.fieldnames = [name.strip() if name else name for name in reader.fieldnames]
        
        for row in reader:
            # Clean the row data as well
            cleaned_row = {k.strip() if k else k: v.strip() if v else v for k, v in row.items()}
            # Only add if ASIN exists and is not empty
            if cleaned_row.get('asin') and cleaned_row['asin'].strip():
                products.append(cleaned_row)
    print(f"✅ Successfully read {len(products)} products from CSV")
    
    # Debug: Print the first product to verify structure
    if products:
        print(f"🔍 CSV Headers: {list(products[0].keys())}")
        print(f"🔍 First product ASIN: '{products[0].get('asin', 'MISSING')}'")
        
except Exception as e:
    print(f"❌ Error reading CSV: {e}")
    # Fallback to see what's actually in the file
    try:
        with open("products.csv", "r", encoding="utf-8") as f:
            lines = f.readlines()[:3]  # Read first 3 lines
            print(f"🔍 Raw CSV content (first 3 lines):")
            for i, line in enumerate(lines):
                print(f"Line {i+1}: {repr(line)}")
    except Exception as debug_error:
        print(f"❌ Could not read file for debugging: {debug_error}")
    exit(1)

if not products:
    print("❌ No valid products found in CSV")
    exit(1)

results = []

# Process products one by one with better error handling
for i, product in enumerate(products, 1):
    asin = product.get('asin', '').strip()
    
    if not asin:
        print(f"⚠️ Product {i}: No ASIN found, skipping")
        continue
        
    print(f"🔍 Processing product {i}/{len(products)}: ASIN '{asin}'")
    
    try:
        # Make API call
        response = amazon.get_items(asin)
        
        if not response or "ItemsResult" not in response:
            raise Exception("Invalid API response structure")
            
        if "Items" not in response["ItemsResult"] or not response["ItemsResult"]["Items"]:
            raise Exception("No items found in API response")
            
        item = response["ItemsResult"]["Items"][0]
        
        # Extract price with multiple fallback options
        price = "N/A"
        price_sources = [
            lambda: item["Offers"]["Listings"][0]["Price"]["DisplayAmount"],
            lambda: item["Offers"]["Listings"][0]["Price"]["Amount"],
            lambda: item["Offers"]["Summaries"][0]["LowestPrice"]["DisplayAmount"],
            lambda: item["Offers"]["Summaries"][0]["LowestPrice"]["Amount"],
            lambda: str(item["Offers"]["Listings"][0]["Price"]["Amount"]) if "Amount" in item["Offers"]["Listings"][0]["Price"] else None
        ]
        
        for price_source in price_sources:
            try:
                extracted_price = price_source()
                if extracted_price:
                    price = extracted_price
                    break
            except (KeyError, IndexError, TypeError):
                continue
        
        # Extract title (fallback to CSV title if API doesn't provide one)
        title = product.get("title", "N/A")
        try:
            api_title = item["ItemInfo"]["Title"]["DisplayValue"]
            if api_title:
                title = api_title
        except (KeyError, TypeError):
            pass
        
        result = {
            "asin": asin,
            "title": title,
            "affiliate_link": product.get("affiliate_link", "N/A"),
            "price": price,
            "last_updated": datetime.datetime.utcnow().isoformat()
        }
        
        results.append(result)
        print(f"✅ Successfully processed {asin}: {price}")
        
        # Small delay to avoid rate limiting
        import time
        time.sleep(0.5)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Error processing ASIN '{asin}': {error_msg}")
        
        # Add error entry
        results.append({
            "asin": asin,
            "title": product.get("title", "N/A"),
            "affiliate_link": product.get("affiliate_link", "N/A"),
            "price": "N/A",
            "error": error_msg,
            "last_updated": datetime.datetime.utcnow().isoformat()
        })

# Save results to JSON
try:
    with open("prices.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"✅ prices.json updated with {len(results)} products")
except Exception as e:
    print(f"❌ Error writing JSON file: {e}")

# Print summary
successful_prices = sum(1 for r in results if r.get('price') != 'N/A' and 'error' not in r)
failed_requests = sum(1 for r in results if 'error' in r)

print(f"📊 Summary:")
print(f"  - Total products processed: {len(results)}")
print(f"  - Successful price retrievals: {successful_prices}")
print(f"  - Failed requests: {failed_requests}")

if failed_requests > 0:
    print(f"⚠️ Common failure reasons:")
    error_types = {}
    for r in results:
        if 'error' in r:
            error = r['error'][:50] + "..." if len(r['error']) > 50 else r['error']
            error_types[error] = error_types.get(error, 0) + 1
    
    for error, count in error_types.items():
        print(f"  - {error}: {count} times")
