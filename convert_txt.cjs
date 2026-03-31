const fs = require('fs');
const path = require('path');

// ================= 配置区 =================
// 1. 请把你的 TXT 文件放在和这个脚本同一个目录下，并在这修改文件名
const INPUT_FILENAME = 'nce_input.txt'; 
// 2. 转换后输出的 JSON 文件名
const OUTPUT_FILENAME = 'nce_output.json'; 
// 3. 课本的 ID 和 大标题
const BOOK_ID = 'nce_custom';
const BOOK_TITLE = '新概念英语 (自定义转换版)';
// =========================================

function convertTxtToJson() {
    const inputPath = path.join(__dirname, INPUT_FILENAME);
    const outputPath = path.join(__dirname, OUTPUT_FILENAME);

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 找不到文件: ${inputPath}`);
        console.error('请确保文件存在，并且在脚本内的 INPUT_FILENAME 中配置了正确的文件名！');
        return;
    }

    const content = fs.readFileSync(inputPath, 'utf8');
    
    // 按行切分文本，去掉头尾空白
    const lines = content.split(/\r?\n/).map(line => line.trim());

    const chapters = [];
    let currentChapter = null;
    let contentLines = [];

    // 正则表达式匹配标题行（例如匹配 "Lesson 1 Excuse me!" 或者 "第1课 Excuse me!"）
    // 你可以根据你实际 txt 里的规律修改这个正则！
    const titleRegex = /^(?:Lesson|第)\s*(\d+(?:-\d+)?).*?[.\s:：]*(.+)?$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue; // 跳过空行

        // 判断这一行是不是新课文的标题
        const match = line.match(titleRegex);

        // 如果是纯手写数字起头的标题也可以用这个简单判定，比如 "1. Excuse me"
        // const match = line.match(/^(\d+)\.\s*(.+)/);

        if (match) {
            // 在保存新的一课之前，先把旧的一课内容闭合收集起来
            if (currentChapter) {
                currentChapter.content = contentLines.join('\n');
                chapters.push(currentChapter);
            }

            // 开启新的一课
            const chapterId = match[1]; // 例如 "1"
            let chapterTitle = match[2] ? match[2].trim() : `Chapter ${chapterId}`;
            
            // 有时候标题和 Lesson 分成两行写了，如果本行没抓住标题，抓下一行
            if (!match[2] && i + 1 < lines.length && !lines[i+1].match(titleRegex)) {
                 chapterTitle = lines[i+1].trim();
                 i++; // 跳过下一行，因为它被当做标题了
            }

            currentChapter = {
                id: chapterId,
                title: chapterTitle,
                content: "",
                // 默认的 mp3 命名规则，如果您的 mp3 叫 lesson-1.mp3，这里就改掉
                audioUrl: `local://audio/${chapterId}.mp3` 
            };
            contentLines = []; // 清空收集器准备收集正文
        } else {
            // 如果不是标题行，且当前有章节，就全算作正文
            if (currentChapter) {
                contentLines.push(line);
            }
        }
    }

    // 文件末尾，别忘了把最后一课保存进去
    if (currentChapter) {
        currentChapter.content = contentLines.join('\n');
        chapters.push(currentChapter);
    }

    if (chapters.length === 0) {
        console.warn("⚠️ 没有识别到任何章节！请检查 txt 里的标题是不是没有写成 'Lesson 1' 的格式？");
        return;
    }

    const finalJson = [
        {
            id: BOOK_ID,
            title: BOOK_TITLE,
            chapters: chapters
        }
    ];

    fs.writeFileSync(outputPath, JSON.stringify(finalJson, null, 2), 'utf8');
    console.log(`✅ 转换成功！共提取了 ${chapters.length} 篇课文。`);
    console.log(`文件已保存到: ${outputPath}`);
}

convertTxtToJson();
