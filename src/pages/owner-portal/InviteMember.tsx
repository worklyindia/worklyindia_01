import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTeamManagement, UserSearchResult } from "@/hooks/useTeamManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import LottieSearchIcon from "@/components/LottieSearchIcon";

export default function InviteMember() {
  const navigate = useNavigate();
  const { assignRole, teamRoles, searchUsersByEmail, loading } = useTeamManagement();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [inviting, setInviting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Search users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm || searchTerm.length < 2 || !searchUsersByEmail) {
        setSearchResults([]);
        setEmailError(null);
        return;
      }

      // More lenient email validation - allow partial emails
      const hasAtSymbol = searchTerm.includes('@');
      if (hasAtSymbol && searchTerm.length > 3) {
        const parts = searchTerm.split('@');
        if (parts.length === 2 && parts[1].length > 0 && parts[1].includes('.')) {
          if (!validateEmail(searchTerm)) {
            setEmailError('Please enter a valid email address');
            setSearchResults([]);
            return;
          }
        }
      }

      setEmailError(null);
      setSearching(true);
      try {
        console.log('🔍 Searching for:', searchTerm);
        const results = await searchUsersByEmail(searchTerm);
        console.log('✅ Search results:', results);
        setSearchResults(results);
        
        if (results.length === 0) {
          setEmailError('No users found matching your search');
        }
      } catch (error) {
        console.error('❌ Search error:', error);
        setEmailError('Failed to search users. Please try again.');
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, searchUsersByEmail]);

  const handleInvite = async () => {
    if (!selectedUser || !selectedRole) return;

    const role = teamRoles.find(r => r.role_name === selectedRole);
    if (!role) return;

    try {
      setInviting(true);
      await assignRole(selectedUser.user_id, selectedRole, role.base_permissions);
      toast.success('Team member invited successfully');
      navigate('/owner-portal/team-management');
    } catch (error) {
      // Error handled in hook
    } finally {
      setInviting(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchTerm(user.email);
    setSearchResults([]);
  };

  const handleReset = () => {
    setSearchTerm("");
    setSelectedUser(null);
    setSelectedRole("");
    setSearchResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-4 p-4 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/owner-portal/team-management')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">Invite Team Member</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Add a new team member and assign them a role
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Search User Section */}
          <div className="space-y-3">
            <Label htmlFor="search-user" className="text-sm font-medium">Search User</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                id="search-user"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedUser) setSelectedUser(null);
                }}
                className="h-12 pl-10 pr-10 text-base"
                disabled={!searchUsersByEmail}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Email Validation Error */}
            {emailError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {emailError}
                </AlertDescription>
              </Alert>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg bg-background shadow-lg overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full p-4 hover:bg-accent active:bg-accent/80 flex items-start gap-3 text-left transition-colors border-b last:border-b-0 overflow-hidden"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-base font-semibold">
                        {user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-semibold text-base truncate">
                        {user.full_name || user.email}
                      </p>
                      <p className="text-sm text-foreground font-medium truncate" title={user.email}>
                        {user.email}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate" title={user.user_id}>
                          ID: {user.user_id.substring(0, 8)}...
                        </p>
                        {user.is_admin ? (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Admin</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5">Available</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected User */}
            {selectedUser && (
              <>
                <div className="border rounded-lg bg-accent/50 p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {selectedUser.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="shrink-0 h-8 w-8 p-0"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
                {selectedUser.is_admin && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This user already has an admin role. They cannot be invited again.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {!searchUsersByEmail && (
              <p className="text-xs text-muted-foreground">
                Search functionality is currently unavailable
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label htmlFor="role" className="text-sm font-medium">Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="h-10 sm:h-12 bg-background text-sm sm:text-base">
                <SelectValue placeholder="Select a role">
                  {selectedRole && (
                    <span className="capitalize">
                      {selectedRole.replace(/_/g, ' ')}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg max-h-[300px] max-w-[85vw] sm:max-w-md overflow-auto z-50">
                {teamRoles.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No roles available</div>
                ) : (
                  teamRoles.map((role) => (
                    <SelectItem 
                      key={role.id} 
                      value={role.role_name}
                      className="cursor-pointer py-2 px-3 text-sm"
                    >
                      <span className="font-medium capitalize">
                        {role.role_name.replace(/_/g, ' ')}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {/* Show selected role description below */}
            {selectedRole && teamRoles.find(r => r.role_name === selectedRole)?.role_description && (
              <p className="text-xs text-muted-foreground mt-2">
                {teamRoles.find(r => r.role_name === selectedRole)?.role_description}
              </p>
            )}
            
            {teamRoles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {teamRoles.length} role{teamRoles.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/owner-portal/team-management')} 
            disabled={inviting} 
            className="w-full sm:w-auto h-12 text-base"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            disabled={!selectedUser || !selectedRole || inviting || selectedUser?.is_admin}
            className="w-full sm:w-auto h-12 text-base font-medium"
          >
            {inviting ? "Inviting..." : "Invite Member"}
          </Button>
        </div>
      </div>
    </div>
  );
}
