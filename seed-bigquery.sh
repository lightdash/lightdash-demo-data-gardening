#!/bin/sh

echo "\033[33m🚀  Running all scripts\033[0m"
echo ""
echo ""

echo "1. update start date to 735 days ago"
date_two_years_ago=$(/bin/date -j -v-735d "+%Y-%m-%d %H:%M:%S")
for file in synth/*.json; do
  sed -i '' "s/\"start\": \"[^\"]*\"/\"start\": \"$date_two_years_ago\"/" $file
done
# echo in green that it's done and add a newlines
echo "\033[32m✅  Done updating start date to 735 days ago\033[0m"
echo ""
echo ""

echo "2. running synths"
synth generate synth --collection users > synth_output_data/users.json
synth generate synth --collection orders > synth_output_data/orders.json
synth generate synth --collection partners > synth_output_data/partners.json
synth generate synth --collection products > synth_output_data/products.json
synth generate synth --collection support_requests > synth_output_data/support_requests.json
synth generate synth --collection orders --random > synth_output_data/orders_random.json
synth generate synth --collection support_requests --random > synth_output_data/support_requests_random.json
echo "\033[32m✅  Done running synths\033[0m"
echo ""
echo ""


echo "3. transform data"
python main.py --path dbt-bigquery
echo "\033[32m✅  Done transforming data\033[0m"
echo ""
echo ""

echo "4. load data to bigquery - You need to do this manually using dbt seed"
echo ""
echo ""

echo "5. ℹ️  You need to run dbt manually to update the tables!"
echo ""
echo ""