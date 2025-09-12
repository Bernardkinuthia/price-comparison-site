#!/usr/bin/env python3
"""
HTML Updater Script for Generator Prices
Updates index.html with prices from products.json
"""

import json
import re
from datetime import datetime
from bs4 import BeautifulSoup

def update_html_with_prices():
    # Load the products data
    with open('products.json', 'r') as f:
        data = json.load(f)
    
    # Load the HTML file
    with open('index.html', 'r') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Update timestamp
    timestamp_elem = soup.find('span', {'id': 'update-timestamp'})
    if timestamp_elem:
        timestamp_elem.string = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Update each product row
    product_count = 0
    for product_data in data.get('products', []):
        affiliate_link = product_data.get('affiliate_link', '')
        if not affiliate_link:
            continue
        
        # Find the row with this affiliate link
        row = soup.find('a', {'href': affiliate_link})
        if not row:
            continue
            
        row = row.find_parent('tr')
        if not row:
            continue
        
        # Update price
        price_td = row.find('td', {'class': 'price'})
        if price_td and product_data.get('price_available'):
            price_td.string = product_data.get('price', 'N/A')
        
        # Update price per watt
        price_per_watt_td = row.find('td', {'class': 'price-per-watt'})
        if price_per_watt_td and product_data.get('price_available'):
            price = product_data.get('price', '0')
            wattage = row.get('data-wattage', '0')
            
            try:
                # Extract numeric value from price string
                price_value = float(re.search(r'[\d.]+', price).group())
                wattage_value = float(wattage)
                
                if wattage_value > 0:
                    price_per_watt = price_value / wattage_value
                    price_per_watt_td.string = f'${price_per_watt:.3f}'
                else:
                    price_per_watt_td.string = 'N/A'
            except (ValueError, AttributeError):
                price_per_watt_td.string = 'N/A'
        
        product_count += 1
    
    # Update product count
    count_elem = soup.find('span', {'id': 'product-count'})
    if count_elem:
        count_elem.string = str(product_count)
    
    # Save the updated HTML
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(str(soup))
    
    print(f"Updated {product_count} products in HTML")

if __name__ == "__main__":
    update_html_with_prices()
