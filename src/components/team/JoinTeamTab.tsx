
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinTeamTabProps {
  joinTeamUrl: string;
  onJoinTeamUrlChange: (url: string) => void;
  onJoinTeam: () => void;
}

const JoinTeamTab: React.FC<JoinTeamTabProps> = ({
  joinTeamUrl,
  onJoinTeamUrlChange,
  onJoinTeam
}) => {
  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-purple-400" />
          Join a Team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="join-team-url" className="text-white">Team Invite Link</Label>
          <div className="flex gap-2">
            <Input
              id="join-team-url"
              placeholder="Paste the team invite link here..."
              value={joinTeamUrl}
              onChange={(e) => onJoinTeamUrlChange(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
            />
            <Button 
              onClick={onJoinTeam}
              className="bg-green-600 hover:bg-green-700"
            >
              Join Team
            </Button>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Enter the invite link shared by a team member to join their team.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default JoinTeamTab;
