SELECT
  order_id,
  order_date,
  user_id,
  partner_id,
  currency,
  basket_total,
  referrer
FROM
  `lightdash-analytics.lightdash_demo_gardening.orders`
ORDER BY
  CAST(order_id AS int) ASC