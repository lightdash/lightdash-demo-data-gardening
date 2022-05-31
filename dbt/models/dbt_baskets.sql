SELECT
  bsk.order_id,
  bsk.basket_item_id,
  bsk.ordered_product_skus AS sku,
  prd.product_name,
  prd.price_currency AS currency,
  bsk.price_amount AS item_price,
  ROUND(bsk.basket_total, 2) AS basket_total,
  ord.order_date,
  ROUND(ord.profit, 2) AS profit,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission
FROM
  `lightdash-analytics.lightdash_demo_gardening.baskets` bsk
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.products` prd
ON
  CAST(bsk.ordered_product_skus AS STRING) = prd.sku
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.orders` ord
ON
  bsk.order_id = ord.order_id
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.partners` prt
ON
  ord.partner_id = prt.partner_id
ORDER BY
  CAST(bsk.basket_item_id AS int) ASC