#!/bin/bash

# Script parameters
CSS_IN_FILE="nathanatos-styles-input.css"
CSS_OUT_FILE="scripts/nathanatos-styles.css"
DEPLOY_FLAG="$1"

# Initialize npm and install Tailwind CSS and other dependencies
npm init -y
if ! npm install tailwindcss postcss autoprefixer @tailwindcss/cli http-server aws-cli; then
    echo "Failed to install dependencies."
    exit 1
fi

# Create/initialize directory structure
mkdir -p src
rm -rf dist
mkdir -p dist/scripts

# Verify Tailwind configuration
if [ ! -f "src/$CSS_IN_FILE" ]; then
    echo '@import "tailwindcss";' > src/$CSS_IN_FILE
fi
if [ ! -f "tailwind.config.js" ]; then
    cat <<EOT > tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {},
  },
}
EOT
fi
if ! jq ".scripts += {\"build-css\": \"npx @tailwindcss/cli -i src/$CSS_IN_FILE -o dist/$CSS_OUT_FILE\"}" package.json > tmp.json; then
    echo "Failed to update package.json."
    exit 1
fi
mv tmp.json package.json

# Generate the CSS
if ! npm run build-css; then
    echo "Failed to generate CSS."
    exit 1
fi

# Copy static files to dist
rsync -av --exclude=$CSS_IN_FILE src/ dist/

# Handle --deploy flag for S3 upload
if [ "$DEPLOY_FLAG" = "--deploy" ]; then
    # Deploy to S3
    if [ -z "$WEB_BUCKET_NAME" ]; then
        echo "Error: WEB_BUCKET_NAME environment variable not set."
        echo "Usage: WEB_BUCKET_NAME=my-bucket ./build.sh --deploy"
        exit 1
    fi
    
    echo "Deploying dist/ to s3://$WEB_BUCKET_NAME/"
    aws s3 sync dist/ "s3://$WEB_BUCKET_NAME/"

    if [ $? -eq 0 ]; then
        echo "✓ Successfully deployed to S3!"
    else
        echo "✗ S3 deployment failed."
        exit 1
    fi
else
    # Open browser to test and debug the site
    npx http-server &
    open -a "Google Chrome" http://localhost:8080/dist/index.html
fi
