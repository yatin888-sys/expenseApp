import json

# Load the JSON data
with open('expenses.json', 'r') as f:
    data = json.load(f)

# Sort the data by the 'date' key
data_sorted = sorted(data, key=lambda x: x['date'])

# Overwrite the "id" properties with sequential unique integers
for idx, item in enumerate(data_sorted, start=1):
    item['id'] = idx

# Save the sorted data back to the file (or a new file)
with open('data_sorted.json', 'w') as f:
    json.dump(data_sorted, f, indent=2)