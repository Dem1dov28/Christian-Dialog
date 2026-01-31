const fs = require('fs');

const filePath = 'd:/work/веб/2/TimeTalk/EpochalDialog/frontend/src/components/chat/LeftMessage.jsx';

let content = fs.readFileSync(filePath, 'utf8');

// Fix the regex pattern by replacing literal newlines with \n
content = content.replace(
  /const recommendationsPattern = \/$$?:\^\|\n$$\s*$$?:💡\s*$$\?Рекомендации:\s*\n$$($$?:$$-•$$\s*$$n$$\+$$?:\n\|\$$$)+\)/i,
  'const recommendationsPattern = /(?:^|\\n)\\s*(?:💡\\s*)?Рекомендации:\\s*(($?:$$-•$$\\s*$$n$$\+$$?:\\n\|\\$$$)+)/i'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed the regex pattern');