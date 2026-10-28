import LottieSearchIcon from "@/components/LottieSearchIcon";
import { Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";

const SearchBar = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(searchTerm)}`);
    } else {
      navigate("/jobs");
    }
  };

  const handleVoice = () => {
    navigate("/jobs?voice=1");
  };

  return (
    <div className="bg-background/80 backdrop-blur-sm pt-1 pb-3 px-2.5">
      <form onSubmit={handleSearch}>
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <LottieSearchIcon size={24} />
          </div>
          <Input
            type="text"
            placeholder={animatedPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-12 h-[46px] text-base rounded-2xl bg-muted/40 border border-border/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all shadow-sm"
          />
          <button
            type="button"
            onClick={handleVoice}
            aria-label="Voice search"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center bg-transparent hover:bg-transparent p-1"
          >
            <Mic className="w-7 h-7 text-muted-foreground" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
