SELECT
  b.order_id,
  b.basket_item_id,
  b.ordered_product_skus as sku,
  p.product_name,
  p.price_currency as currency,
  b.price_amount as item_price,
  b.basket_total,
FROM
  lightdash-analytics.lightdash_demo_gardening.baskets b
LEFT JOIN
  lightdash-analytics.lightdash_demo_gardening.products p
ON
  CAST(b.ordered_product_skus AS STRING) = p.sku
ORDER BY
  cast(basket_item_id as int) ASC