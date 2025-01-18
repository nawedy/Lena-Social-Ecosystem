#!/bin/bash

# Function to safely rename variables
fix_unused_vars() {
  file="$1"
  # Only process TypeScript/React files
  if [[ "$file" =~ \.(ts|tsx)$ ]]; then
    # Add underscore prefix to unused variables
    sed -i '' -E 's/\b(const|let|var) ([a-zA-Z][a-zA-Z0-9]*)(: [^=]+)? = [^;]+;.*\/\/ eslint-disable-line.*@typescript-eslint\/no-unused-vars.*/\1 _\2\3 = \4;/' "$file"
    
    # Add underscore prefix to unused function parameters
    sed -i '' -E 's/\(([^)]*)\bfunction ([a-zA-Z][a-zA-Z0-9]*)\(([^)]*)\).*\/\/ eslint-disable-line.*@typescript-eslint\/no-unused-vars.*/\1function _\2(\3)/' "$file"
  fi
}

# Function to fix React Hook dependencies
fix_hook_deps() {
  file="$1"
  if [[ "$file" =~ \.(tsx?)$ ]]; then
    # Find useEffect and useCallback hooks without dependencies
    grep -l "useEffect\|useCallback" "$file" | while read -r hook_file; do
      # Add missing dependencies warning
      sed -i '' -E 's/useEffect\(\(\) => \{([^}]+)\}, \[\]\)/useEffect(() => {\1}, []) \/\/ TODO: Add missing dependencies/' "$hook_file"
      sed -i '' -E 's/useCallback\(\(\) => \{([^}]+)\}, \[\]\)/useCallback(() => {\1}, []) \/\/ TODO: Add missing dependencies/' "$hook_file"
    done
  fi
}

# Function to fix console statements
fix_console_statements() {
  file="$1"
  if [[ "$file" =~ \.(ts|tsx)$ ]]; then
    # Replace console.log with appropriate logging
    sed -i '' -E 's/console\.log\((.*)\)/logger.info(\1)/' "$file"
  fi
}

# Process all TypeScript files
find . -type f -name "*.ts" -o -name "*.tsx" | while read -r file; do
  if [[ ! "$file" =~ node_modules ]]; then
    fix_unused_vars "$file"
    fix_hook_deps "$file"
    fix_console_statements "$file"
  fi
done

# Run ESLint fix
npm run lint -- --fix
