import { render, screen } from "@testing-library/react";
import RenderQA from "./components/RenderQA";

test("renders document and web answers for each exchange", () => {
  render(
    <RenderQA
      conversation={[
        { question: "What is the refund window?", ragAnswer: "30 days.", mcpAnswer: "Usually 30 days." },
      ]}
      isLoading={false}
    />,
  );
  expect(screen.getByText("What is the refund window?")).toBeInTheDocument();
  expect(screen.getByText("30 days.")).toBeInTheDocument();
  expect(screen.getByText(/Web answer/i)).toBeInTheDocument();
});

test("shows a notice when web search is unavailable", () => {
  render(
    <RenderQA
      conversation={[{ question: "q", ragAnswer: "a", mcpAnswer: null, mcpError: "Web search unavailable" }]}
      isLoading={false}
    />,
  );
  expect(screen.getByText("Web search unavailable")).toBeInTheDocument();
});
