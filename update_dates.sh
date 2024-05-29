#!/bin/sh

date_two_hundreed_days_ago=$(date "+%Y-%m-%d %H:%M:%S" -d "200 day ago")

for file in synth/*.json; do
  sed -i '' "s/\"start\": \"[^\"]*\"/\"start\": \"$date_two_hundreed_days_ago\"/" $file
done