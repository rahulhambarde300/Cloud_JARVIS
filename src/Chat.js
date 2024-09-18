/***************************************************************************************
* The http components used in this page were taken from MUI, with the styling   
*    Title: Chat.js - http component
*    Author: MUI
*    Date: 2024-07-25
*    Code version: 1.0.0
*    Availability: https://mui.com/
*
***************************************************************************************/
import React, { useState, useEffect, useRef } from 'react';
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  InputBase,
  Toolbar,
  Typography,
  Backdrop,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/system';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import axios from 'axios';
import { COHERE_API_URL } from './Constants/Constant';
import { SpectrumVisualizer, SpectrumVisualizerTheme  } from 'react-audio-visualizers';
import { LiveAudioVisualizer } from 'react-audio-visualize';
import { AudioRecorder, useAudioRecorder } from 'react-audio-voice-recorder';

const drawerWidth = 240;

const theme = createTheme();

const ChatBox = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '10px',
  overflowY: 'auto',
});

const ChatMessage = styled(Box)(({ sender }) => ({
  alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
  backgroundColor: sender === 'user' ? '#dcf8c6' : '#f1f0f0',
  padding: '10px',
  borderRadius: '5px',
  margin: '5px 0',
  maxWidth: '80%',
}));

const API_KEY = process.env.REACT_APP_COHERE_API_KEY;
const BASE_API_URL = process.env.REACT_APP_AWS_BASE_API_URL;

let conversationHistory = '';


