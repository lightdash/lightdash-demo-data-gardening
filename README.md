# lightdash-demo-data-gardening
Demo dbt project using fake gardening e-commerce platform data

# 1. generate all the synth datasets
```
synth generate synth --collection users > synth_output_data/users.json
synth generate synth --collection orders > synth_output_data/orders.json
synth generate synth --collection baskets > synth_output_data/baskets.json
synth generate synth --collection partners > synth_output_data/partners.json
synth generate synth --collection products > synth_output_data/products.json
synth generate synth --collection support_requests > synth_output_data/support_requests.json

synth generate synth --collection orders --random > synth_output_data/orders_random.json
synth generate synth --collection support_requests --random > synth_output_data/support_requests_random.json
```
# 2. run transformation script
remember to check the charts and data critically, along the way...
```
pip install -r requirements.txt
python main.py
```
# 3. load to bigquery

```
bq load --autodetect=true lightdash_demo_gardening.users transformed_data/users.csv
bq load --autodetect=true lightdash_demo_gardening.orders transformed_data/orders.csv
bq load --autodetect=true lightdash_demo_gardening.baskets transformed_data/baskets.csv
bq load --autodetect=true lightdash_demo_gardening.partners transformed_data/partners.csv
bq load --autodetect=true lightdash_demo_gardening.products transformed_data/products.csv
bq load --autodetect=true lightdash_demo_gardening.support_requests transformed_data/support_requests.csv
```

# 4. run dbt

```
cd dbt
dbt run --full-refresh
```