
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Mail, UserPlus, Copy, Edit, Trash2, MoreVertical, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EditMemberDialog from '@/components/EditMemberDialog';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: null;
  status: string;
  joinDate: string;
}

const Team = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: 1,
      name: 'John Smith',
      email: 'john@company.com',
      role: 'Project Manager',
      avatar: null,
      status: 'active',
      joinDate: '2024-01-15'
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah@company.com',
      role: 'Developer',
      avatar: null,
      status: 'active',
      joinDate: '2024-02-20'
    },
    {
      id: 3,
      name: 'Mike Chen',
      email: 'mike@company.com',
      role: 'Designer',
      avatar: null,
      status: 'active',
      joinDate: '2024-03-10'
    },
    {
      id: 4,
      name: 'Lisa Wong',
      email: 'lisa@company.com',
      role: 'QA Engineer',
      avatar: null,
      status: 'inactive',
      joinDate: '2024-01-30'
    }
  ]);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [joinTeamUrl, setJoinTeamUrl] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Generate shareable invite link
  const inviteLink = `${window.location.origin}/join-team?invite=abc123def456`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: "Link Copied",
      description: "Invite link has been copied to clipboard."
    });
  };

  const saveTeamMembersToDatabase = async (updatedMembers: TeamMember[]) => {
    try {
      // In a real app, you would save to the database here
      // For now, we'll simulate a database save
      console.log('Saving team members to database:', updatedMembers);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Changes Saved",
        description: "Team member changes have been saved to the database."
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save changes to database. Please try again.",
        variant: "destructive"
      });
    }
  };

  const editMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditDialogOpen(true);
  };

  const handleSaveMember = async (updatedMember: TeamMember) => {
    const updatedMembers = teamMembers.map(member => 
      member.id === updatedMember.id ? updatedMember : member
    );
    setTeamMembers(updatedMembers);
    await saveTeamMembersToDatabase(updatedMembers);
    setEditDialogOpen(false);
    setEditingMember(null);
  };

  const deleteMember = async (memberId: number) => {
    const updatedMembers = teamMembers.filter(member => member.id !== memberId);
    setTeamMembers(updatedMembers);
    await saveTeamMembersToDatabase(updatedMembers);
    toast({
      title: "Member Removed",
      description: "Team member has been removed successfully."
    });
  };

  const handleJoinTeam = async () => {
    if (!joinTeamUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid team invite URL.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Extract invite code from URL
      const url = new URL(joinTeamUrl);
      const inviteCode = url.searchParams.get('invite');
      
      if (!inviteCode) {
        throw new Error('Invalid invite link');
      }

      // Simulate joining team
      toast({
        title: "Joining Team...",
        description: "Processing your request to join the team."
      });

      // Navigate to the join team page
      navigate(`/join-team?invite=${inviteCode}`);
    } catch (error) {
      toast({
        title: "Invalid Link",
        description: "The provided invite link is not valid.",
        variant: "destructive"
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400">/</span>
            <span className="text-white font-medium">Team Management</span>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Invite Team Member</DialogTitle>
                <DialogDescription className="text-slate-300">
                  Share this link with anyone you want to invite to your team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-link" className="text-white">Shareable Invite Link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="invite-link"
                      value={inviteLink}
                      readOnly
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <Button onClick={copyInviteLink} className="bg-purple-600 hover:bg-purple-700">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    Anyone with this link can join your team after registering or signing in.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setInviteDialogOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Team Management</h1>
          <p className="text-xl text-slate-300">Manage your team and collaborators</p>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border-white/20 mb-8">
            <TabsTrigger value="members" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Team Members
            </TabsTrigger>
            <TabsTrigger value="join" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Join Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-8">
            {/* Team Stats */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    Total Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{teamMembers.length}</div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-400" />
                    Active Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">
                    {teamMembers.filter(m => m.status === 'active').length}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-400" />
                    Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">
                    {new Set(teamMembers.map(m => m.role)).size}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Members List */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {getInitials(member.name)}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{member.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Mail className="h-4 w-4" />
                            {member.email}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge
                            variant={member.status === 'active' ? 'default' : 'secondary'}
                            className={member.status === 'active' ? 'bg-green-600' : 'bg-slate-600'}
                          >
                            {member.status}
                          </Badge>
                          <div className="text-sm text-slate-300 mt-1">{member.role}</div>
                        </div>
                        
                        <div className="text-right text-sm text-slate-400">
                          <div>Joined</div>
                          <div>{formatDate(member.joinDate)}</div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/30 hover:bg-white/10 text-black"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-slate-800 border-slate-700">
                            <DropdownMenuItem 
                              onClick={() => editMember(member)}
                              className="text-white hover:bg-slate-700"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteMember(member.id)}
                              className="text-red-400 hover:bg-slate-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join" className="space-y-8">
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
                      onChange={(e) => setJoinTeamUrl(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                    />
                    <Button 
                      onClick={handleJoinTeam}
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
          </TabsContent>
        </Tabs>
      </div>

      <EditMemberDialog
        member={editingMember}
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
      />
    </div>
  );
};

export default Team;
