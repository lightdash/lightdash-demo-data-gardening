#!/bin/sh
# Load the seed CSVs into BigQuery. Replaces `dbt seed` / `dbt build`.
#
# The pure Lightdash models in lightdash/models/ read these raw tables directly
# and do their joins in sql_from, so there is nothing to build after this.
#
# Schemas are pinned explicitly, in CSV column order, so types match what the
# models expect (dates as TIMESTAMP, ids as NUMERIC and cast to STRING in the
# models). Autodetect is deliberately not used.
#
# Usage:
#   ./load-seeds.sh                                   # loads the external demo dataset
#   DATASET=lightdash-analytics:lightdash_demo_gardening ./load-seeds.sh
#
# WARNING: --replace truncates each table before loading.

set -e

DATASET="${DATASET:-lightdash-healthcare-demo:lightdash_gardening_demo}"
# The CSVs stay in the dbt project so `dbt seed` there keeps working.
SEEDS="${SEEDS:-$(cd "$(dirname "$0")/../dbt-bigquery/seeds" && pwd)}"

load() {
  table="$1"
  schema="$2"
  echo "Loading ${DATASET}.${table}"
  bq load \
    --replace \
    --source_format=CSV \
    --skip_leading_rows=1 \
    --allow_quoted_newlines \
    "${DATASET}.${table}" \
    "${SEEDS}/${table}.csv" \
    "${schema}"
}

load users            'user_id:NUMERIC,email:STRING,created_date:TIMESTAMP,browser:STRING,shipping_address:STRING'
load orders           'order_id:NUMERIC,order_date:TIMESTAMP,user_id:NUMERIC,partner_id:NUMERIC,ordered_product_skus:STRING,currency:STRING,basket_total:NUMERIC,profit:NUMERIC,referrer:STRING'
load baskets          'order_id:NUMERIC,basket_item_id:NUMERIC,ordered_product_skus:NUMERIC,price_amount:NUMERIC,basket_total:NUMERIC'
load partners         'partner_id:NUMERIC,partner_name:STRING,partner_commission:NUMERIC,partner_logo:STRING'
load products         'sku:NUMERIC,product_name:STRING,price_amount:NUMERIC,price_currency:STRING'
load support_requests 'request_id:NUMERIC,order_id:NUMERIC,request_date:TIMESTAMP,reason:STRING,feedback_rating:NUMERIC'

echo
echo "Done. Now refresh the semantic layer:"
echo "  lightdash deploy --project-dir . --no-warehouse-credentials"
