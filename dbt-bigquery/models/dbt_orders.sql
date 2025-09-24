{{
  config(
    tags = ['not_lightdash']
  )
}}

SELECT 
  CAST(ord.order_id AS STRING) AS order_id,
  -- Calculate days between current timestamp and 2025-02-12 (the max order_date in our dataset), then add those days to order_date
  -- This ensures that the demo data always appears recent & uses dbt macros to ensure this works across data warehouses
  -- Note that this requires regular builds to keep the data fresh
  {{ dbt.dateadd("day", 
    dbt.datediff("'2025-02-12'", dbt.current_timestamp(), "day"), 
    "ord.order_date") }} as order_date,
  CAST(ord.partner_id AS STRING) AS partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.currency,
  ord.basket_total,
  ord.profit,
  ord.referrer,
  CAST(ord.user_id AS STRING) AS user_id,
  usr.email,
  -- Calculate days between current timestamp and 2025-02-12 (the max order_date in our dataset), then add those days to user_created_date
  -- This ensures that the demo data always appears recent & uses dbt macros to ensure this works across data warehouses
  -- Note that this requires regular builds to keep the data fresh
  {{ dbt.dateadd("day", 
    dbt.datediff("'2025-02-12'", dbt.current_timestamp(), "day"), 
    "usr.created_date") }} as user_created_date,
  usr.browser,
  JSON_EXTRACT_SCALAR(shipping_address, '$.city') AS shipping_city,
  JSON_EXTRACT_SCALAR(shipping_address, '$.country') AS shipping_country
FROM {{ ref('orders') }} ord
  LEFT JOIN {{ ref('users') }} usr ON CAST(ord.user_id AS STRING) = CAST(usr.user_id AS STRING)
  LEFT JOIN {{ ref('partners') }} prt ON CAST(ord.partner_id AS STRING) = CAST(prt.partner_id AS STRING)
ORDER BY CAST(order_id AS int) ASC