function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audio, setAudio] = useState('');
  const [blob, setBlob] = useState(null);
  const [backdropLoading, setBackdropLoading] = useState(false);
  const recorder = useAudioRecorder();

  
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false,
      })
      .then(setAudio);
  }, []);

  async function startTranscription(fileContent) {
    try {
      const response = await axios.post(
        `${BASE_API_URL}/transcribe`,
        JSON.stringify({ fileContent }),
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
  
      const jobName = response.data.jobName;
      handleBackdropOpen()
      await getTranscriptionResult(jobName).then(()=>{
        handleSend();
      });
    } catch (error) {
      console.error('Error starting transcription:', error);
      throw error;
    }
  }
  
  /**
   * Check the status of transcription job
   * @param {*} jobName 
   * @returns 
   */
  async function checkTranscriptionStatus(jobName) {
    try {
      const response = await axios.get(
        `${BASE_API_URL}/getTransriptionResult?jobName=${jobName}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      //console.log("Transcript",response.data);
      return response.data;
    } catch (error) {
      console.error('Error checking transcription status:', error);
      throw error;
    }
  }
  
  /**
   * Get the result of transcription job and fetch the transcript
   * @param {*} jobName 
   * @returns 
   */
  async function getTranscriptionResult(jobName) {
    const pollingInterval = 10000;
    let status;
    
    try{
      while (true) {
        status = await checkTranscriptionStatus(jobName);
    
        if (status.jobStatus === 'COMPLETED') {
          const query = status.transcript.results.transcripts[0].transcript;
          console.log(query);
          handleBackdropClose();
          setInput(query);
          return query;
        } else if (status.jobStatus === 'FAILED') {
          throw new Error('Transcription job failed');
        } else {
          console.log('Transcription job in progress...');
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
      }
    }
    catch(error){
      console.error('Error getting transcription result:', error);
    }
    
  }

  /**
   * Sends the text query to cohere for processing
   */
  const handleSend = async () => {
    if (input) {
      const newMessage = { sender: 'user', text: input.trim() };
      setMessages([...messages, newMessage]);
      conversationHistory += `User: ${input}\n`;
      setInput('');
      setLoading(true);

      try {
        await axios.post(
          COHERE_API_URL,
          {
            prompt: conversationHistory,
            max_tokens: 100,
            temperature: 0.7
          },
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        ).then((resp) => {
          if (resp.status != 200) {
            setError(resp.data.message);
          } else {
            const botResp = resp.data.generations[0].text;
            //TODO: Call polly here
            synthesizeSpeech(botResp);
            conversationHistory += `Bot: ${botResp}\n`;
            setMessages(prevMessages => [...prevMessages, { sender: 'bot', text: botResp }]);
          }
          
        }); 

        
      } catch (err) {
        if (err.response && err.response.data && err.response.data.error) {
          setError(err.response.data.error);
        } else {
          setError('An error occurred while generating text.');
        }
      } finally {
        setLoading(false);
      }
    }
  };


  const handleSaveRecording = () => {
    if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        //setAudio(url);
        a.style.display = 'none';
        let reader = new window.FileReader();
        reader.readAsDataURL(blob); 
        reader.onloadend = function() {
        let base64 = reader.result;
        base64 = base64.split(',')[1];
        startTranscription(base64);
        window.URL.revokeObjectURL(url);
        setBlob(null);
      }
    }
  };

  const synthesizeSpeech = async(text) => {
    
    try {
      setAudio(null);
      await axios.post(
        `${BASE_API_URL}/synthesize`,
        JSON.stringify({ text }),
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ).then(async(resp) => {
        if (resp.status != 200) {
          setError(resp.data.message);
        } else {
          await decodeBase64ToAudio(resp.data.audio);
        }
        
      }); 
      
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('An error occurred while generating audio.');
      }
    } finally {
      setLoading(false);
    }
  }

  const decodeBase64ToAudio = async(base64Audio) => {
    const binaryString = atob(base64Audio);

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const synthesizedAudio = new Blob([bytes], { type: "audio/mp3" });
    const url = URL.createObjectURL(synthesizedAudio);
    setAudio(url);
  }

  const handleBackdropClose = () => {
    setBackdropLoading(false);
  };
  const handleBackdropOpen = () => {
    setBackdropLoading(true);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
          <AppBar position="fixed" sx={{backgroundColor:'#26a69a',color:'#333333',zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar>
              <Typography variant="h6" noWrap>
                JARVIS
              </Typography>
            </Toolbar>
          </AppBar>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: '#333333',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            height:'100%',
            width:'65%',
            borderRight: '1px solid #ccc'
          }}
        >
          <Toolbar />
          <ChatBox>
            {messages.map((msg, index) => (
              <ChatMessage key={index} sender={msg.sender}>
                {msg.text}
              </ChatMessage>
            ))}
          </ChatBox>
          <Box sx={{ display: 'flex', borderTop: '1px solid #ccc', p: 2 }}>
          {!recorder.mediaRecorder && (<InputBase
              sx={{ flex: 1, p: 1, border: '1px solid #ccc', borderRadius: 1, color:'white' }}
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => (e.key === 'Enter' ? handleSend() : null)}
            />)}
            <div style={{padding: '10px'}}>
              <AudioRecorder
                onRecordingComplete={setBlob}
                recorderControls={recorder}
                showVisualizer
              />
              {/* {recorder.mediaRecorder && (
                <LiveAudioVisualizer
                  mediaRecorder={recorder.mediaRecorder}
                  width={'900em'}
                  height={45}
                />
              )} */}
            </div>
            {!recorder.mediaRecorder && blob && 
            (<Button  variant="contained" sx={{backgroundColor:'#26a69a', color:'#333333'}} onClick={handleSaveRecording} disabled={loading}>
              {loading ? 'Generating...' : 'Send recording'}
            </Button>)}
            {!recorder.mediaRecorder && !blob && 
            (<Button variant="contained" sx={{backgroundColor:'#26a69a', color:'#333333'}} onClick={handleSend} disabled={loading}>
              {loading ? 'Generating...' : 'Send'}
            </Button>)}
          </Box>
        </Box>
        <Box sx={{
            width: '0%', 
            height:'100%', 
            pt:2,
            justifyContent: 'center', 
            alignItems: 'center', 
            backgroundColor:'#333333',
            flexGrow:1,
            flexDirection:'column',
            display:'flex'}}>
          {audio!="" && (<Toolbar sx={{justifyContent:'center', alignSelf:'center'}}>
            <Typography color='#26a69a' sx={{pt:8}} variant="h6" noWrap>
              Click to Play Audio
            </Typography>
          </Toolbar>
          )}
          {audio!="" && (<SpectrumVisualizer
              audio={audio}
              theme={SpectrumVisualizerTheme.radialSquaredBars}
              colors={['#009688', '#26a69a']}
              iconsColor="#26a69a"
              backgroundColor="#333333"
              showMainActionIcon
              showLoaderIcon
              highFrequency={2000}
          />)}
        </Box>
      </Box>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={backdropLoading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </ThemeProvider>
  );
}


export default Chat;
