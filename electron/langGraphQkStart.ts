import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { StateGraph, START, END, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { AIMessage, SystemMessage, ToolMessage, HumanMessage } from "@langchain/core/messages";
// Invoke
const model = new ChatOpenAI({
    modelName: "gpt-5-nano", // 或者 "gpt-4o"
    temperature: 1,
    apiKey: "",
    configuration: {
        baseURL: "https://api.openai-proxy.org/v1",
    }
  });

// Define tools
const add = tool(({ a, b }) => a + b, {
  name: "add",
  description: "Add two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

const multiply = tool(({ a, b }) => a * b, {
  name: "multiply",
  description: "Multiply two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

const divide = tool(({ a, b }) => a / b, {
  name: "divide",
  description: "Divide two numbers",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
});

// Augment the LLM with tools
const toolsByName = {
  [add.name]: add,
  [multiply.name]: multiply,
  [divide.name]: divide,
};
const tools = Object.values(toolsByName);
const modelWithTools = model.bindTools(tools);

const MessagesState = Annotation.Root({
  ...MessagesAnnotation.spec,
  llmCalls: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

// Extract the state type for function signatures
type MessagesStateType = typeof MessagesState.State;

async function llmCall(state: MessagesStateType) {
    const messages = [await modelWithTools.invoke([
      new SystemMessage(
        "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
      ),
      ...state.messages,
    ])]
    console.log('state.messages', state.messages);
    console.log('messages',messages);
  return {
    messages: messages,
    llmCalls: 1,
  };
}

async function toolNode(state: MessagesStateType) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }
  const result: ToolMessage[] = [];
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name];
    const observation = await tool.invoke(toolCall);
    console.log('observation',observation);
    result.push(observation);
  }

  return { messages: result };
}

async function shouldContinue(state: MessagesStateType) {
  const lastMessage = state.messages.at(-1);

  // Check if it's an AIMessage before accessing tool_calls
  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return END;
  }

  // If the LLM makes a tool call, then perform an action
  if (lastMessage.tool_calls?.length) {
    return "toolNode";
  }

  // Otherwise, we stop (reply to the user)
  return END;
}

const agent = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("toolNode", toolNode)
  .addEdge(START, "llmCall")
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "llmCall")
  .compile();


const result = await agent.invoke({
  messages: [new HumanMessage("Add 3 and 4.")],
});

for (const message of result.messages) {
  console.log(`[${message.type}]: ${message.text}`);
}

