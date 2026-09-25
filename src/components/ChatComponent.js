import React, { useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import Speech from "speak-tts";
import { IconMic, IconSend } from "./Icons";

// Composer: typed questions, plus an optional voice mode that listens for a
// question and reads the document answer back aloud.
const ChatComponent = ({ onAsk, isLoading, disabled, lastAnswer, answerVersion }) => {
  const [value, setValue] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [speech, setSpeech] = useState(null);
  const area = useRef(null);
  const spokenVersion = useRef(answerVersion);

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    const s = new Speech();
    s.init({ volume: 1, rate: 1, pitch: 1, lang: "en-US", splitSentences: false })
      .then(() => setSpeech(s))
      .catch(() => setSpeech(null));
  }, []);

  // A finished voice transcript becomes a question.
  useEffect(() => {
    if (voiceOn && !listening && transcript) {
      onAsk(transcript);
      resetTranscript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, transcript]);

  // In voice mode, read each new finished answer aloud, then listen again.
  useEffect(() => {
    if (!voiceOn || isLoading || answerVersion === spokenVersion.current) return;
    spokenVersion.current = answerVersion;
    if (!speech || !lastAnswer) return;
    speech
      .speak({ text: lastAnswer, queue: false })
      .then(() => voiceOn && SpeechRecognition.startListening())
      .catch(() => {});
  }, [voiceOn, isLoading, answerVersion, lastAnswer, speech]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const q = value.trim();
    if (!q || isLoading || disabled) return;
    onAsk(q);
    setValue("");
  };

  const toggleVoice = () => {
    if (voiceOn) {
      SpeechRecognition.stopListening();
      if (speech) speech.cancel();
      setVoiceOn(false);
    } else {
      setVoiceOn(true);
      resetTranscript();
      SpeechRecognition.startListening();
    }
  };

  return (
    <div className={`composer${disabled ? " disabled" : ""}`}>
      <textarea
        ref={area}
        rows={1}
        value={voiceOn ? transcript : value}
        readOnly={voiceOn}
        disabled={disabled}
        placeholder={
          disabled ? "Upload a PDF to start asking questions" : voiceOn ? (listening ? "Listening…" : "Voice mode on") : "Ask anything about your document…"
        }
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label="Your question"
      />
      <div className="composer-actions">
        {browserSupportsSpeechRecognition && (
          <button
            type="button"
            className={`ghost-btn${voiceOn ? " on" : ""}${listening ? " live" : ""}`}
            onClick={toggleVoice}
            disabled={disabled}
            title={voiceOn ? "Turn voice mode off" : "Voice mode: speak your question, hear the answer"}
          >
            <IconMic />
            <span className="ghost-label">{voiceOn ? (listening ? "Listening" : "Voice on") : "Voice"}</span>
          </button>
        )}
        <button
          type="button"
          className="send-btn"
          onClick={submit}
          disabled={disabled || isLoading || !value.trim() || voiceOn}
          aria-label="Send"
        >
          {isLoading ? <span className="spinner light" /> : <IconSend />}
        </button>
      </div>
    </div>
  );
};

export default ChatComponent;
