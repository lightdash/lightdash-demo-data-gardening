# lightdash-demo-data-gardening
This repo consists of a synthetically generated dataset, along with the config for producing that dataset, and a working dbt project for the data. This data is intended to power a new project "Thyme to Shine Market" as part of the Lightdash demo.

# Pre-requisites
- [Synth](https://github.com/shuttle-hq/synth) for time-series synthetic data generation.
- [Python](https://www.python.org/) for some data transformation using `pandas` and `numpy`.
- [google-cloud-sdk](https://cloud.google.com/sdk/docs/install) for loading to bigquery.
- [dbt](https://docs.getdbt.com/dbt-cli/install/overview) for data transformations as config.

# User guide
## 1. Generate the base data

This will use `synth` to generate all the base datasets using the synth configuration defined in `synth/`, with help from the lookups define in `lookup/`. Note that the final two commands are non-deterministic.

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
## 2. Transform data

This will run some bespoke transformations (using Python `pandas` and `numpy`) on the data to improve its suitability for a demo. Note that this script is non-deterministic since it includes some randomness (e.g. to adjust product popularity).
```
pip install -r requirements.txt
python main.py
```
## 3. Load to bigquery
This will load the datasets into bigquery under the dataset name `lightdash_demo_gardening`.

```
bq load --autodetect=true --replace=true --schema=transformed_data/users.json lightdash_demo_gardening.users transformed_data/users.csv
bq load --autodetect=true --replace=true --schema=transformed_data/orders.json lightdash_demo_gardening.orders transformed_data/orders.csv
bq load --autodetect=true --replace=true --schema=transformed_data/baskets.json lightdash_demo_gardening.baskets transformed_data/baskets.csv
bq load --autodetect=true --replace=true --schema=transformed_data/partners.json lightdash_demo_gardening.partners transformed_data/partners.csv
bq load --autodetect=true --replace=true --schema=transformed_data/products.json lightdash_demo_gardening.products transformed_data/products.csv
bq load --autodetect=true --replace=true --schema=transformed_data/support_requests.json lightdash_demo_gardening.support_requests transformed_data/support_requests.csv
```

## 4. Run dbt

```
cd dbt
dbt run --full-refresh
```
