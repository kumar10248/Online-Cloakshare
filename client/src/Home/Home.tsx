import React, { useEffect, useState } from "react";
import "./Home.css";
import { getData, postData } from "../Config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload,faFloppyDisk } from "@fortawesome/free-solid-svg-icons";

const Home = () => {
  const [text, setText] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [codeText, setCodeText] = useState<string>("");
  const [showText, setShowText] = useState<string>("");
  const [number, setNumber] = useState<string>('');

  const [isLoadingSave, setIsLoadingSave] = useState<boolean>(false);
  const [isLoadingShow, setIsLoadingShow] = useState<boolean>(false);

  const [isText, setIsText] = useState<boolean>(true);
  const [isFile, setIsFile] = useState<boolean>(false);

  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(()=>{
    const fetchAPI = async()=>{
      await getData("");
      console.log("API is working");
    };
    fetchAPI();
  },[]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSave(true);
    const response = await postData("save", { text: text, time: number }, {});
    console.log(response);
    if (response) {
      setCodeText(response.code);
    }
    setIsLoadingSave(false);
  };

  const handleShow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingShow(true);
    setShowText("");
    const response = await getData("show", { code: code, responseType: 'blob' });
    if (response.text) {
      setShowText(response.text);
    } else{
      // window.open(`https://drive.google.com/uc?export=download&id=${response.fileId}`)
      let link = document.createElement('a');
link.href = `https://drive.google.com/uc?export=download&id=${response.fileId}`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
    }
    setIsLoadingShow(false);
  };

  const handleCopy = () => {
    const textArea = document.querySelector(
      ".homeTextArea1"
    ) as HTMLTextAreaElement;
    textArea.select();
    document.execCommand("copy");
  };

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setSelectedFile(selectedFile);
    console.log('Selected File:', selectedFile);

  };

  

  const handleErrorNumChange=(e: React.ChangeEvent<HTMLInputElement>)=>{
    let inputValue = e.target.value;
    if(!/^\d*$/.test(inputValue)){
      return;
    } else if (parseInt(inputValue) > 2880) {
      setNumber('2880');
    }else{
      setNumber(inputValue);
    }
  };
  

  const handleUpload = async (e: React.FormEvent) => {
    console.log('Selected File successfully:');
    e.preventDefault();
    setCodeText("");
  
    if (!selectedFile) {
      alert('Please select a file');
      return;
    };

    if (selectedFile.size > 100 * 1024 * 1024) {
      alert("File is too large, please select a file less than 100MB.");
      setIsLoadingSave(false);
      return;
    }
  
    setIsLoadingSave(true);
  
    try {
      const config = {
        onUploadProgress: function(progressEvent: ProgressEvent) {
          let percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      };

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('time', number);
  
      console.log('Selected File:', selectedFile);
      console.log('FormData:', formData);
  
      const response = await postData('upload', formData, config);
  
      console.log('File uploaded:', response.data);
      setCodeText(response.code);
      setIsLoadingSave(false);
    } catch (error) {
      console.error('Error uploading file:', error);
      setIsLoadingSave(false);
    }
  };
  

  return (
    <>
    {/* top */}
     <div className="text-2xl flex justify-center items-center"><h1>ONLINE  CLOAKSHARE</h1></div>
   
    {/* <div className="homeNoticeText">Your Data will be deleted within 24 hours automatically if you leave expiration time empty.</div> */}
    {/* homeMainDiv */}
    <div className="bg-black flex justify-center h-[100vh]">
      <div className="w-1/2">
      <div className="">
        <div className="homeTitleText">Send to online CloakShare</div>
        <div className="homeBtnDiv">
          <button
            className="homeBtn"
            onClick={() => {
              setIsText(true);
              setIsFile(false);
              setCodeText("");
            }}>
            Text
          </button>
          <button
            className="homeBtn"
            onClick={() => {
              setIsFile(true);
              setIsText(false);
              setCodeText("");
            }}>
            File
          </button>
          </div>
        {isText&&<form
          action="submit"
          className="homeForm"
          onSubmit={handleSave}>
          <textarea
            placeholder="Enter Text"
            className="homeTextArea outline-none focus:outline-yellow-400 focus:border-none border-none text-black"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
          />
          <div className="homeExpireDiv">Expiration Time: <input type="text" className="homeExpireInput" maxLength={4} value={number} onChange={handleErrorNumChange} /> minutes. (max. 2880 minutes)</div>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-yellow-500 text-white my-2 hover:scale-95 transition-all duration-300">
              <span className="icon mx-2">
              <FontAwesomeIcon icon={faFloppyDisk} className="" />
              </span>
            {isLoadingSave ? "Loading..." : "Save Copy"}
          </button>
        </form>}

        {isFile && (
  <form action="submit" className="homeForm" encType="multipart/form-data" onSubmit={handleUpload}>
    <label htmlFor="fileInput" className="customFileInput">
      <span className="icon">
        <FontAwesomeIcon icon={faUpload} />
      </span>
      <span className="homeFileNameText">{selectedFileName || 'Choose a file...'}</span>
    </label>
    <input
      type="file"
      id="fileInput"
      className="hidden"
      onChange={(e) => {
        handleFileChange(e);
        const file = e.target.files?.[0];
        if (file) {
          setSelectedFileName(file.name);
          const reader = new FileReader();
          reader.readAsText(file);
        }
      }}
    />
    <div className="homeExpireDiv">Expiration Time <input type="text" className="homeExpireInput" maxLength={4} value={number} onChange={handleErrorNumChange} /> minutes. (max. 2880 minutes)</div>
    <button type="submit" className="homeBtn">
      {isLoadingSave ? "Loading..." : "Save Copy"}
    </button>
    {isLoadingSave&&<div className="progress-bar">
  <div className="progress-bar-fill" style={{width: `${uploadProgress}%`}}></div>
  <div className="progress-bar-text">{uploadProgress}%</div>
</div>}
  </form>
)}

        {codeText && (
          <div className="homeCode">
            {`Code - ${codeText}`}{" "}
            <button
              className="homeCopyBtn"
              onClick={() => {
                handleCopyCode(codeText);
                
              }}>
              Copy
            </button>
          </div>
        )}
      </div>
      <div className="homeRightDiv w-full justify-center flex">
        <div>
        <div className="homeTitleText text-white">Reveal from Online CloakShare</div>
        <form
          action="submit"
          className="homeForm"
          onSubmit={handleShow}>
          <input
            type="text"
            placeholder="Code"
            className="homeInput"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            maxLength={4}
          />
          <button className="homeBtn1">
            {isLoadingShow ? "Loading..." : "Show"}
          </button>
        </form>
        {showText && (
          <>
            <textarea
              className="homeTextArea1"
              value={showText}
              readOnly
            />

            <button
              className="homeCopyBtn"
              onClick={() => {
                handleCopy();
              }}>
              Copy
            </button>
          </>
        )}
      </div>
      </div>
      </div>
    </div>
    </>
  );
};

export default Home;
