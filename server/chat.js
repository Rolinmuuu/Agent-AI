import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

// 留个尾巴：如何优化算法，例如 多次查询是否需要全部走这5步吗，针对用户的优化等
const chat = async (filePath = "./uploads/hbs-lean-startup.pdf", query) => {
  const apiKey = process.env.OPENAI_API_KEY;
  // step 1: ducument loader
  const loader = new PDFLoader(filePath);
  const data = await loader.load();

  // step 2: text splitting
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 0,
  });
  const slpitDocuments = await textSplitter.splitDocuments(data);

  // step 3: save to vector stores
  const embeddings = new OpenAIEmbeddings({ apiKey });
  const vectorStore = await MemoryVectorStore.fromDocuments(
    slpitDocuments,
    embeddings,
  );

  // step 4 & 5: retrival - combined with step 5
  const model = new ChatOpenAI({
    model: "gpt-4o",
    apiKey,
  });
  const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.

{context}
Question: {question}
Helpful Answer:`;

  const prompt = PromptTemplate.fromTemplate(template);

  const retriever = vectorStore.asRetriever();
  const relevantDocs = await retriever.invoke(query);

  const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

  const formattedPrompt = await prompt.format({
    context,
    question: query,
  });

  const response = await model.invoke(formattedPrompt);
  return { text: response.content };
};

export default chat;
