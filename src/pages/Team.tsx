
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Mail, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const Team = () => {
  const [teamMembers, setTeamMembers] = useState([
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
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: ''
  });
  const { toast } = useToast();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteForm.name || !inviteForm.email || !inviteForm.role) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    // Add new member to the list
    const newMember = {
      id: teamMembers.length + 1,
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role,
      avatar: null,
      status: 'active' as const,
      joinDate: new Date().toISOString().split('T')[0]
    };

    setTeamMembers([...teamMembers, newMember]);
    
    // Reset form and close dialog
    setInviteForm({ name: '', email: '', role: '' });
    setInviteDialogOpen(false);
    
    toast({
      title: "Member Invited",
      description: `${inviteForm.name} has been added to your team.`
    });
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
              <img src="/lovable-uploads/a8794a28-d1ea-4182-a872-01c163c23ee5.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400">/</span>
            <span className="text-white font-medium">Team Members</span>
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
                  Add a new member to your team by filling out their information below.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">Full Name</Label>
                  <Input
                    id="name"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    placeholder="Enter full name"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="Enter email address"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="role" className="text-white">Role</Label>
                  <Input
                    id="role"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    placeholder="Enter role (e.g., Developer, Designer)"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                    Send Invite
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Team Members</h1>
          <p className="text-xl text-slate-300">Manage your team and collaborators</p>
        </div>

        {/* Team Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
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
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/30 hover:bg-white/10 text-slate-950"
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Team;
