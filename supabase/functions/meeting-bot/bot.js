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
  }

  async initialize() {
    console.log(`Initializing bot for meeting: ${this.meetingUrl}`);
    
    // Launch browser with audio permissions
    this.browser = await chromium.launch({
      headless: true, // Use headless for production
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    const context = await this.browser.newContext({
      permissions: ['microphone', 'camera'],
      recordVideo: { dir: './recordings/' }
    });

    this.page = await context.newPage();
    
    // Expose the WebSocket to the page context
    await this.page.exposeFunction('sendAudioToTranscription', (base64Audio) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'audio',
          data: base64Audio,
          transcriptionId: this.transcriptionId
        }));
      }
    });
  }

  async connectToTranscriptionService() {
    const wsUrl = process.env.SUPABASE_URL.replace('https://', 'wss://') + '/functions/v1/transcribe-audio-realtime';
    
    console.log('Connecting to transcription WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      console.log('Connected to transcription service');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('Received message from transcription service:', message.type);
        
        if (message.type === 'transcript') {
          this.handleTranscript(message.transcript, message.confidence);
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
    console.log('Starting audio capture...');
    
    try {
      // Inject audio capture script into the page
      await this.page.addScriptTag({
        content: `
          (async function() {
            try {
              console.log('Starting audio capture in browser context...');
              
              const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                  sampleRate: 24000
                },
                video: false
              });
              
              console.log('Got display media stream');
              
              const audioContext = new AudioContext({ sampleRate: 24000 });
              const source = audioContext.createMediaStreamSource(stream);
              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = function(e) {
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Convert Float32Array to Int16Array
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
                
                // Send to transcription service
                if (window.sendAudioToTranscription) {
                  window.sendAudioToTranscription(base64);
                }
              };
              
              source.connect(processor);
              processor.connect(audioContext.destination);
              
              console.log('Audio capture started successfully');
              
              // Store references for cleanup
              window.audioStream = stream;
              window.audioContext = audioContext;
              window.audioProcessor = processor;
              
            } catch (error) {
              console.error('Error starting audio capture:', error);
            }
          })();
        `
      });
      
      this.isRecording = true;
      console.log('Audio capture script injected');
      
    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw error;
    }
  }

  async handleTranscript(transcript, confidence) {
    console.log(`Received transcript: ${transcript} (confidence: ${confidence})`);
    
    // Update Supabase with the transcript
    try {
      const timestamp = new Date().toLocaleTimeString();
      const formattedTranscript = `[${timestamp}] ${transcript}`;
      
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/transcriptions?id=eq.${this.transcriptionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          content: formattedTranscript,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('Transcript updated in database');
    } catch (error) {
      console.error('Error updating transcript:', error);
    }
  }

  async cleanup() {
    console.log('Cleaning up bot...');
    
    // Stop audio capture
    if (this.isRecording && this.page) {
      try {
        await this.page.evaluate(() => {
          if (window.audioStream) {
            window.audioStream.getTracks().forEach(track => track.stop());
          }
          if (window.audioContext) {
            window.audioContext.close();
          }
        });
      } catch (error) {
        console.error('Error stopping audio capture:', error);
      }
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
      console.log('Starting meeting bot...');
      
      await this.initialize();
      console.log('Bot initialized');
      
      await this.connectToTranscriptionService();
      console.log('Connected to transcription service');
      
      await this.joinMeeting();
      console.log('Joined meeting');
      
      await this.startAudioCapture();
      console.log('Audio capture started');
      
      console.log('Bot is now running and capturing audio...');
      
      // Keep the bot running
      const keepAlive = setInterval(() => {
        console.log('Bot is still running...');
      }, 30000);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        clearInterval(keepAlive);
        await this.cleanup();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        clearInterval(keepAlive);
        await this.cleanup();
        process.exit(0);
      });
      
      // Auto-shutdown after 2 hours to prevent runaway processes
      setTimeout(async () => {
        console.log('Auto-shutdown after 2 hours');
        clearInterval(keepAlive);
        await this.cleanup();
        process.exit(0);
      }, 2 * 60 * 60 * 1000);
      
    } catch (error) {
      console.error('Error running bot:', error);
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
