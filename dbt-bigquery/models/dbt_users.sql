select
  cast(user_id as string) as user_id,
  email,
  created_date,
  browser,
  shipping_address,
  case mod(abs(farm_fingerprint(cast(user_id as string))), 8)
    when 0 then 'Red'
    when 1 then 'Blue'
    when 2 then 'Green'
    when 3 then 'Yellow'
    when 4 then 'Purple'
    when 5 then 'Orange'
    when 6 then 'Pink'
    when 7 then 'Teal'
  end as favourite_colour

from {{ ref('users') }}