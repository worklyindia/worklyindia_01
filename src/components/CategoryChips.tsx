import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Briefcase, Clock, Home, MapPin, TrendingUp, GraduationCap, FileText, Laptop, Users } from "lucide-react";

const categories = [
  { label: "All Jobs", icon: Briefcase, path: "/jobs" },
  { label: "Remote", icon: Home, path: "/jobs?workMode=remote" },
  { label: "Part-time", icon: Clock, path: "/jobs?jobType=part-time" },
  { label: "Full-time", icon: Briefcase, path: "/jobs?jobType=full-time" },
  { label: "Near Me", icon: MapPin, path: "/jobs?location=nearby" },
  { label: "Internship", icon: GraduationCap, path: "/jobs?jobType=internship" },
  { label: "Contract", icon: FileText, path: "/jobs?jobType=contract" },
  { label: "Freelance", icon: Laptop, path: "/jobs?jobType=freelance" },
  { label: "Hybrid", icon: Users, path: "/jobs?workMode=hybrid" },
];

const CategoryChips = () => {
  const navigate = useNavigate();

  return (
    <div className="px-2.5 py-2.5 bg-background/60 backdrop-blur-sm">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {categories.map((category, index) => (
          <Button
            key={category.label}
            variant="outline"
            size="sm"
            onClick={() => navigate(category.path)}
            className="flex-shrink-0 rounded-full bg-muted/30 border border-border/40 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95 animate-slide-up-fade shadow-sm"
            style={{ animationDelay: `${index * 0.03}s`, animationFillMode: 'both' }}
          >
            <category.icon className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">{category.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default CategoryChips;
