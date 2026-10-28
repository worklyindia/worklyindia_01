import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, X, Plus } from "lucide-react";

interface VideoInputProps {
  videos: Array<{ url: string }>;
  onVideoChange: (index: number, field: 'url', value: string) => void;
  onRemoveVideo: (index: number) => void;
}

const extractYouTubeId = (url: string) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const VideoInput = ({ videos, onVideoChange, onRemoveVideo }: VideoInputProps) => {
  return (
    <div className="space-y-4">
      <Label>YouTube Videos (Optional)</Label>
      <div className="space-y-3">
        {videos.map((video, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-medium text-sm">Video {index + 1}</h4>
              {videos.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveVideo(index)}
                  className="text-destructive hover:text-destructive h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Input
                  id={`video-url-${index}`}
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={video.url}
                  onChange={(e) => onVideoChange(index, 'url', e.target.value)}
                  className="rounded-xl"
                />
              </div>
              {video.url && extractYouTubeId(video.url) && (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                  <img
                    src={`https://img.youtube.com/vi/${extractYouTubeId(video.url)}/maxresdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-red-600 rounded-full p-3">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => onVideoChange(videos.length, 'url', '')}
          className="rounded-xl w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Video
        </Button>
      </div>
    </div>
  );
};

export default VideoInput;
