
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface JoinGroupTabProps {
  onJoinSuccess: () => void;
}

const JoinGroupTab: React.FC<JoinGroupTabProps> = ({ onJoinSuccess }) => {
  const [joinGroupUrl, setJoinGroupUrl] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleJoinGroup = async () => {
    if (!joinGroupUrl.trim() || !user) return;

    setIsJoining(true);
    try {
      // Extract group ID from URL (assuming format like /join-group/{id})
      const urlMatch = joinGroupUrl.match(/\/join-group\/(\d+)/);
      if (!urlMatch) {
        toast({
          title: "Invalid Link",
          description: "Please enter a valid group invite link.",
          variant: "destructive"
        });
        return;
      }

      const groupId = parseInt(urlMatch[1]);

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        toast({
          title: "Already a Member",
          description: "You are already a member of this group.",
          variant: "destructive"
        });
        return;
      }

      // Join the group
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: user.id,
          is_admin: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "You have successfully joined the group!"
      });

      setJoinGroupUrl('');
      onJoinSuccess();
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: "Error",
        description: "Failed to join group. Please check the invite link and try again.",
        variant: "destructive"
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-purple-400" />
          Join a Group
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="join-group-url" className="text-white">Group Invite Link</Label>
          <div className="flex gap-2">
            <Input
              id="join-group-url"
              placeholder="Paste the group invite link here..."
              value={joinGroupUrl}
              onChange={(e) => setJoinGroupUrl(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
            />
            <Button 
              onClick={handleJoinGroup}
              disabled={!joinGroupUrl.trim() || isJoining}
              className="bg-green-600 hover:bg-green-700"
            >
              {isJoining ? 'Joining...' : 'Join Group'}
            </Button>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Enter the invite link shared by a group member to join their group.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default JoinGroupTab;
