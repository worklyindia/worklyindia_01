import { useNavigate } from "react-router-dom";
import { ArrowLeft, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import HomeSeekersVideoSettings from "@/components/HomeSeekersVideoSettings";
import { goBack } from "@/lib/goBack";

/** Owner page: YouTube video shown above the home page job seekers scroll. */
const HomeVideoManagement = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-2 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate, "/owner-portal")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Youtube className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Home Page Video</h1>
      </header>
      <main className="w-full pb-24">
        <HomeSeekersVideoSettings bare />
      </main>
    </div>
  );
};

export default HomeVideoManagement;
