import LottieSearchIcon from "@/components/LottieSearchIcon";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const AppSearchBar = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/jobs?search=${encodeURIComponent(searchTerm)}`);
    } else {
      navigate("/jobs");
    }
  };

  return (
    <div className="sticky top-12 z-30 bg-background py-3 px-4 border-b">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <LottieSearchIcon size={22} />
          </div>
          <Input
            type="text"
            placeholder="Search jobs, companies, skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 text-base rounded-xl bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </form>
    </div>
  );
};

export default AppSearchBar;
