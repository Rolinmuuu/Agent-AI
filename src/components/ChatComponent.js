import React, { useState, useEffect } from "react";
import axios from "axios";
import { Input, Button } from "antd";
import { AudioOutlined, BoldOutlined } from "@ant-design/icons";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import Speech from "speak-tts";

const { Search } = Input;

const DOMAIN = "http://localhost:5001";

const searchContainer = {
  display: "flex",
  justifyContent: "center",
};

const ChatComponent = (props) => {
  const { handleResponse, isLoading, setIsLoading } = props;

  const [searchValue, setSearchValue] = useState("");
  const [isChatModeOn, setIsChatModeOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speech, setSpeech] = useState(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  useEffect(() => {
    const initialized_speech = new Speech();
    initialized_speech
      .init({
        volume: 1,
        rate: 1,
        pitch: 1,
        lang: "en-US",
        voice: "Google US English",
        splitSentences: false,
      })
      .then(() => {
        console.log("Speech is ready");
        setSpeech(initialized_speech);
      })
      .catch((e) => {
        console.error("Speech failed, please try again.", e);
      });
  }, []);

  useEffect(() => {
    if (!listening && Boolean(transcript)) {
      // 这是什么写法，IFFE？
      (async () => await onSearch(transcript))();
      setIsRecording(false);
    }
  }, [listening, transcript]);

  const talk = (what2say) => {
    speech.speak({
        text: what2say,
        queue: false,
        listeners: {
            onstart: () => {},
            onend: () => {},
            onresume: () => {},
            onboundary: () => {},
        }
    })
    .then(() => {
        userStartConvo();
    })
    .catch((e) => {
        console.error("Speech failed, please try again.", e);
    });
  };

  const userStartConvo = () => {
    SpeechRecognition.startListening();
    setIsRecording(true);
    resetTranscript();
  }

  const chatModeClickHandler = () => {
    setIsChatModeOn(!isChatModeOn);
    setIsRecording(false);
    SpeechRecognition.stopListening();
  }

  const recordingClickHandler = () => {
    if (isRecording) {
        setIsRecording(false);
        SpeechRecognition.stopListening();
    } else {
        setIsRecording(true);
        SpeechRecognition.startListening();
    }
  }

  const onSearch = async (question) => {
    setSearchValue("");
    setIsLoading(true);
    try {
      const response = await axios.get(`${DOMAIN}/chat`, {
        params: {
          question: question,
        },
      });
      handleResponse(question, response.data);
      if (isChatModeOn) {
        talk(response.data);
      }
      setIsLoading(false);
    } catch (error) {
      handleResponse(question, "Something went wrong, please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleChange = (e) => {
    setSearchValue(e.target.value);
  };
  return (
    <div style={searchContainer}>
      { !isChatModeOn && (
        <Search
        placeholder="Input your question"
        enterButton="Search"
        size="large"
        style={{ width: 500 }}
        onSearch={onSearch}
        loading={isLoading}
        value={searchValue}
        onChange={handleChange}
      />
      )}
      <Button
       type="primary"
       size="large"
       danger={isRecording}
       onClick={chatModeClickHandler}
       style={{ marginLeft: "5px" }}
      >
        Chat Mode: {isChatModeOn ? "On" : "Off"}
      </Button>

      {
        isChatModeOn && <Button
        type="primary"
        size="large"
        icon={<AudioOutlined />}
        danger={isRecording}
        onClick={recordingClickHandler}
        style={{ marginLeft: "5px" }}
      >
            {isRecording ? "Recording..." : "Click to record"}
        </Button>
      }
    </div>
  );
};

export default ChatComponent;
