SELECT 
  CAST(bsk.order_id AS STRING) AS order_id,
  CAST(bsk.basket_item_id AS STRING) AS item_id,
  bsk.ordered_product_skus AS sku,
  prd.product_name,
  prd.price_currency AS currency,
  bsk.price_amount AS item_price,
  bsk.basket_total,
  -- Calculate days between current timestamp and 2025-02-12 (the max date in our dataset), then add those days to order_date
  -- This ensures that the demo data always appears recent & uses dbt macros to ensure this works across data warehouses
  -- Note that this requires regular builds to keep the data fresh
  {{ dbt.dateadd("day", 
    dbt.datediff("'2025-02-12'", dbt.current_timestamp(), "day"), 
    "ord.order_date") }} as order_date,
  ord.profit,
  (
    bsk.price_amount * prt.partner_commission
  ) AS item_profit,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission
FROM {{ ref('baskets') }} bsk
  LEFT JOIN {{ ref('products') }} prd ON CAST(ordered_product_skus AS STRING) = CAST(prd.sku AS STRING)
  LEFT JOIN {{ ref('orders') }} ord ON CAST(bsk.order_id AS STRING) = CAST(ord.order_id AS STRING)
  LEFT JOIN {{ ref('partners') }} prt ON CAST(ord.partner_id AS STRING) = CAST(prt.partner_id AS STRING)
ORDER BY bsk.basket_item_id ASC