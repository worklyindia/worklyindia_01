import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

/** Matches WhatsApp dictation: populate the draft, never send automatically. */
export function useChatDictation(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;
  const release = () => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };
  const stop = () => {
    clearTimeout(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };
  const cancel = () => {
    generationRef.current += 1;
    stop(); release();
    setStream(null); setRecording(false); setProcessing(false);
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      release();
    };
  }, []);
  const start = async () => {
    if (recording || processing) return;
    const generation = ++generationRef.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone recording is not available in this browser.");
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || generation !== generationRef.current) { audioStream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = audioStream; setStream(audioStream);
      const mimeType = ["audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        release();
        if (!mountedRef.current || generation !== generationRef.current) return;
        setStream(null); setProcessing(true);
        try {
          const audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = () => reject(new Error("Could not read the recording."));
            reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
          });
          const { data, error } = await supabase.functions.invoke("unified-voice", { body: { action: "speech-to-text", audio } });
          if (error) {
            let message = error.message;
            if (error instanceof FunctionsHttpError) {
              try { message = (await error.context.json()).error || message; } catch { /* fallback */ }
            }
            throw new Error(message);
          }
          if (data?.error || !data?.text) throw new Error(data?.error || "No speech detected. Please try again.");
          if (mountedRef.current && generation === generationRef.current) callbackRef.current(data.text);
        } catch (error) {
          if (mountedRef.current && generation === generationRef.current) toast.error(error instanceof Error ? error.message : "Voice transcription failed.");
        } finally {
          if (mountedRef.current && generation === generationRef.current) { setRecording(false); setProcessing(false); }
        }
      };
      recorder.start(); setRecording(true);
      timerRef.current = setTimeout(stop, 5000);
    } catch (error) {
      release();
      if (mountedRef.current) { setStream(null); setRecording(false); toast.error(error instanceof Error ? error.message : "Microphone access denied."); }
    }
  };
  return { recording, processing, stream, start, stop, cancel };
}