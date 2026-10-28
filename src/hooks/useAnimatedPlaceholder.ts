import { useState, useEffect } from "react";

export const useAnimatedPlaceholder = (placeholders: string[], typingSpeed: number = 100) => {
  const [currentText, setCurrentText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (placeholders.length === 0) return;

    const currentPhrase = placeholders[currentIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (currentText.length < currentPhrase.length) {
          setCurrentText(currentPhrase.slice(0, currentText.length + 1));
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (currentText.length > 0) {
          setCurrentText(currentText.slice(0, -1));
        } else {
          // Move to next phrase
          setIsDeleting(false);
          setCurrentIndex((prev) => (prev + 1) % placeholders.length);
        }
      }
    }, isDeleting ? typingSpeed / 2 : typingSpeed);

    return () => clearTimeout(timeout);
  }, [currentText, currentIndex, isDeleting, placeholders, typingSpeed]);

  return currentText || placeholders[0];
};

export const searchPlaceholders = [
  "Search jobs, companies...",
  "Find Workly India opportunities...",
  "Discover remote jobs...",
  "Search for video editing roles...",
  "Look for photo editing jobs...",
  "Find content writing positions...",
  "Search digital marketing jobs...",
  "Explore software developer roles...",
  "Find customer service jobs...",
  "Search data entry positions..."
];

export const companySearchPlaceholders = [
  "Search companies by name, industry...",
  "Find technology companies...",
  "Discover marketing agencies...",
  "Search healthcare providers...",
  "Explore finance companies...",
  "Find IT consulting firms...",
  "Search remote-first companies...",
  "Discover verified employers...",
  "Find companies in your city...",
  "Search by company size..."
];

export const domainSearchPlaceholders = [
  "Search your company name...",
  "Find a .com for your brand...",
  "Try worklyindia.in...",
  "Search a short business name...",
  "Find a domain for your startup...",
  "Check .in, .com, .online availability...",
  "Search your shop or store name...",
  "Find a domain for your portfolio..."
];
