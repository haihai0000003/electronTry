import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { Annotation, START,END, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from 'dotenv'
dotenv.config({path: '../.env'})


const model = new ChatOpenAI({
    model: 'gpt-5-nano',
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: 'https://api.openai-proxy.org/v1'
    }
})
const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y)
    })
})

const writer = async (state: typeof GraphState.State) => {
    const response = await model.invoke(state.messages)
    return {
        messages: [response]
    }
}

const workflow = new StateGraph(GraphState)
.addNode("write", writer)
.addEdge(START, "write")
.addEdge("write", END)


const app = workflow.compile()
//方式一：节点级流式 (`app.stream`)
async function streamGraphUpdates() {

    const inputs = {
        messages: [new HumanMessage("写一首关于'冬天'的短诗")]
    }

    for await(const chunk of await app.stream(inputs)) {
        console.log('chunk', chunk)
        for (const [nodeName, update] of Object.entries(chunk)) {
            console.log(`\n>>> [节点完成]: ${nodeName}`);
            console.log("    输出内容:", update); // 这里会打印出该节点产生的消息
        }
    }
    console.log("\n--- 流程结束 ---");
}



// 方式二：Token 级流式 (`app.streamEvents`) —— **最常用！**

async function streamTokens() {
    const inputs = {
    messages: [new HumanMessage("写一首关于'咖啡'的短诗")],
  };

  const eventStream = await app.streamEvents(inputs, { version : 'v2'})

   for await (const event of eventStream) {
    // event 包含了很多类型的事件（图开始、节点开始、工具开始、LLM开始...）
    // 我们只关心 LLM 的流式输出事件
    
    const eventType = event.event;

    // 1. 监听 LLM 吐字
    if (eventType === "on_chat_model_stream") {
      // 获取当前吐出的 token (或者 chunk)
      const chunk = event.data.chunk;
      
      // 打印内容 (注意：有些 chunk 可能是空的或者是工具调用请求)
      if (chunk.content) {
        process.stdout.write(chunk.content as string); // 不换行打印
      }
    }
    
    // 2. 你也可以监听节点切换，做 UI 上的 Loading 提示
    else if (eventType === "on_chain_start") {
        if (event.name === "writer") {
            console.log("\n[系统]: 正在构思诗歌...\n");
        }
    }
  }
  
  console.log("\n\n--- 结束 ---");
}

streamTokens()