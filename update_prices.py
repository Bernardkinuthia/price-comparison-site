import csv, json, os, datetime
from amazon_paapi import AmazonApi

# Amazon credentials from GitHub secrets (injected as env variables)
access_key = os.getenv("AMAZON_ACCESS_KEY")
secret_key = os.getenv("AMAZON_SECRET_KEY")
associate_tag = os.getenv("AMAZON_ASSOCIATE_TAG")

# Initialize Amazon API client
amazon = AmazonApi(access_key, secret_key, associate_tag, "US")  # "US" marketplace

# Read products from CSV
products = []
with open("products.csv", newline="", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        products.append(row)

results = []
for product in products:
    try:
        response = amazon.get_items(product["asin"])
        item = response["ItemsResult"]["Items"][0]
        price = item["Offers"]["Listings"][0]["Price"]["DisplayAmount"]

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
            "error": str(e)
        })

# Save results to JSON
with open("prices.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("✅ prices.json updated with", len(results), "products")
