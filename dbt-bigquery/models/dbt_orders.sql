{{
  config(
    tags = ['not_lightdash']
  )
}}

SELECT 
  CAST(ord.order_id AS STRING) AS order_id,
  ord.order_date,
  CAST(ord.partner_id AS STRING) AS partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.currency,
  ord.basket_total,
  ord.profit,
  ord.referrer,
  CAST(ord.user_id AS STRING) AS user_id,
  usr.email,
  usr.created_date AS user_created_date,
  usr.browser,
  JSON_EXTRACT_SCALAR(shipping_address, '$.city') AS shipping_city,
  JSON_EXTRACT_SCALAR(shipping_address, '$.country') AS shipping_country
FROM {{ ref('orders') }} ord
  LEFT JOIN {{ ref('users') }} usr ON CAST(ord.user_id AS STRING) = CAST(usr.user_id AS STRING)
  LEFT JOIN {{ ref('partners') }} prt ON CAST(ord.partner_id AS STRING) = CAST(prt.partner_id AS STRING)
ORDER BY CAST(order_id AS int) ASC