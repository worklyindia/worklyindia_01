
import { ArrowUpDown, X, MapPin, Hash, Tag, Briefcase, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect, useCallback } from "react";
import { useAvailableJobFilters } from "@/hooks/useAvailableJobFilters";
import { formatLocationString } from "@/constants/locations";

interface FilterBarProps {
  onFiltersChange?: (filters: {
    category?: string[];
    skills?: string[];
    location?: { city?: string; state?: string; country?: string };
    sortBy?: string;
    jobId?: string;
    experience?: string;
    jobType?: string;
    languages?: string[];
  }) => void;
  initialFilters?: {
    category?: string | string[];
    skills?: string | string[];
    location?: string | { city?: string; state?: string; country?: string };
    sortBy?: string;
    jobId?: string;
    experience?: string;
    jobType?: string;
    languages?: string | string[];
  };
}

const FilterBar = ({ onFiltersChange, initialFilters = {} }: FilterBarProps) => {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>(initialFilters.sortBy || "");
  const [currentFilters, setCurrentFilters] = useState(initialFilters);
  
  // Multi-select states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<string>("");
  const [selectedJobType, setSelectedJobType] = useState<string>("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  
  // Location states
  const [locationCity, setLocationCity] = useState<string>("");
  const [locationState, setLocationState] = useState<string>("");
  const [locationCountry, setLocationCountry] = useState<string>("");
  const [cityInput, setCityInput] = useState<string>("");
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  
  const [jobIdInput, setJobIdInput] = useState<string>(initialFilters.jobId || "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [jobTypeOpen, setJobTypeOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);

  // Fetch available categories, skills, locations, job types, and languages from active jobs
  const { 
    categories: categoryOptions, 
    skills: skillOptions, 
    cities: availableCities,
    states: availableStates,
    countries: availableCountries,
    jobTypes: jobTypeOptions,
    languages: languageOptions,
    loading: filtersLoading 
  } = useAvailableJobFilters();

  const sortOptions = [
    { value: "trending", label: "Trending" },
    { value: "latest", label: "Latest" }, 
    { value: "salary_high", label: "Salary: High to Low" },
    { value: "salary_low", label: "Salary: Low to High" },
    { value: "experience", label: "Experience Required" }
  ];

  const experienceOptions = [
    { value: "0-1", label: "0-1 years" },
    { value: "1-3", label: "1-3 years" },
    { value: "3-5", label: "3-5 years" }
  ];

  // Update filters helper function
  const updateFilters = useCallback((newFilters: any) => {
    const updatedFilters = { ...currentFilters, ...newFilters };
    // Clean undefined values
    Object.keys(updatedFilters).forEach(key => {
      if (updatedFilters[key] === undefined) {
        delete updatedFilters[key];
      }
    });
    setCurrentFilters(updatedFilters);
    onFiltersChange?.(updatedFilters as any);
  }, [currentFilters, onFiltersChange]);

  // Initialize active filters from props
  useEffect(() => {
    const filters = [];
    
    if (initialFilters.category) {
      const cats = Array.isArray(initialFilters.category) ? initialFilters.category : [initialFilters.category];
      setSelectedCategories(cats);
      filters.push(...cats);
    }
    
    if (initialFilters.skills) {
      const skills = Array.isArray(initialFilters.skills) ? initialFilters.skills : [initialFilters.skills];
      setSelectedSkills(skills);
      filters.push(...skills);
    }
    
    if (initialFilters.location) {
      if (typeof initialFilters.location === 'string') {
        filters.push(`📍 ${initialFilters.location}`);
      } else {
        const { city, state, country } = initialFilters.location;
        setLocationCity(city || "");
        setLocationState(state || "");
        setLocationCountry(country || "");
        const locStr = formatLocationString(city, state, country);
        if (locStr) filters.push(`📍 ${locStr}`);
      }
    }
    
    if (initialFilters.jobId) {
      filters.push(`🆔 ID: ${initialFilters.jobId}`);
      setJobIdInput(initialFilters.jobId);
    }
    
    if (initialFilters.experience) {
      setSelectedExperience(initialFilters.experience);
      const expLabel = experienceOptions.find(e => e.value === initialFilters.experience)?.label;
      if (expLabel) filters.push(`💼 ${expLabel}`);
    }
    
    if (initialFilters.jobType) {
      setSelectedJobType(initialFilters.jobType);
      filters.push(`💼 ${initialFilters.jobType}`);
    }
    
    if (initialFilters.languages) {
      const langs = Array.isArray(initialFilters.languages) ? initialFilters.languages : [initialFilters.languages];
      setSelectedLanguages(langs);
      filters.push(...langs.map(lang => `🌐 ${lang.charAt(0).toUpperCase() + lang.slice(1)}`));
    }
    
    setActiveFilters(filters);
    setCurrentFilters(initialFilters);
    setSortBy(initialFilters.sortBy || "");
  }, [initialFilters]);

  const handleSortChange = useCallback((value: string) => {
    setSortBy(value);
    updateFilters({ sortBy: value });
  }, [updateFilters]);

  const handleLocationApply = useCallback(() => {
    const locationObj = {
      city: locationCity || undefined,
      state: locationState || undefined,
      country: locationCountry || undefined,
    };
    
    const locationStr = formatLocationString(locationCity, locationState, locationCountry);
    
    setActiveFilters(prev => {
      const filtered = prev.filter(f => !f.startsWith('📍'));
      if (locationStr) {
        return [...filtered, `📍 ${locationStr}`];
      }
      return filtered;
    });
    
    updateFilters({ 
      location: (locationCity || locationState || locationCountry) ? locationObj : undefined 
    });
  }, [locationCity, locationState, locationCountry, updateFilters]);

  const handleJobIdChange = useCallback((jobId: string) => {
    setJobIdInput(jobId);
    setActiveFilters(prev => {
      const filtered = prev.filter(f => !f.startsWith('🆔'));
      if (jobId.trim()) {
        return [...filtered, `🆔 ID: ${jobId}`];
      }
      return filtered;
    });
    updateFilters({ jobId: jobId || undefined });
  }, [updateFilters]);

  const handleCategoryToggle = useCallback((category: string, checked: boolean) => {
    setSelectedCategories(prev => {
      const updated = checked ? [...prev, category] : prev.filter(c => c !== category);
      setActiveFilters(prevFilters => {
        const filtered = prevFilters.filter(f => !categoryOptions.includes(f));
        return [...filtered, ...updated];
      });
      updateFilters({ category: updated.length > 0 ? updated : undefined });
      return updated;
    });
  }, [categoryOptions, updateFilters]);

  const handleSkillToggle = useCallback((skill: string, checked: boolean) => {
    setSelectedSkills(prev => {
      const updated = checked ? [...prev, skill] : prev.filter(s => s !== skill);
      setActiveFilters(prevFilters => {
        const filtered = prevFilters.filter(f => !skillOptions.includes(f));
        return [...filtered, ...updated];
      });
      updateFilters({ skills: updated.length > 0 ? updated : undefined });
      return updated;
    });
  }, [skillOptions, updateFilters]);

  const handleExperienceChange = useCallback((experience: string) => {
    setSelectedExperience(experience);
    setActiveFilters(prev => {
      const filtered = prev.filter(f => {
        if (!f.startsWith('💼')) return true;
        const isExpLabel = experienceOptions.some(e => `💼 ${e.label}` === f);
        return !isExpLabel;
      });
      const expLabel = experienceOptions.find(e => e.value === experience)?.label;
      if (expLabel) {
        return [...filtered, `💼 ${expLabel}`];
      }
      return filtered;
    });
    updateFilters({ experience: experience || undefined });
  }, [updateFilters]);

  const handleJobTypeChange = useCallback((jobType: string) => {
    setSelectedJobType(jobType);
    setActiveFilters(prev => {
      const filtered = prev.filter(f => !jobTypeOptions.includes(f.replace('💼 ', '')));
      if (jobType) {
        return [...filtered, `💼 ${jobType}`];
      }
      return filtered;
    });
    updateFilters({ jobType: jobType || undefined });
  }, [jobTypeOptions, updateFilters]);

  const handleLanguageToggle = useCallback((language: string, checked: boolean) => {
    setSelectedLanguages(prev => {
      const updated = checked ? [...prev, language] : prev.filter(l => l !== language);
      setActiveFilters(prevFilters => {
        const filtered = prevFilters.filter(f => !f.startsWith('🌐'));
        return [...filtered, ...updated.map(l => `🌐 ${l.charAt(0).toUpperCase() + l.slice(1)}`)];
      });
      updateFilters({ languages: updated.length > 0 ? updated : undefined });
      return updated;
    });
  }, [updateFilters]);

  const removeFilter = useCallback((filterToRemove: string) => {
    setActiveFilters(prev => prev.filter(filter => filter !== filterToRemove));
    
    // Update states and calculate new filters
    if (filterToRemove.startsWith('📍')) {
      setLocationCity("");
      setLocationState("");
      setLocationCountry("");
      const newFilters: any = { ...currentFilters };
      delete newFilters.location;
      setCurrentFilters(newFilters);
      onFiltersChange?.(newFilters);
    } else if (filterToRemove.startsWith('🆔')) {
      setJobIdInput("");
      const newFilters: any = { ...currentFilters };
      delete newFilters.jobId;
      setCurrentFilters(newFilters);
      onFiltersChange?.(newFilters);
    } else if (filterToRemove.startsWith('💼')) {
      const expLabel = experienceOptions.find(e => `💼 ${e.label}` === filterToRemove)?.value;
      const isJobType = jobTypeOptions.some(jt => `💼 ${jt}` === filterToRemove);
      
      if (expLabel) {
        setSelectedExperience("");
        const newFilters: any = { ...currentFilters };
        delete newFilters.experience;
        setCurrentFilters(newFilters);
        onFiltersChange?.(newFilters);
      } else if (isJobType) {
        setSelectedJobType("");
        const newFilters: any = { ...currentFilters };
        delete newFilters.jobType;
        setCurrentFilters(newFilters);
        onFiltersChange?.(newFilters);
      }
    } else if (filterToRemove.startsWith('🌐')) {
      const language = filterToRemove.replace('🌐 ', '').toLowerCase();
      setSelectedLanguages(prev => {
        const remaining = prev.filter(l => l !== language);
        const newFilters: any = { ...currentFilters };
        newFilters.languages = remaining.length > 0 ? remaining : undefined;
        setCurrentFilters(newFilters);
        onFiltersChange?.(newFilters);
        return remaining;
      });
    } else if (categoryOptions.includes(filterToRemove)) {
      setSelectedCategories(prev => {
        const remaining = prev.filter(c => c !== filterToRemove);
        const newFilters: any = { ...currentFilters };
        newFilters.category = remaining.length > 0 ? remaining : undefined;
        setCurrentFilters(newFilters);
        onFiltersChange?.(newFilters);
        return remaining;
      });
    } else if (skillOptions.includes(filterToRemove)) {
      setSelectedSkills(prev => {
        const remaining = prev.filter(s => s !== filterToRemove);
        const newFilters: any = { ...currentFilters };
        newFilters.skills = remaining.length > 0 ? remaining : undefined;
        setCurrentFilters(newFilters);
        onFiltersChange?.(newFilters);
        return remaining;
      });
    }
  }, [categoryOptions, skillOptions, currentFilters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    setActiveFilters([]); setSortBy(""); setSelectedCategories([]); setSelectedSkills([]);
    setLocationCity(""); setLocationState(""); setLocationCountry(""); setJobIdInput("");
    setSelectedExperience(""); setSelectedJobType(""); setSelectedLanguages([]);
    setCurrentFilters({}); onFiltersChange?.({});
  }, [onFiltersChange]);

  useEffect(() => {
    if (cityInput.length >= 2) {
      setFilteredCities(availableCities.filter(c => c.toLowerCase().includes(cityInput.toLowerCase())).slice(0, 10));
    } else {
      setFilteredCities([]);
    }
  }, [cityInput, availableCities]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h2 className="text-lg font-semibold">Active Filters</h2>
          {(activeFilters.length > 0 || sortBy) && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
              Clear All
            </Button>
          )}
        </div>
        {(activeFilters.length > 0 || sortBy) && (
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
            {sortBy && (<Badge variant="secondary" className="rounded-full px-3 py-1"><ArrowUpDown className="w-3 h-3 mr-1" />{sortOptions.find(o => o.value === sortBy)?.label}</Badge>)}
            {activeFilters.map((filter, index) => (
              <Badge key={`filter-${index}-${filter}`} variant="secondary" className="rounded-full px-3 py-1 gap-1">
                <span>{filter}</span><X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter(filter)} />
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-40 rounded-xl">
              <div className="flex items-center"><ArrowUpDown className="w-4 h-4 mr-2" /><SelectValue placeholder="Sort by" /></div>
            </SelectTrigger>
            <SelectContent>{sortOptions.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Input placeholder="Search by Job ID" value={jobIdInput} onChange={(e) => handleJobIdChange(e.target.value)} className="pl-8 rounded-xl" />
            <Hash className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            {jobIdInput && (<Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6" onClick={() => handleJobIdChange('')}><X className="w-3 h-3" /></Button>)}
          </div>
        </div>
        <div className="space-y-3">
          <Collapsible open={categoryOpen} onOpenChange={setCategoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-xl justify-between" disabled={filtersLoading || categoryOptions.length === 0}>
                <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2" />Category {selectedCategories.length > 0 && `(${selectedCategories.length})`}</div>
                <ChevronDown className={`w-4 h-4 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-xl p-3 max-h-64 overflow-y-auto bg-background">
                <div className="grid grid-cols-1 gap-2">
                  {categoryOptions.map((option) => (<div key={option} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <Checkbox id={`category-${option}`} checked={selectedCategories.includes(option)} onCheckedChange={(checked) => handleCategoryToggle(option, checked as boolean)} className="flex-shrink-0 h-5 w-5" />
                    <label htmlFor={`category-${option}`} className="text-sm font-medium leading-none cursor-pointer flex-1 text-foreground select-none">{option}</label>
                  </div>))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={skillsOpen} onOpenChange={setSkillsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-xl justify-between" disabled={filtersLoading || skillOptions.length === 0}>
                <div className="flex items-center"><Tag className="w-4 h-4 mr-2" />Skills {selectedSkills.length > 0 && `(${selectedSkills.length})`}</div>
                <ChevronDown className={`w-4 h-4 transition-transform ${skillsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-xl p-3 max-h-64 overflow-y-auto bg-background">
                <div className="grid grid-cols-1 gap-2">
                  {skillOptions.map((option) => (<div key={option} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <Checkbox id={`skills-${option}`} checked={selectedSkills.includes(option)} onCheckedChange={(checked) => handleSkillToggle(option, checked as boolean)} className="flex-shrink-0 h-5 w-5" />
                    <label htmlFor={`skills-${option}`} className="text-sm font-medium leading-none cursor-pointer flex-1 text-foreground select-none">{option}</label>
                  </div>))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={locationOpen} onOpenChange={setLocationOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-xl justify-between">
                <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" />Location</div>
                <ChevronDown className={`w-4 h-4 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-xl p-4 bg-background space-y-3">
                <div className="space-y-2"><label className="text-sm font-medium">City</label>
                  <div className="relative"><Input placeholder="Enter city name" value={cityInput || locationCity} onChange={(e) => { setCityInput(e.target.value); setLocationCity(e.target.value); }} className="rounded-xl" />
                    {filteredCities.length > 0 && cityInput && (<div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredCities.map((city) => (<button key={city} className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50" onClick={() => { setLocationCity(city); setCityInput(""); setFilteredCities([]); }}>{city}</button>))}
                    </div>)}
                  </div>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">State</label>
                  <Select value={locationState} onValueChange={setLocationState}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">{availableStates.map((state) => (<SelectItem key={state} value={state}>{state}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Country</label>
                  <Select value={locationCountry} onValueChange={setLocationCountry}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>{availableCountries.map((country) => (<SelectItem key={country} value={country}>{country}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <Button onClick={handleLocationApply} className="w-full rounded-xl" size="sm">Apply Location Filter</Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={experienceOpen} onOpenChange={setExperienceOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-xl justify-between">
                <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2" />Experience {selectedExperience && `(${experienceOptions.find(e => e.value === selectedExperience)?.label})`}</div>
                <ChevronDown className={`w-4 h-4 transition-transform ${experienceOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-xl p-3 bg-background space-y-2">
                {experienceOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedExperience === option.value ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start rounded-xl"
                    onClick={() => handleExperienceChange(selectedExperience === option.value ? "" : option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={jobTypeOpen} onOpenChange={setJobTypeOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-xl justify-between" disabled={filtersLoading || jobTypeOptions.length === 0}>
                <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2" />Job Type {selectedJobType && `(${selectedJobType})`}</div>
                <ChevronDown className={`w-4 h-4 transition-transform ${jobTypeOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-xl p-3 bg-background space-y-2">
                {jobTypeOptions.map((option) => (
                  <Button
                    key={option}
                    variant={selectedJobType === option ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start rounded-xl"
                    onClick={() => handleJobTypeChange(selectedJobType === option ? "" : option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={languagesOpen} onOpenChange={setLanguagesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-xl justify-between" disabled={filtersLoading || languageOptions.length === 0}>
                <div className="flex items-center"><Globe className="w-4 h-4 mr-2" />Languages {selectedLanguages.length > 0 && `(${selectedLanguages.length})`}</div>
                <ChevronDown className={`w-4 h-4 transition-transform ${languagesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-border rounded-xl p-3 max-h-64 overflow-y-auto bg-background">
                <div className="grid grid-cols-1 gap-2">
                  {languageOptions.map((option) => (<div key={option} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <Checkbox id={`language-${option}`} checked={selectedLanguages.includes(option)} onCheckedChange={(checked) => handleLanguageToggle(option, checked as boolean)} className="flex-shrink-0 h-5 w-5" />
                    <label htmlFor={`language-${option}`} className="text-sm font-medium leading-none cursor-pointer flex-1 text-foreground select-none capitalize">{option}</label>
                  </div>))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
