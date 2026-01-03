import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as dotenv from "dotenv";
import { z } from "zod";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
// 加载 .env 中的 OPENAI_API_KEY
dotenv.config();

const ExplanationSchema = z.object({
  topic: z.string().describe("用户询问的技术概念名称"),
  analogy: z.string().describe("用生活中的例子做的比喻，一定要生动"),
    technical_details: z.string().describe("严谨的技术原理解释"),
  difficulty_score: z.number().min(1).max(10).describe("该概念的理解难度评分 (1-10)"),
  tags: z.array(z.string()).describe("3个相关的技术领域标签"),
});

type Explanation = z.infer<typeof ExplanationSchema>;

  const model = new ChatOpenAI({
    modelName: "gpt-5-nano", // 或者 "gpt-4o"
    temperature: 1,
    apiKey: "",
    configuration: {
        baseURL: "https://api.openai-proxy.org/v1",
    }
  });
async function main() {
  // --- 第一步：初始化模型 (Model) ---
  // temperature: 0.7 表示更有创造力，0 表示更严谨
  

  // --- 第二步：创建提示词模板 (Prompt) ---
  // 使用 fromMessages 定义角色，更符合 Chat 模型逻辑
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个资深的技术专家，擅长用通俗易懂的生活比喻来解释复杂的技术概念。"],
    ["user", "请简单解释一下什么是：{topic},不超过50个字。"],
  ]);

  // --- 第三步：定义输出解析器 (Output Parser) ---
  // 模型的原始输出是 AIMessage 对象，我们通常只需要里面的 content 字符串
  const outputParser = new StringOutputParser();

  // --- 第四步：组装 LCEL 链 (Chain) ---
  // 核心魔法：使用 .pipe() 将它们串联起来
  // 数据流向：Input -> Prompt -> Model -> OutputParser -> Result
  const chain = prompt.pipe(model).pipe(outputParser);

  // --- 第五步：调用 (Invoke) ---
  console.log("正在思考...");
  const result = await chain.invoke({
    topic: "防抖和节流",
  });

  console.log("\n--- 回答 ---");
  console.log(result);
}


async function jsonMain() {
    // --- 关键魔法：withStructuredOutput ---
  // 这行代码做了两件事：
  // 1. 告诉 OpenAI 必须按照这个 Schema 输出。
  // 2. 自动把输出解析成 JS 对象（不需要再写 JSON.parse 了）。
  const structuredModel = model.withStructuredOutput(ExplanationSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个技术字典助手。"],
    ["user", "请解释：{topic},不超过50个字。"],
  ]);
  
  const chain = prompt.pipe(structuredModel);

  const result = await chain.invoke({
    topic: "React Hooks",
  });
  console.log("\n--- 回答 ---");
  console.log(result);
}


async function ragMain() {
    // --- A. 准备数据 (模拟加载文档) ---
  // 现实中这里通常使用 PDFLoader 或 CheerioWebBaseLoader
  const policyText = `
  欢迎来到 TechCorp 公司。
  关于远程办公政策：
  1. 只有工作满 6 个月的员工可以申请远程办公。
  2. 每周最多允许远程办公 2 天（周二和周四）。
  3. 申请必须在每周一上午 10 点前提交给经理审批。
  4. 全职远程仅适用于居住在公司 500 公里以外的员工。
  关于报销政策：
  1. 只有差旅产生的餐费可以报销，上限为每天 50 美元。
  `;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 100, // 每块大概 100 字符
    chunkOverlap: 20, // 指定相邻两个文本块（Chunk）之间重叠 / 共享的文本内容长度（通常以字符数为单位，可理解为 “重叠字符数”
  })

  const docs = await splitter.createDocuments([policyText]);
    console.log(`文档已切分为 ${docs.length} 个片段。`);
    // --- C. 建立索引 (Indexing) ---
  // 1. 使用 OpenAIEmbeddings 把文字变成向量
  // 2. 存入 MemoryVectorStore (内存向量库)
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings({
    apiKey: "",
    configuration: {
        baseURL: "https://api.openai-proxy.org/v1",
    }
  }));

  const retriever = vectorStore.asRetriever({k: 2}); // 每次只找最相关的 2 个片段，节省 Token


  console.log(retriever);
  // 这是一个专门给 RAG 用的 Prompt 模板
  const prompt = ChatPromptTemplate.fromTemplate(`
    你是一个助手，请根据下面的上下文回答问题。如果不清楚，就说不知道。
    
    上下文 (Context):
    {context}
    
    问题: {question}
  `);

  // 辅助函数：把检索到的 Document 对象数组转成一个长字符串
  const formatDocumentsAsString = (documents: Document[]) => {
    return documents.map((doc) => doc.pageContent).join("\n\n");
  };

  const chain = RunnableSequence.from([
    {
        context: retriever.pipe(formatDocumentsAsString),
        question: new RunnablePassthrough()
    },
    prompt,
    model,
    new StringOutputParser(),
  ])
  // --- E. 提问 ---
  console.log("正在查询知识库...");
  
  const result = await chain.invoke("我刚入职，下周二能远程办公吗？");
  
  console.log("\n--- AI 回答 ---");
  console.log(result);
}


async function toolMain() {
    const addTool = tool(async ({a, b}) => {
        return a + b;
    }, {
      name: 'calculate',
      description: '用于计算两个数的和',
      schema: z.object({
        a: z.number().describe('第一个数'),
        b: z.number().describe('第二个数'),
      }),
    })
    const outputParser = new StringOutputParser();
    const modelWithTools = model.bindTools([addTool]);

    try {
      const res = await modelWithTools.pipe(outputParser).invoke("39225 加 192381 等于多少？");
      console.log("\n--- 回答 ---");
      console.log(res);
    } catch (error) {
      console.log('error', error)
    }
   
}
toolMain().catch(console.error);
