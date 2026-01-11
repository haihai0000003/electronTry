import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {ChatOpenAI} from "@langchain/openai"
import * as dotenv from "dotenv";
import * as z from 'zod'
import { tavily } from '@tavily/core'
import { tool } from "@langchain/core/tools";
import fs from 'fs/promises'
import { ToolNode } from "@langchain/langgraph/prebuilt";
dotenv.config({path: '../.env'})

let fullContent: string;

// 定义条件边逻辑
function shouldResearch(state: typeof AgentState.State) {
  if (state.analysis.needsResearch) {
    return "research";
  }
  return "generate_fix";
}

const readLocalFileTool = tool(
    async ({ filePath, line }, options?: { config?: { configurable?: { state?: typeof AgentState.State } } }) => {
        try {
           const path = filePath.replace(/['"]/g, '').trim(); 
            const content = await fs.readFile(path, 'utf-8');
            const lineContent = getSpecifiedLineFromFileContent(content, line);
            fullContent = content;
            return {
                lineContent
            }
        } catch (error) {
            return `读取文件 ${filePath} 失败: ${error}`;
        }
    },
    {
        name: "read_local_file",
        description: "读取本地文件内容.当用户的问题中包含文件路径和行号时,使用此工具读取文件内容.",
        schema: z.object({
            filePath: z.string().describe("要读取的文件绝对路径,例如: E:\code\note-box\electron\analyzeError.ts"),
            line: z.string().describe("要读取的行号,格式例如: 17-20 或 17"),
        }),
    },
)

// 将工具放入数组
const tools = [readLocalFileTool];

const model = new ChatOpenAI({
    modelName: "gpt-5-nano", // 或者 "gpt-4o"
    temperature: 1,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: "https://api.openai-proxy.org/v1",
    }
  })

const AgentState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
    }),
    // 专门存储“分析阶段”产生的结构化数据
    analysis: Annotation<{
        errorType: "simple" | "complex";
        needsResearch: boolean;
        reasoning: string;
    }>()
})

const analyzeResult = z.object({
    reasoning: z.string().describe("分析结果"),
    errorType: z.enum(["simple", "complex"]).describe("错误类型"),
    needsResearch: z.boolean().describe("复杂问题,需要查阅文档"),
    // needsCodeFile: z.boolean().describe("需要查看代码文件"),
})

async function analyzeErrorNode(state: typeof AgentState.State) {
    console.log('state', state)
    const prompt = `
    你是一名 Vue3 + Vite 专家。请根据对话历史中的报错信息和（可能的）代码文件内容进行诊断。
    判断这是简单的代码错误，还是复杂的概念性错误。
    `;

    const response = await model.withStructuredOutput(analyzeResult).invoke([new HumanMessage(prompt), ...state.messages]);
    
    return {
        // 这里不更新 messages，而是更新专门的 analysis 状态
        analysis: response 
    };
}

async function researchNode(state: typeof AgentState.State) {
    console.log("--- 正在搜索 Vue 文档/社区解决方案 ---");

    const tvly = tavily({
        apiKey: process.env.TVLV_API_KEY,
    })
    const lastUserMsg = state.messages.find(m => m._getType() === 'human')?.content as string;
    const searchResult = await tvly.search(lastUserMsg.slice(0, 200), {
        maxResults: 2,
    })
    console.log('searchResult',searchResult)
    const context = searchResult.results.map(r => r.content).join("\n\n");
    // 模拟搜索结果
//   const mockSearchResult = `
//     搜索结果: 针对 Vue 3 "Hydration mismatch" 错误，通常是因为服务器端渲染 (SSR) 的 HTML 与客户端初始渲染的 DOM 结构不匹配导致。常见原因是 HTML 嵌套不规范（如 p 标签内嵌套 div）。
//   `;

   return {
    messages:  [new AIMessage(`【外部搜索结果】:\n${context}`)]
  };
}
const llmWithTools = model.bindTools(tools);
/**
 * 节点 1: 上下文收集者
 * 它的任务不是修复 bug，而是看用户的输入里有没有文件路径。
 * 如果有，它会发起 Tool Call。
 */
