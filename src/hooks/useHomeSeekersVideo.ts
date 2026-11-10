import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const HOME_SEEKERS_VIDEO_KEY = "home_seekers_video_url";

const YT_RE = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
export const isValidYouTubeUrl = (url: string) => YT_RE.test(url);

/** Splits a saved multi-link value (one per line, commas also ok) into valid YouTube URLs. */
export const parseVideoUrls = (raw: string): string[] =>
  raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s && isValidYouTubeUrl(s));

/** Owner-chosen YouTube links shown above the home page job seekers scroll; follows changes live. */
export const useHomeSeekersVideo = () => {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", HOME_SEEKERS_VIDEO_KEY)
        .maybeSingle();
      if (active) setUrls(parseVideoUrls(data?.setting_value ?? ""));
    };
    void load();
    const channel = supabase
      .channel(`home_seekers_video_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `setting_key=eq.${HOME_SEEKERS_VIDEO_KEY}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return urls;
};
