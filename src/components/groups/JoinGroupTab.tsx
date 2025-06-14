
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinGroupTabProps {
  joinGroupUrl: string;
  onJoinGroupUrlChange: (url: string) => void;
  onJoinGroup: () => void;
}

const JoinGroupTab: React.FC<JoinGroupTabProps> = ({
  joinGroupUrl,
  onJoinGroupUrlChange,
  onJoinGroup
}) => {
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
              onChange={(e) => onJoinGroupUrlChange(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
            />
            <Button 
              onClick={onJoinGroup}
              className="bg-green-600 hover:bg-green-700"
            >
              Join Group
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
