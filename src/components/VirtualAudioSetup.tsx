
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Volume2, Headphones } from 'lucide-react';
import { VirtualAudioDriver, VirtualAudioDevice } from '@/utils/VirtualAudioDriver';
import { useToast } from '@/hooks/use-toast';

interface VirtualAudioSetupProps {
  onDeviceSelected: (device: VirtualAudioDevice) => void;
  onSetupComplete: (stream: MediaStream) => void;
}

const VirtualAudioSetup: React.FC<VirtualAudioSetupProps> = ({
  onDeviceSelected,
  onSetupComplete
}) => {
  const [availableDrivers, setAvailableDrivers] = useState<string[]>([]);
  const [virtualDevices, setVirtualDevices] = useState<VirtualAudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [setupStep, setSetupStep] = useState<'detect' | 'select' | 'test' | 'complete'>('detect');
  const { toast } = useToast();

  const audioDriver = VirtualAudioDriver.getInstance();

  useEffect(() => {
    detectDrivers();
  }, []);

  const detectDrivers = async () => {
    setIsDetecting(true);
    try {
      const drivers = await audioDriver.detectVirtualDrivers();
      const devices = await audioDriver.getVirtualAudioDevices();
      
      setAvailableDrivers(drivers);
      setVirtualDevices(devices);
      
      if (devices.length > 0) {
        setSetupStep('select');
        toast({
          title: "Virtual Audio Drivers Detected",
          description: `Found ${devices.length} virtual audio device(s)`,
        });
      } else {
        toast({
          title: "No Virtual Audio Drivers",
          description: "Please install VB-Audio, Soundflower, or similar virtual audio driver",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error detecting drivers:', error);
      toast({
        title: "Detection Failed",
        description: "Failed to detect virtual audio drivers",
        variant: "destructive"
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const testDevice = async () => {
    if (!selectedDeviceId) return;

    setIsTesting(true);
    try {
      const stream = await audioDriver.selectDevice(selectedDeviceId);
      if (stream) {
        const hasAudio = await audioDriver.testAudioLevel(selectedDeviceId);
        
        if (hasAudio) {
          setAudioStream(stream);
          setSetupStep('complete');
          
          const device = virtualDevices.find(d => d.deviceId === selectedDeviceId);
          if (device) {
            onDeviceSelected(device);
            onSetupComplete(stream);
          }

          toast({
            title: "Audio Test Successful",
            description: "Virtual audio device is working correctly",
          });
        } else {
          toast({
            title: "No Audio Detected",
            description: "Please ensure audio is playing through the virtual device",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error testing device:', error);
      toast({
        title: "Test Failed",
        description: "Failed to test virtual audio device",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const renderSetupInstructions = () => {
    if (availableDrivers.length === 0) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Virtual Audio Driver Required</p>
              <p>To capture meeting audio, please install one of these virtual audio drivers:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>VB-Audio Virtual Cable</strong> (Windows/Mac) - Free</li>
                <li><strong>Soundflower</strong> (Mac) - Free</li>
                <li><strong>BlackHole</strong> (Mac) - Free</li>
                <li><strong>PulseAudio</strong> (Linux) - Built-in</li>
              </ul>
              <p className="mt-2 text-sm">After installation, restart your browser and try again.</p>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>
            <p className="font-medium text-green-700">Virtual Audio Drivers Detected</p>
            <p>Found: {availableDrivers.join(', ')}</p>
          </AlertDescription>
        </Alert>

        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Setup Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>Set your meeting app's audio output to the virtual cable</li>
            <li>Select the virtual audio device below</li>
            <li>Test the audio connection</li>
            <li>Start your meeting and begin transcription</li>
          </ol>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Headphones className="h-5 w-5 text-purple-400" />
          Virtual Audio Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderSetupInstructions()}

        {virtualDevices.length > 0 && setupStep !== 'complete' && (
          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Select Virtual Audio Device
              </label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Choose virtual audio device..." />
                </SelectTrigger>
                <SelectContent>
                  {virtualDevices.map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={testDevice}
              disabled={!selectedDeviceId || isTesting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isTesting ? (
                <>
                  <Volume2 className="h-4 w-4 mr-2 animate-pulse" />
                  Testing Audio...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Test Audio Connection
                </>
              )}
            </Button>
          </div>
        )}

        {setupStep === 'complete' && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <p className="font-medium text-green-700">Virtual Audio Setup Complete</p>
              <p>Ready to capture meeting audio for transcription</p>
            </AlertDescription>
          </Alert>
        )}

        {virtualDevices.length === 0 && !isDetecting && (
          <Button
            onClick={detectDrivers}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Retry Detection
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default VirtualAudioSetup;
