
import React from 'react';
import { Download, Share, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TranscriptActionsProps {
  onDownload: () => void;
  onShare: () => void;
  onCopy: () => void;
}

const TranscriptActions: React.FC<TranscriptActionsProps> = ({
  onDownload,
  onShare,
  onCopy
}) => {
  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onDownload} className="w-full bg-blue-600 hover:bg-blue-700">
          <Download className="h-4 w-4 mr-2" />
          Download Transcript
        </Button>
        <Button onClick={onShare} variant="outline" className="w-full border-white/30 text-white hover:bg-white/10">
          <Share className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Button onClick={onCopy} variant="outline" className="w-full border-white/30 text-white hover:bg-white/10">
          <Copy className="h-4 w-4 mr-2" />
          Copy to Clipboard
        </Button>
      </CardContent>
    </Card>
  );
};

export default TranscriptActions;
