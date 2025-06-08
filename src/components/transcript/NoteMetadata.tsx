
import React from 'react';
import { Calendar, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface NoteMetadataProps {
  sourceType: string;
  createdAt: string;
  duration?: number;
}

const NoteMetadata: React.FC<NoteMetadataProps> = ({
  sourceType,
  createdAt,
  duration
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceLabel = (type: string) => {
    switch (type) {
      case 'upload':
        return 'File Upload';
      case 'live_meeting':
        return 'Live Meeting';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
        <CardTitle className="text-white text-base md:text-lg">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
        <div className="flex items-center gap-2">
          <FileText className="h-3 w-3 md:h-4 md:w-4 text-purple-400" />
          <span className="text-slate-300 text-xs md:text-sm">Source:</span>
          <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 text-xs">
            {getSourceLabel(sourceType)}
          </Badge>
        </div>
        
        <div className="flex items-start gap-2">
          <Calendar className="h-3 w-3 md:h-4 md:w-4 text-blue-400 mt-0.5" />
          <div className="flex flex-col">
            <span className="text-slate-300 text-xs md:text-sm">Created:</span>
            <span className="text-white text-xs md:text-sm break-words">{formatDate(createdAt)}</span>
          </div>
        </div>
        
        {duration && (
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
            <span className="text-slate-300 text-xs md:text-sm">Duration:</span>
            <span className="text-white text-xs md:text-sm">{formatDuration(duration)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NoteMetadata;
