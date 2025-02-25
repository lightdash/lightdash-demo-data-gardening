# lightdash-demo-data-gardening

This repo consists of a synthetically generated dataset, along with the config for producing that dataset, and a working dbt project for the data. This data is intended to power the "Thyme to Shine Market" as part of the Lightdash demo.

# Pre-requisites

- [Synth](https://github.com/shuttle-hq/synth) for time-series synthetic data generation.
- [Python](https://www.python.org/) for some data transformation using `pandas` and `numpy`.
- [google-cloud-sdk](https://cloud.google.com/sdk/docs/install) for loading to bigquery.
- [dbt](https://docs.getdbt.com/dbt-cli/install/overview) for data transformations as config.

# User guide

## 1. Run the script to write the demo data to BigQuery

*Note that you shouldn't need to do this very often! The data should be kept up to data with some configuration in the yml files.*
*That means that the data is updated at run time in Lightdash, so we can keep the underlying objects as table to enable good performance and low cost.*

```bash
sh seed-bigquery.sh
```

This will:
1. use `synth` to generate all the base datasets using the synth configuration defined in `synth/`, with help from the lookups define in `lookup/`. Note that the final two commands are non-deterministic.
2. run some bespoke transformations (using Python `pandas` and `numpy`) on the data to improve its suitability for a demo. Note that this script is non-deterministic since it includes some randomness (e.g. to adjust product popularity).

## 2. Adjust output data

You will need to manually adjust the output data. It's important that you do the following steps:
1. Make sure all CSV files have data that runs to the current date - if they don't you'll need to readjust your settings and generate new data.
2. Manually remove rows that have dates beyond the current date.
3. Make sure to adjust the .yml file date configurations. For each date field, you need to adjust the sql block to specify the maximum timestamp in the given table.

## 3. Execute dbt seed

Running dbt seed will take the data that exists in the CSVs and create objects in BigQuery, that are then used downstream.
```
cd dbt-bigquery
dbt seed
```

## 4. Execute dbt run

This will run the dbt models and build tables in `lightdash-analytics.lightdash_demo_gardening`

```
cd dbt-bigquery
dbt run
```

Now the data in the internal version of Thyme to Shine Market will reflect the new data from the generated CSVs.

## 5. Updating the external demo site.

Now that the internal site is updated, you need to update the externally facing demo site.

You can copy the seeds folder from the dbt-bigquery project into the dbt project.

Before you continue remember to update the sql blocks in each of the yml files! Once that is complete you can execute your dbt run and dbt seed commands targeting the Postgres warehouse.
