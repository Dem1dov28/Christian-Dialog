const fs = require('fs');

// Read the corrupted file
const content = fs.readFileSync('en.json', 'utf8');

// Find the export section (this should be near the end)
const exportStart = content.indexOf('  "export": {');
console.log('Export section starts at position:', exportStart);

// Find the closing brace of the export section
const exportEnd = content.indexOf('  }', exportStart) + 3; // +3 for '  }' plus newline
console.log('Export section ends at position:', exportEnd);
console.log('Total file length:', content.length);

// Extract only the valid portion
const validContent = content.substring(0, exportEnd);

// Write the cleaned file
fs.writeFileSync('en.json', validContent);
console.log('✅ File cleaned and saved');
console.log('New file length:', validContent.length);

// Validate
try {
  JSON.parse(validContent);
  console.log('✅ JSON is now valid');
} catch(e) {
  console.log('❌ Still invalid:', e.message);
}