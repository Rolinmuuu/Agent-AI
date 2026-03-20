import React from "react";
import { Upload, message } from "antd";
import axios from "axios";
import { InboxOutlined } from "@ant-design/icons";

const { Dragger } = Upload;

const DOMAIN = "http://localhost:5001";

const uploadToBackend = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await axios.post(`${DOMAIN}/upload`, formData);
    return response;
  } catch (error) {
    console.error("Error uploading file:", error.response?.data);
    return null;
  }
};

const attributes = {
  name: "file",
  multiple: true,
  customRequest: async ({ file, onSuccess, onError }) => {
    try {
      const response = await uploadToBackend(file);
      if (response && response.status === 200) {
        onSuccess(response.data);
      } else {
        onError(new Error("Failed to upload file"));
      }
    } catch (error) {
      onError(new Error("Failed to upload file"));
    }
  },
  onChange: (info) => {
    const { status } = info.file;
    if (status !== "uploading") {
      console.log(info.file, info.fileList);
    }
    if (status === "done") {
      message.success(`${info.file.name} file uploaded successfully.`);
    }
    if (status === "error") {
      message.error(
        `${info.file.name} file upload failed, please try again later.`,
      );
    }
  },
  onDrop: (e) => {
    console.log("File dropped e", e);
  },
};

const PdfUploader = () => {
  return (
    <Dragger {...attributes}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">
        Click or drag file to this area to upload your PDF.
      </p>
    </Dragger>
  );
};
export default PdfUploader;
