#!/bin/bash

# Function to extract dependencies from a hook's body
extract_deps() {
  local hook_body="$1"
  local deps=""
  
  # Look for variable references
  while read -r line; do
    # Extract variables that are referenced but not declared within the hook
    local vars=$(echo "$line" | grep -o '\b[a-zA-Z][a-zA-Z0-9]*\b' | grep -v '^const$\|^let$\|^var$\|^function$\|^return$\|^if$\|^else$\|^for$\|^while$')
    if [ ! -z "$vars" ]; then
      deps="$deps $vars"
    fi
  done <<< "$hook_body"
  
  echo "$deps" | tr ' ' '\n' | sort -u | tr '\n' ' '
}

# Process React files
find . -type f -name "*.tsx" -o -name "*.ts" | while read -r file; do
  if [[ ! "$file" =~ node_modules ]]; then
    # Find useEffect and useCallback hooks
    while IFS= read -r line; do
      if [[ "$line" =~ useEffect\(\(\)\s*=>\s*\{.*\},\s*\[\]\) ]]; then
        # Extract hook body
        body=$(echo "$line" | sed -n 's/.*useEffect(\(\) => {\(.*\)}, \[\]).*/\2/p')
        # Get dependencies
        deps=$(extract_deps "$body")
        if [ ! -z "$deps" ]; then
          # Replace empty dependency array with extracted dependencies
          sed -i '' "s/useEffect(() => {$body}, \[\])/useEffect(() => {$body}, [$deps])/" "$file"
        fi
      fi
      
      if [[ "$line" =~ useCallback\(\(\)\s*=>\s*\{.*\},\s*\[\]\) ]]; then
        # Extract hook body
        body=$(echo "$line" | sed -n 's/.*useCallback(\(\) => {\(.*\)}, \[\]).*/\2/p')
        # Get dependencies
        deps=$(extract_deps "$body")
        if [ ! -z "$deps" ]; then
          # Replace empty dependency array with extracted dependencies
          sed -i '' "s/useCallback(() => {$body}, \[\])/useCallback(() => {$body}, [$deps])/" "$file"
        fi
      fi
    done < "$file"
  fi
done
