import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TeamRole, UserSearchResult } from "@/hooks/useTeamManagement";
import { Search, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (userId: string, role: string, permissions: any) => Promise<void>;
  roles: TeamRole[];
  onSearchUsers?: (search: string) => Promise<UserSearchResult[]>;
}

export function InviteMemberDialog({ open, onClose, onInvite, roles, onSearchUsers }: InviteMemberDialogProps) {
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
      if (!searchTerm || searchTerm.length < 2 || !onSearchUsers) {
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
        const results = await onSearchUsers(searchTerm);
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
  }, [searchTerm, onSearchUsers]);

  const handleInvite = async () => {
    if (!selectedUser || !selectedRole) return;

    const role = roles.find(r => r.role_name === selectedRole);
    if (!role) return;

    try {
      setInviting(true);
      await onInvite(selectedUser.user_id, selectedRole, role.base_permissions);
      setSearchTerm("");
      setSelectedUser(null);
      setSelectedRole("");
      setSearchResults([]);
      onClose();
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-[92vw] sm:max-w-md mx-auto h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col px-5 py-3 sm:p-6 rounded-none sm:rounded-lg">
        <DialogHeader className="pb-2 shrink-0 space-y-1">
          <DialogTitle className="text-base sm:text-xl">Invite Team Member</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add a new team member and assign them a role
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2 -mr-2 max-h-[calc(100vh-180px)] sm:max-h-[60vh]">
          <div className="space-y-2.5 py-1">
          <div className="space-y-1 max-w-[88%] sm:max-w-none mx-auto sm:mx-0 w-full">
            <Label htmlFor="search-user" className="text-xs sm:text-sm font-medium">Search User</Label>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 sm:h-4 sm:w-4 pointer-events-none"><LottieSearchIcon size={14} /></div>
              <Input
                id="search-user"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedUser) setSelectedUser(null);
                }}
                className="h-8 sm:h-9 pl-8 pr-8 text-xs sm:text-sm"
                disabled={!onSearchUsers}
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Email Validation Error */}
            {emailError && (
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm">
                  {emailError}
                </AlertDescription>
              </Alert>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg bg-background max-h-[200px] sm:max-h-[280px] overflow-y-auto overflow-x-hidden shadow-sm max-w-[88%] sm:max-w-none mx-auto sm:mx-0 w-full">
                {searchResults.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full p-2 sm:p-3 hover:bg-accent active:bg-accent/80 flex items-start gap-2 sm:gap-3 text-left transition-colors border-b last:border-b-0 min-h-[52px] sm:min-h-[64px] overflow-hidden"
                  >
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-base font-semibold">
                        {user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-semibold text-xs sm:text-sm truncate">
                        {user.full_name || user.email}
                      </p>
                      <p className="text-xs sm:text-sm text-foreground font-medium truncate" title={user.email}>
                        {user.email}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate" title={user.user_id}>
                        ID: {user.user_id.substring(0, 8)}...
                      </p>
                    </div>
                    {user.is_admin ? (
                      <Badge variant="secondary" className="shrink-0 text-[9px] sm:text-xs flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1">
                        <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="hidden sm:inline">Already Admin</span>
                        <span className="sm:hidden">Admin</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-[9px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1">Available</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Selected User */}
            {selectedUser && (
              <>
                <div className="border rounded-lg bg-accent/50 p-2 sm:p-2.5 flex items-center gap-2 sm:gap-3 min-h-[48px] sm:min-h-[52px] overflow-hidden max-w-[88%] sm:max-w-none mx-auto sm:mx-0 w-full">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                      {selectedUser.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                {selectedUser.is_admin && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <AlertDescription className="text-[10px] sm:text-xs">
                      This user already has an admin role. They cannot be invited again.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {!onSearchUsers && (
              <p className="text-xs text-muted-foreground">
                Search functionality is currently unavailable
              </p>
            )}
          </div>

          <div className="space-y-1 max-w-[88%] sm:max-w-none mx-auto sm:mx-0 w-full">
            <Label htmlFor="role" className="text-xs sm:text-sm font-medium">Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="h-8 sm:h-9 bg-background text-xs sm:text-sm w-full">
                <SelectValue placeholder="Select a role">
                  {selectedRole && (
                    <span className="capitalize">
                      {selectedRole.replace(/_/g, ' ')}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent 
                className="bg-background border shadow-lg max-h-[200px] sm:max-h-[240px] max-w-[85vw] sm:max-w-md overflow-auto z-50"
                position="popper"
                sideOffset={5}
                align="start"
              >
                {roles.length === 0 ? (
                  <div className="p-2 text-[10px] sm:text-xs text-muted-foreground">No roles available</div>
                ) : (
                  roles.map((role) => (
                    <SelectItem 
                      key={role.id} 
                      value={role.role_name}
                      className="cursor-pointer py-1.5 px-2.5 text-xs sm:text-sm"
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
            {selectedRole && roles.find(r => r.role_name === selectedRole)?.role_description && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">
                {roles.find(r => r.role_name === selectedRole)?.role_description}
              </p>
            )}
            
            {roles.length > 0 && (
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                {roles.length} role{roles.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
        </div>
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 border-t mt-2 shrink-0 max-w-[88%] sm:max-w-none mx-auto sm:mx-0 w-full">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={inviting} 
            className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            disabled={!selectedUser || !selectedRole || inviting || selectedUser?.is_admin}
            className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm font-medium"
          >
            {inviting ? "Inviting..." : "Invite Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
