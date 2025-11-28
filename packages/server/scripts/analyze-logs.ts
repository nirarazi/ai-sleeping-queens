import fs from 'fs';
import path from 'path';
import readline from 'readline';

interface LogEntry {
    level: string;
    message: string;
    timestamp: string;
    stack?: string;
    [key: string]: any;
}

interface Issue {
    id: string;
    message: string;
    location?: {
        file: string;
        line: number;
        column: number;
    };
    count: number;
    firstSeen: string;
    lastSeen: string;
    stack: string;
    context?: string;
}

const LOG_FILE = path.join(__dirname, '../error.log');
const OUTPUT_FILE = path.join(__dirname, '../../../ISSUES.md');
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../');

console.log(`Scanning logs from: ${LOG_FILE}`);
console.log(`Workspace root: ${WORKSPACE_ROOT}`);

function extractLocation(stack: string | undefined): { file: string; line: number; column: number } | undefined {
    if (!stack) return undefined;

    // Look for the first line in the stack that points to a file in our codebase
    // Regex to match: at FunctionName (filePath:line:column) or at filePath:line:column
    const lines = stack.split('\n');
    
    for (const line of lines) {
        // Filter out node_modules and internal node calls if possible, unless that's all we have
        if (line.includes('node_modules')) continue;
        if (line.includes('internal/')) continue;

        const match = /\((.+):(\d+):(\d+)\)/.exec(line) || /at (.+):(\d+):(\d+)/.exec(line);
        if (match) {
            const absolutePath = match[1];
            const lineNumber = parseInt(match[2], 10);
            const colNumber = parseInt(match[3], 10);

            // Only accept if it's within our workspace
            if (absolutePath.includes(WORKSPACE_ROOT)) {
                // Convert to relative path
                const relativePath = path.relative(WORKSPACE_ROOT, absolutePath);
                return {
                    file: relativePath,
                    line: lineNumber,
                    column: colNumber
                };
            }
        }
    }
    return undefined;
}

async function analyzeLogs() {
    if (!fs.existsSync(LOG_FILE)) {
        console.log('No error log file found.');
        return;
    }

    const fileStream = fs.createReadStream(LOG_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const issues: Map<string, Issue> = new Map();

    for await (const line of rl) {
        try {
            if (!line.trim()) continue;
            const entry: LogEntry = JSON.parse(line);
            
            // Create a unique signature for the error to group them
            // Use message + stack top (if available)
            const stackTop = entry.stack ? entry.stack.split('\n')[0] : '';
            const signature = `${entry.message}|${stackTop}`;
            
            if (issues.has(signature)) {
                const issue = issues.get(signature)!;
                issue.count++;
                issue.lastSeen = entry.timestamp;
            } else {
                const location = extractLocation(entry.stack);
                issues.set(signature, {
                    id: Math.random().toString(36).substr(2, 9),
                    message: entry.message,
                    location,
                    count: 1,
                    firstSeen: entry.timestamp,
                    lastSeen: entry.timestamp,
                    stack: entry.stack || '',
                    context: JSON.stringify(entry, null, 2) // Keep full log entry as context
                });
            }
        } catch (e) {
            console.error('Failed to parse log line:', line);
        }
    }

    generateMarkdown(Array.from(issues.values()));
}

function generateMarkdown(issues: Issue[]) {
    if (issues.length === 0) {
        console.log('No issues found.');
        // Write a "No issues" file or delete existing?
        // Let's write a happy file.
        fs.writeFileSync(OUTPUT_FILE, '# No Critical Issues Found\n\nGreat job! The logs are clean.');
        return;
    }

    let md = '# 🚨 Critical Issues Report\n\n';
    md += `Generated at: ${new Date().toLocaleString()}\n`;
    md += `Total Issues Found: ${issues.length}\n\n`;

    issues.forEach((issue, index) => {
        const fileLink = issue.location ? `${issue.location.file}` : 'Unknown Location';
        
        md += `## ${index + 1}. ${issue.message}\n\n`;
        md += `- **Count**: ${issue.count}\n`;
        md += `- **First Seen**: ${issue.firstSeen}\n`;
        md += `- **Last Seen**: ${issue.lastSeen}\n`;
        
        if (issue.location) {
            md += `- **Location**: \`${issue.location.file}:${issue.location.line}\`\n`;
            // Add a Cursor-friendly file link/reference?
            // Using absolute path for easy clicking if supported, or relative.
            // Markdown link: [path](path)
        }

        md += `\n### 🤖 Cursor Auto-Fix Prompt\n`;
        md += `Copy the block below into Cursor Chat (Cmd+L) to fix this issue:\n\n`;
        
        md += `\`\`\`text\n`;
        if (issue.location) {
            md += `@${issue.location.file} \n`;
        }
        md += `I found an error in the logs: "${issue.message}"\n`;
        if (issue.location) {
             md += `It seems to be happening at line ${issue.location.line}.\n`;
        }
        md += `Here is the stack trace:\n${issue.stack}\n\n`;
        md += `Please analyze the code and fix this error.\n`;
        md += `\`\`\`\n\n`;

        md += `### Stack Trace\n`;
        md += `\`\`\`\n${issue.stack}\n\`\`\`\n`;
        
        md += `---\n`;
    });

    fs.writeFileSync(OUTPUT_FILE, md);
    console.log(`Report generated at: ${OUTPUT_FILE}`);
}

analyzeLogs();

