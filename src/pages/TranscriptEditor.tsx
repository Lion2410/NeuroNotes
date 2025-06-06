
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EditableTitle from '@/components/EditableTitle';
import TranscriptContent from '@/components/transcript/TranscriptContent';
import TranscriptActions from '@/components/transcript/TranscriptActions';
import TranscriptMetadata from '@/components/transcript/TranscriptMetadata';

interface Transcription {
  id: string;
  title: string;
  content: string;
  source_type: string;
  created_at: string;
  duration?: number;
}

const TranscriptEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (id && user) {
      fetchTranscription();
    }
  }, [id, user]);

  const fetchTranscription = async () => {
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setTranscription(data);
    } catch (error) {
      console.error('Error fetching transcription:', error);
      toast({
        title: "Error",
        description: "Failed to load transcription.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTitleUpdate = async (newTitle: string) => {
    if (!transcription) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .update({ title: newTitle })
        .eq('id', transcription.id);

      if (error) throw error;

      setTranscription(prev => prev ? { ...prev, title: newTitle } : null);
      
      toast({
        title: "Title Updated",
        description: "Transcript title has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating title:', error);
      toast({
        title: "Error",
        description: "Failed to update title.",
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    if (!transcription) return;
    
    const element = document.createElement('a');
    const file = new Blob([transcription.content || ''], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${transcription.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Download Started",
      description: "Your transcript is being downloaded."
    });
  };

  const handleShare = () => {
    if (navigator.share && transcription) {
      navigator.share({
        title: transcription.title,
        text: transcription.content,
        url: window.location.href
      });
    } else {
      toast({
        title: "Share",
        description: "Copy the URL to share this transcript."
      });
    }
  };

  const handleCopy = () => {
    if (!transcription?.content) return;
    
    navigator.clipboard.writeText(transcription.content);
    toast({
      title: "Copied",
      description: "Transcript has been copied to clipboard."
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Loading transcript...</div>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Transcript not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/notes" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400">/</span>
            <EditableTitle
              title={transcription.title}
              onUpdate={handleTitleUpdate}
              className="text-white font-medium"
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <TranscriptContent
              content={transcription.content || ''}
              isLoading={false}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <TranscriptMetadata
              sourceType={transcription.source_type}
              createdAt={transcription.created_at}
              duration={transcription.duration}
            />
            
            <TranscriptActions
              onDownload={handleDownload}
              onShare={handleShare}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptEditor;
