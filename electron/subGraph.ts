import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import * as dotenv from 'dotenv'
dotenv.config({path: '../.env'})
// 定义一个通用的状态，父子图都用它
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // 增加一个字段来追踪是谁做的菜
  logs: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
  })
});


// 1. 定义子图的节点逻辑
async function makeCake(state: typeof AgentState.State) {
  return { 
    messages: [new AIMessage("甜点师: 正在烤蛋糕...")],
    logs: ["子图动作: 蛋糕进烤箱"]
  };
}

async function addFrosting(state: typeof AgentState.State) {
  return { 
    messages: [new AIMessage("甜点师: 正在给蛋糕抹奶油...")],
    logs: ["子图动作: 蛋糕装饰完成"]
  };
}

// 2. 构建子图结构
const dessertWorkflow = new StateGraph(AgentState)
  .addNode("baking", makeCake)
  .addNode("frosting", addFrosting)
  
  .addEdge(START, "baking")
  .addEdge("baking", "frosting")
  .addEdge("frosting", END);

// 3. 编译子图
// 【关键点】：这个 dessertApp 稍后会被当做一个“函数”传给父图
const dessertApp = dessertWorkflow.compile();

// 1. 定义父图的节点逻辑
async function mainCourse(state: typeof AgentState.State) {
  return {
    messages: [new AIMessage("主厨: 牛排煎好了，该上甜点了。")],
    logs: ["父图动作: 主菜完成"]
  };
}

async function serve(state: typeof AgentState.State) {
  return {
    messages: [new AIMessage("主厨: 所有菜齐了，请慢用！")],
    logs: ["父图动作: 上菜"]
  };
}

// 2. 构建父图
const mainWorkflow = new StateGraph(AgentState)
  .addNode("main_course", mainCourse)
  
  // ==================================================
  // 【核心魔法】: 添加子图节点
  // 语法: .addNode("节点名", 编译好的子图App)
  // ==================================================
  .addNode("dessert_specialist", dessertApp)
  
  .addNode("serve", serve)

  // 3. 定义流程
  .addEdge(START, "main_course")
  .addEdge("main_course", "dessert_specialist") // 像调用普通函数一样调用子图
  .addEdge("dessert_specialist", "serve")
  .addEdge("serve", END);

// 4. 编译父图
const parentApp = mainWorkflow.compile();


async function main() {
  const inputs = {
    messages: [new HumanMessage("我饿了，上菜吧！")],
    logs: []
  };

  console.log("--- 开始上菜流程 ---");
  const result = await parentApp.invoke(inputs);

  console.log("\n--- 最终消息记录 ---");
  result.messages.forEach(msg => {
    console.log(msg.content);
  });

  console.log("\n--- 内部执行日志 (Log) ---");
  result.logs.forEach(log => {
    console.log(log);
  });
}

main();