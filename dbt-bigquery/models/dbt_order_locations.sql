select
  cast(order_locations.order_id as string) as order_id,
  order_locations.latitude,
  order_locations.longitude

from {{ ref('order_locations') }} as order_locations
