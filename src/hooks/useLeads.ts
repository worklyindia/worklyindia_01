import { useState, useEffect } from 'react';
import { Lead, LeadFilters } from '@/types/leads';

// Mock data - will be replaced with Supabase queries
const mockLeads: Lead[] = [
  {
    id: 1,
    name: "राहुल शर्मा",
    email: "r****@email.com",
    phone: "+91 98765 ****",
    position: "Software Developer",
    experience: "3 years",
    location: "Mumbai, Maharashtra",
    appliedDate: "2024-01-15",
    status: "Fresh",
    skills: ["React", "Node.js", "MongoDB"],
    expectedSalary: "₹8,00,000",
    currentCompany: "TCS",
    education: "B.Tech Computer Science",
    price: 500,
    rating: 4.5,
    verified: true,
    purchased: false,
    jobId: "job_123",
    fullData: {
      email: "rahul.sharma@email.com",
      phone: "+91 98765 43210"
    }
  },
  {
    id: 2,
    name: "प्रिया पटेल",
    email: "p****@email.com", 
    phone: "+91 87654 ****",
    position: "Digital Marketing Manager",
    experience: "5 years",
    location: "Delhi, NCR",
    appliedDate: "2024-01-14",
    status: "Hot",
    skills: ["SEO", "SEM", "Social Media"],
    expectedSalary: "₹12,00,000",
    currentCompany: "Wipro",
    education: "MBA Marketing",
    price: 750,
    rating: 4.8,
    verified: true,
    purchased: false,
    jobId: "job_124",
    fullData: {
      email: "priya.patel@email.com",
      phone: "+91 87654 32109"
    }
  },
  {
    id: 3,
    name: "अमित कुमार",
    email: "a****@email.com",
    phone: "+91 76543 ****",
    position: "Data Analyst", 
    experience: "2 years",
    location: "Bangalore, Karnataka",
    appliedDate: "2024-01-13",
    status: "Warm",
    skills: ["Python", "SQL", "Tableau"],
    expectedSalary: "₹6,00,000",
    currentCompany: "Infosys",
    education: "B.Sc Statistics",
    price: 400,
    rating: 4.2,
    verified: false,
    purchased: true,
    jobId: "job_125",
    fullData: {
      email: "amit.kumar@email.com",
      phone: "+91 76543 21098"
    }
  }
];

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [loading, setLoading] = useState(false);
  const [purchasedLeads, setPurchasedLeads] = useState<number[]>([3]);

  // TODO: Replace with Supabase queries when connected
  const fetchLeads = async (filters?: LeadFilters) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      let filteredLeads = [...mockLeads];
      
      if (filters) {
        if (filters.status && filters.status !== 'all') {
          filteredLeads = filteredLeads.filter(lead => 
            lead.status.toLowerCase() === filters.status.toLowerCase()
          );
        }
        // Add more filtering logic as needed
      }
      
      setLeads(filteredLeads);
      setLoading(false);
    }, 500);
  };

  const purchaseLead = async (leadId: number) => {
    // TODO: Implement wallet deduction and lead purchase logic with Supabase
    setPurchasedLeads(prev => [...prev, leadId]);
    
    // Update lead status
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, purchased: true } : lead
    ));
  };

  const isLeadPurchased = (leadId: number) => {
    return purchasedLeads.includes(leadId);
  };

  const updateLeadStatus = async (leadId: number, status: Lead['status']) => {
    // TODO: Update in Supabase
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, status } : lead
    ));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return {
    leads,
    loading,
    purchasedLeads,
    fetchLeads,
    purchaseLead,
    isLeadPurchased,
    updateLeadStatus
  };
};