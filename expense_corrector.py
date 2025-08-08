import json
from datetime import datetime, timedelta

# Step 1: Load the data from the old JSON file
with open('expenses_old.json', 'r') as f:
    expenses = json.load(f)

# Step 2: Loop through each record and increment the date
for record in expenses:
    # Convert the date string to a datetime object
    date_obj = datetime.strptime(record['date'], '%Y-%m-%d')
    
    # Add one day to the date
    new_date_obj = date_obj + timedelta(days=1)
    
    # Convert the new date back to string and update the record
    record['date'] = new_date_obj.strftime('%Y-%m-%d')

# Step 3: Write the updated data to the new JSON file
with open('expenses.json', 'w') as f:
    json.dump(expenses, f, indent=4)

print("Date modification complete. New data saved in 'expenses.json'.")
