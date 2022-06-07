SELECT
  bsk.order_id,
  bsk.basket_item_id,
  bsk.ordered_product_skus AS sku,
  prd.product_name,
  prd.price_currency AS currency,
  bsk.price_amount AS item_price,
  ROUND(bsk.basket_total::NUMERIC, 2) AS basket_total,
  ord.order_date,
  ROUND(ord.profit::NUMERIC, 2) AS profit,
  ROUND((bsk.price_amount::decimal * prt.partner_commission::decimal), 2) AS item_profit,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission
FROM
  thyme.baskets bsk
LEFT JOIN
  thyme.products prd
ON
  ordered_product_skus::VARCHAR = prd.sku::VARCHAR
LEFT JOIN
  thyme.orders ord
ON
  bsk.order_id = ord.order_id
LEFT JOIN
  thyme.partners prt
ON
  ord.partner_id = prt.partner_id
ORDER BY
  bsk.basket_item_id::int ASC