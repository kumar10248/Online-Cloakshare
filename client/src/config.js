// Config.js
export const postData = async (endpoint, data, config = {}) => {
    const response = await fetch(`http://localhost:8000/api/${endpoint}`, {
      method: 'POST',
      body: data,
      ...config
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  };