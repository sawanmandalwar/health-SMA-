const fs = require('fs');
let content = fs.readFileSync('src/app/scan.tsx', 'utf8');
content = content.replace(/\r\n/g, '\n');

const stylesIdx = content.indexOf('const styles = StyleSheet.create({');
console.log('Styles start:', stylesIdx);

if (stylesIdx >= 0) {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  for (let i = stylesIdx; i < content.length; i++) {
    const char = content[i];
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && content[i-1] !== '\\') {
      inString = false;
    } else if (!inString && char === '{') {
      braceCount++;
    } else if (!inString && char === '}') {
      braceCount--;
      if (braceCount === 0) {
        console.log('Styles end at:', i);
        console.log('Context:', JSON.stringify(content.substring(i, i + 50)));
        break;
      }
    }
  }
}