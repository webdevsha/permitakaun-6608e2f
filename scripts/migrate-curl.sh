#!/bin/bash

# Supabase Database Migration Script using curl
# This script executes SQL statements via the Supabase REST API

SUPABASE_URL="https://sfcoqymbxectgwedkbqa.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM"

echo "🚀 Running Supabase Migration..."
echo ""

# Function to execute SQL
execute_sql() {
    local name="$1"
    local sql="$2"
    
    echo -n "📝 $name... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        -H "apikey: $SERVICE_ROLE_KEY" \
        -d "{\"query\": \"$sql\"}" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        echo "✅"
        return 0
    elif [ "$http_code" = "404" ]; then
        echo "⚠️  (exec_sql function not found)"
        return 1
    else
        echo "❌ (HTTP $http_code)"
        return 1
    fi
}

# Test connection
echo -n "🔗 Testing connection... "
test_response=$(curl -s -o /dev/null -w "%{http_code}" \
    "$SUPABASE_URL/rest/v1/organizers?limit=1" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" 2>/dev/null)

if [ "$test_response" = "200" ]; then
    echo "✅"
else
    echo "❌ (HTTP $test_response)"
    echo "Unable to connect to Supabase. Please check credentials."
    exit 1
fi

echo ""

# Since exec_sql may not exist, let's provide instructions
echo "ℹ️  Note: The exec_sql function is required to run migrations automatically."
echo ""
echo "📋 To complete the migration, please run the SQL file manually:"
echo ""
echo "1. Go to your Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/sfcoqymbxectgwedkbqa"
echo ""
echo "2. Navigate to: SQL Editor → New Query"
echo ""
echo "3. Copy and paste the contents of:"
echo "   sql/enhanced_tenant_organizer_workflow.sql"
echo ""
echo "4. Click 'Run' to execute the migration"
echo ""
echo "📁 SQL file location:"
echo "   $(pwd)/../sql/enhanced_tenant_organizer_workflow.sql"
echo ""

# Optionally try to show the first few functions that would be created
echo "🔍 The migration will create the following key components:"
echo "   • Additional columns on tenant_organizers table"
echo "   • Additional columns on tenant_locations table"
echo "   • validate_organizer_by_code() function"
echo "   • request_organizer_link() function"
echo "   • process_tenant_request() function"
echo "   • get_available_locations_for_tenant() function"
echo "   • add_tenant_locations() function"
echo "   • Indexes and views for performance"
echo ""
