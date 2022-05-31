SELECT
  sku,
  product_name,
  price_amount,
  price_currency
FROM
  `lightdash-analytics.lightdash_demo_gardening.products`
ORDER BY
  CAST(sku AS int) ASC