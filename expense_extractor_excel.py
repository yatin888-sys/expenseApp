import pandas as pd
import json

# Load the JSON file
with open('expenses.json', 'r') as file:
    data = json.load(file)

# Convert JSON data to a DataFrame
df = pd.DataFrame(data)

# Save the DataFrame to an Excel file
df.to_excel('output.xlsx', index=False)

print("JSON has been successfully converted to Excel!")
