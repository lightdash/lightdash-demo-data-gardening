SELECT
  ord.order_id,
  ord.order_date,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.currency,
  ROUND(ord.basket_total, 2) AS basket_total,
  ROUND(ord.profit::NUMERIC, 2) AS profit,
  ord.referrer,
  ord.user_id,
  usr.email,
  usr.created_date AS user_created_date,
  usr.browser,
  usr.shipping_address::json->'city' AS shipping_city,
  usr.shipping_address::json->'country' AS shipping_country
FROM
  thyme.orders ord
LEFT JOIN
  thyme.users usr
ON
  ord.user_id = usr.user_id
LEFT JOIN
  thyme.partners prt
ON
  ord.partner_id = prt.partner_id
ORDER BY
  CAST(order_id AS int) ASC