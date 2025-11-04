select

  cast(basket.order_id as string) as order_id,
  cast(basket.basket_item_id as string) as item_id,
  basket.ordered_product_skus as sku,
  product.product_name,
  product.price_currency as currency,
  basket.price_amount as item_price,
  basket.basket_total,
  orders.order_date,
  orders.profit,
  (basket.price_amount * partners.partner_commission) as item_profit,
  orders.partner_id,
  partners.partner_name,
  partners.partner_commission

from {{ ref('baskets') }} as basket

  left join {{ ref('products') }} as product
    on cast(ordered_product_skus as string) = cast(product.sku as string)

  left join {{ ref('orders') }} as orders
    on cast(basket.order_id as string) = cast(orders.order_id as string)

  left join {{ ref('partners') }} as partners
    on cast(orders.partner_id as string) = cast(partners.partner_id as string)