import { ChatOpenAI } from "@langchain/openai";
import { Annotation, START, END, StateGraph, MessagesAnnotation } from '@langchain/langgraph'
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from '@langchain/core/tools'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { AIMessage } from '@langchain/core/messages'
import * as z from 'zod'
const model = new ChatOpenAI({
    modelName: "gpt-5-nano", // 或者 "gpt-4o"
    temperature: 1,
    apiKey: "",
    configuration: {
        baseURL: "https://api.openai-proxy.org/v1",
    }
  });

// 定义 Graph 的状态
// 这里我们使用 Annotation.Root 来定义一个包含 messages 数组的状态
// reducer: (x, y) => x.concat(y) 意味着新的消息会被追加到数组末尾，而不是覆盖
// - 初始状态 ： message: [HumanMessage]
// - 节点执行 ： callModel 节点处理状态，调用模型并返回 { message: [AIMessage] }
// - 状态合并 ：LangGraph检测到message字段有reducer，执行
const GraphState = Annotation.Root({
  message: Annotation<BaseMessage[]>({
    reducer: (a, b) => a.concat(b)
  })
})

async function callModel(state:typeof GraphState.State) {
  const messages = state.message;
  const response = await model.invoke(messages);
  return {
    message: [response]
  };
}


const workFlow = new StateGraph(GraphState)
.addNode("agent", callModel)
.addEdge(START, "agent")
.addEdge("agent", END)


const app = workFlow.compile();


async function main() {
  const inputs = {
    message: [new HumanMessage("你好，请用简短的话介绍一下 LangGraph。")],
  };
 
  // invoke 运行
  const result = await app.invoke(inputs);
  
  // 打印最后一条消息的内容
  console.log(result.message[result.message.length - 1].content);
}

// -------------------------------------langgraph 工具调用-------------------------------------------------
const multiply = tool(({a,b}) => {
  return a + b;
}, {
  name: "multiply",
    description: "计算两个数字的乘积",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
})

const tools = [multiply]

const modelTools = model.bindTools(tools)

const toolNode = new ToolNode(tools)

function shouldcontinue(state: typeof GraphState.State) {
  const message = state.message
  const lastMessage = message.at(-1)
  if(AIMessage.isInstance(lastMessage) && (lastMessage.tool_calls?.length ?? 0) > 0) {
    return "tools"
  }

  return END
}


async function callModelWithTools(state: typeof GraphState.State) {
  const messages = state.message;
  const response = await modelTools.invoke(messages);
  return {
    message: [response]
  };
}

const agentWorkFlow = new StateGraph(GraphState)
.addNode("agent", callModelWithTools)
.addNode("tools", toolNode)
.addEdge(START, "agent")
.addConditionalEdges("agent", shouldcontinue, {tools: "tools", [END]: END})
.addEdge("tools", "agent")
// -------------------------------------langgraph 多条件调用-------------------------------------------------


const initState = Annotation.Root({
  rawInput: Annotation<String>(),
  processedData: Annotation<String>(),
  finalResult: Annotation<String>(),
  isResultValid: Annotation<Boolean>(),
  index: Annotation<number>(),
})

type RootState = typeof initState.State;

// 2. 定义 4 个业务节点（新增重处理节点）
// 节点 1：数据预处理
async function preprocessDataNode(state: RootState) {
  return {
    processedData: `[预处理完成] ${state.rawInput.trim().toLowerCase()} state.index: ${state.index}`,
  };
}

// 节点 2：业务逻辑处理
async function handleBusinessNode(state: RootState) {
  return {
    finalResult: `[业务处理完成] ${state.processedData.toUpperCase()}`,
  };
}

// 节点 3：结果校验（更新 isValid 状态）
async function checkResultNode(state: RootState) {
  const isValid = state.finalResult.length > 20; // 校验规则：结果长度大于20为有效
  return {
    index: state.index + 1,
    isResultValid: isValid,
    finalResult: isValid ? state.finalResult : "[校验失败] 结果长度不足20",
  };
}

// 节点 4：重处理节点（校验失败时，重新处理数据）
async function reprocessNode(state: RootState) {
  // 重处理逻辑：在原有预处理基础上补充内容
  const reprocessedData = `${state.processedData} - [重处理补充内容]`;
  return {
    processedData: reprocessedData, // 更新预处理数据，用于重新执行业务处理
  };
}

// 3. 定义【条件判断函数】（核心：决定条件边的流转方向）
/**
 * 条件判断函数：基于当前 RootState，返回目标节点 ID
 * @param state 当前全局状态
 * @returns 目标节点 ID（字符串类型，需与 addNode 定义的 Node ID 一致）
 */
async function conditionJudgeFunction(state: RootState) {
  // 核心逻辑：根据 isResultValid 判断下一步
  if (state.index > 5) {
    // 校验通过：直接结束（返回 END 内置标识）
    return END;
  } else {
    // 校验失败：跳转到重处理节点（返回自定义 Node ID "reprocessData"）
    return "preprocessData";
  }
}


// 4. 构建 StateGraph + 添加条件边
const graphBuilder = new StateGraph(initState)
  // 第一步：添加所有节点（含重处理节点）
  .addNode("preprocessData", preprocessDataNode)
  .addNode("handleBusiness", handleBusinessNode)
  .addNode("checkResult", checkResultNode)

  // 第二步：添加普通边（固定流转）
  .addEdge(START, "preprocessData") // 入口 → 预处理
  .addEdge("preprocessData", "handleBusiness") // 预处理 → 业务处理
  .addEdge("handleBusiness", "checkResult") // 业务处理 → 结果校验

  // 第三步：添加条件边（核心：addConditionalEdges）
  .addConditionalEdges(
    "checkResult", // 第一个参数：源节点 ID（从哪个节点出发做条件判断）
    conditionJudgeFunction, // 第二个参数：条件判断函数（返回目标节点 ID）
    // 第三个参数（可选，但建议配置）：枚举所有可能的目标节点 ID，用于类型校验
    [END, "preprocessData"]
  )

  // 第四步：添加重处理节点的后续普通边（重处理后 → 重新执行业务处理）


  // 5. 编译并运行工作流
const graph = graphBuilder.compile();

// 执行函数
async function runWorkflow() {
  // 初始状态（rawInput 较短，会导致第一次校验失败，触发重处理）
  const initialState: RootState = {
    rawInput: "Hi", // 原始输入较短
    processedData: "",
    finalResult: "",
    isResultValid: false,
    index: 0,
  };

  // 运行工作流
  const result = await graph.invoke(initialState);

  // 打印结果
  console.log("最终原始输入：", result.rawInput);
  console.log("最终预处理数据：", result.processedData);
  console.log("最终结果：", result.finalResult);
  console.log("结果是否有效：", result.isResultValid);
  console.log("索引值：", result.index);
}

// 执行
runWorkflow();

