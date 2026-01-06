import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages"
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph"


const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y)
    })
})

const workFlow = new StateGraph(GraphState)
.addNode('agent', (state: typeof GraphState.State) => {
    const lastMessage = state.messages[state.messages.length - 1]
    return {
        messages: [new AIMessage(`好的，记住了： ${lastMessage?.content}`)]
    }
})
.addEdge(START, 'agent')
.addEdge('agent', END)

const checkpointer = new MemorySaver()

const app = workFlow.compile({
    checkpointer
})

async function main() {
    const config = {
        configurable: {thread_id: "ice-cream-user"}
    }
    await app.invoke({messages: [new HumanMessage("我喜欢香草味")]}, config)

     // 第二轮：喜欢巧克力 (这一步我们将要在稍后“修正”)
    console.log("--- Round 2: 巧克力 ---");
    await app.invoke(
        { messages: [new HumanMessage("我还喜欢巧克力味")] },
        config
    );
    
    // 此时的状态: [Human(香草), AI(OK), Human(巧克力), AI(OK)

     console.log("\n--- 查看历史快照 ---");
    const history = [];

    for await (const checkpoint of app.getStateHistory(config)) {
        history.push(checkpoint)

        // 打印看看结构
        console.log(`Checkpoint ID: ${checkpoint.config.configurable?.checkpoint_id}`);
        console.log(`Payload:`, checkpoint.values.messages?.map((m:BaseMessage) => m.content));
        // console.log("-------------------");
    }

    const targetConfig = history[2].config
    // console.log(history.length,targetConfig)

    // 使用旧的 config，传入新的消息
    const newResult = await app.invoke(
        { messages: [new HumanMessage("不，其实我想要草莓味！")] },
        targetConfig // <--- 关键！告诉 Graph 基于这个旧存档运行
    );

    console.log("\n--- 修正后的最新回复 ---");
    console.log(newResult.messages);
}

main()