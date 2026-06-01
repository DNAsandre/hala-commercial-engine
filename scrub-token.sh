#!/bin/sh
# Scrub leaked GHL token from .env.example in git history
if [ -f .env.example ]; then
  sed -i 's/pit-6eb95fc6-0fb1-4ffb-8de3-c2c0a6debd4a/your-ghl-private-token-here/g' .env.example
  sed -i 's/69e9fa0ab2bd0a7b91d66ef1/your-ghl-location-id-here/g' .env.example
fi
