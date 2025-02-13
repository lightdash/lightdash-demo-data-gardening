
{% macro shift_timestamp(date_col, max_tstamp = '2025-02-12 00:00:00') %}
  timestamp_add(
    {{ date_col }},
    interval timestamp_diff(current_timestamp(), timestamp '{{ max_tstamp }}', second) second
  )
{% endmacro %}