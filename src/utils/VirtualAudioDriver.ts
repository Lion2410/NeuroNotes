
export interface VirtualAudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  groupId: string;
}

export class VirtualAudioDriver {
  private static instance: VirtualAudioDriver;
  private availableDrivers: string[] = [];
  private currentDevice: VirtualAudioDevice | null = null;

  private constructor() {}

  static getInstance(): VirtualAudioDriver {
    if (!VirtualAudioDriver.instance) {
      VirtualAudioDriver.instance = new VirtualAudioDriver();
    }
    return VirtualAudioDriver.instance;
  }

  async detectVirtualDrivers(): Promise<string[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const virtualDrivers: string[] = [];

      devices.forEach(device => {
        const label = device.label.toLowerCase();
        if (device.kind === 'audioinput') {
          // Detect common virtual audio drivers
          if (label.includes('vb-audio') || label.includes('voicemeeter')) {
            virtualDrivers.push('VB-Audio Virtual Cable');
          } else if (label.includes('soundflower')) {
            virtualDrivers.push('Soundflower');
          } else if (label.includes('blackhole')) {
            virtualDrivers.push('BlackHole');
          } else if (label.includes('pulse') || label.includes('monitor')) {
            virtualDrivers.push('PulseAudio Monitor');
          } else if (label.includes('stereo mix') || label.includes('what u hear')) {
            virtualDrivers.push('Stereo Mix');
          }
        }
      });

      this.availableDrivers = [...new Set(virtualDrivers)];
      return this.availableDrivers;
    } catch (error) {
      console.error('Error detecting virtual audio drivers:', error);
      return [];
    }
  }

  async getVirtualAudioDevices(): Promise<VirtualAudioDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'audioinput')
        .filter(device => this.isVirtualDevice(device.label))
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label,
          kind: device.kind,
          groupId: device.groupId
        }));
    } catch (error) {
      console.error('Error getting virtual audio devices:', error);
      return [];
    }
  }

  private isVirtualDevice(label: string): boolean {
    const virtualKeywords = [
      'vb-audio', 'voicemeeter', 'soundflower', 'blackhole',
      'pulse', 'monitor', 'stereo mix', 'what u hear', 'virtual'
    ];
    return virtualKeywords.some(keyword => label.toLowerCase().includes(keyword));
  }

  async selectDevice(deviceId: string): Promise<MediaStream | null> {
    try {
      const devices = await this.getVirtualAudioDevices();
      const device = devices.find(d => d.deviceId === deviceId);
      
      if (!device) {
        throw new Error('Virtual audio device not found');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.currentDevice = device;
      console.log('Selected virtual audio device:', device.label);
      return stream;
    } catch (error) {
      console.error('Error selecting virtual audio device:', error);
      return null;
    }
  }

  getCurrentDevice(): VirtualAudioDevice | null {
    return this.currentDevice;
  }

  getAvailableDrivers(): string[] {
    return this.availableDrivers;
  }

  async testAudioLevel(deviceId: string): Promise<boolean> {
    try {
      const stream = await this.selectDevice(deviceId);
      if (!stream) return false;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      return new Promise((resolve) => {
        let sampleCount = 0;
        let hasAudio = false;

        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          
          if (average > 5) { // Threshold for detecting audio
            hasAudio = true;
          }

          sampleCount++;
          if (sampleCount < 30) { // Test for 1 second at 30fps
            requestAnimationFrame(checkAudio);
          } else {
            stream.getTracks().forEach(track => track.stop());
            audioContext.close();
            resolve(hasAudio);
          }
        };

        checkAudio();
      });
    } catch (error) {
      console.error('Error testing audio level:', error);
      return false;
    }
  }
}
