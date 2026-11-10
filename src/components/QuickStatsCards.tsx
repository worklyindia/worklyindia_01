import { Users, Heart, Building2, Gift, Code2, BookOpen, PlusSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AIChipIcon } from "@/components/icons/AIChipIcon";
import type { ComponentType } from "react";

type Stat = {
  icon: ComponentType<{ className?: string; strokeWidth?: string | number }>;
  label: string;
  color: string;
  bg: string;
  path: string;
  size?: string;
};

const QuickStatsCards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const stats: Stat[] = [
    { icon: Users, label: "Employee", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", path: "/employer-portal" },
    { icon: Building2, label: "Companies", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30", path: "/company-directory" },
    { icon: Heart, label: "Favorites", color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/30", path: user ? "/favorites" : "/auth" },
    { icon: Gift, label: "Refer", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30", path: "/referral" },
    { icon: AIChipIcon, label: "AI Chat", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", path: "/ai-assistant?audience=job_seeker", size: "w-[30px] h-[30px]" },
    { icon: Code2, label: "Developer", color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950/30", path: "/developers" },
    { icon: BookOpen, label: "Resume", color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30", path: "/resume-builder" },
    { icon: PlusSquare, label: "Post Job", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", path: "/post-job" },
  ];

  return (
    <div className="px-2.5 py-4">
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            onClick={() => navigate(stat.path)}
            className="flex flex-col items-center cursor-pointer animate-scale-in py-2.5"
            style={{ animationDelay: `${index * 0.04}s`, animationFillMode: 'both' }}
          >
            <div className={`w-[52px] h-[52px] ${stat.bg} rounded-2xl flex items-center justify-center mb-2 transition-all active:scale-90 shadow-sm`}>
              <stat.icon className={`${stat.size ?? "w-[22px] h-[22px]"} ${stat.color}`} strokeWidth={1.8} />
            </div>
            <span className="text-[11px] text-muted-foreground text-center leading-tight font-medium">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickStatsCards;
