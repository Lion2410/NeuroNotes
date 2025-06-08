
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
      <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
        <CardTitle className="text-white text-base md:text-lg">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3 p-4 md:p-6 pt-0">
        <Button onClick={onDownload} className="w-full bg-blue-600 hover:bg-blue-700 text-sm md:text-base py-2">
          <Download className="h-3 w-3 md:h-4 md:w-4 mr-2" />
          Download Note
        </Button>
        <Button onClick={onShare} variant="outline" className="w-full border-white/30 hover:bg-white/10 text-slate-950 text-sm md:text-base py-2">
          <Share className="h-3 w-3 md:h-4 md:w-4 mr-2" />
          Share
        </Button>
        <Button onClick={onCopy} variant="outline" className="w-full border-white/30 hover:bg-white/10 text-slate-950 text-sm md:text-base py-2">
          <Copy className="h-3 w-3 md:h-4 md:w-4 mr-2" />
          Copy to Clipboard
        </Button>
      </CardContent>
    </Card>
  );
};

export default TranscriptActions;
