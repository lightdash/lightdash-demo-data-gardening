{{
  config(
    tags = ['not_lightdash']
  )
}}

SELECT 
  CAST(ord.order_id AS STRING) AS order_id,
  {{ shift_timestamp('ord.order_date') }} as order_date,
  CAST(ord.partner_id AS STRING) AS partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.currency,
  ord.basket_total,
  ord.profit,
  ord.referrer,
  CAST(ord.user_id AS STRING) AS user_id,
  usr.email,
  {{ shift_timestamp('usr.created_date') }} AS user_created_date,
  usr.browser,
  JSON_EXTRACT_SCALAR(shipping_address, '$.city') AS shipping_city,
  JSON_EXTRACT_SCALAR(shipping_address, '$.country') AS shipping_country
FROM `lightdash-analytics.lightdash_demo_gardening.orders` ord
  LEFT JOIN `lightdash-analytics.lightdash_demo_gardening.users` usr ON CAST(ord.user_id AS STRING) = CAST(usr.user_id AS STRING)
  LEFT JOIN `lightdash-analytics.lightdash_demo_gardening.partners` prt ON CAST(ord.partner_id AS STRING) = CAST(prt.partner_id AS STRING)
ORDER BY CAST(order_id AS int) ASC