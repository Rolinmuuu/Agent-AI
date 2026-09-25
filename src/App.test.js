import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RenderQA from "./components/RenderQA";
import { Dropzone } from "./components/PdfUploader";
import App from "./App";
import * as api from "./api";

jest.mock("./api", () => ({ uploadPdf: jest.fn(), resetHistory: jest.fn(), streamChat: jest.fn() }));
// Browser speech APIs do not exist in jsdom; voice mode is exercised manually.
jest.mock("react-speech-recognition", () => ({
  __esModule: true,
  default: { startListening: jest.fn(), stopListening: jest.fn() },
  useSpeechRecognition: () => ({
    transcript: "",
    listening: false,
    resetTranscript: jest.fn(),
    browserSupportsSpeechRecognition: false,
  }),
}));
// Plain class (not jest.fn) because CRA resets mock implementations between tests.
jest.mock("speak-tts", () =>
  class {
    init() {
      return Promise.reject(new Error("no speech in jsdom"));
    }
  },
);

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

test("shows progress placeholders while the last answer is streaming", () => {
  render(<RenderQA conversation={[{ question: "q", ragAnswer: "" }]} isLoading />);
  expect(screen.getByText(/Reading the document/i)).toBeInTheDocument();
  expect(screen.getByText(/Checking the web/i)).toBeInTheDocument();
});

test("dropzone rejects files that are not PDFs", () => {
  const onFile = jest.fn();
  const { container } = render(<Dropzone onFile={onFile} />);
  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
  expect(onFile).not.toHaveBeenCalled();
  expect(screen.getByText(/Only PDF files/i)).toBeInTheDocument();

  fireEvent.change(input, { target: { files: [new File(["%PDF"], "report.pdf", { type: "application/pdf" })] } });
  expect(onFile).toHaveBeenCalledTimes(1);
});

test("questions are disabled until a PDF has been uploaded", async () => {
  api.uploadPdf.mockResolvedValue();
  const { container } = render(<App />);
  expect(screen.getByLabelText("Your question")).toBeDisabled();

  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(["%PDF"], "report.pdf", { type: "application/pdf" })] } });

  await waitFor(() => expect(screen.getByText(/Your document is ready/i)).toBeInTheDocument());
  expect(api.uploadPdf).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Your question")).not.toBeDisabled();
});
