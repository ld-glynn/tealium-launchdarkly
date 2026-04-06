#!/bin/bash
# Creates the demo feature flags in LaunchDarkly
# Usage: LD_API_KEY=your-api-key ./create-flags.sh [project-key]

if [ -z "$LD_API_KEY" ]; then
  echo "Error: Set LD_API_KEY environment variable"
  echo "Usage: LD_API_KEY=api-xxx ./create-flags.sh [project-key]"
  exit 1
fi

PROJECT="${1:-default}"
API="https://app.launchdarkly.com/api/v2"

echo "Creating flags in project: $PROJECT"
echo ""

# show-promo-banner (boolean)
echo "Creating show-promo-banner..."
curl -s -X POST "$API/flags/$PROJECT" \
  -H "Authorization: $LD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "show-promo-banner",
    "name": "Show Promo Banner",
    "kind": "boolean",
    "description": "Controls visibility of the promotional banner",
    "clientSideAvailability": {
      "usingMobileKey": true,
      "usingEnvironmentId": true
    }
  }' | python3 -c "import sys,json; r=json.load(sys.stdin); print('  OK:', r.get('key', r.get('message','unknown')))" 2>/dev/null || echo "  Done"

# checkout-flow (string)
echo "Creating checkout-flow..."
curl -s -X POST "$API/flags/$PROJECT" \
  -H "Authorization: $LD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "checkout-flow",
    "name": "Checkout Flow",
    "kind": "multivariate",
    "description": "Controls which checkout experience users see",
    "variations": [
      {"value": "classic", "name": "Classic", "description": "Original checkout flow"},
      {"value": "streamlined", "name": "Streamlined", "description": "New streamlined checkout"}
    ],
    "clientSideAvailability": {
      "usingMobileKey": true,
      "usingEnvironmentId": true
    }
  }' | python3 -c "import sys,json; r=json.load(sys.stdin); print('  OK:', r.get('key', r.get('message','unknown')))" 2>/dev/null || echo "  Done"

# hero-image-variant (string)
echo "Creating hero-image-variant..."
curl -s -X POST "$API/flags/$PROJECT" \
  -H "Authorization: $LD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "hero-image-variant",
    "name": "Hero Image Variant",
    "kind": "multivariate",
    "description": "A/B/C test for hero image on homepage",
    "variations": [
      {"value": "A", "name": "Variant A"},
      {"value": "B", "name": "Variant B"},
      {"value": "C", "name": "Variant C"}
    ],
    "clientSideAvailability": {
      "usingMobileKey": true,
      "usingEnvironmentId": true
    }
  }' | python3 -c "import sys,json; r=json.load(sys.stdin); print('  OK:', r.get('key', r.get('message','unknown')))" 2>/dev/null || echo "  Done"

echo ""
echo "Done! Flags created in project '$PROJECT'."
echo "Note: Flags are created with targeting OFF (serving default variation)."
echo "Turn on targeting in the LD dashboard to start serving variations."
