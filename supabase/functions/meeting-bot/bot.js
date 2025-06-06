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
  }

  async initialize() {
    console.log(`Initializing bot for meeting: ${this.meetingUrl}`);
    
    // Launch browser with audio permissions
    this.browser = await chromium.launch({
      headless: false, // Set to true for production
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const context = await this.browser.newContext({
      permissions: ['microphone', 'camera'],
      recordVideo: { dir: './recordings/' }
    });

    this.page = await context.newPage();
  }

  async connectToTranscriptionService() {
    const wsUrl = process.env.SUPABASE_URL.replace('https://', 'wss://') + '/functions/v1/transcribe-audio-realtime';
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      console.log('Connected to transcription service');
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'transcript') {
        this.handleTranscript(message.transcript, message.confidence);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  async joinMeeting() {
    console.log('Navigating to meeting...');
    await this.page.goto(this.meetingUrl);

    // Wait for page to load
    await this.page.waitForTimeout(3000);

    // Handle different meeting platforms
    if (this.meetingUrl.includes('meet.google.com')) {
      await this.joinGoogleMeet();
    } else if (this.meetingUrl.includes('zoom.us')) {
      await this.joinZoomMeeting();
    } else if (this.meetingUrl.includes('youtube.com')) {
      await this.joinYouTubeLive();
    }
  }

  async joinGoogleMeet() {
    try {
      // Wait for join button and click it
      await this.page.waitForSelector('[data-call-status="JOINED"]', { timeout: 5000 });
      console.log('Already in meeting');
    } catch {
      // Try to join the meeting
      const joinButton = await this.page.$('button[jsname="Qx7uuf"]');
      if (joinButton) {
        await joinButton.click();
        console.log('Clicked join button');
      }
    }

    // Mute microphone and camera
    try {
      const micButton = await this.page.$('[data-tooltip*="microphone"]');
      const camButton = await this.page.$('[data-tooltip*="camera"]');
      
      if (micButton) await micButton.click();
      if (camButton) await camButton.click();
    } catch (error) {
      console.log('Could not mute mic/camera:', error.message);
    }
  }

  async joinZoomMeeting() {
    // Handle Zoom meeting join
    console.log('Joining Zoom meeting...');
    // Implementation for Zoom would go here
  }

  async joinYouTubeLive() {
    // Handle YouTube Live
    console.log('Joining YouTube Live...');
    // Implementation for YouTube would go here
  }

  async startAudioCapture() {
    console.log('Starting audio capture...');
    
    // Start capturing audio from the page
    await this.page.evaluate(() => {
      return new Promise((resolve) => {
        navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: false
        }).then(stream => {
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
          });

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              const reader = new FileReader();
              reader.onload = () => {
                const arrayBuffer = reader.result;
                const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                
                // Send audio data to transcription service
                if (window.meetingBot && window.meetingBot.ws) {
                  window.meetingBot.ws.send(JSON.stringify({
                    type: 'audio',
                    data: base64
                  }));
                }
              };
              reader.readAsArrayBuffer(event.data);
            }
          };

          mediaRecorder.start(1000); // Send data every second
          window.mediaRecorder = mediaRecorder;
          resolve();
        });
      });
    });

    this.isRecording = true;
  }

  async handleTranscript(transcript, confidence) {
    console.log(`Received transcript: ${transcript} (confidence: ${confidence})`);
    
    // Update Supabase with the transcript
    try {
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/transcriptions`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          content: transcript,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating transcript:', error);
    }
  }

  async cleanup() {
    console.log('Cleaning up bot...');
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.connectToTranscriptionService();
      await this.joinMeeting();
      await this.startAudioCapture();
      
      console.log('Bot is now running and capturing audio...');
      
      // Keep the bot running until manually stopped
      process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await this.cleanup();
        process.exit(0);
      });
      
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
