import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
const FILE_PATH = process.env.FILE_PATH;

const vectorStoreCache = new Map();

const chat = async (filePath = FILE_PATH, query, chatHistory = []) => {
  const apiKey = process.env.OPENAI_API_KEY;

  let vectorStore;
  if (vectorStoreCache.has(filePath)) {
    vectorStore = vectorStoreCache.get(filePath);
  } else {
    // step 1: ducument loader
    const loader = new PDFLoader(filePath);
    const data = await loader.load();

    // step 2: text splitting
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const slpitDocuments = await textSplitter.splitDocuments(data);

    // step 3: save to vector stores
    const embeddings = new OpenAIEmbeddings({ apiKey });
    vectorStore = await MemoryVectorStore.fromDocuments(
      slpitDocuments,
      embeddings,
    );
    vectorStoreCache.set(filePath, vectorStore);
  }

  // step 4 & 5: retrival - combined with step 5
  const model = new ChatOpenAI({
    model: "gpt-5",
    apiKey,
  });
  const template = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.

CONTEXT: {context}`;
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", template],
    new MessagesPlaceholder("chat_history"),
    ["human", "{question}"],
  ]);

  const retriever = vectorStore.asRetriever();
  const relevantDocs = await retriever.invoke(query);

  const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
  const chain = prompt.pipe(model);
  const stream = await chain.stream({
    context,
    chat_history: chatHistory,
    question: query,
  });
  return stream;
};

export default chat;
