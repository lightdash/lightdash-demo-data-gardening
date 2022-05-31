SELECT
  ord.order_id,
  ord.order_date,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.currency,
  ROUND(ord.basket_total, 2) AS basket_total,
  ROUND(ord.profit, 2) AS profit,
  ord.referrer,
  ord.user_id,
  usr.email,
  usr.created_date AS user_created_date,
  usr.browser,
  REPLACE(JSON_EXTRACT(usr.shipping_address, '$.city'), '"', '') AS shipping_city,
  REPLACE(JSON_EXTRACT(usr.shipping_address, '$.country'), '"', '') AS shipping_country
FROM
  `lightdash-analytics.lightdash_demo_gardening.orders` ord
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.users` usr
ON
  ord.user_id = usr.user_id
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.partners` prt
ON
  ord.partner_id = prt.partner_id
ORDER BY
  CAST(order_id AS int) ASC