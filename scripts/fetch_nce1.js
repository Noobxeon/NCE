const fs = require('fs');
const path = require('path');

// 帮助说明
console.log(`
=========================================
🌍 新概念课文资源自动化导入工具 (TXT 转 JSON)
=========================================
这个脚本可以协助你将任何来源的 .txt 课文资料批量导入。

【使用前提】：
1. 从网上搜索 "新概念第一册全套纯文本.txt" 并下载到当前 scripts/ 目录。
2. 确保你的 .txt 格式为简单的换行结构（通常一行为标题，下面几行为正文，或者类似格式）。

如果不懂编程，你可以完全忽略此文件，直接按照 "d:\\NCE\\books_data\\template_instructions.json" 
中的格式，手动将文本粘贴替换 \`nce1.json\` 中的 chapters 数组即可直接生效！
`);

// 示例解析器(仅针对一种假定格式演示)
function convertTxtToJson(txtPath, outputFileName, bookTitle, bookId) {
    if (!fs.existsSync(txtPath)) {
        console.log(`[提示] 未找到指定的课文文本文件：${txtPath}`);
        console.log(`如果你有资料，命名为 ${path.basename(txtPath)} 放置在此处然后重新运行 node scripts/fetch_nce1.js。`);
        return;
    }

    const rawContent = fs.readFileSync(txtPath, 'utf8');
    // 假设文章通过连续的两个空行分隔
    const lessonBlocks = rawContent.split(/\n\s*\n\s*\n/);
    
    const chapters = [];
    let lessonCount = 1;

    for (const block of lessonBlocks) {
        const lines = block.trim().split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) continue;

        // 首行作为标题，其余作为正文
        const title = lines[0].trim();
        const contentLines = lines.slice(1);
        const content = contentLines.map(l => l.trim()).join('\\n');

        chapters.push({
            id: \`\${bookId}-\${lessonCount}\`,
            title: title,
            content: content,
            audioUrl: "" // 可随时在外部 JSON 手动填入 mp3 的相对路径
        });

        lessonCount++;
    }

    const outputJson = {
        id: bookId,
        title: bookTitle,
        chapters: chapters
    };

    const outPath = path.join(__dirname, '..', 'books_data', outputFileName);
    fs.writeFileSync(outPath, JSON.stringify(outputJson, null, 2));
    console.log(`✅ 成功将 ${chapters.length} 篇课文解析并写入到：${outPath}`);
    console.log(`👉 请重启软件或点击 "Review" 刷新界面查看最新课本资源。`);
}

// 运行用例
convertTxtToJson(
    path.join(__dirname, 'nce1_full_text.txt'), 
    'nce1_imported.json', 
    'NCE Book 1: First Things First (全文)', 
    'nce1_full'
);
