
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const JoinGroup = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const inviteToken = searchParams.get('invite');

  useEffect(() => {
    if (user && inviteToken) {
      handleJoinGroup();
    }
  }, [user, inviteToken]);

  const handleJoinGroup = async () => {
    if (!user || !inviteToken) return;

    try {
      // Call the database function to join the group
      const { data, error } = await supabase.rpc('join_group_via_invitation', {
        _invite_token: inviteToken,
        _user_id: user.id
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Welcome to the Group!",
          description: "You have successfully joined the group."
        });
        navigate('/groups');
      } else {
        toast({
          title: "Invalid Invite",
          description: "This invite link is invalid or has expired.",
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

  if (!inviteToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center p-6">
        <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Invalid Invite Link</h1>
            <p className="text-slate-300 mb-6">This invite link is not valid or has expired.</p>
            <Link to="/">
              <Button className="bg-purple-600 hover:bg-purple-700">
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center p-6">
        <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-md">
          <CardHeader className="text-center">
            <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto mx-auto mb-4" />
            <CardTitle className="text-white">Join the Group</CardTitle>
            <CardDescription className="text-slate-300">
              You've been invited to join a group. Please sign in or create an account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                Sign In
              </Button>
            </Link>
            <Link to={`/register?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
              <Button variant="outline" className="w-full border-white/30 text-black hover:bg-white/10">
                Create Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center p-6">
      <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-md">
        <CardContent className="p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Joining Group...</h1>
          <p className="text-slate-300">Please wait while we add you to the group.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinGroup;
