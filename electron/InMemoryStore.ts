import { ChatOpenAI } from '@langchain/openai'
import * as dotenv from 'dotenv'
import { tool } from '@langchain/core/tools'
import * as z from 'zod'
import { END, InMemoryStore, MemorySaver, MessagesAnnotation, START, StateGraph, Runtime } from '@langchain/langgraph'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ToolNode } from '@langchain/langgraph/prebuilt'
dotenv.config({path: '../.env'})


const model = new ChatOpenAI({
    model: 'gpt-5-nano',
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: 'https://api.openai-proxy.org/v1'
    }
})

const savePreferenceTool = tool(
    async (input, config) => {
        console.log(config)
        const store = config.store
        const userId = config.configurable?.user_id

        if (!userId || !store) {
            return "无法保存：缺少 user_id 或 store";
        }
        const namespace = ["users", userId, "profile"]

        const key = 'perferences'
        await store.put(namespace, key, {
            data: input.content
        })
        return `已将用户偏好保存到长期记忆：${input.content}`;
    },
    {
        name: 'save_preference',
        description: '当用户提到自己的名字、喜好、习惯时，使用此工具保存。',
        schema: z.object({
            content: z.string().describe("需要保存的用户偏好内容，例如'用户喜欢吃苹果'")
        })
    }
)

const llmWithTools = model.bindTools([savePreferenceTool])

const callModel = async (state: typeof MessagesAnnotation.State, config: any) => {
    const store = config.store
    const userId = config.configurable?.user_id as string

    let userMemoryContext = "";

    if(store && userId) {
        const namespace = ["users", userId, "profile"];

        const memory = await store.get(namespace, 'perferences')

        if (memory) {
        userMemoryContext = `\n[长期记忆] 关于该用户的已知信息：${memory.value.data}`;
        }
    }

    // --- 构造 System Prompt ---
    // 我们把读取到的记忆注入到 System Message 中
    const systemMsg = new SystemMessage(
        `你是一个贴心的助手。如果用户有具体的喜好，请参考以下信息进行回复。` + 
        userMemoryContext
    );

    const response = await llmWithTools.invoke([systemMsg, ...state.messages])

    return {messages: [response]}
}


const workFlow = new StateGraph(MessagesAnnotation)
.addNode('agent', callModel)
.addNode('tools', new ToolNode([savePreferenceTool]))
.addEdge(START, 'agent')
.addConditionalEdges('agent', (state) => {
    const lastMessage = state.messages.at(-1)
    return lastMessage?.tool_calls?.length > 0 ? 'tools' : END
})
.addEdge("tools", "agent")

// 4. 初始化 Store 和 Checkpointer
// ==========================================
// 这里的 store 是全局唯一的，贯穿所有会话
const inMemoryStore = new InMemoryStore();
const memorySaver = new MemorySaver();
const app = workFlow.compile({
    checkpointer: memorySaver,
    store: inMemoryStore
})

async function main() {
    const userId = "user_123"
    console.log("----- 会话 1 (Thread A): 用户告知喜好 -----");

    const threadConfigA = {
        configurable: {thread_id: "hread_A", user_id: userId}
    }

    // 用户发送第一条消息
  const input1 = [new HumanMessage("你好，我叫小明。记住，我是一个素食主义者，不吃肉。")];

  // 运行图
  for await (const event of await app.stream({ messages: input1 }, threadConfigA)) {
    // 打印每一步的输出以便观察
    const keys = Object.keys(event);
    if (keys.length > 0) {
        console.log(`Node: ${keys[0]} 正在运行...`);
        if (keys[0] === 'tools') {
            console.log("  -> (系统正在调用工具保存记忆...)");
        }
    }
  }
  
  console.log("\n(此时，Thread A 结束。Thread A 的状态存在 MemorySaver 里，但'素食'这个知识存在了 InMemoryStore 里)\n");

  console.log("----- 会话 2 (Thread B): 全新对话，测试记忆 -----");

  // 注意：这里换了一个全新的 thread_id
  const threadConfigB = { 
    configurable: { thread_id: "thread_B", user_id: userId } 
  };
  
  // 用户发送请求，不包含之前的上下文
  const input2 = [new HumanMessage("请给我推荐一道今晚的晚餐。")];

  const resultB = await app.invoke({ messages: input2 }, threadConfigB);
  const finalResponse = resultB.messages[resultB.messages.length - 1].content;

  console.log("Agent 回复:", finalResponse);
  // 预期输出：Agent 会推荐素食，因为它读取到了 InMemoryStore 中的数据
}

// main().catch(console.error);