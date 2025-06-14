const { chromium } = require('playwright');
const WebSocket = require('ws');

class MeetingBot {
  constructor(transcriptionId, meetingUrl) {
    this.transcriptionId = transcriptionId;
    this.meetingUrl = meetingUrl;
    this.browser = null;
    this.page = null;
    this.ws = null;
    this.isRecording = false;
    this.audioChunks = [];
    this.virtualAudioEnabled = false;
  }

  async initialize() {
    console.log(`Initializing bot for meeting: ${this.meetingUrl}`);
    
    // Launch browser with enhanced audio permissions
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--enable-experimental-web-platform-features',
        '--enable-features=WebAudioEvaluateNoDelay'
      ]
    });

    const context = await this.browser.newContext({
      permissions: ['microphone', 'camera'],
      recordVideo: { dir: './recordings/' }
    });

    this.page = await context.newPage();
    
    // Expose enhanced WebSocket communication
    await this.page.exposeFunction('sendAudioToTranscription', (base64Audio, audioMetadata) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'audio',
          data: base64Audio,
          transcriptionId: this.transcriptionId,
          metadata: audioMetadata || {}
        }));
      }
    });

    await this.page.exposeFunction('reportAudioStatus', (status) => {
      console.log('Audio capture status:', status);
    });
  }

  async connectToTranscriptionService() {
    const wsUrl = process.env.SUPABASE_URL.replace('https://', 'wss://') + '/functions/v1/meeting-bot-realtime';
    
    console.log('Connecting to meeting bot transcription WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      console.log('Connected to meeting bot transcription service');
      // Initialize the transcription session
      this.ws.send(JSON.stringify({
        type: 'initialize',
        transcriptionId: this.transcriptionId
      }));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('Received message from transcription service:', message.type);
        
        if (message.type === 'transcript') {
          this.handleTranscript(message.transcript, message.confidence);
        } else if (message.type === 'initialized') {
          console.log('Transcription session initialized');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
    });

    // Wait for connection to be established
    return new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });
  }

  async joinMeeting() {
    console.log('Navigating to meeting...');
    await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle' });

    // Wait for page to load
    await this.page.waitForTimeout(3000);

    // Handle different meeting platforms
    if (this.meetingUrl.includes('meet.google.com')) {
      await this.joinGoogleMeet();
    } else if (this.meetingUrl.includes('zoom.us')) {
      await this.joinZoomMeeting();
    } else if (this.meetingUrl.includes('youtube.com')) {
      await this.joinYouTubeLive();
    } else {
      console.log('Unknown meeting platform, attempting generic join...');
      await this.attemptGenericJoin();
    }
  }

  async joinGoogleMeet() {
    try {
      console.log('Joining Google Meet...');
      
      // Wait for join button and click it
      try {
        await this.page.waitForSelector('[data-call-status="JOINED"]', { timeout: 5000 });
        console.log('Already in meeting');
      } catch {
        // Try different selectors for join button
        const joinSelectors = [
          'button[jsname="Qx7uuf"]',
          '[aria-label*="Join"]',
          '[data-testid="join-button"]',
          'button:has-text("Join now")',
          'button:has-text("Ask to join")'
        ];
        
        let joined = false;
        for (const selector of joinSelectors) {
          try {
            const button = await this.page.$(selector);
            if (button) {
              await button.click();
              console.log(`Clicked join button with selector: ${selector}`);
              joined = true;
              break;
            }
          } catch (error) {
            console.log(`Failed to click selector ${selector}:`, error.message);
          }
        }
        
        if (!joined) {
          console.log('Could not find join button, continuing anyway...');
        }
      }

      // Wait a bit for the meeting to load
      await this.page.waitForTimeout(5000);

      // Try to mute microphone and camera
      try {
        const micSelectors = [
          '[data-tooltip*="microphone"]',
          '[aria-label*="microphone"]',
          '[data-testid*="mic"]'
        ];
        
        const camSelectors = [
          '[data-tooltip*="camera"]',
          '[aria-label*="camera"]',
          '[data-testid*="camera"]'
        ];
        
        for (const selector of micSelectors) {
          try {
            const micButton = await this.page.$(selector);
            if (micButton) {
              await micButton.click();
              console.log('Muted microphone');
              break;
            }
          } catch (error) {
            console.log(`Failed to mute with selector ${selector}`);
          }
        }
        
        for (const selector of camSelectors) {
          try {
            const camButton = await this.page.$(selector);
            if (camButton) {
              await camButton.click();
              console.log('Turned off camera');
              break;
            }
          } catch (error) {
            console.log(`Failed to turn off camera with selector ${selector}`);
          }
        }
      } catch (error) {
        console.log('Could not mute mic/camera:', error.message);
      }
    } catch (error) {
      console.error('Error joining Google Meet:', error);
    }
  }

  async joinZoomMeeting() {
    console.log('Joining Zoom meeting...');
    // Basic Zoom implementation - can be expanded
    try {
      await this.page.waitForTimeout(5000);
      
      // Look for join button
      const joinButton = await this.page.$('a[role="button"]:has-text("Join from Your Browser")');
      if (joinButton) {
        await joinButton.click();
        console.log('Clicked join from browser');
      }
    } catch (error) {
      console.error('Error joining Zoom:', error);
    }
  }

  async joinYouTubeLive() {
    console.log('Joining YouTube Live...');
    // YouTube Live streams don't require joining, just navigate
    await this.page.waitForTimeout(3000);
  }

  async attemptGenericJoin() {
    console.log('Attempting generic meeting join...');
    
    // Look for common join button text
    const joinTexts = ['join', 'enter', 'start', 'connect'];
    
    for (const text of joinTexts) {
      try {
        const button = await this.page.$(`button:has-text("${text}")`);
        if (button) {
          await button.click();
          console.log(`Clicked button with text: ${text}`);
          break;
        }
      } catch (error) {
        console.log(`No button found with text: ${text}`);
      }
    }
  }

  async startAudioCapture() {
    console.log('Starting enhanced audio capture...');
    
    try {
      // Inject enhanced audio capture script
      await this.page.addScriptTag({
        content: `
          (async function() {
            try {
              console.log('Starting enhanced audio capture in browser context...');
              
              let audioStream = null;
              let audioContext = null;
              let processor = null;
              let source = null;
              
              // Try multiple methods for audio capture
              const captureStrategies = [
                // Strategy 1: getDisplayMedia with audio
                async () => {
                  console.log('Trying getDisplayMedia strategy...');
                  return await navigator.mediaDevices.getDisplayMedia({
                    audio: {
                      echoCancellation: false,
                      noiseSuppression: false,
                      autoGainControl: false,
                      sampleRate: 24000,
                      channelCount: 1
                    },
                    video: false
                  });
                },
                
                // Strategy 2: getUserMedia with specific constraints
                async () => {
                  console.log('Trying getUserMedia strategy...');
                  return await navigator.mediaDevices.getUserMedia({
                    audio: {
                      echoCancellation: false,
                      noiseSuppression: false,
                      autoGainControl: false,
                      sampleRate: 24000,
                      channelCount: 1,
                      deviceId: 'default'
                    }
                  });
                },
                
                // Strategy 3: Try to find virtual audio devices
                async () => {
                  console.log('Trying virtual audio device strategy...');
                  const devices = await navigator.mediaDevices.enumerateDevices();
                  const virtualDevice = devices.find(device => 
                    device.kind === 'audioinput' && 
                    (device.label.toLowerCase().includes('virtual') ||
                     device.label.toLowerCase().includes('cable') ||
                     device.label.toLowerCase().includes('monitor'))
                  );
                  
                  if (virtualDevice) {
                    console.log('Found virtual audio device:', virtualDevice.label);
                    return await navigator.mediaDevices.getUserMedia({
                      audio: {
                        deviceId: { exact: virtualDevice.deviceId },
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        sampleRate: 24000,
                        channelCount: 1
                      }
                    });
                  }
                  throw new Error('No virtual audio device found');
                }
              ];
              
              let strategyIndex = 0;
              while (strategyIndex < captureStrategies.length && !audioStream) {
                try {
                  audioStream = await captureStrategies[strategyIndex]();
                  console.log('Audio capture strategy succeeded:', strategyIndex);
                  break;
                } catch (error) {
                  console.log('Strategy', strategyIndex, 'failed:', error.message);
                  strategyIndex++;
                }
              }
              
              if (!audioStream) {
                throw new Error('All audio capture strategies failed');
              }
              
              window.reportAudioStatus('Audio stream acquired');
              
              // Set up audio processing
              audioContext = new AudioContext({ sampleRate: 24000 });
              source = audioContext.createMediaStreamSource(audioStream);
              processor = audioContext.createScriptProcessor(4096, 1, 1);
              
              let audioChunkCount = 0;
              processor.onaudioprocess = function(e) {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Check for actual audio data
                const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
                if (!hasAudio) return;
                
                audioChunkCount++;
                
                // Convert Float32Array to Int16Array (PCM16)
                const int16Array = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  const s = Math.max(-1, Math.min(1, inputData[i]));
                  int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                // Convert to base64
                const uint8Array = new Uint8Array(int16Array.buffer);
                let binary = '';
                const chunkSize = 0x8000;
                
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                  const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                  binary += String.fromCharCode.apply(null, chunk);
                }
                
                const base64 = btoa(binary);
                
                // Send to transcription service with metadata
                if (window.sendAudioToTranscription) {
                  window.sendAudioToTranscription(base64, {
                    chunkIndex: audioChunkCount,
                    sampleRate: 24000,
                    channels: 1,
                    format: 'pcm16'
                  });
                }
                
                // Report status periodically
                if (audioChunkCount % 100 === 0) {
                  window.reportAudioStatus('Audio chunks sent: ' + audioChunkCount);
                }
              };
              
              source.connect(processor);
              processor.connect(audioContext.destination);
              
              console.log('Enhanced audio capture started successfully');
              window.reportAudioStatus('Enhanced audio capture active');
              
              // Store references for cleanup
              window.audioStream = audioStream;
              window.audioContext = audioContext;
              window.audioProcessor = processor;
              window.audioSource = source;
              
            } catch (error) {
              console.error('Error starting enhanced audio capture:', error);
              window.reportAudioStatus('Audio capture failed: ' + error.message);
            }
          })();
        `
      });
      
      this.isRecording = true;
      console.log('Enhanced audio capture script injected');
      
    } catch (error) {
      console.error('Error starting enhanced audio capture:', error);
      throw error;
    }
  }

  async handleTranscript(transcript, confidence) {
    console.log(`Received transcript: ${transcript} (confidence: ${confidence})`);
    // The transcript is now handled by the meeting-bot-realtime function
    // which directly updates the database
  }

  async cleanup() {
    console.log('Cleaning up enhanced meeting bot...');
    
    // Enhanced audio cleanup
    if (this.isRecording && this.page) {
      try {
        await this.page.evaluate(() => {
          if (window.audioStream) {
            window.audioStream.getTracks().forEach(track => track.stop());
          }
          if (window.audioSource) {
            window.audioSource.disconnect();
          }
          if (window.audioProcessor) {
            window.audioProcessor.disconnect();
          }
          if (window.audioContext) {
            window.audioContext.close();
          }
        });
      } catch (error) {
        console.error('Error stopping enhanced audio capture:', error);
      }
    }
    
    // Send end meeting signal
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'end_meeting',
        transcriptionId: this.transcriptionId
      }));
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      console.log('Starting enhanced meeting bot...');
      
      await this.initialize();
      console.log('Enhanced bot initialized');
      
      await this.connectToTranscriptionService();
      console.log('Connected to enhanced transcription service');
      
      await this.joinMeeting();
      console.log('Joined meeting');
      
      await this.startAudioCapture();
      console.log('Enhanced audio capture started');
      
      console.log('Enhanced bot is now running and capturing audio...');
      
      // Keep the bot running
      const keepAlive = setInterval(() => {
        console.log('Enhanced bot is still running...');
      }, 30000);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down enhanced bot gracefully...');
        clearInterval(keepAlive);
        await this.cleanup();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down enhanced bot gracefully...');
        clearInterval(keepAlive);
        await this.cleanup();
        process.exit(0);
      });
      
      // Auto-shutdown after 2 hours
      setTimeout(async () => {
        console.log('Auto-shutdown after 2 hours');
        clearInterval(keepAlive);
        await this.cleanup();
        process.exit(0);
      }, 2 * 60 * 60 * 1000);
      
    } catch (error) {
      console.error('Error running enhanced bot:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the bot if called directly
if (require.main === module) {
  const transcriptionId = process.argv[2];
  const meetingUrl = process.argv[3];
  
  if (!transcriptionId || !meetingUrl) {
    console.error('Usage: node bot.js <transcriptionId> <meetingUrl>');
    process.exit(1);
  }
  
  const bot = new MeetingBot(transcriptionId, meetingUrl);
  bot.run();
}

module.exports = MeetingBot;
