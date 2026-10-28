import { useState, useEffect } from "react";
import { Search, X, TrendingUp, MapPin, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import { useJobSearch } from "@/hooks/useJobSearch";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface QuickSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickSearch = ({ isOpen, onClose }: QuickSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);
  const { suggestions, getSuggestions } = useJobSearch();

  // Get suggestions when typing
  useEffect(() => {
    if (searchQuery.length >= 2) {
      getSuggestions(searchQuery);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchQuery, getSuggestions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
      onClose();
      setShowSuggestions(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    navigate(`/jobs?q=${encodeURIComponent(suggestion)}`);
    onClose();
    setShowSuggestions(false);
  };

  const trendingSearches = [
    "Workly India",
    "Customer service",
    "Data entry",
    "Content writing",
    "Digital marketing"
  ];

  const popularLocations = [
    "Ahmedabad",
    "Delhi",
    "Bangalore",
    "Hyderabad",
    "Chennai"
  ];

  const quickCategories = [
    { name: "All Jobs", icon: Briefcase, path: "/jobs", count: "25+" },
    { name: "Remote Jobs", icon: MapPin, path: "/jobs?location=Remote", count: "20+" },
    { name: "Full Time", icon: TrendingUp, path: "/jobs?type=full-time", count: "15+" }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in">
      <div className="bg-gradient-card h-full overflow-y-auto animate-slide-up">
        {/* Header with Glass Effect */}
        <div className="sticky top-0 glass border-b border-primary/20 p-4 shadow-glow">
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative group">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors group-hover:text-secondary z-10 pointer-events-none"><LottieSearchIcon size={20} /></div>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={animatedPlaceholder}
                className="pl-10 pr-4 py-3 text-base glass border-primary/30 hover:border-primary focus:border-secondary transition-all duration-300 focus:shadow-glow relative z-10"
                autoFocus
              />
              
              {/* Auto-suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background/95 backdrop-blur-lg border border-primary/20 rounded-lg shadow-rainbow z-50 max-h-60 overflow-y-auto animate-slide-down">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-all duration-200 flex items-center justify-between group border-b border-border/50 last:border-0"
                      onClick={() => handleSuggestionClick(suggestion.suggestion)}
                    >
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{suggestion.suggestion}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {suggestion.type === 'job_title' && '📋 Job'}
                          {suggestion.type === 'company' && '🏢 Company'}
                          {suggestion.type === 'skill' && '🎯 Skill'}
                          {suggestion.type === 'category' && '📂 Category'}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.count}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-primary rounded-lg opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"></div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="glass border border-destructive/30 hover:border-destructive hover:bg-gradient-secondary text-destructive hover:text-destructive-foreground transition-all duration-300 group"
            >
              <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Quick Categories with Enhanced Design */}
          <div>
            <h3 className="font-bold text-foreground mb-4 gradient-text text-lg">Quick Access</h3>
            <div className="grid grid-cols-1 gap-3">
              {quickCategories.map((category, index) => (
                <Card
                  key={index}
                  className="p-4 cursor-pointer glass border border-primary/20 hover:border-primary hover:shadow-rainbow transition-all duration-300 group animate-scale-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => {
                    navigate(category.path);
                    onClose();
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-primary rounded-xl shadow-glow group-hover:shadow-neon transition-all duration-300 animate-float">
                      <category.icon className="w-5 h-5 text-primary-foreground transition-transform group-hover:scale-110" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground group-hover:gradient-text transition-all duration-300">{category.name}</h4>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="bg-gradient-secondary text-secondary-foreground shadow-soft group-hover:shadow-glow transition-all duration-300 font-bold"
                    >
                      {category.count}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-gradient-primary rounded-lg opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
                </Card>
              ))}
            </div>
          </div>

          {/* Trending Searches with Enhanced Design */}
          <div>
            <h3 className="font-bold text-foreground mb-4 flex items-center gradient-text text-lg">
              <TrendingUp className="w-5 h-5 mr-2 text-primary animate-pulse-glow" />
              Trending Searches
            </h3>
            <div className="flex flex-wrap gap-3">
              {trendingSearches.map((search, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer glass border-primary/30 hover:border-primary hover:bg-gradient-primary hover:text-primary-foreground transition-all duration-300 hover:shadow-glow hover:scale-105 animate-bounce-in font-medium"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => {
                    setSearchQuery(search);
                    navigate(`/jobs?q=${encodeURIComponent(search)}`);
                    onClose();
                  }}
                >
                  {search}
                </Badge>
              ))}
            </div>
          </div>

          {/* Popular Locations with Enhanced Design */}
          <div>
            <h3 className="font-bold text-foreground mb-4 flex items-center gradient-text text-lg">
              <MapPin className="w-5 h-5 mr-2 text-success animate-float" />
              Popular Locations
            </h3>
            <div className="flex flex-wrap gap-3">
              {popularLocations.map((location, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer glass border-success/30 hover:border-success hover:bg-gradient-success hover:text-success-foreground transition-all duration-300 hover:shadow-glow hover:scale-105 animate-fade-in font-medium"
                  style={{ animationDelay: `${index * 75}ms` }}
                  onClick={() => {
                    navigate(`/jobs?location=${encodeURIComponent(location)}`);
                    onClose();
                  }}
                >
                  {location}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickSearch;