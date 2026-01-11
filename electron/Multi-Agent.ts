import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, START, StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as z from 'zod'
dotenv.config({path: '../.env'})

const TeamState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // 新增一个字段，存储主管的决定
  next: Annotation<string>({
    reducer: (x, y) => y ?? x, // 总是覆盖，取最新的决定
  }),
});


const llm = new ChatOpenAI({
    model: 'gpt-5-nano',
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: 'https://api.openai-proxy.org/v1'
    }
})

// 1. 研究员节点
async function researcherNode(state: typeof TeamState.State) {
    const result = await llm.invoke([
        new SystemMessage("你是一个严谨的研究员。你只负责提供事实和数据，不要废话。"),
        ...state.messages
    ])

     // 重点：为了让大家知道这是谁说的，我们在前面加个前缀 (生产环境可以用 name 字段)

     return {
        messages: [new AIMessage({ content: `[研究员]: ${result.content}`, name: "Researcher" })]
     }
}


// 2. 作家节点
async function writerNode(state:typeof TeamState.State) {
    const result = await llm.invoke([
        new SystemMessage("你是一个有文采的作家。根据研究员提供的数据写一段漂亮的文字。"),
        ...state.messages
    ])
    
    return {
        messages: [new AIMessage({ content: `[作家]: ${result.content}`, name: "Writer" })]
    }
}

// 定义主管的输出结构：它必须返回 next 字段
const routeSchema = z.object({
    next: z.enum(["Researcher", "Writer", "FINISH"]).describe("下一步该谁行动？如果任务完成了，选择 FINISH。")
})

// 让 LLM 强制输出这个结构
// .withStructuredOutput 是 LangChain 的神器，自动处理 Function Calling
const supervisorModel = llm.withStructuredOutput(routeSchema);

async function supervisorNode(state: typeof TeamState.State) {
    const systemPrompt =  new SystemMessage(
        "你是项目经理。你的团队有：Researcher, Writer。\n" +
        "根据用户的需求，指挥团队成员工作。\n" +
        "通常流程是：先让 Researcher 查数据 -> 然后让 Writer 写文章 -> 最后 FINISH。"
    )
    
    const response = await supervisorModel.invoke([
        systemPrompt,
        ...state.messages
    ])

    return {
        next: response.next
    }

}

const workFlow = new StateGraph(TeamState)
.addNode("Supervisor", supervisorNode)
.addNode("Researcher", researcherNode)
.addNode("Writer", writerNode)
.addEdge(START, "Supervisor")
.addEdge("Researcher", "Supervisor")
.addEdge("Writer", "Supervisor")
.addConditionalEdges("Supervisor", (state) => state.next, {
    Researcher: "Researcher",
    Writer: "Writer",
    FINISH: END
})

const teamApp = workFlow.compile()

async function main() {
  console.log('run')
  const input = {
    messages: [new HumanMessage("请帮我查一下2024年的奥运会在哪举办，然后写一句简短的宣传语。")],
  };
  console.log("--- 团队开始工作 ---");
  
  // 我们使用 stream 来看清交接过程
  for await (const chunk of await teamApp.stream(input)) {
    for (const [nodeName, update] of Object.entries(chunk)) {
      console.log(`\n>>> [${nodeName}] 工作完成`);
      if (nodeName === "Supervisor") {
        console.log(`    主管决定: 下一步交给 ${update.next}`);
      } else {
        // 打印员工的输出
        const lastMsg = update.messages[update.messages.length - 1];
        console.log(`    ${lastMsg.content}`);
      }
    }
  }
}

main();