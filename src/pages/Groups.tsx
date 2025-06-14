import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import GroupsList from '@/components/groups/GroupsList';
import CreateGroupDialog from '@/components/groups/CreateGroupDialog';
import JoinGroupTab from '@/components/groups/JoinGroupTab';

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

const Groups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinGroupUrl, setJoinGroupUrl] = useState('');
  const [activeTab, setActiveTab] = useState('groups');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      console.log('Fetching groups for user:', user?.id);
      
      // First, let's debug by checking ALL group_members data
      const { data: allMemberships, error: allMembershipsError } = await supabase
        .from('group_members')
        .select('*');
      
      console.log('ALL group_members data:', allMemberships);
      
      // Then check specifically for this user
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id, is_admin, user_id, joined_at')
        .eq('user_id', user?.id);

      if (membershipError) {
        console.error('Error fetching memberships:', membershipError);
        throw membershipError;
      }

      console.log('User memberships for user', user?.id, ':', membershipData);

      // Let's also check groups created by this user
      const { data: createdGroups, error: createdGroupsError } = await supabase
        .from('groups')
        .select('id, name, creator_id, created_at')
        .eq('creator_id', user?.id);
        
      console.log('Groups created by user:', createdGroups);

      // Combine groups where user is member OR creator
      let userGroupIds: number[] = [];
      
      if (membershipData && membershipData.length > 0) {
        userGroupIds = membershipData.map(m => m.group_id);
      }
      
      if (createdGroups && createdGroups.length > 0) {
        const createdGroupIds = createdGroups.map(g => g.id);
        userGroupIds = [...new Set([...userGroupIds, ...createdGroupIds])];
      }

      console.log('Combined user group IDs:', userGroupIds);

      if (userGroupIds.length === 0) {
        console.log('User has no group access');
        setGroups([]);
        return;
      }

      // Fetch all groups where user has access
      const { data: userGroups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, creator_id, created_at')
        .in('id', userGroupIds)
        .order('created_at', { ascending: false });

      if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        throw groupsError;
      }

      console.log('Fetched user groups:', userGroups);

      // Process the groups to add member counts and admin status
      const processedGroups = await Promise.all(
        (userGroups || []).map(async (group: any) => {
          // Get member count for this group
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          // Check if user is admin (either through membership or being creator)
          const membership = membershipData?.find(m => m.group_id === group.id);
          const isCreator = group.creator_id === user?.id;
          const isAdmin = isCreator || (membership?.is_admin || false);

          return {
            id: group.id,
            name: group.name,
            creator_id: group.creator_id,
            created_at: group.created_at,
            member_count: count || 0,
            is_admin: isAdmin
          };
        })
      );
      
      console.log('Processed groups:', processedGroups);
      setGroups(processedGroups);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load groups.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (groupName: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a group.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Creating group:', groupName, 'for user:', user.id);
      
      // Create the group first
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          creator_id: user.id
        })
        .select()
        .single();

      if (groupError) {
        console.error('Group creation error:', groupError);
        throw groupError;
      }

      console.log('Group created successfully:', newGroup);

      // Add creator as admin member
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .insert({
          user_id: user.id,
          group_id: newGroup.id,
          is_admin: true
        })
        .select();

      if (memberError) {
        console.error('Member creation error:', memberError);
        // If adding member fails, clean up by deleting the group
        await supabase
          .from('groups')
          .delete()
          .eq('id', newGroup.id);
        
        throw new Error('Failed to add creator as group member: ' + memberError.message);
      }

      console.log('Creator successfully added as admin member:', memberData);
      
      toast({
        title: "Group Created",
        description: `"${groupName}" has been created successfully and you've been added as an admin.`
      });

      // Refresh the list
      await fetchGroups();
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create group.",
        variant: "destructive"
      });
    }
  };

  const handleJoinGroup = async () => {
    if (!joinGroupUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid group invite URL.",
        variant: "destructive"
      });
      return;
    }

    try {
      const url = new URL(joinGroupUrl);
      const inviteToken = url.searchParams.get('invite');
      
      if (!inviteToken) {
        throw new Error('Invalid invite link');
      }

      // Call the database function to join the group
      const { data, error } = await supabase.rpc('join_group_via_invitation', {
        _invite_token: inviteToken,
        _user_id: user?.id
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Joined Group!",
          description: "You have successfully joined the group."
        });
        fetchGroups(); // Refresh the list
        setJoinGroupUrl(''); // Clear the input
      } else {
        toast({
          title: "Invalid Invite",
          description: "The invite link is invalid or has expired.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error joining group:', error);
      toast({
        title: "Join Failed",
        description: error.message || "Failed to join group.",
        variant: "destructive"
      });
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Loading groups...</div>
      </div>
    );
  }

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
            <span className="text-white font-medium">Groups</span>
          </div>
          <Button 
            onClick={handleOpenCreateDialog}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Groups</h1>
          <p className="text-xl text-slate-300">Create and join groups to share notes and collaborate</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border-white/20 mb-8">
            <TabsTrigger value="groups" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              My Groups
            </TabsTrigger>
            <TabsTrigger value="join" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Join Group
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="space-y-8">
            <GroupsList groups={groups} onRefresh={fetchGroups} onCreateGroup={handleOpenCreateDialog} />
          </TabsContent>

          <TabsContent value="join" className="space-y-8">
            <JoinGroupTab
              joinGroupUrl={joinGroupUrl}
              onJoinGroupUrlChange={setJoinGroupUrl}
              onJoinGroup={handleJoinGroup}
            />
          </TabsContent>
        </Tabs>
      </div>

      <CreateGroupDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};

export default Groups;
