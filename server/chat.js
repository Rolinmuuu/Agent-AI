import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-5";
const MAX_CACHED_DOCUMENTS = 20;

// filePath -> vector store. Map keeps insertion order, so the first key is the
// least recently used one; re-inserting on every hit keeps that order.
const vectorStoreCache = new Map();

export const forgetFile = (filePath) => {
  vectorStoreCache.delete(filePath);
};

const getVectorStore = async (filePath, apiKey) => {
  if (vectorStoreCache.has(filePath)) {
    const cached = vectorStoreCache.get(filePath);
    vectorStoreCache.delete(filePath);
    vectorStoreCache.set(filePath, cached);
    return cached;
  }

  // 1. load  2. split  3. embed into an in-memory vector store
  const docs = await new PDFLoader(filePath).load();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const chunks = await splitter.splitDocuments(docs);
  const embeddings = new OpenAIEmbeddings({ apiKey, model: EMBEDDING_MODEL });
  const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  vectorStoreCache.set(filePath, vectorStore);
  if (vectorStoreCache.size > MAX_CACHED_DOCUMENTS) {
    vectorStoreCache.delete(vectorStoreCache.keys().next().value);
  }
  return vectorStore;
};

const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.

CONTEXT: {context}`;

const chat = async (filePath, query, chatHistory = []) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const vectorStore = await getVectorStore(filePath, apiKey);

  // 4. retrieve  5. generate (streamed), with the session's chat history
  const relevantDocs = await vectorStore.asRetriever({ k: 6 }).invoke(query);
  const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_TEMPLATE],
    new MessagesPlaceholder("chat_history"),
    ["human", "{question}"],
  ]);
  const model = new ChatOpenAI({ model: CHAT_MODEL, apiKey });

  return prompt.pipe(model).stream({
    context,
    chat_history: chatHistory,
    question: query,
  });
};

export default chat;
