import React, { useState } from "react";
import { Layout, Typography } from "antd";
import PdfUploader from "./components/PdfUploader";
import RenderQA from "./components/RenderQA";
import ChatComponent from "./components/ChatComponent";

const chatComponentStyle = {
  position: "fixed",
  bottom: "0",
  width: "80%",
  left: "10%", // this will center it because it leaves 10% space on each side
  marginBottom: "20px",
};

const pdfUploaderStyle = {
  margin: "auto",
  paddingTop: "80px",
};

const renderQAStyle = {
  height: "50%", // adjust the height as you see fit
  overflowY: "auto",
};

const App = () => {
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { Header, Content } = Layout;
  const { Title } = Typography;

  const handleStreamStart = (question) => {
    setConversation((prev) => [
      ...prev,
      { question, ragAnswer: "", mcpAnswer: "" },
    ]);
  };

  const handleRagUpdate = (ragAnswer) => {
    setConversation((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        ragAnswer,
      };
      return updated;
    });
  };

  const handleMcpResponse = (mcpAnswer) => {
    setConversation((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        mcpAnswer,
      };
      return updated;
    });
  };

  return (
    <>
      <Layout style={{ height: "100vh", backgroundColor: "white" }}>
        <Header style={{ display: "flex", alignItems: "center" }}>
          <Title style={{ color: "white" }}>AgentAI</Title>
        </Header>
        <Content style={{ width: "80%", margin: "auto" }}>
          <div style={pdfUploaderStyle}>
            <PdfUploader />
          </div>
          <br />
          <br />
          <div style={renderQAStyle}>
            <RenderQA conversation={conversation} isLoading={isLoading} />
          </div>
          <br />
          <br />
          <div style={chatComponentStyle}>
            <ChatComponent
              handleStreamStart={handleStreamStart}
              handleRagUpdate={handleRagUpdate}
              handleMcpResponse={handleMcpResponse}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        </Content>
      </Layout>
    </>
  );
};

export default App;
