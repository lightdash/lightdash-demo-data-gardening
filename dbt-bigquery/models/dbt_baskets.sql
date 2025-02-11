SELECT 
  CAST(bsk.order_id AS STRING) AS order_id,
  CAST(bsk.basket_item_id AS STRING) AS item_id,
  bsk.ordered_product_skus AS sku,
  prd.product_name,
  prd.price_currency AS currency,
  bsk.price_amount AS item_price,
  bsk.basket_total,
  {{ shift_timestamp('ord.order_date') }} as order_date,
  ord.profit,
  (
    bsk.price_amount * prt.partner_commission
  ) AS item_profit,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission
FROM `lightdash-analytics.lightdash_demo_gardening.baskets` bsk
  LEFT JOIN `lightdash-analytics.lightdash_demo_gardening.products` prd ON CAST(ordered_product_skus AS STRING) = CAST(prd.sku AS STRING)
  LEFT JOIN `lightdash-analytics.lightdash_demo_gardening.orders` ord ON CAST(bsk.order_id AS STRING) = CAST(ord.order_id AS STRING)
  LEFT JOIN `lightdash-analytics.lightdash_demo_gardening.partners` prt ON CAST(ord.partner_id AS STRING) = CAST(prt.partner_id AS STRING)
ORDER BY bsk.basket_item_id ASC