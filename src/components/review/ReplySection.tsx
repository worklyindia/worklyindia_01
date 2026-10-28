import { useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewReplies } from "@/hooks/useReviewReplies";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReplySectionProps {
  reviewId: string;
  className?: string;
}

export const ReplySection = ({ reviewId, className }: ReplySectionProps) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showAllReplies, setShowAllReplies] = useState(false);
  const { user } = useAuth();
  const { replies, loading, isSubmitting, submitReply, deleteReply, replyCount } = useReviewReplies(reviewId);

  const handleSubmitReply = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to reply to reviews",
        variant: "destructive"
      });
      return;
    }

    if (!replyText.trim()) {
      toast({
        title: "Empty reply",
        description: "Please enter a reply message",
        variant: "destructive"
      });
      return;
    }

    console.log('📤 Submitting reply:', replyText);

    try {
      await submitReply(replyText);
      setReplyText("");
      setShowReplyForm(false);
      toast({
        title: "Reply posted",
        description: "Your reply has been added successfully"
      });
      console.log('✅ Reply posted successfully');
    } catch (error) {
      console.error('❌ Reply error:', error);
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive"
      });
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      await deleteReply(replyId);
      toast({
        title: "Reply deleted",
        description: "Your reply has been removed"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete reply",
        variant: "destructive"
      });
    }
  };

  const displayedReplies = showAllReplies ? replies : replies.slice(0, 2);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setShowReplyForm(!showReplyForm)}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Reply {replyCount > 0 && `(${replyCount})`}</span>
        </Button>
      </div>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="space-y-2 pl-4 border-l-2 border-border">
          <Textarea
            placeholder="Write your reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmitReply}
              disabled={isSubmitting}
            >
              <Send className="w-3 h-3 mr-1" />
              {isSubmitting ? "Posting..." : "Post Reply"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowReplyForm(false);
                setReplyText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Replies List */}
      {loading ? (
        <p className="text-sm text-muted-foreground pl-4">Loading replies...</p>
      ) : replies.length > 0 ? (
        <div className="space-y-3">
          {displayedReplies.map((reply) => (
            <div key={reply.id} className="pl-4 border-l-2 border-border space-y-1">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {reply.profiles?.full_name || "Anonymous User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(reply.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{reply.reply_text}</p>
                </div>
                {user && reply.user_id === user.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDeleteReply(reply.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {replies.length > 2 && (
            <Button
              variant="link"
              size="sm"
              className="pl-4"
              onClick={() => setShowAllReplies(!showAllReplies)}
            >
              {showAllReplies ? "Show less" : `Show ${replies.length - 2} more replies`}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};
