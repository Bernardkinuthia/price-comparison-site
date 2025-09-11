import csv, json, os, datetime
from paapi5_python_sdk.api.default_api import DefaultApi
from paapi5_python_sdk.configuration import Configuration
from paapi5_python_sdk.models.get_items_request import GetItemsRequest
from paapi5_python_sdk.models.partner_type import PartnerType
from paapi5_python_sdk.rest import ApiException

# Amazon credentials from GitHub secrets (injected as env variables)
access_key = os.getenv("AMAZON_ACCESS_KEY")
secret_key = os.getenv("AMAZON_SECRET_KEY")
associate_tag = os.getenv("AMAZON_ASSOCIATE_TAG")

# Configure the API
configuration = Configuration()
configuration.access_key = access_key
configuration.secret_key = secret_key
configuration.host = "webservices.amazon.com"
configuration.region = "us-east-1"

# Create API instance
api_instance = DefaultApi(configuration=configuration)

# Read products from CSV
products = []
with open("products.csv", newline="", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        products.append(row)

results = []
for product in products:
    try:
        # Create request for this product
        request = GetItemsRequest(
            partner_tag=associate_tag,
            partner_type=PartnerType.ASSOCIATES,
            marketplace="www.amazon.com",
            item_ids=[product["asin"]],
            resources=[
                "ItemInfo.Title",
                "Offers.Listings.Price",
                "ItemInfo.ProductInfo"
            ]
        )
        
        # Make API call
        response = api_instance.get_items(request)
        
        # Extract price from response
        if response.items_result and response.items_result.items:
            item = response.items_result.items[0]
            price = "N/A"
            
            # Try to get price from offers
            if (hasattr(item, 'offers') and 
                item.offers and 
                item.offers.listings and 
                len(item.offers.listings) > 0 and
                item.offers.listings[0].price):
                price = item.offers.listings[0].price.display_amount
            
            results.append({
                "asin": product["asin"],
                "title": product["title"],
                "affiliate_link": product["affiliate_link"],
                "price": price,
                "last_updated": datetime.datetime.utcnow().isoformat()
            })
        else:
            results.append({
                "asin": product["asin"],
                "title": product["title"],
                "affiliate_link": product["affiliate_link"],
                "price": "N/A",
                "error": "No item data returned"
            })
            
    except ApiException as e:
        results.append({
            "asin": product["asin"],
            "title": product["title"],
            "affiliate_link": product["affiliate_link"],
            "price": "N/A",
            "error": f"API Error: {str(e)}"
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
