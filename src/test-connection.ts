import axios from 'axios';

const baseURL = 'https://atende-api.corz.com.br/api';
const token = 'fW7ZZvNoXHR5k5g172xpF2hBSp1bOWX2McZvyR_6K5M';

async function test() {
  console.log('Testing connection to:', baseURL);
  console.log('Token:', token);
  
  try {
    const response = await axios.get(`${baseURL}/ticket`, {
      headers: {
        'api-key': token.trim()
      },
      params: { limit: 1 }
    });
    console.log('Success!');
    console.log('Status:', response.status);
    console.log('Data sample:', JSON.stringify(response.data).substring(0, 100));
  } catch (error: any) {
    console.error('Connection failed!');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
    if (error.cause) {
        console.error('Cause:', error.cause);
    }
  }
}

test();
