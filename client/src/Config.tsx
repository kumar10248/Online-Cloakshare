import axios from "axios";

const baseURL = "http://localhost:8000/api";

const getData = async (url: string, customHeaders = {}) => {
  const headers = {
    ...customHeaders,
  };
  const response = await axios.get(`${baseURL}/${url}`, { headers: headers });
  return response.data;
};

const postData = async (url: string, body: any, options:any) => {
  
  const response = await axios.post(`${baseURL}/${url}`, body, options);
  return response.data;
};

export { getData, postData };
