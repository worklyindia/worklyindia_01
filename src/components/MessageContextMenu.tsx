import { MoreVertical, Trash2, MessageSquare, Search, Image, Star, Download, Info, Wallpaper, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LottieSearchIcon from "@/components/LottieSearchIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageContextMenuProps {
  onClearAll: () => void;
  onSelectMode?: () => void;
  onSearch: () => void;
  onViewMedia: () => void;
  onStarred: () => void;
  onExport: () => void;
  onInfo: () => void;
  onProfile?: () => void;
  onChangeWallpaper?: () => void;

  triggerClassName?: string;
  isSelectionMode?: boolean;
  messageCount: number;
}

export default function MessageContextMenu({ 
  onClearAll, 
  onSelectMode,
  onSearch,
  onViewMedia,
  onStarred,
  onExport,
  onInfo,
  onProfile,
  onChangeWallpaper,

  triggerClassName,
  isSelectionMode,
  messageCount
}: MessageContextMenuProps) {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName ?? "shrink-0 text-white hover:bg-white/10"}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-white z-50">
        {onProfile && (
          <>
            <DropdownMenuItem onClick={onProfile}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={onSearch} disabled={messageCount === 0}>
          <span className="mr-2 inline-flex"><LottieSearchIcon size={16} /></span>
          <span>Search Messages</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onViewMedia}>
          <Image className="mr-2 h-4 w-4" />
          <span>View Media</span>
        </DropdownMenuItem>
        {onChangeWallpaper && (
          <DropdownMenuItem onClick={onChangeWallpaper}>
            <Wallpaper className="mr-2 h-4 w-4" />
            <span>Change Wallpaper</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onStarred}>
          <Star className="mr-2 h-4 w-4" />
          <span>Starred Messages</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onExport} disabled={messageCount === 0}>
          <Download className="mr-2 h-4 w-4" />
          <span>Export Chat</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onInfo}>
          <Info className="mr-2 h-4 w-4" />
          <span>Chat Info</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={onClearAll} 
          className="text-destructive focus:text-destructive"
          disabled={messageCount === 0}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Clear All Messages</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
