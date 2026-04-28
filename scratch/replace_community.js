const fs = require('fs');
const path = 'c:/Users/Samukinha/Desktop/Destaq-MOV/scroll-demo/index.html';
let content = fs.readFileSync(path, 'utf8');
const startTag = '<!-- ABA 2: COMUNIDADE -->';
const endTag = '<!-- FIM DA ABA COMUNIDADE -->';
const start = content.indexOf(startTag);
const end = content.indexOf(endTag) + endTag.length;

if (start !== -1 && end !== -1) {
    const replacement = `    <!-- ABA 2: COMUNIDADE -->
    <div id="aba-comunidade" class="tab-pane" style="display: none;">
        <div id="community-content"></div>
    </div> <!-- FIM DA ABA COMUNIDADE -->`;
    content = content.substring(0, start) + replacement + content.substring(end);
    fs.writeFileSync(path, content);
    console.log('REPLACED');
} else {
    console.log('NOT FOUND');
}