async function checkContextNode(state: typeof AgentState.State) {
    const { messages } = state;
    // 提示词稍微引导一下，确保它积极调用工具
    const systemMsg = new HumanMessage("检查用户输入。如果包含文件路径和行号，请调用 read_local_file 工具读取代码。如果不包含，直接回复 '无文件信息'。");
    
    // 注意：这里我们只取最后一条消息加上系统提示，或者取全部消息
    const response = await llmWithTools.invoke([systemMsg, ...messages]);
    return { messages: [response] };
}

async function generateFixNode(state:typeof AgentState.State) {
    const { messages, analysis } = state;
        
        const prompt = `
        基于之前的分析和代码上下文，请给出修复方案。
        
        诊断结论: ${analysis?.reasoning}
        
        请输出:
        1. 错误原因详解
        2. 修复后的代码片段 (Vue 3 Composition API)
        `;
    
        const response = await model.invoke([...messages, new HumanMessage(prompt)]);
        return { messages: [response] };

}


const toolNode = new ToolNode(tools);
function getSpecifiedLineFromFileContent(fileContent: string, line: string) {
    try {
        const lines = fileContent.split('\n');
        // 支持 "17-20" 或 "17" 两种格式
        const parts = line.split('-').map(p => parseInt(p.trim(), 10));
        if (parts.length === 1) {
            // 单行
            const lineNumber = parts[0];
            if (lineNumber > 0 && lineNumber <= lines.length) {
                return lines[lineNumber - 1];
            } else {
                return `行号 ${lineNumber} 超出文件范围`;
            }
        } else if (parts.length === 2) {
            // 范围行
            const [start, end] = parts;
            if (start > 0 && end <= lines.length && start <= end) {
                return lines.slice(start - 1, end).join('\n');
            } else {
                return `行号范围 ${start}-${end} 超出文件范围`;
            }
        } else {
            return `无效的行号格式: ${line}`;
        }
    } catch (error) {
        return `读取文件内容失败: ${error}`;
    }
}

const shouldContinue = (state: typeof AgentState.State) => {
    const messages = state.messages;
    const lastMessage = messages.at(-1);
    console.log('lastMessage', lastMessage)
    if(lastMessage?.tool_calls?.length) {
        return "tools";
    }
    return 'analyze_error';
}

const workFlow = new StateGraph(AgentState)
    .addNode('check_context', checkContextNode)
    .addNode('tools', toolNode)
    .addNode("analyze_error", analyzeErrorNode)
    .addNode("research", researchNode)
    .addNode("generate_fix", generateFixNode)


    .addEdge(START, 'check_context')
    .addConditionalEdges('check_context', shouldContinue, {
        analyze_error: "analyze_error",
        tools: "tools",
    })
    .addEdge('tools', 'analyze_error')
    // .addEdge(START, "analyze_error")
    .addConditionalEdges("analyze_error", shouldResearch, {
        research: "research",       // 如果返回 'research'，去 research 节点
        generate_fix: "generate_fix" // 如果返回 'generate_fix'，直接去生成修复
    })
    .addEdge("research", "generate_fix")
    .addEdge("generate_fix", END)

const app = workFlow.compile();

async function main() {
    // 模拟一个复杂的 Vue 报错
  const vueHydrationError = "SyntaxError: E:\\code\\vue-admin-template\\src\\views\\tree\\index.vue: Unexpected token 报错行：71-74"

  const input = {
    errorLog: vueHydrationError,
    messages: [new HumanMessage(vueHydrationError)] // 初始化空消息列表
  };

  console.log("Starting Agent...");
  
  const result = await app.invoke(input);

  const finalResponse = result.messages[result.messages.length - 1].content;
  console.log("\n====== Final Solution ======\n");
  console.log(finalResponse);
}

main()