
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Save, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Profile = () => {
  const { user, refreshSession } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: user?.user_metadata?.first_name || '',
    lastName: user?.user_metadata?.last_name || '',
    email: user?.email || '',
    company: user?.user_metadata?.company || '',
    jobTitle: user?.user_metadata?.job_title || '',
    bio: user?.user_metadata?.bio || '',
    phone: user?.user_metadata?.phone || ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user?.user_metadata?.first_name || '',
        lastName: user?.user_metadata?.last_name || '',
        email: user?.email || '',
        company: user?.user_metadata?.company || '',
        jobTitle: user?.user_metadata?.job_title || '',
        bio: user?.user_metadata?.bio || '',
        phone: user?.user_metadata?.phone || ''
      });
      setAvatarUrl(user?.user_metadata?.avatar_url || null);
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleWithRetry = async (operation: () => Promise<any>, operationName: string) => {
    try {
      return await operation();
    } catch (error: any) {
      if (error.message?.includes('expired') || error.message?.includes('JWT')) {
        console.log(`${operationName} failed, refreshing session and retrying...`);
        await refreshSession();
        return await operation();
      }
      throw error;
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      await handleWithRetry(async () => {
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        setAvatarUrl(publicUrl);

        // Update user metadata with new avatar URL
        const { error: updateError } = await supabase.auth.updateUser({
          data: { avatar_url: publicUrl }
        });

        if (updateError) {
          throw updateError;
        }
      }, 'Avatar upload');
      
      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated successfully."
      });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await handleWithRetry(async () => {
        // Update user metadata
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            company: formData.company,
            job_title: formData.jobTitle,
            bio: formData.bio,
            phone: formData.phone,
            avatar_url: avatarUrl
          }
        });

        if (updateError) {
          throw updateError;
        }

        // Update profile in database
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user?.id,
            email: user?.email,
            first_name: formData.firstName,
            last_name: formData.lastName,
            avatar_url: avatarUrl
          });

        if (profileError) {
          throw profileError;
        }
      }, 'Profile update');

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated."
      });
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link to="/dashboard" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/82423172-8fa2-4a61-9691-e45ac0c5f57c.png" alt="NeuroNotes" className="h-8 md:h-12 w-auto" />
              <span className="text-lg md:text-2xl font-bold text-white">NeuroNotes</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-white text-sm md:text-base">Profile Settings</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">Profile Settings</h1>
          <p className="text-lg md:text-xl text-slate-300">Manage your account information and preferences</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* Profile Picture Section */}
          <div className="lg:col-span-1">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg md:text-xl">Profile Picture</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 md:h-16 md:w-16 text-white" />
                    )}
                  </div>
                  <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full cursor-pointer">
                    <Camera className="h-3 w-3 md:h-4 md:w-4" />
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="border-white/30 hover:bg-white/10 text-slate-950 text-sm"
                  disabled={uploading}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  {uploading ? 'Uploading...' : 'Upload New Photo'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Profile Form */}
          <div className="lg:col-span-2">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg md:text-xl">Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-white text-sm">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm"
                        placeholder="Enter your first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-white text-sm">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm"
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white text-sm">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-white/5 border-white/20 text-slate-400 cursor-not-allowed text-sm"
                    />
                    <p className="text-xs text-slate-400">Email cannot be changed</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-white text-sm">Company</Label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm"
                        placeholder="Enter your company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="text-white text-sm">Job Title</Label>
                      <Input
                        id="jobTitle"
                        name="jobTitle"
                        value={formData.jobTitle}
                        onChange={handleInputChange}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm"
                        placeholder="Enter your job title"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white text-sm">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-white text-sm">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 min-h-[80px] md:min-h-[100px] text-sm"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                    <Button 
                      type="submit" 
                      disabled={isLoading} 
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm"
                    >
                      {isLoading ? 'Saving...' : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate('/dashboard')} 
                      className="border-white/30 hover:bg-white/10 text-slate-950 text-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
