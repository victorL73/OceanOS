const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/components/MailList.jsx',
  'frontend/src/components/Sidebar.jsx',
  'frontend/src/components/AiPanel.jsx',
  'frontend/src/components/MailDetail.jsx'
];

files.forEach(f => {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/\\\$/g, '$').replace(/\\`/g, '`');
    fs.writeFileSync(p, content);
    console.log('Fixed', f);
  }
});
