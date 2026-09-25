import React from "react";
import { IconDoc, IconGlobe, IconSpark } from "./Icons";

const Thinking = ({ label }) => (
  <div className="thinking">
    <span className="dots">
      <i />
      <i />
      <i />
    </span>
    {label}
  </div>
);

// One question and its two answers: the streamed document answer (RAG) and the
// parallel web answer from the MCP search tool.
const Exchange = ({ each, streaming, docName }) => {
  const webPending = streaming && each.mcpAnswer === undefined && !each.mcpError;
  const web = each.mcpAnswer || each.mcpError;
  return (
    <div className="exchange">
      <div className="q-row">
        <div className="q-bubble">{each.question}</div>
      </div>

      <div className="a-row">
        <span className="avatar" aria-hidden="true">
          <IconSpark width={16} height={16} />
        </span>
        <div className="a-card">
          <div className="a-section">
            <div className="a-label">
              <IconDoc width={14} height={14} />
              Document answer (RAG){docName ? <span className="a-source"> · {docName}</span> : null}
            </div>
            {each.ragAnswer ? (
              <div className={`a-text${streaming ? " streaming" : ""}`}>{each.ragAnswer}</div>
            ) : streaming ? (
              <Thinking label="Reading the document…" />
            ) : (
              <div className="a-text muted">No answer was returned.</div>
            )}
          </div>

          {(web || webPending) && (
            <div className="a-section web">
              <div className="a-label">
                <IconGlobe width={14} height={14} />
                Web answer (via MCP search)
              </div>
              {webPending ? (
                <Thinking label="Checking the web in parallel…" />
              ) : (
                <div className={`a-text${each.mcpError && !each.mcpAnswer ? " muted" : ""}`}>{web}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RenderQA = ({ conversation, isLoading, docName }) => (
  <>
    {conversation?.map((each, index) => (
      <Exchange
        key={index}
        each={each}
        docName={docName}
        streaming={isLoading && index === conversation.length - 1}
      />
    ))}
  </>
);

export default RenderQA;
